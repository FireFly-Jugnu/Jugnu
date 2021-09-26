import * as HF from './HelperFunctions';
import * as MyTypes from './Types';

export namespace jugnu {
    export import createFirebaseCollection = HF.createFirebaseCollection;
    export import initialize = HF.initialize;
    export import Types = MyTypes;
}

import {
    FirebaseCollection, 
    DocumentField,
    DocumentKey,
    StorageFile
} from './decorators/CollectionDecorators';

export {
    FirebaseCollection,
    DocumentField,
    DocumentKey,
    StorageFile
}