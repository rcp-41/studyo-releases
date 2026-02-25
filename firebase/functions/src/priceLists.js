/**
 * Price Lists Cloud Functions
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { priceListSchema, validate } = require('./validators/schemas');

const FieldValue = admin.firestore.FieldValue;

const ALLOWED_PRICE_LIST_FIELDS = [
    'name', 'isActive',
    'vesikalik_biyometrik', 'standart_olculer', 'cogaltma_carpan',
    'yillik', 'cerceve', 'fotoblok', 'kanvas_tablo'
];

const filterAllowedFields = (data) => {
    const filtered = {};
    for (const field of ALLOWED_PRICE_LIST_FIELDS) {
        if (data[field] !== undefined) {
            filtered[field] = data[field];
        }
    }
    return filtered;
};

exports.list = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('priceLists')
            .orderBy('name', 'asc')
            .get();

        const priceLists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { data: priceLists };
    } catch (error) {
        console.error('List PriceLists Error:', error);
        throw new HttpsError('internal', 'Fiyat listesi alınamadı');
    }
});

exports.getActive = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('priceLists')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { data: null };
        }

        const doc = snapshot.docs[0];
        return { data: { id: doc.id, ...doc.data() } };
    } catch (error) {
        console.error('Get Active PriceList Error:', error);
        throw new HttpsError('internal', 'Aktif fiyat listesi alınamadı');
    }
});

exports.create = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data;
    validate(priceListSchema, data, 'fiyat listesi');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const filtered = filterAllowedFields(data);

    try {
        // If this one is active, deactivate others
        if (filtered.isActive) {
            const existing = await dbHandler.collection('priceLists')
                .where('isActive', '==', true)
                .get();
            const batch = admin.firestore().batch();
            existing.docs.forEach(doc => {
                batch.update(doc.ref, { isActive: false });
            });
            await batch.commit();
        }

        const docRef = await dbHandler.collection('priceLists').add({
            ...filtered,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Create PriceList Error:', error);
        throw new HttpsError('internal', 'Fiyat listesi oluşturulamadı');
    }
});

exports.update = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id, data } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'PriceList ID required');

    validate(priceListSchema.partial(), data, 'fiyat listesi');

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const filtered = filterAllowedFields(data);

    try {
        // If activating this one, deactivate others
        if (filtered.isActive) {
            const existing = await dbHandler.collection('priceLists')
                .where('isActive', '==', true)
                .get();
            const batch = admin.firestore().batch();
            existing.docs.forEach(doc => {
                if (doc.id !== id) {
                    batch.update(doc.ref, { isActive: false });
                }
            });
            await batch.commit();
        }

        await dbHandler.collection('priceLists').doc(id).update({
            ...filtered,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });

        return { success: true };
    } catch (error) {
        console.error('Update PriceList Error:', error);
        throw new HttpsError('internal', 'Fiyat listesi güncellenemedi');
    }
});

exports.delete = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'PriceList ID required');

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        await dbHandler.collection('priceLists').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Delete PriceList Error:', error);
        throw new HttpsError('internal', 'Fiyat listesi silinemedi');
    }
});
