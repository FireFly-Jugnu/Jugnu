import 'reflect-metadata';
import { CollectionMetaData, FirebaseQueryCondition } from "./Types";
import {config, firebaseAdmin} from './Global';
import { Jugnu } from './Jugnu';

export class FirebaseCollection<T>{

    entity: T;
    firestore = firebaseAdmin.firestore();

    constructor(entity: T){
        this.entity = entity;
    }

    async create(data: any){
        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const keyField: string = Reflect.getMetadata("DocumentKeyField",this.entity);
        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        const id = data[keyField];
        const docuData:any = this._pick(data, properties);
        properties.forEach(prop => {
            const t = Reflect.getMetadata("design:type", data, prop);
            if(t){
                let cn = Reflect.getMetadata("CollectionName",t);
                if(cn){
                    let refKeyField = Reflect.getMetadata("DocumentKeyField",t);
                    const refData = data[prop];
                    const refKey = refData[refKeyField];
                    const docRef = this.firestore.doc(cn + '/' + refKey);
                    docuData[prop] = docRef;
                }
            }
        });

        properties = Reflect.getMetadata("StorageFile", this.entity);
        if(properties){
            for (const prop of properties) {
                const storageFile = data[prop];
                const bucketFile = await this._uploadFile(storageFile);
                docuData[prop] = bucketFile.publicUrl();
            }
        }
                        
        await this.firestore.collection(collectionName).doc(id).set(Object.assign({}, docuData));
    }

    async query<T>(filterConditions: FirebaseQueryCondition[]): Promise<T[]>{

        const collectionName = Reflect.getMetadata("CollectionName",this.entity);
        const docs: T[] = [];
        var collRef = this.firestore.collection(collectionName);

        filterConditions.forEach(filterCondition => {
            collRef = collRef.where(filterCondition.field, filterCondition.condition, filterCondition.value);
        });
        
        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);

        const query = await collRef.get();
        for (const doc of query.docs) {

            let docData: any = doc.data();
            
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
        const docRef = await this.firestore.collection(collectionName).doc(docKey).get();
        let docData: any = docRef.data();

        let properties: string[] = Reflect.getMetadata("DocumentField", this.entity);
        for await (const prop of properties) {
            if(docData[prop] && docData[prop].constructor.name === 'DocumentReference'){
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