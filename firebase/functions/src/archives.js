/**
 * Archives Cloud Functions
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { archiveSchema, validate } = require('./validators/schemas');
const { APPCHECK_ENABLED } = require('./config');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const storage = admin.storage();



// Helper to validate auth
const validateAuth = (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
};

/**
 * Create Archive (Server-Side)
 * Handles auto-increment ID and creation timestamp
 */
// GÜVENLİK: İzin verilen alanlar (field whitelisting)
const ALLOWED_ARCHIVE_FIELDS = [
    'customerName', 'customerPhone', 'customerEmail',
    'fullName', 'phone', 'email',
    'shootTypeId', 'shootTypeName', 'locationId', 'locationName',
    'photographerId', 'photographerName',
    'description', 'description1', 'description2', 'notes', 'status',
    'workflowStatus', 'folderPath', 'shootDate',
    'selectedCount', 'totalCount', 'appointmentDate', 'timeSlot',
    'wcProductIds', 'wcUploaded', 'selectionUrl',
    'price', 'paidAmount', 'paymentStatus',
    'totalAmount', 'cashAmount', 'cardAmount', 'transferAmount',
    // Photo Selector fields
    'schoolId', 'className', 'section',
    'photoSelectionData', 'autoDescription', 'autoPrice'
];

const filterAllowedFields = (data) => {
    const filtered = {};
    for (const field of ALLOWED_ARCHIVE_FIELDS) {
        if (data[field] !== undefined) {
            filtered[field] = data[field];
        }
    }
    return filtered;
};

/**
 * List Archives (Server-Side)
 * Returns archives from the studio-scoped subcollection
 */
