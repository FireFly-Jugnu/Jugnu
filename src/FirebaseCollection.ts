import 'reflect-metadata';
import { CollectionMetaData, DocumentKeyType, FirebaseQueryCondition, SystemAdminData, EventName } from "./Types";
import {config, firebaseAdmin, pubSubClient} from './Global';
import { v4 as uuidv4 } from 'uuid';

export class FirebaseCollection<T>{

    entity: T;
    firestore = firebaseAdmin.firestore();

    constructor(entity: T){
        this.entity = entity;
    }

    async create(data: any): Promise<string> {

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        
        // Prepare data for CRUD.
        let docuData = await this._prepareDataForCRUD(data, this.entity);
        
        // Set value of auto increment fields
        let autoIncrementFields: string[] = Reflect.getMetadata("AutoIncrementFields", this.entity);
        autoIncrementFields = autoIncrementFields? autoIncrementFields: [];
        for await (const prop of autoIncrementFields) {
            const nextNo = await this._getNextCounter(collectionName + "__" + prop);
            docuData[prop] = nextNo;
        }
        
        // System Admin Data
        const FieldValue = firebaseAdmin.firestore.FieldValue;
        const sysAdminDataField = Reflect.getMetadata("SystemAdminData", this.entity);
        if(sysAdminDataField){
            const sysAdminData: SystemAdminData = {};
            sysAdminData.createdAt = sysAdminData.lastChangedAt = new Date();
            docuData[sysAdminDataField] = sysAdminData;
        }

        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const keyType = Reflect.getMetadata("DocumentKeyType",this.entity);

        let dataId: string = "";

        switch (keyType) {
            case DocumentKeyType.UserDefined:
                dataId = data[keyField];
                await this.firestore.collection(collectionName).doc(dataId).set(Object.assign({}, docuData));
                break;
        
            case DocumentKeyType.GeneratedKey:
                const docRef = this.firestore.collection(collectionName).doc();
                dataId = docuData[keyField] = docRef.id;
                await docRef.set(Object.assign({}, docuData));
                break;

            case DocumentKeyType.UUIDKey:
                dataId = uuidv4();
                docuData[keyField] = dataId;
                await this.firestore.collection(collectionName).doc(dataId).set(Object.assign({}, docuData));
                break;

            case DocumentKeyType.AutoIncrement:
                dataId = (await this._getNextCounter(collectionName)).toString();
                docuData[keyField] = dataId;
                await this.firestore.collection(collectionName).doc(dataId).set(Object.assign({}, docuData));
                break;
        }

        // Publish Event
        await this._publishEvent(EventName.OnCreate, dataId);

        return dataId;
    }

