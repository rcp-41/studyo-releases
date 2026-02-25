/**
 * Customers Cloud Functions
 * Customer management
 *
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { customerSchema, validate } = require('./validators/schemas');

const FieldValue = admin.firestore.FieldValue;

/**
 * List customers with pagination and search
 */
exports.listCustomers = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const { page = 1, limit = 12, search = '' } = request.data || {};
        const offset = (page - 1) * limit;

        let query = dbHandler.collection('customers');

        if (search) {
            query = query.where('fullName', '>=', search)
                .where('fullName', '<=', search + '\uf8ff');
        }

        const countSnapshot = await query.get();
        const total = countSnapshot.size;

        const snapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .get();

        const customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return {
            success: true,
            data: customers,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    } catch (error) {
        console.error('List customers error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get customer by ID
 */
exports.getCustomer = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { customerId } = request.data || {};

    if (!customerId) {
        throw new HttpsError('invalid-argument', 'customerId is required');
    }

    try {
        const doc = await dbHandler.collection('customers').doc(customerId).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Customer not found');
        }

        return {
            success: true,
            data: { id: doc.id, ...doc.data() }
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Get customer error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get customer's shoots
 */
exports.getCustomerShoots = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { customerId } = request.data || {};

    if (!customerId) {
        throw new HttpsError('invalid-argument', 'customerId is required');
    }

    try {
        const snapshot = await dbHandler.collection('shoots')
            .where('customerId', '==', customerId)
            .orderBy('shootDate', 'desc')
            .get();

        const shoots = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: shoots };
    } catch (error) {
        console.error('Get customer shoots error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Update customer
 */
exports.updateCustomer = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { customerId, updates } = request.data || {};

    if (!customerId) {
        throw new HttpsError('invalid-argument', 'customerId is required');
    }

    const allowedFields = [
        'fullName', 'phone', 'email', 'customerType',
        'source', 'isVip', 'notes', 'address'
    ];

    const filteredUpdates = {};
    for (const field of allowedFields) {
        if (updates && updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }
    filteredUpdates.updatedAt = FieldValue.serverTimestamp();

    try {
        await dbHandler.collection('customers').doc(customerId).update(filteredUpdates);

        return { success: true };
    } catch (error) {
        console.error('Update customer error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Search customers (for autocomplete)
 */
exports.searchCustomers = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { query = '', limit = 10 } = request.data || {};

    if (query.length < 2) {
        return { success: true, data: [] };
    }

    try {
        const snapshot = await dbHandler.collection('customers')
            .where('fullName', '>=', query)
            .where('fullName', '<=', query + '\uf8ff')
            .limit(limit)
            .get();

        const customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: customers };
    } catch (error) {
        console.error('Search customers error:', error);
        throw new HttpsError('internal', 'Müşteri arama başarısız oldu.');
    }
});

/**
 * Lookup customer by phone number (exact match)
 * Used in ArchiveModal to auto-fill customer info
 */
exports.lookupByPhone = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { phone } = request.data || {};

    if (!phone || phone.length < 4) {
        return { success: true, data: null };
    }

    try {
        // Clean phone for matching
        const cleanedPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

        const snapshot = await dbHandler.collection('customers')
            .where('phone', '==', cleanedPhone)
            .limit(1)
            .get();

        if (snapshot.empty) {
            // Also try with original format
            const snapshot2 = await dbHandler.collection('customers')
                .where('phone', '==', phone.trim())
                .limit(1)
                .get();

            if (snapshot2.empty) {
                return { success: true, data: null };
            }

            const doc = snapshot2.docs[0];
            return { success: true, data: { id: doc.id, ...doc.data() } };
        }

        const doc = snapshot.docs[0];
        return { success: true, data: { id: doc.id, ...doc.data() } };
    } catch (error) {
        console.error('Lookup by phone error:', error);
        throw new HttpsError('internal', 'Müşteri arama başarısız oldu.');
    }
});

/**
 * Create a new customer
 */
exports.create = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const data = request.data || {};

    // Zod validation
    validate(customerSchema.partial(), data, 'müşteri');

    const { fullName, phone, email, customerType, source, notes, address } = data;

    if (!fullName) {
        throw new HttpsError('invalid-argument', 'fullName is required');
    }

    try {
        const customerData = {
            fullName,
            phone: phone || '',
            email: email || '',
            customerType: customerType || 'individual',
            source: source || 'walk-in',
            notes: notes || '',
            address: address || '',
            isVip: false,
            totalShoots: 0,
            totalSpent: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        };

        const docRef = await dbHandler.collection('customers').add(customerData);

        return {
            success: true,
            data: { id: docRef.id, ...customerData }
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Create customer error:', error);
        throw new HttpsError('internal', 'Müşteri oluşturma başarısız oldu.');
    }
});

/**
 * Delete a customer
 */
exports.delete = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { id } = request.data || {};

    if (!id) {
        throw new HttpsError('invalid-argument', 'id is required');
    }

    try {
        const doc = await dbHandler.collection('customers').doc(id).get();
        if (!doc.exists) {
            throw new HttpsError('not-found', 'Müşteri bulunamadı.');
        }

        await dbHandler.collection('customers').doc(id).delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete customer error:', error);
        throw new HttpsError('internal', 'Müşteri silme başarısız oldu.');
    }
});