exports.list = onCall({ enforceAppCheck: APPCHECK_ENABLED, memory: '512MiB', timeoutSeconds: 120 }, async (request) => {
    validateAuth(request);

    const { search, limit: queryLimit, filters, startAfterDocId } = request.data || {};
    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const searchTrimmed = search ? search.trim() : '';

        const [shootTypesSnap, locationsSnap, photographersSnap] = await Promise.all([
            dbHandler.collection('shootTypes').get(),
            dbHandler.collection('locations').get(),
            dbHandler.collection('photographers').get()
        ]);

        const shootTypes = {};
        shootTypesSnap.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            shootTypes[doc.id] = d;
            if (d.legacyId) shootTypes[String(d.legacyId)] = d;
        });
        const locations = {};
        locationsSnap.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            locations[doc.id] = d;
            if (d.legacyId) locations[String(d.legacyId)] = d;
        });
        const photographers = {};
        photographersSnap.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            photographers[doc.id] = d;
            if (d.legacyId) photographers[String(d.legacyId)] = d;
        });

        const mapDoc = (doc) => {
            const data = doc.data();
            const resolvedShootType = shootTypes[data.shootTypeId] || shootTypes[String(data.shootTypeId)] || (data.shootTypeName ? { name: data.shootTypeName } : null);
            const resolvedLocation = locations[data.locationId] || locations[String(data.locationId)] || (data.locationName ? { name: data.locationName } : null);
            const resolvedPhotographer = photographers[data.photographerId] || photographers[String(data.photographerId)] || (data.photographerName ? { name: data.photographerName } : null);
            const cleanDesc = (val) => {
                if (!val) return '';
                return String(val).replace(/^\[/, '').replace(/\]$/, '').replace(/^Ebat:\s*/i, '').trim();
            };
            return {
                id: doc.id,
                ...data,
                archiveNumber: data.archiveNumber || data.archiveId || 0,
                fullName: data.fullName || data.customerName || '',
                phone: data.phone || data.customerPhone || '',
                email: data.email || data.customerEmail || '',
                description1: cleanDesc(data.description1),
                description2: cleanDesc(data.description2),
                shootType: resolvedShootType,
                location: resolvedLocation,
                photographer: resolvedPhotographer,
                shootDate: data.shootDate?.toDate?.() ? data.shootDate.toDate().toISOString() : data.shootDate,
                createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt
            };
        };

        let archives;

        if (searchTrimmed) {
            const isNumeric = /^\d+$/.test(searchTrimmed);
            if (isNumeric) {
                const searchNum = parseInt(searchTrimmed, 10);
                const exactSnap = await dbHandler.collection('archives').where('archiveNumber', '==', searchNum).get();
                archives = exactSnap.docs.map(mapDoc);
                if (archives.length === 0) {
                    const idSnap = await dbHandler.collection('archives').where('archiveId', '==', searchTrimmed).get();
                    archives = idSnap.docs.map(mapDoc);
                }
            } else {
                const snapshot = await dbHandler.collection('archives').orderBy('createdAt', 'desc').limit(2000).get();
                const searchLower = searchTrimmed.toLowerCase();
                archives = snapshot.docs.map(mapDoc).filter(a =>
                    (a.fullName || '').toLowerCase().includes(searchLower) ||
                    (a.phone || '').includes(searchTrimmed)
                );
            }
        } else if (filters && Object.keys(filters).length > 0) {
            // Advanced filters with server-side date range support
            let query = dbHandler.collection('archives');

            // Date range filtering using Firestore Timestamps
            if (filters.dateFrom || filters.dateTo) {
                if (filters.dateFrom) {
                    const fromDate = new Date(filters.dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(fromDate));
                }
                if (filters.dateTo) {
                    const toDate = new Date(filters.dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(toDate));
                }
                query = query.orderBy('createdAt', 'desc');
            } else {
                query = query.orderBy('createdAt', 'desc').limit(5000);
            }

            const snapshot = await query.get();

            // Helper: checks if an archive field matches a filter value
            // Supports both raw IDs (legacy numeric) and resolved entity IDs (Firestore doc IDs)
            const matchesId = (rawId, resolvedEntity, filterVal) => {
                if (!filterVal) return true; // no filter = match all
                return String(rawId || '') === String(filterVal) ||
                    resolvedEntity?.id === filterVal;
            };

            archives = snapshot.docs.map(mapDoc).filter(a => {
                if (!matchesId(a.shootTypeId, a.shootType, filters.shootTypeId)) return false;
                if (!matchesId(a.locationId, a.location, filters.locationId)) return false;
                if (!matchesId(a.photographerId, a.photographer, filters.photographerId)) return false;
                if (filters.schoolId && String(a.schoolId || '') !== String(filters.schoolId)) return false;
                if (filters.className && String(a.className || '') !== String(filters.className)) return false;
                if (filters.workflowStatus && (a.workflowStatus || 'selection_pending') !== filters.workflowStatus) return false;
                return true;
            });
        } else {
            const maxLimit = Math.min(queryLimit || 50, 500);
            let query = dbHandler.collection('archives').orderBy('createdAt', 'desc');

            // Cursor-based pagination: start after a specific document
            if (startAfterDocId) {
                const startAfterDoc = await dbHandler.collection('archives').doc(startAfterDocId).get();
                if (startAfterDoc.exists) {
                    query = query.startAfter(startAfterDoc);
                }
            }

            const snapshot = await query.limit(maxLimit).get();
            archives = snapshot.docs.map(mapDoc);
        }

        // Return lastDocId for cursor-based pagination
        const lastDocId = archives.length > 0 ? archives[archives.length - 1].id : null;
        return { data: archives, total: archives.length, lastDocId, hasMore: archives.length >= (queryLimit || 50) };
    } catch (error) {
        console.error('List Archives Error:', error.message, error.stack);
        throw new HttpsError('internal', 'Arşiv listesi alınamadı: ' + error.message);
    }
});

exports.getNextNumber = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);
    const dbHandler = await DatabaseHandler.fromRequest(request);
    try {
        const counterDoc = await dbHandler.collection('counters').doc('archives').get();
        const current = counterDoc.exists ? (counterDoc.data().current || 0) : 0;
        return { nextNumber: current + 1 };
    } catch (error) {
        console.error('Get next number error:', error);
        throw new HttpsError('internal', 'Arşiv numarası alınamadı');
    }
});

