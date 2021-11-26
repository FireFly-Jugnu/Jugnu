import 'reflect-metadata';
import { Jugnu } from '../Jugnu';
import { CollectionMetaData, DocumentKeyType, EventName } from '../Types';

export function FirebaseCollection(collName?: string){

    if(collName){
        return function firebaseCollection(target: Function){
            Reflect.defineMetadata("CollectionName", collName, target);
            _addToCollections(target);
        }
    }
    else{
        return function firebaseCollection(target: Function){
            Reflect.defineMetadata("CollectionName", target.name, target);
            _addToCollections(target);
        }
    }
}

export function PublishEvent(event: EventName, topic?: string){

    return function publishEvent(target: Function){

        const topicName = topic? topic : event + "-" + target.name;
        Reflect.defineMetadata(event, topicName, target);
    }
}

export function DocumentKey(docKeyType?: DocumentKeyType){

    const keyType = docKeyType? docKeyType: DocumentKeyType.UserDefined;

    return function documentKey(target: any, propertyKey: string){

        Reflect.defineMetadata("DocumentKeyField", propertyKey, target.constructor);
        Reflect.defineMetadata("DocumentKeyType", keyType, target.constructor);
        
        //const collections: Map<String, CollectionMetaData> = Reflect.getMetadata("Collections", Jugnu);
        //console.log("In DocKey PropKey:", propertyKey);console.log("In DocKey collections:", collections);
        // const metadata = collections.get(propertyKey);
        // if(metadata) metadata.keyField = propertyKey;
        _registerDocumentField(target, propertyKey);

    }
}

export function DocumentField(target: any, propertyKey: string) {
    _registerDocumentField(target, propertyKey);
}

export function DocumentArrayField(arrayType: Function) {
    return function _registerDocumentArrayField(target: any, propertyKey: string) {
        _registerDocumentField(target, propertyKey);
        Reflect.defineMetadata("design:ArrayType", arrayType, target, propertyKey);
    }
}

export function StorageFile(target: any, propertyKey: string) {
    _registerStorageFileField(target, propertyKey);
    //_registerDocumentField(target, propertyKey);
}

export function AutoIncrement(target: any, propertyKey: string) {
    const properties: String[] = Reflect.getMetadata("AutoIncrementFields", target.constructor);
    properties? properties.push(propertyKey) : Reflect.defineMetadata("AutoIncrementFields", [propertyKey], target.constructor);
}

export function SystemAdminData(target: any, propertyKey: string) {
    Reflect.defineMetadata("SystemAdminData", propertyKey, target.constructor);
}

function _registerDocumentField(target: any, propertyKey: string) {
    const properties: String[] = Reflect.getMetadata("DocumentField", target.constructor);
    properties? properties.push(propertyKey) : Reflect.defineMetadata("DocumentField", [propertyKey], target.constructor);
    //const collections: Map<String, CollectionMetaData> = Reflect.getMetadata("Collections", Jugnu);
    //console.log("In Docfield PropKey:", propertyKey);console.log("In Docfield collections:", collections);
    // const metadata = collections.get(propertyKey);
    //console.log(target[propertyKey]);
    // const t = Reflect.getMetadata("design:type", target, propertyKey);
    // console.log(`In Docfield PropKey, type of ${propertyKey} : ${t.name}`);

    // if (t.name === 'Array') {
    //     console.log("Type of t =>", t.constructor.name);
    //     console.log(t.isArray()) // true
    //     //console.log("Type of t => ",typeof(t).GetElementType());   
    // }

    // type a = Array<typeof t>;
    // type ai = a[0];
    // console.log(`Array type:: ${a.}`);
    // console.log("Araay Item type", ai);
    // if(metadata) metadata.documentFields?.push({name: propertyKey, type: t});
}

function _registerStorageFileField(target: any, propertyKey: string) {
    const properties: String[] = Reflect.getMetadata("StorageFile", target.constructor);
    properties? properties.push(propertyKey) : Reflect.defineMetadata("StorageFile", [propertyKey], target.constructor);
}

function _addToCollections(target: Function){
    //*/
    const collections: String[] = Reflect.getMetadata("Collections", Jugnu);
    collections? collections.push(target.name) : Reflect.defineMetadata("Collections", [target.name], Jugnu);
    //*/
    /*/
    const properties: string[] = Reflect.getMetadata("DocumentField", target);
    console.log(`Properties of ${target.name} : ${properties}`);

    console.log(target);
    properties.forEach(prop => {
        const t = Reflect.getMetadata("design:type", target, prop);
        t? console.log(`${prop} type: ${t.name}`) : console.log("Cant read metadata for", prop);
    });

    console.log("Adding collection: ", target.name);
    let collections: Map<String, CollectionMetaData> = Reflect.getMetadata("Collections", Jugnu);
    if(collections){
        collections.set(target.name, {});
    }
    else{
        collections = new Map<String, CollectionMetaData>();
        collections.set(target.name, {});
        Reflect.defineMetadata("Collections", collections, Jugnu);
    }
    //*/
}