/**
 * Migration Functions
 * Data migration utilities for multi-tenant organization structure
 * 
 * Legacy: /studios/{studioId}/... → New: /organizations/{orgId}/studios/{studioId}/...
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Collections that exist under each studio
const STUDIO_SUBCOLLECTIONS = [
    'archives', 'appointments', 'customers', 'users', 'payments',
    'paymentIntents', 'shoots', 'shootTypes', 'locations', 'photographers',
    'packages', 'priceLists', 'settings', 'counters', 'leaves',
    'auditLogs', 'schools', 'expenses', 'finance'
];

/**
 * Migrate studios from /studios/ to /organizations/{orgId}/studios/
 * 
 * Creates a default organization if needed, then moves all studio data.
 * Creator-only. Idempotent — skips already-migrated data.
 */
exports.migrateToOrganizations = onCall({
    enforceAppCheck: false,
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Creator only');

    const {
        organizationId,       // target org ID (if empty, creates default)
        organizationName,     // org name
        targetStudioId,       // specific studio to migrate (optional)
        dryRun = false        // preview mode
    } = request.data || {};

    try {
        // 1. Ensure organization exists
        let orgId = organizationId;
        if (!orgId) {
            orgId = 'default-org';
            const orgRef = db.collection('organizations').doc(orgId);
            const orgDoc = await orgRef.get();
            if (!orgDoc.exists) {
                if (dryRun) {
                    console.log('[DRY RUN] Would create default organization');
                } else {
                    await orgRef.set({
                        name: organizationName || 'Varsayılan Organizasyon',
                        owner: 'Creator',
                        slug: 'default',
                        createdAt: FieldValue.serverTimestamp()
                    });
                }
                console.log('Created default organization:', orgId);
            }
        }

        // 2. Get studios to migrate
        let legacyStudios = [];
        if (targetStudioId) {
            const doc = await db.collection('studios').doc(targetStudioId).get();
            if (doc.exists) legacyStudios.push({ id: doc.id, ...doc.data() });
            else throw new HttpsError('not-found', `Studio ${targetStudioId} not found in /studios/`);
        } else {
            const snap = await db.collection('studios').get();
            snap.forEach(doc => legacyStudios.push({ id: doc.id, ...doc.data() }));
        }

        console.log(`Found ${legacyStudios.length} legacy studios to migrate`);

        const results = [];

        for (const studio of legacyStudios) {
            const studioId = studio.id;
            const studioName = studio.info?.name || studio.name || studioId;
            const result = {
                studioId, studioName, organizationId: orgId,
                collections: {}, totalDocs: 0, skipped: 0
            };

            // Check if already migrated
            const targetRef = db.collection('organizations').doc(orgId)
                .collection('studios').doc(studioId);
            const targetDoc = await targetRef.get();

            if (targetDoc.exists) {
                console.log(`Studio ${studioId} already exists in org ${orgId}, checking subcollections...`);
            }

            // 3. Copy studio document
            if (!dryRun && !targetDoc.exists) {
                // Copy studio document with organizationId added
                const studioData = { ...studio };
                delete studioData.id;
                studioData.organizationId = orgId;
                studioData.migratedAt = FieldValue.serverTimestamp();
                await targetRef.set(studioData, { merge: true });
            }

            // 4. Migrate subcollections
            for (const collName of STUDIO_SUBCOLLECTIONS) {
                const sourceSnap = await db.collection('studios').doc(studioId)
                    .collection(collName).get();

                if (sourceSnap.empty) continue;

                let migrated = 0;
                let skipped = 0;
                let batch = db.batch();
                let batchCount = 0;

                for (const docSnap of sourceSnap.docs) {
                    const targetDocRef = targetRef.collection(collName).doc(docSnap.id);

                    if (!dryRun) {
                        // Check if already exists
                        const existingDoc = await targetDocRef.get();
                        if (existingDoc.exists) {
                            skipped++;
                            continue;
                        }
                        batch.set(targetDocRef, docSnap.data());
                        batchCount++;
                        if (batchCount >= 400) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    }
                    migrated++;
                }

                if (batchCount > 0 && !dryRun) {
                    await batch.commit();
                }

                result.collections[collName] = { total: sourceSnap.size, migrated, skipped };
                result.totalDocs += migrated;
                result.skipped += skipped;
            }

            // 5. Update Auth claims for studio users
            if (!dryRun) {
                const usersSnap = await targetRef.collection('users').get();
                for (const userDoc of usersSnap.docs) {
                    try {
                        const currentUser = await admin.auth().getUser(userDoc.id);
                        const currentClaims = currentUser.customClaims || {};
                        if (!currentClaims.organizationId) {
                            await admin.auth().setCustomUserClaims(userDoc.id, {
                                ...currentClaims,
                                organizationId: orgId
                            });
                            console.log(`Updated claims for user ${userDoc.id}`);
                        }
                    } catch (authError) {
                        console.warn(`Could not update claims for ${userDoc.id}:`, authError.message);
                    }
                }
            }

            console.log(`Studio ${studioName}: ${result.totalDocs} docs migrated, ${result.skipped} skipped`);
            results.push(result);
        }

        return {
            success: true,
            dryRun,
            organizationId: orgId,
            message: dryRun
                ? `DRY RUN: Would migrate ${legacyStudios.length} studios`
                : `Migrated ${legacyStudios.length} studios to organization ${orgId}`,
            results
        };

    } catch (error) {
        console.error('Migration error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Migration failed: ' + error.message);
    }
});