exports.create = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const data = request.data;
    // Zod validation (partial - archive has many optional fields)
    validate(archiveSchema.partial(), data, 'arşiv');
    const dbHandler = await DatabaseHandler.fromRequest(request);

    // GÜVENLİK: Field whitelisting
    const filteredData = filterAllowedFields(data);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const counterRef = dbHandler.collection('counters').doc('archives');
            const counterDoc = await transaction.get(counterRef);

            let newId = 1;
            if (counterDoc.exists) {
                const current = counterDoc.data().current;
                if (typeof current === 'number') {
                    newId = current + 1;
                }
            }

            transaction.set(counterRef, { current: newId }, { merge: true });

            const newDocRef = dbHandler.collection('archives').doc();

            const archiveData = {
                ...filteredData,
                archiveId: newId.toString(),
                archiveNumber: newId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
                status: filteredData.status || 'draft'
            };

            transaction.set(newDocRef, archiveData);

            return { id: newDocRef.id, archiveId: newId.toString(), archiveNumber: newId };
        });

        // Auto-create/link customer (best-effort, don't block archive creation)
        const phone = (filteredData.phone || '').trim();
        const email = (filteredData.email || '').trim();
        const fullName = filteredData.fullName || '';

        if (phone || email) {
            try {
                let existingCustomer = null;

                // Search by phone first
                if (phone) {
                    const phoneSnap = await dbHandler.collection('customers')
                        .where('phone', '==', phone)
                        .limit(1)
                        .get();
                    if (!phoneSnap.empty) {
                        existingCustomer = phoneSnap.docs[0];
                    }
                }

                // If not found by phone, try email
                if (!existingCustomer && email) {
                    const emailSnap = await dbHandler.collection('customers')
                        .where('email', '==', email)
                        .limit(1)
                        .get();
                    if (!emailSnap.empty) {
                        existingCustomer = emailSnap.docs[0];
                    }
                }

                if (existingCustomer) {
                    // Link archive to existing customer
                    await existingCustomer.ref.update({
                        archiveIds: FieldValue.arrayUnion(result.id),
                        totalShoots: FieldValue.increment(1),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                    // Also update archive with customerId
                    await dbHandler.collection('archives').doc(result.id).update({
                        customerId: existingCustomer.id
                    });
                } else {
                    // Create new customer
                    const customerData = {
                        fullName,
                        phone,
                        email,
                        customerType: 'individual',
                        source: 'archive',
                        notes: '',
                        isVip: false,
                        totalShoots: 1,
                        totalSpent: 0,
                        archiveIds: [result.id],
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                        createdBy: request.auth.uid
                    };
                    const customerRef = await dbHandler.collection('customers').add(customerData);
                    // Update archive with customerId
                    await dbHandler.collection('archives').doc(result.id).update({
                        customerId: customerRef.id
                    });
                }
            } catch (custErr) {
                console.error('Customer auto-create error (non-blocking):', custErr);
            }
        }

        return { id: result.id, archiveId: String(result.archiveId || result.archiveNumber || ''), archiveNumber: result.archiveNumber || 0 };
    } catch (error) {
        console.error('Create Archive Error:', error);
        throw new HttpsError('internal', 'Arşiv oluşturma başarısız oldu.');
    }
});

/**
 * Update Archive (Server-Side)
 */
exports.update = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const { id, data } = request.data;
    if (!id || !data) {
        throw new HttpsError('invalid-argument', 'Missing id or data');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    // GÜVENLİK: Field whitelisting
    const filteredData = filterAllowedFields(data);

    try {
        const docRef = dbHandler.collection('archives').doc(id);

        await docRef.update({
            ...filteredData,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        });

        return { success: true };
    } catch (error) {
        console.error('Update Archive Error:', error);
        throw new HttpsError('internal', 'Arşiv güncelleme başarısız oldu.');
    }
});

/**
 * Delete Archive (Server-Side)
 */
exports.delete = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const { id } = request.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'Missing id');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const docRef = dbHandler.collection('archives').doc(id);
        await docRef.delete();
        return { success: true };
    } catch (error) {
        console.error('Delete Archive Error:', error);
        throw new HttpsError('internal', 'Arşiv silme başarısız oldu.');
    }
});

