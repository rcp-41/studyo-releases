/**
 * Auth Cloud Functions
 * Authentication-related functions (profile)
 *
 * User management (CRUD) is in users.js
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

/**
 * Get current user profile
 * Multi-Tenant: reads from studios/{studioId}/users/{uid}
 * Fallback to top-level users for creator accounts
 */
exports.getProfile = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User ID not found');
    }

    try {
        const studioId = request.auth.token?.studioId;
        let doc;

        if (studioId) {
            // Studio user: read from studio subcollection
            doc = await db.collection('studios').doc(studioId).collection('users').doc(uid).get();
        }

        // Fallback: top-level users (creator users or migration period)
        if (!doc || !doc.exists) {
            doc = await db.collection('users').doc(uid).get();
        }

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Kullanıcı profili bulunamadı.');
        }
        return { uid, ...doc.data() };
    } catch (error) {
        if (error.code) throw error;
        console.error('GetProfile Error:', error);
        throw new HttpsError('internal', 'Profil yükleme başarısız oldu.');
    }
});
