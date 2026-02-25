const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Service account (Step 328'deki path mantığı)
const possiblePaths = [
    path.join(__dirname, '../../studyo-live-2026-firebase-adminsdk.json'),
    path.join(__dirname, '../studyo-live-2026-firebase-adminsdk.json'),
    path.join(__dirname, '../../../studyo-live-2026-firebase-adminsdk.json')
];
const serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));

if (!serviceAccountPath) {
    console.error('Service account not found');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

async function check() {
    console.log('Checking archives...');
    const snapshot = await db.collection('archives').limit(5).get();

    snapshot.forEach(doc => {
        console.log(`ID: ${doc.id}`);
        console.log(`Data: `, JSON.stringify(doc.data(), null, 2));
        console.log('---');
    });
}

check();
