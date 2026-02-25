/**
 * Migration Functions
 * One-time data migration utilities for moving root-level data to studio-scoped subcollections
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

/**
 * Migrate root-level archives to all studios (paginated)
 * Reads from root /archives and copies to /studios/{studioId}/archives
 * Also migrates: shootTypes, locations, photographers, settings
 * 
 * GÜVENLİK: Authenticated users only
 */
exports.migrateRootDataToStudios = onCall({ enforceAppCheck: false,
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    // SECURITY: Only Creator can run migrations
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can run migrations');
    }

    const { targetStudioId, batchSize = 200, startAfter } = request.data || {};

    try {
        // Get studios
        let studios = [];
        if (targetStudioId) {
            const studioDoc = await db.collection('studios').doc(targetStudioId).get();
            if (studioDoc.exists) {
                studios.push({ id: studioDoc.id, ...studioDoc.data() });
            } else {
                throw new HttpsError('not-found', `Studio ${targetStudioId} not found`);
            }
        } else {
            const studiosSnap = await db.collection('studios').get();
            studiosSnap.forEach(doc => studios.push({ id: doc.id, ...doc.data() }));
        }

        console.log(`Found ${studios.length} studio(s) to migrate to`);

        // Read root-level archives in batches
        let archivesQuery = db.collection('archives').orderBy('__name__').limit(batchSize);
        if (startAfter) {
            const startDoc = await db.collection('archives').doc(startAfter).get();
            if (startDoc.exists) {
                archivesQuery = archivesQuery.startAfter(startDoc);
            }
        }
        const archivesSnap = await archivesQuery.get();
        const rootArchives = archivesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        console.log(`Fetched ${rootArchives.length} archives (batch)`);

        // Read small collections fully
        const [shootTypesSnap, locationsSnap, photographersSnap, settingsSnap] = await Promise.all([
            db.collection('shootTypes').get(),
            db.collection('locations').get(),
            db.collection('photographers').get(),
            db.collection('settings').get()
        ]);

        const rootShootTypes = shootTypesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        const rootLocations = locationsSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        const rootPhotographers = photographersSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        const rootSettings = settingsSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        console.log(`Options: ${rootShootTypes.length} shootTypes, ${rootLocations.length} locations, ${rootPhotographers.length} photographers, ${rootSettings.length} settings`);

        const results = [];

        for (const studio of studios) {
            const studioId = studio.id;
            const studioName = studio.info?.name || studio.name || studioId;
            console.log(`Migrating to: ${studioName} (${studioId})`);

            let migrated = { studioId, studioName, archives: 0, shootTypes: 0, locations: 0, photographers: 0, settings: 0, skipped: 0 };
            let batch = db.batch();
            let batchCount = 0;

            const commitBatch = async () => {
                if (batchCount > 0) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            };

            // Migrate archives
            for (const archive of rootArchives) {
                const targetRef = db.collection('studios').doc(studioId).collection('archives').doc(archive.id);
                batch.set(targetRef, archive.data, { merge: true });
                batchCount++;
                migrated.archives++;
                if (batchCount >= 400) await commitBatch();
            }

            // Migrate options (small collections, only if not existing)
            const migrateSmall = async (items, collName, key) => {
                for (const item of items) {
                    const targetRef = db.collection('studios').doc(studioId).collection(collName).doc(item.id);
                    const existing = await targetRef.get();
                    if (!existing.exists) {
                        batch.set(targetRef, item.data);
                        batchCount++;
                        migrated[key]++;
                    } else {
                        migrated.skipped++;
                    }
                    if (batchCount >= 400) await commitBatch();
                }
            };

            await migrateSmall(rootShootTypes, 'shootTypes', 'shootTypes');
            await migrateSmall(rootLocations, 'locations', 'locations');
            await migrateSmall(rootPhotographers, 'photographers', 'photographers');
            await migrateSmall(rootSettings, 'settings', 'settings');

            // Update counter
            if (rootArchives.length > 0) {
                let maxArchiveId = 999;
                for (const archive of rootArchives) {
                    const archiveId = parseInt(archive.data.archiveId) || 0;
                    if (archiveId > maxArchiveId) maxArchiveId = archiveId;
                }
                const counterRef = db.collection('studios').doc(studioId).collection('counters').doc('archives');
                batch.set(counterRef, { current: maxArchiveId }, { merge: true });
                batchCount++;
            }

            await commitBatch();
            console.log(`Done: ${JSON.stringify(migrated)}`);
            results.push(migrated);
        }

        // Determine if more batches are needed
        const lastDocId = rootArchives.length > 0 ? rootArchives[rootArchives.length - 1].id : null;
        const hasMore = rootArchives.length === batchSize;

        return {
            success: true,
            message: `Batch complete. Migrated ${rootArchives.length} archives.`,
            hasMore,
            lastDocId,
            results
        };

    } catch (error) {
        console.error('Migration error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Migration failed: ' + error.message);
    }
});

/**
 * Check root-level data counts (diagnostic)
 * Only returns counts, not full data, to avoid memory issues
 */
exports.checkRootData = onCall({ enforceAppCheck: false, memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    // SECURITY: Only Creator can check root data
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can access this function');
    }

    try {
        // Get counts using aggregation or limited queries
        const archivesSnap = await db.collection('archives').count().get();
        const shootTypesSnap = await db.collection('shootTypes').count().get();
        const locationsSnap = await db.collection('locations').count().get();
        const photographersSnap = await db.collection('photographers').count().get();
        const settingsSnap = await db.collection('settings').count().get();

        // Get studios with their subcollection counts
        const studiosSnap = await db.collection('studios').get();
        const studioData = [];
        for (const doc of studiosSnap.docs) {
            const data = doc.data();
            const studioArchivesCount = await db.collection('studios').doc(doc.id).collection('archives').count().get();
            studioData.push({
                studioId: doc.id,
                studioName: data.info?.name || data.name || 'Unknown',
                existingArchives: studioArchivesCount.data().count
            });
        }

        // Get a small sample of root archives (just 5)
        const sampleSnap = await db.collection('archives').limit(5).get();
        const sample = sampleSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                archiveId: d.archiveId || '',
                fullName: d.fullName || d.customerName || '',
                phone: d.phone || d.customerPhone || ''
            };
        });

        return {
            rootCollections: {
                archives: archivesSnap.data().count,
                shootTypes: shootTypesSnap.data().count,
                locations: locationsSnap.data().count,
                photographers: photographersSnap.data().count,
                settings: settingsSnap.data().count
            },
            studios: studioData,
            archivesSample: sample
        };
    } catch (error) {
        console.error('Check root data error:', error);
        throw new HttpsError('internal', 'Failed: ' + error.message);
    }
});
