/**
 * Settings Cloud Functions
 * 
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const FieldValue = admin.firestore.FieldValue;



/**
 * Get all settings
 */
exports.getAll = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('settings').get();
        const settings = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            // Group by category
            if (!settings[data.category]) {
                settings[data.category] = {};
            }
            settings[data.category][doc.id] = data.value;
        });

        return settings;
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

// Fields that studio admin can update (Creator Panel controls studioName, phone, email, address)
const STUDIO_ADMIN_ALLOWED_SETTINGS = ['archivePath', 'archive_base_path', 'whatsapp', 'whatsapp_enabled', 'backupPath', 'backupSchedule'];

/**
 * Update settings — studio admin can only update archivePath and backup settings
 * Studio name, phone, email, address are controlled by Creator Panel (super_admin only)
 */
exports.update = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { settings } = request.data;

    if (!settings || typeof settings !== 'object') {
        throw new HttpsError('invalid-argument', 'Settings object required');
    }

    try {
        const batch = dbHandler.batch();

        for (const [category, categorySettings] of Object.entries(settings)) {
            if (typeof categorySettings === 'object' && categorySettings !== null) {
                for (const [key, value] of Object.entries(categorySettings)) {
                    // Studio admin can only modify allowed settings
                    if (!STUDIO_ADMIN_ALLOWED_SETTINGS.includes(key)) continue;
                    const docRef = dbHandler.collection('settings').doc(key);
                    batch.set(docRef, {
                        value,
                        category,
                        valueType: typeof value,
                        updatedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            } else {
                if (!STUDIO_ADMIN_ALLOWED_SETTINGS.includes(category)) continue;
                const docRef = dbHandler.collection('settings').doc(category);
                batch.set(docRef, {
                    value: categorySettings,
                    valueType: typeof categorySettings,
                    category: 'general',
                    updatedAt: FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }

        await batch.commit();
        return { success: true };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get single setting
 */
exports.get = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);
    const { key } = request.data;

    if (!key) {
        throw new HttpsError('invalid-argument', 'Setting key required');
    }

    try {
        const doc = await dbHandler.collection('settings').doc(key).get();
        if (!doc.exists) {
            return { value: null };
        }
        return doc.data();
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});
