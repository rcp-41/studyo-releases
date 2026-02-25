/**
 * Local migration script - runs with Firebase Admin SDK
 * Usage: node migrate-root-data.js [targetStudioId]
 */

const admin = require('firebase-admin');

// Initialize with project defaults (requires GOOGLE_APPLICATION_CREDENTIALS or firebase CLI login)
admin.initializeApp({
    projectId: 'studyo-live-2026'
});

const db = admin.firestore();

async function main() {
    const targetStudioId = process.argv[2]; // Optional: migrate to specific studio only

    console.log('=== Root-Level Data Check ===');

    // 1. Read root-level collections
    const [archivesSnap, shootTypesSnap, locationsSnap, photographersSnap, settingsSnap, studiosSnap] = await Promise.all([
        db.collection('archives').get(),
        db.collection('shootTypes').get(),
        db.collection('locations').get(),
        db.collection('photographers').get(),
        db.collection('settings').get(),
        db.collection('studios').get()
    ]);

    console.log(`Root archives: ${archivesSnap.size}`);
    console.log(`Root shootTypes: ${shootTypesSnap.size}`);
    console.log(`Root locations: ${locationsSnap.size}`);
    console.log(`Root photographers: ${photographersSnap.size}`);
    console.log(`Root settings: ${settingsSnap.size}`);
    console.log(`Studios: ${studiosSnap.size}`);

    // Show sample archives
    console.log('\n=== Sample Archives ===');
    archivesSnap.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`  [${doc.id}] archiveId=${data.archiveId}, name=${data.fullName || data.customerName || 'N/A'}, phone=${data.phone || data.customerPhone || 'N/A'}`);
    });

    // Show studios
    console.log('\n=== Studios ===');
    const studios = [];
    studiosSnap.forEach(doc => {
        const data = doc.data();
        const name = data.info?.name || data.name || 'Unknown';
        console.log(`  [${doc.id}] ${name}`);
        studios.push({ id: doc.id, data });
    });

    // Filter to target studio if specified
    const targetStudios = targetStudioId
        ? studios.filter(s => s.id === targetStudioId)
        : studios;

    if (targetStudios.length === 0) {
        console.log('No studios found to migrate to!');
        process.exit(1);
    }

    // Prepare root data
    const rootArchives = archivesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const rootShootTypes = shootTypesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const rootLocations = locationsSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const rootPhotographers = photographersSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const rootSettings = settingsSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    console.log(`\n=== Starting Migration to ${targetStudios.length} studio(s) ===`);

    for (const studio of targetStudios) {
        const studioId = studio.id;
        const studioName = studio.data.info?.name || studio.data.name || studioId;
        console.log(`\nMigrating to: ${studioName} (${studioId})...`);

        let migrated = { archives: 0, shootTypes: 0, locations: 0, photographers: 0, settings: 0, skipped: 0 };
        let batch = db.batch();
        let batchCount = 0;

        const commitBatch = async () => {
            if (batchCount > 0) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        };

        const commitIfNeeded = async () => {
            if (batchCount >= 400) await commitBatch();
        };

        // Migrate archives
        for (const archive of rootArchives) {
            const targetRef = db.collection('studios').doc(studioId).collection('archives').doc(archive.id);
            const existing = await targetRef.get();
            if (!existing.exists) {
                batch.set(targetRef, archive.data);
                batchCount++;
                migrated.archives++;
            } else {
                migrated.skipped++;
            }
            await commitIfNeeded();
        }

        // Migrate shootTypes
        for (const item of rootShootTypes) {
            const targetRef = db.collection('studios').doc(studioId).collection('shootTypes').doc(item.id);
            const existing = await targetRef.get();
            if (!existing.exists) {
                batch.set(targetRef, item.data);
                batchCount++;
                migrated.shootTypes++;
            } else {
                migrated.skipped++;
            }
            await commitIfNeeded();
        }

        // Migrate locations
        for (const item of rootLocations) {
            const targetRef = db.collection('studios').doc(studioId).collection('locations').doc(item.id);
            const existing = await targetRef.get();
            if (!existing.exists) {
                batch.set(targetRef, item.data);
                batchCount++;
                migrated.locations++;
            } else {
                migrated.skipped++;
            }
            await commitIfNeeded();
        }

        // Migrate photographers
        for (const item of rootPhotographers) {
            const targetRef = db.collection('studios').doc(studioId).collection('photographers').doc(item.id);
            const existing = await targetRef.get();
            if (!existing.exists) {
                batch.set(targetRef, item.data);
                batchCount++;
                migrated.photographers++;
            } else {
                migrated.skipped++;
            }
            await commitIfNeeded();
        }

        // Migrate settings
        for (const item of rootSettings) {
            const targetRef = db.collection('studios').doc(studioId).collection('settings').doc(item.id);
            const existing = await targetRef.get();
            if (!existing.exists) {
                batch.set(targetRef, item.data);
                batchCount++;
                migrated.settings++;
            } else {
                migrated.skipped++;
            }
            await commitIfNeeded();
        }

        // Set counter based on max archiveId
        if (rootArchives.length > 0) {
            let maxArchiveId = 999;
            for (const archive of rootArchives) {
                const archiveId = parseInt(archive.data.archiveId) || 0;
                if (archiveId > maxArchiveId) maxArchiveId = archiveId;
            }
            const counterRef = db.collection('studios').doc(studioId).collection('counters').doc('archives');
            const currentCounter = await counterRef.get();
            const currentVal = currentCounter.exists ? currentCounter.data().current : 0;
            if (maxArchiveId > currentVal) {
                batch.set(counterRef, { current: maxArchiveId }, { merge: true });
                batchCount++;
                console.log(`  Counter set to ${maxArchiveId}`);
            }
        }

        await commitBatch();

        console.log(`  Done! Archives: ${migrated.archives}, ShootTypes: ${migrated.shootTypes}, Locations: ${migrated.locations}, Photographers: ${migrated.photographers}, Settings: ${migrated.settings}, Skipped: ${migrated.skipped}`);
    }

    console.log('\n=== Migration Complete ===');
    process.exit(0);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
