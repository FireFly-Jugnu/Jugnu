import * as HF from './HelperFunctions';
import * as MyTypes from './Types';
import * as G from './Global';

export namespace jugnu {
    export import createFirebaseCollection = HF.createFirebaseCollection;
    export import initialize = HF.initialize;
    export import firebaseAdmin = G.firebaseAdmin;
    export import Types = MyTypes;
}

import {
    FirebaseCollection, 
    DocumentField,
    DocumentKey,
    DocumentArrayField,
    StorageFile,
    AutoIncrement,
    SystemAdminData,
    PublishEvent
} from './decorators/CollectionDecorators';

export {
    FirebaseCollection,
    DocumentField,
    DocumentKey,
    DocumentArrayField,
    StorageFile,
    AutoIncrement,
    SystemAdminData,
    PublishEvent
}