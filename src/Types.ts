export interface FirebaseEntity{
    id: String;
}

export interface StorageFile{
    name: String,
    uri: String
}

export interface FirebaseQueryCondition{
    field: String,
    condition: String,
    value: String
}

export interface JugnuConfig{
    defaultBucket?: String
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