/**
 * Check migration status — shows what data is in legacy vs org paths
 */
exports.checkMigrationStatus = onCall({ enforceAppCheck: false, memory: '512MiB' }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Creator only');

    try {
        // Legacy studio count
        const legacySnap = await db.collection('studios').get();
        const legacyStudios = [];
        for (const doc of legacySnap.docs) {
            const data = doc.data();
            const archiveCount = await db.collection('studios').doc(doc.id)
                .collection('archives').count().get();
            legacyStudios.push({
                studioId: doc.id,
                name: data.info?.name || data.name || 'Unknown',
                archiveCount: archiveCount.data().count
            });
        }

        // Organization studio count
        const orgsSnap = await db.collection('organizations').get();
        const orgStudios = [];
        for (const orgDoc of orgsSnap.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios').get();
            for (const studioDoc of studiosSnap.docs) {
                const data = studioDoc.data();
                const archiveCount = await orgDoc.ref.collection('studios')
                    .doc(studioDoc.id).collection('archives').count().get();
                orgStudios.push({
                    organizationId: orgDoc.id,
                    organizationName: orgDoc.data().name || orgDoc.id,
                    studioId: studioDoc.id,
                    name: data.info?.name || data.name || 'Unknown',
                    archiveCount: archiveCount.data().count
                });
            }
        }

        // Root data counts
        const rootCounts = {};
        for (const coll of ['archives', 'shootTypes', 'locations', 'photographers', 'settings']) {
            const count = await db.collection(coll).count().get();
            rootCounts[coll] = count.data().count;
        }

        return {
            legacy: { studioCount: legacyStudios.length, studios: legacyStudios },
            organizations: { orgCount: orgsSnap.size, studioCount: orgStudios.length, studios: orgStudios },
            rootCollections: rootCounts,
            migrationComplete: legacyStudios.length === 0 && orgStudios.length > 0
        };
    } catch (error) {
        console.error('Check migration status error:', error);
        throw new HttpsError('internal', 'Failed: ' + error.message);
    }
});

/**
 * Legacy root data migration (from root collections to studios)
 * Kept for backward compatibility
 */
exports.migrateRootDataToStudios = onCall({
    enforceAppCheck: false,
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator can run migrations');

    const { targetStudioId, targetOrganizationId, batchSize = 200, startAfter } = request.data || {};

    try {
        let studios = [];
        if (targetStudioId && targetOrganizationId) {
            const studioDoc = await db.collection('organizations').doc(targetOrganizationId)
                .collection('studios').doc(targetStudioId).get();
            if (studioDoc.exists) {
                studios.push({ id: studioDoc.id, orgId: targetOrganizationId, ...studioDoc.data() });
            } else {
                throw new HttpsError('not-found', `Studio ${targetStudioId} not found`);
            }
        } else {
            // Scan all organizations
            const orgsSnap = await db.collection('organizations').get();
            for (const orgDoc of orgsSnap.docs) {
                const studiosSnap = await orgDoc.ref.collection('studios').get();
                studiosSnap.forEach(doc => studios.push({ id: doc.id, orgId: orgDoc.id, ...doc.data() }));
            }
        }

        // Read root archives in batches
        let archivesQuery = db.collection('archives').orderBy('__name__').limit(batchSize);
        if (startAfter) {
            const startDoc = await db.collection('archives').doc(startAfter).get();
            if (startDoc.exists) archivesQuery = archivesQuery.startAfter(startDoc);
        }
        const archivesSnap = await archivesQuery.get();
        const rootArchives = archivesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() }));

        const results = [];
        for (const studio of studios) {
            let migrated = { studioId: studio.id, archives: 0, skipped: 0 };
            let batch = db.batch();
            let batchCount = 0;

            for (const archive of rootArchives) {
                const targetRef = db.collection('organizations').doc(studio.orgId)
                    .collection('studios').doc(studio.id)
                    .collection('archives').doc(archive.id);

                // IDEMPOTENCY: Check if document already exists before writing
                const existingDoc = await targetRef.get();
                if (existingDoc.exists) {
                    migrated.skipped++;
                    continue;
                }

                batch.set(targetRef, {
                    ...archive.data,
                    migratedAt: FieldValue.serverTimestamp(),
                    migratedFrom: 'root-archives'
                });
                batchCount++;
                migrated.archives++;
                if (batchCount >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }

            if (batchCount > 0) await batch.commit();
            results.push(migrated);
        }

        const lastDocId = rootArchives.length > 0 ? rootArchives[rootArchives.length - 1].id : null;
        return {
            success: true,
            hasMore: rootArchives.length === batchSize,
            lastDocId,
            results
        };
    } catch (error) {
        console.error('Migration error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Migration failed: ' + error.message);
    }
});