    async query<T>(filterConditions: FirebaseQueryCondition[]): Promise<T[]>{

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);        
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const keyType = Reflect.getMetadata("DocumentKeyType",this.entity);
        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);

        const docs: T[] = [];
        var collRef = this.firestore.collection(collectionName);

        filterConditions.forEach(filterCondition => {

            const t = filterCondition.referenceCollection;
            if(t){
                const refData = this.firestore.collection(t).doc(filterCondition.value);
                collRef = collRef.where(filterCondition.field, filterCondition.condition, refData);
            }
            else{
                collRef = collRef.where(filterCondition.field, filterCondition.condition, filterCondition.value);
            }
        });
        
        
        const query = await collRef.get();
        for (const doc of query.docs) {

            let docData: any = doc.data();
            if (keyType === DocumentKeyType.GeneratedKey || keyType === DocumentKeyType.AutoIncrement) {
                docData[keyField] = doc.id;
            }
            
            for await (const prop of properties) {
                if(docData[prop] && docData[prop].constructor.name === 'DocumentReference'){
                    const ref = await docData[prop].get();
                    docData[prop] = ref.data();
                }
            };

            docs.push(docData);
        }

        return docs;
    }

    async getDocument<T>(docKey: string | number): Promise<T>{

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const keyType = Reflect.getMetadata("DocumentKeyType",this.entity);

        const docRef = await this.firestore.collection(collectionName).doc(docKey).get();
        let docData: any = docRef.data();
        
        if(!docData){
            return docData as T;
        }

        if (keyType === DocumentKeyType.GeneratedKey || keyType === DocumentKeyType.AutoIncrement) {
            docData[keyField] = docRef.id;
        }

        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        for await (const prop of properties) {
            if(docData[prop] && docData[prop].constructor.name === 'DocumentReference'){
                
                //const refCollName = docData[prop].parent.id;
                //console.log("Ref Coll Name", refCollName);
                const ref = await docData[prop].get();
                docData[prop] = ref.data();
            }
        };

        return docData as T;
    }

    async update(data: any){

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);

        // Prepare data for CRUD.
        let docuData = await this._prepareDataForCRUD(data, this.entity);

        // System Admin Data
        const FieldValue = firebaseAdmin.firestore.FieldValue;
        const sysAdminDataField = Reflect.getMetadata("SystemAdminData", this.entity);
        if(sysAdminDataField){
            const sysAdminData: SystemAdminData = data[sysAdminDataField];
            sysAdminData.lastChangedAt = new Date();
            docuData[sysAdminDataField] = sysAdminData;
        }

        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);

        const dataId = data[keyField];
        const updateRef = this.firestore.collection(collectionName).doc(dataId);
        await updateRef.update(docuData);

        // Publish Event
        await this._publishEvent(EventName.OnUpdate, dataId);
    }

    async delete(data: any){
        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const id = data[keyField];
        await this.firestore.collection(collectionName).doc(id).delete();
        // Publish Event
        await this._publishEvent(EventName.OnDelete, id);
    }

    getReference(data: any){
        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const id = data[keyField];
        const docRef = this.firestore.doc(collectionName + '/' + id);
        return docRef;
    }

    async _uploadFile(storageFile: any){
        const storage = firebaseAdmin.storage();
        const bucket = storage.bucket(config.defaultBucket);
        const bucketFile = bucket.file("uploads/" + storageFile.name);
        await bucketFile.save(Buffer.from(storageFile.uri));
        await bucketFile.setMetadata({});
        return bucketFile;
    }

    _pick(o: any, props:string[]) {
        return Object.assign({}, ...props.map(prop => ({[prop]: o[prop]})));
    }

    async _getNextCounter(collName: string): Promise<number>{

        const FieldValue = firebaseAdmin.firestore.FieldValue;
        const sq = this.firestore.collection("JugnuSettings").doc("Counters");
        const sc = await sq.get();
        let nextCounter = 0;

        if (sc.data()) {
            if (sc.data()[collName]) {
                nextCounter = sc.data()[collName] + 1;
                const cupd: any = {};
                cupd[collName] = FieldValue.increment(1);
                await sq.update(cupd);
            }
            else{
                const counterUpdate: any = {};
                counterUpdate[collName] = 1;
                await sq.update(counterUpdate);
                nextCounter = 1;
            }
        }
        else{
            const counters:any = {};
            counters[collName] = 1;
            await this.firestore.collection('JugnuSettings').doc('Counters').set(counters);
            nextCounter = 1;
        }
        
        return nextCounter;
    }

    async _publishEvent(eventName: EventName, dataId: string){

        const topicId = Reflect.getMetadata(eventName,this.entity);
        if(!topicId){
            return;
        }

        const projectName = process.env.GOOGLE_CLOUD_PROJECT;
        const topicName = "projects/" + projectName + "/topics/" + topicId;

        const [topics] = await pubSubClient.getTopics();
        const topic = topics.find((topic: any) => topic.name === topicName);
        if(topic){
            // Topic already exists
            console.log(`Topic ${topic.name} already exists`);
        }
        else{
            // Topic does not exist.
            console.log(`New topic with name ${topicName} will be created`);
            await pubSubClient.createTopic(topicName);
        }

        // Now publish
        const dataBuffer = Buffer.from(JSON.stringify({dataId: dataId}));
        const messageId = await pubSubClient.topic(topicName).publish(dataBuffer);
        console.log("Message published:", messageId);
        return messageId;

    }

    async _prepareDataForCRUD(data: any, entityName: any) {

        let properties: string[] = Reflect.getMetadata("DocumentField", entityName);
        console.log(`Processing properties of ${entityName.name}. Property list: `, properties);
        
        const docuData:any = this._pick(data, properties);

        for await (const prop of properties) {
            
            const t = Reflect.getMetadata("design:type", data, prop);
            console.log(prop, t);
            if(t.name === 'Array'){

                const itemType = Reflect.getMetadata("design:ArrayType", data, prop);
                if(itemType){
                    let tempData = [];
                    let cn = Reflect.getMetadata("CollectionName",itemType);
                    //console.log("Type of Array", cn);
                    if(cn){
                        let refKeyField = Reflect.getMetadata("DocumentKeyField",itemType);
                        for await (const arrayItem of data[prop]) {
                            const refKey = arrayItem[refKeyField];
                            const docRef = this.firestore.doc(cn + '/' + refKey);
                            tempData.push(docRef);
                        }
                    }
                    else{
                        for await (const arrayItem of data[prop]) {
                            tempData.push(await this._prepareDataForCRUD(arrayItem, itemType));
                        }    
                    }
                    //console.log("Temp data", tempData);
                    docuData[prop] = tempData;
                }
            }
            else{
                // Not an array.
                if(t){
                    let cn = Reflect.getMetadata("CollectionName",t);
                    if(cn){
                        let refKeyField = Reflect.getMetadata("DocumentKeyField",t);
                        const refData = data[prop];
                        if(refData){
                            const refKey = refData[refKeyField];
                            const docRef = this.firestore.doc(cn + '/' + refKey);
                            docuData[prop] = docRef;
                        }
                    }
                    else{
                        // This is not a collection. Just check if this object has any properties.
                        if (typeof data[prop] === 'object') {
                            let objProperties: string[] = Reflect.getMetadata("DocumentField", t);
                            if(objProperties){
                                // We get some properties.
                                docuData[prop] = await this._prepareDataForCRUD(data[prop], t);
                            }
                            else{
                                //console.log("Skipping for ", prop);
                            }
                        }
                    }
                }
            }
        };

        // Process the Storage File Properties.
        properties = Reflect.getMetadata("StorageFile", entityName);
        if(properties){
            for (const prop of properties) {
                const storageFile = data[prop];
                if(storageFile){
                    if (Array.isArray(storageFile)) {
                        docuData[prop] = [];
                        for await (const file of storageFile) {
                            const bucketFile = await this._uploadFile(file);
                            docuData[prop].push({name: file.name, file: bucketFile.publicUrl()});
                        }
                    }
                    else{
                        const bucketFile = await this._uploadFile(storageFile);
                        docuData[prop] = {name: storageFile.name, file: bucketFile.publicUrl()};
                    }
                }
            }
        }

        return docuData;
    }

    async testCreate(data: any){

        let docuData = await this._prepareDataForCRUD(data, this.entity);
        return docuData;
    }

    async test(data: any){

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        console.log("Collection Name:", collectionName);
        console.log("Metadata keys:", Reflect.getMetadataKeys(this.entity));

        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        console.log("DocumentField List:", properties);

        properties.forEach(prop => {
            //type propType = T[prop];
            console.log("-----------------------");
            let t = Reflect.getMetadata("design:type", data, prop);
            t? console.log(`${prop} type: ${t.name}`) : console.log("Cant read metadata for", prop);
            if(t){
                if (t.name === 'Array') {
                    let t1 = Reflect.getMetadata("design:ArrayType", data, prop);
                    t1? console.log(`${prop} ArrayType : ${t1.name}`) : console.log("Cant read metadata for array object", prop);
                }
                let cn = Reflect.getMetadata("CollectionName",t);
                cn? console.log(`Collection name of : ${t.name} is ${cn}`): console.log(`Cant read collection name for ${t.name}`);
            }

            if (typeof data[prop] === 'object') {
                if (Object.keys(data[prop])) {
                    console.log(`Property  ${prop} has keys`);
                }
                let objProperties: string[] = Reflect.getMetadata("DocumentField", t);
                console.log("Obj Properties ", objProperties);
            }
        });

        console.log("====================");
        properties = Reflect.getMetadata("StorageFile", this.entity);
        properties = properties? properties : [];
        console.log("StorageFile List:", properties);
        properties.forEach(prop => {
            //type propType = T[prop];
            const t = Reflect.getMetadata("design:type", data, prop);
            t? console.log(`${prop} type: ${t.name}`) : console.log("Cant read metadata for", prop);
            if(t){
                let cn = Reflect.getMetadata("CollectionName",t);
                cn? console.log(`Collection name of : ${t.name} is ${cn}`): cn = undefined;
            }
        });
    }

}