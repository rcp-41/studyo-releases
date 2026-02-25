const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (use your service account key or default app credentials)
const serviceAccountPath = path.resolve(__dirname, 'studyo-live-2026-61327178bf73.json'); // Replace with actual key path
if (fs.existsSync(serviceAccountPath)) {
    console.log('Using service account key for backup');
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
    });
} else {
    console.log('Using application default credentials for backup');
    admin.initializeApp();
}

const db = admin.firestore();

async function exportCollection(collectionRef) {
    const data = {};
    const snapshot = await collectionRef.get();

    for (const doc of snapshot.docs) {
        data[doc.id] = {
            _data: doc.data()
        };

        // Fetch subcollections
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
            data[doc.id]._subcollections = {};
            for (const subcol of subcollections) {
                data[doc.id]._subcollections[subcol.id] = await exportCollection(subcol);
            }
        }
    }
    return data;
}

async function backupFirestore() {
    try {
        console.log('Starting full Firestore backup...');
        const backupData = {};
        const collections = await db.listCollections();

        for (const collection of collections) {
            console.log(`Exporting root collection: ${collection.id}...`);
            backupData[collection.id] = await exportCollection(collection);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, `firestore_backup_${timestamp}.json`);

        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`Backup completed successfully! Saved to: ${backupFile}`);

    } catch (error) {
        console.error('Backup failed:', error);
    }
}

backupFirestore();