/**
 * Sync customers from existing archive records (one-time operation)
 * Scans all archives, groups by phone, creates customer records
 */
exports.syncCustomersFromArchives = onCall({
    enforceAppCheck: false,
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const db = require('firebase-admin').firestore();

    try {
        // 1. Get archives from BOTH root-level (legacy) and studio-scoped collections
        const archives = [];

        // Root-level archives (legacy migrated data)
        const rootArchivesSnap = await db.collection('archives').get();
        rootArchivesSnap.forEach(doc => {
            archives.push({ id: doc.id, source: 'root', ...doc.data() });
        });

        // Studio-scoped archives
        const studioArchivesSnap = await dbHandler.collection('archives').get();
        studioArchivesSnap.forEach(doc => {
            archives.push({ id: doc.id, source: 'studio', ...doc.data() });
        });

        // 2. Get existing customers to avoid duplicates
        const existingSnap = await dbHandler.collection('customers').get();
        const existingPhones = new Set();
        const existingEmails = new Set();
        existingSnap.forEach(doc => {
            const d = doc.data();
            if (d.phone) existingPhones.add(d.phone.trim());
            if (d.email) existingEmails.add(d.email.trim());
        });

        // 3. Group archives by phone (primary) or email (fallback)
        const customerMap = new Map();
        let skippedNoContact = 0;
        const MAX_ARCHIVE_IDS = 50; // Cap to prevent exceeding Firestore doc size limit

        // Placeholder / invalid phone check
        const isValidPhone = (p) => {
            if (!p) return false;
            const digits = p.replace(/[^0-9]/g, '');
            if (digits.length < 7) return false;
            if (/^0+$/.test(digits)) return false; // all zeros
            return true;
        };

        for (const arc of archives) {
            const rawPhone = (arc.phone || arc.customerPhone || '').trim();
            const email = (arc.email || arc.customerEmail || '').trim();
            const fullName = arc.fullName || arc.customerName || '';
            const phone = isValidPhone(rawPhone) ? rawPhone : '';

            if (!phone && !email) {
                skippedNoContact++;
                continue;
            }

            const key = phone || email;

            if (customerMap.has(key)) {
                const existing = customerMap.get(key);
                if (existing.archiveIds.length < MAX_ARCHIVE_IDS) {
                    existing.archiveIds.push(arc.id);
                    existing.archiveNumbers.push(arc.archiveNumber || arc.archiveId || arc.id || '');
                }
                existing.totalShoots++;
                existing.totalSpent += (arc.totalAmount || 0);
                if (email && !existing.email) existing.email = email;
                if (fullName && existing.fullName === 'İsimsiz') existing.fullName = fullName;
            } else {
                customerMap.set(key, {
                    fullName: fullName || 'İsimsiz',
                    phone,
                    email,
                    archiveIds: [arc.id],
                    archiveNumbers: [arc.archiveNumber || arc.archiveId || arc.id || ''],
                    totalShoots: 1,
                    totalSpent: arc.totalAmount || 0
                });
            }
        }

        // 4. Create customer records (skip existing)
        let created = 0;
        let skippedExisting = 0;
        const FieldValue = require('firebase-admin').firestore.FieldValue;
        let batch = db.batch();
        let batchCount = 0;

        for (const [key, cust] of customerMap) {
            if (cust.phone && existingPhones.has(cust.phone)) { skippedExisting++; continue; }
            if (cust.email && existingEmails.has(cust.email)) { skippedExisting++; continue; }

            const docRef = dbHandler.collection('customers').doc();
            batch.set(docRef, {
                fullName: cust.fullName,
                phone: cust.phone,
                email: cust.email,
                customerType: 'individual',
                source: 'archive',
                notes: '',
                isVip: false,
                totalShoots: cust.totalShoots,
                totalSpent: cust.totalSpent,
                archiveIds: cust.archiveIds,
                archiveNumbers: cust.archiveNumbers,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: 'archive-sync'
            });
            batchCount++;
            created++;

            if (batchCount >= 450) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return {
            success: true,
            totalArchives: archives.length,
            uniqueCustomers: customerMap.size,
            created,
            skippedNoContact,
            skippedExisting,
            existingCustomersBefore: existingSnap.size
        };
    } catch (error) {
        console.error('Sync customers from archives error:', error);
        throw new HttpsError('internal', 'Müşteri senkronizasyonu başarısız: ' + error.message);
    }
});
