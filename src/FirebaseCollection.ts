import 'reflect-metadata';
import { CollectionMetaData, DocumentKeyType, FirebaseQueryCondition, SystemAdminData } from "./Types";
import {config, firebaseAdmin} from './Global';
import { Jugnu } from './Jugnu';

export class FirebaseCollection<T>{

    entity: T;
    firestore = firebaseAdmin.firestore();

    constructor(entity: T){
        this.entity = entity;
    }

    async create(data: any): Promise<string> {
        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        const docuData:any = this._pick(data, properties);
        properties.forEach(prop => {
            const t = Reflect.getMetadata("design:type", data, prop);
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
            }
        });

        properties = Reflect.getMetadata("StorageFile", this.entity);
        if(properties){
            for (const prop of properties) {
                const storageFile = data[prop];
                if(storageFile){
                    const bucketFile = await this._uploadFile(storageFile);
                    docuData[prop] = bucketFile.publicUrl();
                }
            }
        }

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
            sysAdminData.createdAt = sysAdminData.changedAt = new Date();
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

            case DocumentKeyType.AutoIncrement:
                dataId = (await this._getNextCounter(collectionName)).toString();
                docuData[keyField] = dataId;
                await this.firestore.collection(collectionName).doc(dataId).set(Object.assign({}, docuData));
                break;
        }

        return dataId;
    }

    async query<T>(filterConditions: FirebaseQueryCondition[]): Promise<T[]>{

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        const keyType = Reflect.getMetadata("DocumentKeyType",this.entity);

        const docs: T[] = [];
        var collRef = this.firestore.collection(collectionName);

        filterConditions.forEach(filterCondition => {
            collRef = collRef.where(filterCondition.field, filterCondition.condition, filterCondition.value);
        });
        
        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);

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

    async delete(data: any){
        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyProperty = "name";
        const id = data[keyProperty];
        await this.firestore.collection(collectionName).doc(id).delete();
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

    async test<T>(data: T){

        const collections: Map<String, CollectionMetaData> = Reflect.getMetadata("Collections", Jugnu);
        console.log("All Collections: ", collections);

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        console.log("Collection name:", collectionName);
        
        console.log("Metadata keys:", Reflect.getMetadataKeys(this.entity));
                
        // const keyField = Reflect.getMetadata("DocumentKeyField",this.entity);
        // console.log("Key Field:", keyField);
        
        const properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        console.log("Propery List:", properties);

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