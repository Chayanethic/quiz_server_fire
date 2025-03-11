const admin = require('firebase-admin');

console.log('Initializing Firebase Admin SDK...');


if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error('FIREBASE_PRIVATE_KEY is not defined in environment variables');
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firestore.app`
});

console.log('Firebase Admin SDK initialized successfully');
const db = admin.firestore();
console.log('Firestore accessed successfully');
module.exports = db;