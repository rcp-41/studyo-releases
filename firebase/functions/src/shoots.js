/**
 * Shoots Cloud Functions
 * Photography session management
 *
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const {
    shootSchema,
    shootIdSchema,
    shootListSchema,
    shootUpdateSchema,
    shootStatusUpdateSchema,
    shootPaymentSchema,
    shootAssignSchema,
    shootDateRangeSchema,
    validate
} = require('./validators/schemas');

const FieldValue = admin.firestore.FieldValue;

/**
 * List shoots with pagination and filters
 */
exports.listShoots = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const validated = validate(shootListSchema, request.data || {}, 'çekim listesi');

    try {
        const { page, limit, status, search } = validated;
        const offset = (page - 1) * limit;

        let query = dbHandler.collection('shoots');

        if (status) {
            query = query.where('status', '==', status);
        }

        if (search) {
            query = query.where('shootCode', '>=', search)
                .where('shootCode', '<=', search + '\uf8ff');
        }

        const countSnapshot = await query.get();
        const total = countSnapshot.size;

        const snapshot = await query
            .orderBy('shootDate', 'desc')
            .limit(limit)
            .offset(offset)
            .get();

        const shoots = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return {
            success: true,
            data: shoots,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        };
    } catch (error) {
        console.error('List shoots error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get shoot by ID
 */
exports.getShoot = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { shootId } = validate(shootIdSchema, request.data || {}, 'çekim');

    try {
        const doc = await dbHandler.collection('shoots').doc(shootId).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Shoot not found');
        }

        return {
            success: true,
            data: { id: doc.id, ...doc.data() }
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Get shoot error:', error);
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

/**
 * Update shoot (general update - date, customer, notes, etc.)
 */
exports.updateShoot = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const validated = validate(shootUpdateSchema, request.data || {}, 'çekim güncelleme');
    const { shootId, ...updateData } = validated;

    // Whitelist allowed fields
    const allowedFields = [
        'customerName', 'customerId', 'shootTypeId', 'shootTypeName',
        'locationId', 'locationName', 'photographerId', 'photographerName',
        'shootDate', 'timeSlot', 'packageId', 'notes', 'status', 'workflowStage',
        'totalAmount', 'paidAmount', 'remainingAmount', 'paymentStatus'
    ];

    const updates = {};
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            updates[field] = updateData[field];
        }
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    try {
        const docRef = dbHandler.collection('shoots').doc(shootId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Shoot not found');
        }

        await docRef.update(updates);

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Update shoot error:', error);
        throw new HttpsError('internal', 'Çekim güncelleme başarısız oldu.');
    }
});

/**
 * Update shoot status
 */
exports.updateShootStatus = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { shootId, status, workflowStage } = validate(shootStatusUpdateSchema, request.data || {}, 'çekim durumu');

    const validStatuses = [
        'new', 'scheduled', 'confirmed', 'shot_done', 'editing',
        'client_selection', 'payment_complete', 'delivered', 'cancelled'
    ];

    if (!validStatuses.includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid status');
    }

    try {
        const updates = { status, updatedAt: FieldValue.serverTimestamp() };
        if (workflowStage) {
            updates.workflowStage = workflowStage;
        }

        await dbHandler.collection('shoots').doc(shootId).update(updates);

        return { success: true };
    } catch (error) {
        console.error('Update shoot status error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Add payment to a shoot
 */
exports.addPayment = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { shootId, amount, method, note } = validate(shootPaymentSchema, request.data || {}, 'ödeme');

    try {
        const shootRef = dbHandler.collection('shoots').doc(shootId);
        const shootDoc = await shootRef.get();

        if (!shootDoc.exists) {
            throw new HttpsError('not-found', 'Shoot not found');
        }

        const shoot = shootDoc.data();
        const newPaidAmount = (shoot.paidAmount || 0) + Number(amount);
        const totalAmount = shoot.totalAmount || 0;
        const newRemaining = totalAmount - newPaidAmount;

        // Determine payment status
        let paymentStatus = 'partial';
        if (newRemaining <= 0) paymentStatus = 'paid';
        if (newPaidAmount <= 0) paymentStatus = 'unpaid';

        // Update shoot
        await shootRef.update({
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, newRemaining),
            paymentStatus,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Record payment in payments collection (for finance module)
        const paymentData = {
            shootId,
            customerName: shoot.customerName || '',
            archiveNumber: shoot.archiveNumber || shoot.shootCode || '',
            amount: Number(amount),
            method,
            note: note || '',
            date: new Date().toISOString(),
            createdBy: request.auth.uid,
            createdAt: FieldValue.serverTimestamp()
        };

        await dbHandler.collection('payments').add(paymentData);

        return { success: true, paidAmount: newPaidAmount, remainingAmount: Math.max(0, newRemaining), paymentStatus };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Add payment error:', error);
        throw new HttpsError('internal', 'Ödeme ekleme başarısız oldu.');
    }
});

/**
 * Assign photographer to shoot
 */
exports.assignPhotographer = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { shootId, photographerId } = validate(shootAssignSchema, request.data || {}, 'fotoğrafçı atama');

    try {
        const db = admin.firestore();
        const studioId = request.auth.token.studioId;
        const organizationId = request.auth.token.organizationId || null;
        // Read photographer from studio users subcollection (with legacy fallback)
        let photographerDoc;
        if (organizationId) {
            photographerDoc = await db.collection('organizations').doc(organizationId)
                .collection('studios').doc(studioId).collection('users').doc(photographerId).get();
        } else {
            photographerDoc = await db.collection('studios').doc(studioId)
                .collection('users').doc(photographerId).get();
        }

        if (!photographerDoc.exists) {
            throw new HttpsError('not-found', 'Photographer not found');
        }

        const photographer = photographerDoc.data();

        await dbHandler.collection('shoots').doc(shootId).update({
            photographerId,
            photographerName: photographer.fullName,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Assign photographer error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get shoots by date range
 */
exports.getShootsByDateRange = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { startDate, endDate } = validate(shootDateRangeSchema, request.data || {}, 'tarih aralığı');

    try {
        const snapshot = await dbHandler.collection('shoots')
            .where('shootDate', '>=', startDate)
            .where('shootDate', '<=', endDate)
            .orderBy('shootDate', 'asc')
            .get();

        const shoots = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: shoots };
    } catch (error) {
        console.error('Get shoots by date range error:', error);
        throw new HttpsError('internal', 'Çekim sorgusu başarısız oldu.');
    }
});

/**
 * Create a new shoot
 */
exports.create = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const data = request.data || {};

    // Zod validation
    const validated = validate(shootSchema, data, 'çekim');

    const { customerId, customerName, shootTypeId, shootTypeName,
        locationId, locationName, photographerId, photographerName,
        shootDate, timeSlot, packageId, notes } = validated;

    try {
        const shootData = {
            customerId,
            customerName: customerName || '',
            shootTypeId: shootTypeId || '',
            shootTypeName: shootTypeName || '',
            locationId: locationId || '',
            locationName: locationName || '',
            photographerId: photographerId || '',
            photographerName: photographerName || '',
            shootDate,
            timeSlot: timeSlot || '',
            packageId: packageId || '',
            notes: notes || '',
            status: 'scheduled',
            workflowStage: 'booked',
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paymentStatus: 'unpaid',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        };

        const docRef = await dbHandler.collection('shoots').add(shootData);

        return {
            success: true,
            data: { id: docRef.id, ...shootData }
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Create shoot error:', error);
        throw new HttpsError('internal', 'Çekim oluşturma başarısız oldu.');
    }
});
