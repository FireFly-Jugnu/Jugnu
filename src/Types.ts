export interface StorageFile{
    name: string,
    uri: string
}

export interface FirebaseQueryCondition{
    field: string,
    condition: string,
    value: string,
    referenceCollection?: string
}

export interface JugnuConfig{
    defaultBucket?: string
}

export interface SystemAdminData{
    createdBy?: any,
    createdAt?: Date,
    lastChangedBy?: any,
    lastChangedAt?: Date
}

export enum DocumentKeyType{
    UserDefined = 0,
    GeneratedKey = 1,
    AutoIncrement = 2,
    UUIDKey = 3
}

export enum EventName {
    OnCreate = "OnCreated",
    OnUpdate = "OnUpdated",
    OnDelete = "OnDeleted"
}

// Not used as of now
export interface FirebaseEntity{
    id: string;
}
export interface FieldMetaData{
    name: string,
    type: string
}
export interface CollectionMetaData{
    keyField?: string,
    documentFields?: FieldMetaData[],
    storageFileField?: string[]
}