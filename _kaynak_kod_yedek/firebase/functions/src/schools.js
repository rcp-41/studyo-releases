/**
 * Schools Cloud Functions
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const { schoolSchema, validate } = require('./validators/schemas');

const FieldValue = admin.firestore.FieldValue;

const ALLOWED_SCHOOL_FIELDS = [
    'name', 'address', 'classes', 'contactPerson', 'contactPhone', 'isActive'
];

const filterAllowedFields = (data) => {
    const filtered = {};
    for (const field of ALLOWED_SCHOOL_FIELDS) {
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

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('schools')
            .orderBy('name', 'asc')
            .get();

        const schools = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { data: schools };
    } catch (error) {
        console.error('List Schools Error:', error);
        throw new HttpsError('internal', 'Okul listesi alınamadı');
    }
});

exports.create = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data;
    validate(schoolSchema, data, 'okul');

    const dbHandler = DatabaseHandler.fromRequest(request);
    const filtered = filterAllowedFields(data);

    try {
        const docRef = await dbHandler.collection('schools').add({
            ...filtered,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Create School Error:', error);
        throw new HttpsError('internal', 'Okul oluşturulamadı');
    }
});

exports.update = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id, data } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'School ID required');

    validate(schoolSchema.partial(), data, 'okul');

    const dbHandler = DatabaseHandler.fromRequest(request);
    const filtered = filterAllowedFields(data);

    try {
        await dbHandler.collection('schools').doc(id).update({
            ...filtered,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
        });

        return { success: true };
    } catch (error) {
        console.error('Update School Error:', error);
        throw new HttpsError('internal', 'Okul güncellenemedi');
    }
});

exports.delete = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'School ID required');

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        await dbHandler.collection('schools').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Delete School Error:', error);
        throw new HttpsError('internal', 'Okul silinemedi');
    }
});
