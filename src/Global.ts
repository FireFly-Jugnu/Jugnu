import { JugnuConfig } from "./Types";

// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');

export const firebaseAdmin = require('firebase-admin');
export const config: JugnuConfig = {};

// Creates a client; cache this for further use
export const pubSubClient = new PubSub();