const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('../handlers/DatabaseHandler');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();

exports.validateSerialKey = onCall({ enforceAppCheck: false }, async (request) => {
    const clientIp = request.rawRequest?.ip || 'unknown';
    await checkRateLimit(`validateSerialKey_${clientIp}`, 10, 600000);

    const { serialKey } = request.data;

    if (!serialKey || typeof serialKey !== 'string') {
        throw new HttpsError('invalid-argument', 'Serial key is required');
    }

    const cleanKey = serialKey.trim().toUpperCase();

    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
        throw new HttpsError('invalid-argument', 'Invalid serial key format. Expected: XXXX-XXXX-XXXX-XXXX');
    }

    try {
        const studiosSnap = await db.collectionGroup('studios')
            .where('license.license_key', '==', cleanKey)
            .limit(1)
            .get();

        if (!studiosSnap.empty) {
            const studioDoc = studiosSnap.docs[0];
            const studioData = studioDoc.data();
            const orgRef = studioDoc.ref.parent.parent;
            const orgId = orgRef ? orgRef.id : null;

            return {
                success: true,
                studioId: studioDoc.id,
                organizationId: orgId,
                studioName: studioData.info?.name || 'Studio'
            };
        }

        throw new HttpsError('not-found', 'No studio found with this serial key');
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        console.error('Error validating serial key:', error);
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

exports.checkSubscription = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    try {
        const studioDoc = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const data = studioDoc.data();
        const status = data.info?.subscription_status || 'active';
        const license = data.license || {};

        return {
            success: true,
            subscription_status: status,
            hwid_registered: license.hwid_registered || false,
            hwid_lock: license.hwid_lock || null,
            expires_at: license.expires_at || null,
            is_active: license.is_active !== false
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('checkSubscription error:', error);
        throw new HttpsError('internal', 'Abonelik durumu kontrol edilemedi');
    }
});

exports.resetHwid = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);

        await studioRef.update({
            'license.hwid_lock': null,
            'license.mac_address': null,
            'license.hwid_registered': false,
            'license.registered_at': null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await studioRef.collection('auditLogs').add({
            action: 'hwid_reset',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('resetHwid error:', error);
        throw new HttpsError('internal', 'HWID sıfırlama başarısız');
    }
});

exports.regenerateLicenseKey = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const newKey = DatabaseHandler.generateLicenseKey();

        await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).update({
                'license.license_key': newKey,
                'license.hwid_lock': null,
                'license.hwid_registered': false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        return { success: true, newLicenseKey: newKey };
    } catch (error) {
        console.error('regenerateLicenseKey error:', error);
        throw new HttpsError('internal', 'Lisans anahtarı yenileme başarısız');
    }
});
