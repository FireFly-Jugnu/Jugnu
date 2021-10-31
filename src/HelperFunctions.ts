import { FirebaseCollection } from "./FirebaseCollection";
import {config, firebaseAdmin} from './Global';
import { JugnuConfig } from "./Types";

export function initialize(cf: JugnuConfig){
    if (firebaseAdmin.apps.length === 0) {
        firebaseAdmin.initializeApp();
        firebaseAdmin.firestore().settings({ignoreUndefinedProperties: true});
    }
    config.defaultBucket = cf.defaultBucket;
}

export function createFirebaseCollection<T>(e: T): FirebaseCollection<T>{
    return new FirebaseCollection(e);
}