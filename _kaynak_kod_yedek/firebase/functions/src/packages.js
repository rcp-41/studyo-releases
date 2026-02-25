/**
 * Packages Cloud Functions
 *
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

/**
 * List packages
 */
exports.list = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('packages')
            .orderBy('name', 'asc')
            .get();

        const packages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, data: packages };
    } catch (error) {
        console.error('List packages error:', error);
        throw new HttpsError('internal', 'Paket listeleme başarısız oldu.');
    }
});
