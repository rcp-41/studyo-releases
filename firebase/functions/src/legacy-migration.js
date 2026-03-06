/**
 * Legacy ProRandevu Migration Functions
 * Receives parsed SQL data from Creator Panel and writes to studio subcollections
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

/**
 * migrateLegacyBatch
 * Receives a batch of parsed legacy records and writes them to the correct
 * Firestore subcollection under the specified studio.
 * 
 * Called from Creator Panel with chunks of parsed SQL data.
 * 
 * @param {Object} request.data
 * @param {string} request.data.studioId - Target studio ID
 * @param {string} request.data.dataType - One of: archives, payments, appointments, shootTypes, locations, photographers, packages, personnel
 * @param {Array} request.data.records - Array of parsed record objects
 * @param {Object} request.data.options - Optional settings (e.g. { dryRun: true })
 */
exports.migrateLegacyBatch = onCall({
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    // Auth check - SECURITY: Only Creator can run migrations
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can run migrations');
    }

    const { studioId, dataType, records, organizationId, options = {} } = request.data || {};

    if (!studioId) {
        throw new HttpsError('invalid-argument', 'studioId is required');
    }
    if (!dataType) {
        throw new HttpsError('invalid-argument', 'dataType is required');
    }
    if (!records || !Array.isArray(records) || records.length === 0) {
        throw new HttpsError('invalid-argument', 'records array is required and must not be empty');
    }

    // Verify studio exists — check multi-tenant path first, then legacy root
    let studioRef = null;
    if (organizationId) {
        const orgStudioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const orgStudioDoc = await orgStudioRef.get();
        if (orgStudioDoc.exists) {
            studioRef = orgStudioRef;
        }
    }
    if (!studioRef) {
        // Fallback: search all organizations for this studioId
        const orgsSnap = await db.collection('organizations').get();
        for (const orgDoc of orgsSnap.docs) {
            const sDoc = await orgDoc.ref.collection('studios').doc(studioId).get();
            if (sDoc.exists) {
                studioRef = sDoc.ref;
                break;
            }
        }
    }
    if (!studioRef) {
        // Final fallback: legacy root-level studios collection
        const legacyDoc = await db.collection('studios').doc(studioId).get();
        if (legacyDoc.exists) {
            studioRef = db.collection('studios').doc(studioId);
        }
    }
    if (!studioRef) {
        throw new HttpsError('not-found', `Studio ${studioId} not found`);
    }

    const now = admin.firestore.Timestamp.now();

    try {
        let written = 0;
        let skipped = 0;
        let errors = [];
        let batch = db.batch();
        let batchCount = 0;
        const BATCH_LIMIT = 450; // Firestore limit is 500, leave margin

        async function commitBatch() {
            if (batchCount > 0) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Deduplication helper: fetch existing legacyIds from a collection
        async function getExistingLegacyIds(collectionName) {
            const existingSet = new Set();
            const snapshot = await studioRef.collection(collectionName)
                .where('legacyId', '!=', null)
                .select('legacyId')
                .get();
            snapshot.docs.forEach(doc => {
                const lid = doc.data().legacyId;
                if (lid !== null && lid !== undefined) existingSet.add(lid);
            });
            return existingSet;
        }

        // Determine which collection to check for deduplication
        const collectionMap = {
            archives: 'archives',
            payments: 'payments',
            appointments: 'appointments',
            shootTypes: 'shootTypes',
            locations: 'locations',
            photographers: 'photographers',
            packages: 'packages',
            personnel: 'personnel'
        };

        // Fetch existing legacyIds for deduplication (skip for updateArchives)
        let existingIds = new Set();
        if (collectionMap[dataType]) {
            existingIds = await getExistingLegacyIds(collectionMap[dataType]);
            if (existingIds.size > 0) {
                console.log(`Dedup: Found ${existingIds.size} existing records in ${collectionMap[dataType]} for studio ${studioId}`);
            }
        }

        // Build lookup maps for ID → name resolution (for archives and updateArchives)
        const lookupMaps = { shootTypes: {}, locations: {}, photographers: {} };
        if (dataType === 'archives' || dataType === 'updateArchives') {
            for (const collName of ['shootTypes', 'locations', 'photographers']) {
                const snap = await studioRef.collection(collName).get();
                snap.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.legacyId !== null && d.legacyId !== undefined) {
                        lookupMaps[collName][String(d.legacyId)] = d.name || '';
                    }
                });
            }
            console.log(`Lookup maps loaded: ${Object.keys(lookupMaps.shootTypes).length} shootTypes, ${Object.keys(lookupMaps.locations).length} locations, ${Object.keys(lookupMaps.photographers).length} photographers`);
        }

        switch (dataType) {
            case 'archives': {
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection('archives').doc();
                        // Treat "0" as null (SQL NULL equivalent)
                        const cleanId = (val) => val && String(val) !== '0' ? val : null;
                        const archiveData = {
                            archiveNumber: record.archiveNumber || 0,
                            studioId,
                            fullName: record.fullName || 'İsimsiz',
                            phone: record.phone || '',
                            shootTypeId: cleanId(record.shootTypeId),
                            shootTypeName: lookupMaps.shootTypes[String(record.shootTypeId)] || '',
                            locationId: cleanId(record.locationId),
                            locationName: lookupMaps.locations[String(record.locationId)] || '',
                            photographerId: cleanId(record.photographerId),
                            photographerName: lookupMaps.photographers[String(record.photographerId)] || '',
                            description1: record.description1 || '',
                            description2: record.description2 || null,
                            totalAmount: record.totalAmount || 0,
                            cashAmount: record.cashAmount || 0,
                            cardAmount: record.cardAmount || 0,
                            transferAmount: record.transferAmount || 0,
                            isPaid: record.isPaid || false,
                            status: record.status || 'active',
                            packageId: record.packageId || null,
                            email: record.email || null,
                            legacyId: record.legacyId || null,
                            shootDate: record.shootDate ? admin.firestore.Timestamp.fromMillis(record.shootDate) : now,
                            deliveryDate: record.deliveryDate || null,
                            createdAt: record.createdAt ? admin.firestore.Timestamp.fromMillis(record.createdAt) : now,
                            updatedAt: now,
                            createdById: 'legacy-migration',
                            importedAt: now
                        };
                        batch.set(docRef, archiveData);
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Archive ${record.archiveNumber}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'updateArchives': {
                // Update existing archive docs by archiveNumber (for fixing missing IDs)
                for (const record of records) {
                    try {
                        const archiveNum = record.archiveNumber || 0;
                        if (!archiveNum) { skipped++; continue; }

                        const snap = await studioRef.collection('archives')
                            .where('archiveNumber', '==', archiveNum)
                            .limit(1)
                            .get();

                        if (snap.empty) { skipped++; continue; }

                        const updateData = {};
                        if (record.shootTypeId) {
                            updateData.shootTypeId = record.shootTypeId;
                            updateData.shootTypeName = lookupMaps.shootTypes[String(record.shootTypeId)] || '';
                        }
                        if (record.locationId) {
                            updateData.locationId = record.locationId;
                            updateData.locationName = lookupMaps.locations[String(record.locationId)] || '';
                        }
                        if (record.photographerId) {
                            updateData.photographerId = record.photographerId;
                            updateData.photographerName = lookupMaps.photographers[String(record.photographerId)] || '';
                        }
                        if (record.description1 !== undefined) updateData.description1 = record.description1;
                        updateData.updatedAt = now;

                        if (Object.keys(updateData).length > 1) {
                            batch.update(snap.docs[0].ref, updateData);
                            batchCount++;
                            written++;
                        } else {
                            skipped++;
                        }

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`UpdateArchive ${record.archiveNumber}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'payments': {
                // Payments are written as subcollections under archives OR as top-level
                // For legacy data, we write to studios/{id}/payments/ (flat collection)
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection('payments').doc();
                        const paymentData = {
                            studioId,
                            archiveNumber: record.archiveNumber || 0,
                            archiveId: record.archiveId || null,
                            date: record.date ? admin.firestore.Timestamp.fromMillis(record.date) : now,
                            amount: record.amount || 0,
                            method: record.method || 'cash', // 'cash' or 'card'
                            description: record.description || '',
                            legacyId: record.legacyId || null,
                            legacyRandevuId: record.legacyRandevuId || null,
                            createdAt: now,
                            importedAt: now
                        };
                        batch.set(docRef, paymentData);
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Payment ${record.legacyId}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'appointments': {
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection('appointments').doc();

                        // Build appointmentDate from legacy date + time
                        let appointmentDate = now;
                        if (record.date) {
                            const baseDate = new Date(record.date);
                            // Parse legacy time (e.g. "10", "14", "16:30")
                            const timeStr = (record.time || '').trim();
                            if (timeStr) {
                                const hour = parseInt(timeStr) || 0;
                                baseDate.setHours(hour, 0, 0, 0);
                            }
                            appointmentDate = admin.firestore.Timestamp.fromDate(baseDate);
                        }

                        // Map legacy time to timeSlot format (e.g. "10:00")
                        const timeStr = (record.time || '').trim();
                        const hour = parseInt(timeStr) || 9;
                        const timeSlot = `${String(hour).padStart(2, '0')}:00`;

                        // Map legacy status
                        let status = 'pending';
                        const desc2 = (record.description2 || '').toUpperCase();
                        if (desc2.includes('GELDI') || desc2.includes('TAMAMLANDI')) {
                            status = 'completed';
                        } else if (desc2.includes('IPTAL') || desc2.includes('İPTAL')) {
                            status = 'cancelled';
                        } else if (desc2.includes('GELMEDI')) {
                            status = 'no_show';
                        }

                        const appointmentData = {
                            studioId,
                            fullName: record.customerName || '',
                            phone: record.phone || '',
                            shootTypeId: null, // Legacy has text, not ID
                            description1: [record.shootType, record.description, record.venue].filter(Boolean).join(' | ') || null,
                            description2: record.description2 || null,
                            appointmentDate,
                            timeSlot,
                            duration: 30,
                            studioRoom: record.location === 1 ? 'Stüdyo' : (record.location === 2 ? 'Dış Çekim' : ''),
                            status,
                            // Keep legacy financial data as extra fields
                            legacyTotalAmount: record.totalAmount || 0,
                            legacyPaidAmount: record.paidAmount || 0,
                            legacyRemainingAmount: record.remainingAmount || 0,
                            legacyPersonnel: record.personnel || '',
                            legacyShootType: record.shootType || '',
                            legacyVenue: record.venue || '',
                            legacyLocation: record.location || 0,
                            legacyId: record.legacyId || null,
                            createdAt: record.createdAt ? admin.firestore.Timestamp.fromMillis(record.createdAt) : now,
                            updatedAt: now,
                            importedAt: now
                        };
                        batch.set(docRef, appointmentData);
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Appointment ${record.legacyId}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'shootTypes':
            case 'locations':
            case 'photographers': {
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection(dataType).doc();
                        batch.set(docRef, {
                            studioId,
                            name: record.name || '',
                            legacyId: record.legacyId || null,
                            isActive: true,
                            createdAt: now,
                            importedAt: now
                        });
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`${dataType} ${record.name}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'packages': {
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection('packages').doc();
                        batch.set(docRef, {
                            studioId,
                            name: record.name || '',
                            price: record.price || 0,
                            shootTypeId: record.shootTypeId || null,
                            legacyId: record.legacyId || null,
                            isActive: true,
                            createdAt: now,
                            importedAt: now
                        });
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Package ${record.name}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'personnel': {
                for (const record of records) {
                    try {
                        // Dedup check
                        if (record.legacyId && existingIds.has(record.legacyId)) { skipped++; continue; }
                        const docRef = studioRef.collection('personnel').doc();
                        batch.set(docRef, {
                            studioId,
                            name: record.name || '',
                            phone: record.phone || '',
                            legacyId: record.legacyId || null,
                            isActive: true,
                            createdAt: now,
                            importedAt: now
                        });
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Personnel ${record.name}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            case 'customers': {
                // Auto-create customers from archive records
                // Records are archive-format objects with phone, email, fullName
                // Group by phone to deduplicate
                const customerMap = new Map(); // phone -> { names, emails, archiveNumbers }

                for (const record of records) {
                    const phone = (record.phone || '').trim();
                    const email = (record.email || '').trim();
                    if (!phone && !email) continue; // Skip records without contact info

                    const key = phone || email;
                    if (customerMap.has(key)) {
                        const existing = customerMap.get(key);
                        existing.archiveNumbers.push(record.archiveNumber);
                        if (email && !existing.email) existing.email = email;
                        existing.totalShoots++;
                        existing.totalSpent += (record.totalAmount || 0);
                    } else {
                        customerMap.set(key, {
                            fullName: record.fullName || 'İsimsiz',
                            phone,
                            email,
                            archiveNumbers: [record.archiveNumber],
                            totalShoots: 1,
                            totalSpent: record.totalAmount || 0
                        });
                    }
                }

                // Check existing customers to avoid duplicates
                const existingCustomersSnap = await studioRef.collection('customers').get();
                const existingPhones = new Set();
                const existingEmails = new Set();
                existingCustomersSnap.forEach(doc => {
                    const d = doc.data();
                    if (d.phone) existingPhones.add(d.phone.trim());
                    if (d.email) existingEmails.add(d.email.trim());
                });

                for (const [key, cust] of customerMap) {
                    try {
                        // Skip if already exists
                        if (cust.phone && existingPhones.has(cust.phone)) { skipped++; continue; }
                        if (cust.email && existingEmails.has(cust.email)) { skipped++; continue; }

                        const docRef = studioRef.collection('customers').doc();
                        batch.set(docRef, {
                            fullName: cust.fullName,
                            phone: cust.phone,
                            email: cust.email,
                            customerType: 'individual',
                            source: 'legacy-migration',
                            notes: '',
                            isVip: false,
                            totalShoots: cust.totalShoots,
                            totalSpent: cust.totalSpent,
                            archiveNumbers: cust.archiveNumbers,
                            createdAt: now,
                            updatedAt: now,
                            importedAt: now,
                            createdBy: 'legacy-migration'
                        });
                        batchCount++;
                        written++;

                        if (batchCount >= BATCH_LIMIT) await commitBatch();
                    } catch (e) {
                        errors.push(`Customer ${cust.fullName}: ${e.message}`);
                        skipped++;
                    }
                }
                break;
            }

            default:
                throw new HttpsError('invalid-argument', `Unknown dataType: ${dataType}`);
        }

        // Commit remaining
        await commitBatch();

        // Update archive counter if archives were imported
        if (dataType === 'archives' && written > 0) {
            const maxNumber = Math.max(...records.map(r => r.archiveNumber || 0));
            const counterRef = studioRef.collection('counters').doc('archives');
            const counterDoc = await counterRef.get();
            const currentMax = counterDoc.exists ? (counterDoc.data().lastNumber || 0) : 0;

            if (maxNumber > currentMax) {
                await counterRef.set({ lastNumber: maxNumber }, { merge: true });
            }
        }

        console.log(`Legacy migration: ${dataType} - ${written} written, ${skipped} skipped for studio ${studioId}`);

        return {
            success: true,
            dataType,
            written,
            skipped,
            errors: errors.slice(0, 10) // Return only first 10 errors
        };

    } catch (error) {
        console.error('Legacy migration error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Migration failed: ' + error.message);
    }
});

/**
 * recalculatePaymentBreakdown
 * Reads all payments in a studio, groups by archiveNumber & method,
 * then updates each archive's cashAmount/cardAmount/transferAmount.
 */
exports.recalculatePaymentBreakdown = onCall({
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator' && request.auth.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only Creator or Admin can run this');
    }

    const { studioId } = request.data || {};
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId is required');

    const studioRef = db.collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', `Studio ${studioId} not found`);

    try {
        // Step 1: Read ALL payments and group by archiveNumber
        console.log(`Recalculating payment breakdown for studio ${studioId}...`);
        const paymentsSnap = await studioRef.collection('payments').get();
        console.log(`Found ${paymentsSnap.size} payment records`);

        const paymentsByArchive = {};
        paymentsSnap.forEach(doc => {
            const p = doc.data();
            const archNum = p.archiveNumber;
            if (!archNum) return;
            if (!paymentsByArchive[archNum]) {
                paymentsByArchive[archNum] = { cash: 0, card: 0, transfer: 0 };
            }
            const amount = Number(p.amount) || 0;
            const method = p.method || 'cash';
            if (method === 'card' || method === 'credit_card') {
                paymentsByArchive[archNum].card += amount;
            } else if (method === 'transfer') {
                paymentsByArchive[archNum].transfer += amount;
            } else {
                paymentsByArchive[archNum].cash += amount;
            }
        });

        const archiveNumbers = Object.keys(paymentsByArchive);
        console.log(`Grouped payments for ${archiveNumbers.length} archives`);

        // Step 2: Update archives in batches
        let updated = 0;
        let notFound = 0;
        let batch = db.batch();
        let batchCount = 0;
        const BATCH_LIMIT = 450;

        for (const archNum of archiveNumbers) {
            const breakdown = paymentsByArchive[archNum];

            // Find archive by archiveNumber
            const archSnap = await studioRef.collection('archives')
                .where('archiveNumber', '==', parseInt(archNum))
                .limit(1)
                .get();

            if (archSnap.empty) {
                notFound++;
                continue;
            }

            const archDoc = archSnap.docs[0];
            batch.update(archDoc.ref, {
                cashAmount: breakdown.cash,
                cardAmount: breakdown.card,
                transferAmount: breakdown.transfer,
                paidAmount: breakdown.cash + breakdown.card + breakdown.transfer
            });
            batchCount++;
            updated++;

            if (batchCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
                console.log(`Committed batch, ${updated} archives updated so far`);
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`Done: ${updated} archives updated, ${notFound} archives not found`);

        return {
            success: true,
            totalPayments: paymentsSnap.size,
            uniqueArchives: archiveNumbers.length,
            updated,
            notFound
        };
    } catch (error) {
        console.error('recalculatePaymentBreakdown error:', error);
        throw new HttpsError('internal', 'Recalculation failed: ' + error.message);
    }
});
