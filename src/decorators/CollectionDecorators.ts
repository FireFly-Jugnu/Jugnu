import 'reflect-metadata';

export function FirebaseCollection(target: Function){
    Reflect.defineMetadata("CollectionName", target.name, target);
}

export function DocumentKey(target: any, propertyKey: string) {
    Reflect.defineMetadata("DocumentKeyField", propertyKey, target.constructor);
    _registerDocumentField(target, propertyKey);
}

export function DocumentField(target: any, propertyKey: string) {
    _registerDocumentField(target, propertyKey);
}

export function StorageFile(target: any, propertyKey: string) {
    _registerStorageFileField(target, propertyKey);
    //_registerDocumentField(target, propertyKey);
}

function _registerDocumentField(target: any, propertyKey: string) {
    const properties: String[] = Reflect.getMetadata("DocumentField", target.constructor);
    properties? properties.push(propertyKey) : Reflect.defineMetadata("DocumentField", [propertyKey], target.constructor);
}

function _registerStorageFileField(target: any, propertyKey: string) {
    const properties: String[] = Reflect.getMetadata("StorageFile", target.constructor);
    properties? properties.push(propertyKey) : Reflect.defineMetadata("StorageFile", [propertyKey], target.constructor);
}