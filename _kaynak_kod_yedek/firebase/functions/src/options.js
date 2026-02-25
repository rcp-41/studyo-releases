/**
 * Options Cloud Functions
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;



// SECURITY: Field whitelist per type to prevent arbitrary field injection
const ALLOWED_FIELDS_BY_TYPE = {
    shootTypes: ['name', 'price', 'isActive', 'description', 'category'],
    locations: ['name', 'address', 'isActive', 'description'],
    photographers: ['name', 'phone', 'email', 'isActive', 'description'],
    packages: ['name', 'price', 'description', 'shootTypeId', 'isActive', 'items']
};

// Generic Save Helper
const saveOption = async (request, type) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // GÜVENLİK: Sadece admin seçenekleri değiştirebilir
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data;
    if (!data) throw new HttpsError('invalid-argument', 'Missing data');

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const collectionRef = dbHandler.collection(type);
        let docRef;

        if (data.id) {
            docRef = collectionRef.doc(data.id);
        } else {
            docRef = collectionRef.doc();
        }

        // SECURITY: Filter to allowed fields only
        const allowedFields = ALLOWED_FIELDS_BY_TYPE[type] || [];
        const saveData = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                saveData[field] = data[field];
            }
        }

        saveData.updatedAt = FieldValue.serverTimestamp();
        saveData.updatedBy = request.auth.uid;

        if (!data.id) {
            saveData.createdAt = FieldValue.serverTimestamp();
        }

        await docRef.set(saveData, { merge: true });

        return { id: docRef.id, success: true };
    } catch (error) {
        console.error(`Save ${type} Error:`, error);
        throw new HttpsError('internal', 'Kaydetme başarısız oldu.');
    }
};

// Generic Delete Helper
const deleteOption = async (request, type) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // GÜVENLİK: Sadece admin seçenekleri silebilir
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'Missing id');

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        await dbHandler.collection(type).doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error(`Delete ${type} Error:`, error);
        throw new HttpsError('internal', 'Silme başarısız oldu.');
    }
};

// --- Exported Functions (Matched to api.js calls) ---

// Shoot Types
exports.saveShootType = onCall({ enforceAppCheck: false }, (req) => saveOption(req, 'shootTypes'));
exports.deleteShootType = onCall({ enforceAppCheck: false }, (req) => deleteOption(req, 'shootTypes'));

// Locations
exports.saveLocation = onCall({ enforceAppCheck: false }, (req) => saveOption(req, 'locations'));
exports.deleteLocation = onCall({ enforceAppCheck: false }, (req) => deleteOption(req, 'locations'));

// Photographers
exports.savePhotographer = onCall({ enforceAppCheck: false }, (req) => saveOption(req, 'photographers'));
exports.deletePhotographer = onCall({ enforceAppCheck: false }, (req) => deleteOption(req, 'photographers'));

// Packages
exports.savePackage = onCall({ enforceAppCheck: false }, (req) => saveOption(req, 'packages'));
exports.deletePackage = onCall({ enforceAppCheck: false }, (req) => deleteOption(req, 'packages'));

/**
 * Get Options (studio-scoped)
 * Returns shootTypes, locations, photographers, or packages for the current studio
 */
exports.get = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { type } = request.data || {};
    const validTypes = ['shootTypes', 'locations', 'photographers', 'packages'];

    if (!type || !validTypes.includes(type)) {
        throw new HttpsError('invalid-argument', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection(type).get();
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { data: items };
    } catch (error) {
        console.error(`Get ${type} Error:`, error);
        throw new HttpsError('internal', `${type} listesi alınamadı.`);
    }
});

// Convenience list functions (frontend calls these directly)
const listByType = (type) => onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    const dbHandler = DatabaseHandler.fromRequest(request);
    try {
        const snapshot = await dbHandler.collection(type).get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { data: items };
    } catch (error) {
        console.error(`List ${type} Error:`, error);
        throw new HttpsError('internal', `${type} listesi alınamadı.`);
    }
});

exports.listShootTypes = listByType('shootTypes');
exports.listLocations = listByType('locations');
exports.listPhotographers = listByType('photographers');
exports.listPackages = listByType('packages');
