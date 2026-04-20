/**
 * Pixonai Cloud Functions
 * Dynamic photo selection options per shootCategory
 * 
 * Multi-Tenant: Uses DatabaseHandler for studio-scoped data access
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const FieldValue = admin.firestore.FieldValue;

/**
 * Get all Pixonai configs for the studio
 */
exports.getConfigs = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('pixonaiConfigs').get();
        const configs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return { configs };
    } catch (error) {
        console.error('getConfigs error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get a single Pixonai config by shootCategoryId
 */
exports.getConfig = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { shootCategoryId } = request.data || {};
    if (!shootCategoryId) {
        throw new HttpsError('invalid-argument', 'shootCategoryId is required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const snapshot = await dbHandler.collection('pixonaiConfigs')
            .where('shootCategoryId', '==', shootCategoryId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { config: null };
        }

        const doc = snapshot.docs[0];
        return {
            config: { id: doc.id, ...doc.data() }
        };
    } catch (error) {
        console.error('getConfig error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Save (create or update) a Pixonai config
 */
exports.saveConfig = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data || {};
    const { id, shootCategoryId, shootCategoryLabel, options, packages, type, schoolId, className } = data;

    if (!shootCategoryId || !shootCategoryLabel) {
        throw new HttpsError('invalid-argument', 'shootCategoryId and shootCategoryLabel are required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const configData = {
            shootCategoryId,
            shootCategoryLabel,
            type: type || 'custom', // yearly, set, portrait, custom
            schoolId: schoolId || '',
            className: className || '',
            options: (options || []).map((opt, idx) => ({
                id: opt.id || `opt_${idx}`,
                name: opt.name || '',
                abbr: opt.abbr || '',
                price: Number(opt.price) || 0,
                type: opt.type || 'select',
                values: opt.values || [],
                min: opt.min ?? 0,
                max: opt.max ?? 50,
                maxSelections: Number(opt.maxSelections) || 0,
            })),
            packages: (packages || []).map((pkg, idx) => ({
                id: pkg.id || `pkg_${idx}`,
                name: pkg.name || '',
                abbr: pkg.abbr || '',
                price: Number(pkg.price) || 0,
                photoCount: Number(pkg.photoCount) || 0,
                description: pkg.description || '',
                gifts: (pkg.gifts || []).map(g => ({
                    name: g.name || '',
                    abbr: g.abbr || '',
                    quantity: Number(g.quantity) || 1,
                    maxSelections: Number(g.maxSelections) || 1,
                })),
            })),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (id) {
            // Update existing
            await dbHandler.collection('pixonaiConfigs').doc(id).update(configData);
            return { success: true, id };
        } else {
            // Check for duplicate shootCategoryId
            const existing = await dbHandler.collection('pixonaiConfigs')
                .where('shootCategoryId', '==', shootCategoryId)
                .limit(1)
                .get();

            if (!existing.empty) {
                throw new HttpsError('already-exists', 'Bu kategori için zaten bir yapılandırma mevcut');
            }

            configData.createdAt = FieldValue.serverTimestamp();
            const docRef = await dbHandler.collection('pixonaiConfigs').add(configData);
            return { success: true, id: docRef.id };
        }
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('saveConfig error:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Delete a Pixonai config
 */
exports.deleteConfig = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { id } = request.data || {};
    if (!id) {
        throw new HttpsError('invalid-argument', 'Config id is required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        await dbHandler.collection('pixonaiConfigs').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('deleteConfig error:', error);
        throw new HttpsError('internal', error.message);
    }
});