/**
 * Delete Multiple Archives (Server-Side)
 */
exports.deleteMultiple = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const { ids } = request.data;
    if (!ids || !Array.isArray(ids)) {
        throw new HttpsError('invalid-argument', 'Missing ids array');
    }
    // SECURITY: Limit batch size to prevent abuse
    if (ids.length > 50) {
        throw new HttpsError('invalid-argument', 'Maximum 50 items per batch delete');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const batch = db.batch();

        ids.forEach(id => {
            const docRef = dbHandler.collection('archives').doc(id);
            batch.delete(docRef);
        });

        await batch.commit();

        return { success: true, count: ids.length };
    } catch (error) {
        console.error('Batch Delete Error:', error);
        throw new HttpsError('internal', 'Toplu silme başarısız oldu.');
    }
});

/**
 * Update Status (Server-Side)
 */
exports.updateStatus = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const { id, status } = request.data;
    if (!id || !status) {
        throw new HttpsError('invalid-argument', 'Missing id or status');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const docRef = dbHandler.collection('archives').doc(id);
        await docRef.update({
            status,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update Status Error:', error);
        throw new HttpsError('internal', 'Durum güncelleme başarısız oldu.');
    }
});

/**
 * Get the physical folder path for an archive record
 */
exports.getArchiveFolderPath = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { archiveId } = request.data || {};

    if (!archiveId) {
        throw new HttpsError('invalid-argument', 'archiveId required');
    }

    try {
        const doc = await dbHandler.collection('archives').doc(archiveId).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Arşiv kaydı bulunamadı');
        }

        const data = doc.data();
        const folderPath = data.folderPath || null;

        return {
            success: true,
            archiveId,
            folderPath,
            exists: !!folderPath
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Klasör yolu alınamadı: ' + error.message);
    }
});

/**
 * Transfer Appointment to Archive (Server-Side)
 * Creates a new archive from appointment data, then deletes the appointment.
 * All within a transaction for atomicity.
 */
exports.transferFromAppointment = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    validateAuth(request);

    const { appointmentId, archiveData } = request.data;
    if (!appointmentId) {
        throw new HttpsError('invalid-argument', 'appointmentId is required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const result = await dbHandler.runTransaction(async (transaction) => {
            // 1. Read the appointment
            const aptRef = dbHandler.collection('appointments').doc(appointmentId);
            const aptSnap = await transaction.get(aptRef);
            if (!aptSnap.exists) {
                throw new HttpsError('not-found', 'Randevu bulunamadı');
            }
            const aptData = aptSnap.data();

            // 2. Get next archive ID (auto-increment)
            // NOTE: counter doc name must be 'archives' (with 's') to match archives.create
            const counterRef = dbHandler.collection('counters').doc('archives');
            const counterSnap = await transaction.get(counterRef);
            const currentId = counterSnap.exists ? (counterSnap.data().current || 0) : 0;
            const newId = currentId + 1;

            // 3. Build archive record from appointment + optional overrides
            const mergedData = {
                fullName: aptData.fullName || '',
                phone: aptData.phone || '',
                email: aptData.email || '',
                shootTypeId: aptData.shootTypeId || '',
                locationId: aptData.locationId || '',
                photographerId: aptData.photographerId || '',
                description1: aptData.description1 || aptData.notes || '',
                ...(archiveData ? filterAllowedFields(archiveData) : {}),
                archiveId: newId.toString(),
                archiveNumber: newId,
                sourceAppointmentId: appointmentId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
                status: 'active',
                workflowStatus: 'selection_pending'
            };

            // 4. Create archive and update counter
            const newDocRef = dbHandler.collection('archives').doc();
            transaction.set(newDocRef, mergedData);
            transaction.set(counterRef, { current: newId }, { merge: true });

            // 5. Delete the appointment
            transaction.delete(aptRef);

            return { id: newDocRef.id, archiveId: newId.toString() };
        });

        return { success: true, ...result };
    } catch (error) {
        console.error('Transfer Error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Randevu aktarımı başarısız: ' + error.message);
    }
});
