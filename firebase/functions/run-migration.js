/**
 * Run migration: copy root-level archives → studios/{studioId}/archives/
 * Uses Firebase Admin SDK directly (not callable functions)
 */
const admin = require('firebase-admin');

// Initialize with production credentials
admin.initializeApp({
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();

async function migrate(targetStudioId) {
    console.log(`\n=== Migrating root data to studio: ${targetStudioId} ===\n`);

    // 1. Check if studio exists
    const studioDoc = await db.collection('studios').doc(targetStudioId).get();
    if (!studioDoc.exists) {
        console.error('Studio not found:', targetStudioId);
        return;
    }
    console.log('Studio found:', studioDoc.data()?.info?.name);

    // 2. Read root-level archives
    const archivesSnap = await db.collection('archives').get();
    console.log(`Found ${archivesSnap.size} root-level archives`);

    if (archivesSnap.empty) {
        console.log('No archives to migrate');
        return;
    }

    // 3. Copy archives to studio subcollection
    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const doc of archivesSnap.docs) {
        const targetRef = db.collection('studios').doc(targetStudioId)
            .collection('archives').doc(doc.id);
        batch.set(targetRef, doc.data(), { merge: true });
        count++;
        total++;

        if (count >= 400) {
            await batch.commit();
            console.log(`  Committed batch of ${count} (total: ${total})`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`  Committed final batch of ${count} (total: ${total})`);
    }

    // 4. Migrate small collections too
    const smallCollections = ['shootTypes', 'locations', 'photographers', 'settings'];
    for (const collName of smallCollections) {
        const snap = await db.collection(collName).get();
        if (!snap.empty) {
            const b = db.batch();
            snap.docs.forEach(doc => {
                const ref = db.collection('studios').doc(targetStudioId)
                    .collection(collName).doc(doc.id);
                b.set(ref, doc.data(), { merge: true });
            });
            await b.commit();
            console.log(`  Migrated ${snap.size} ${collName}`);
        }
    }

    // 5. Set up counter
    const counterRef = db.collection('studios').doc(targetStudioId)
        .collection('counters').doc('archives');
    const counterDoc = await counterRef.get();
    if (!counterDoc.exists) {
        await counterRef.set({ value: total });
        console.log(`  Created counter with value: ${total}`);
    }

    console.log(`\n=== Migration complete! ${total} archives migrated ===\n`);
}

// Run for Zümrüt İzmit studio
migrate('V6xwwTW5GZ4x7DXFbWh8')
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
