/**
 * H3 — Feature Flag Yönetimi
 * Koleksiyon: featureFlags/{flagKey}
 * Callables: listFeatureFlags, setFeatureFlag, setStudioFlagOverride, getStudioFlags
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { checkRateLimit } = require('./rateLimit');
const { logAudit } = require('./auditHelper');

const db = admin.firestore();

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

exports.listFeatureFlags = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const snap = await db.collection('featureFlags').orderBy('key').get();
    const flags = snap.docs.map(d => d.data());
    return { flags };
});

exports.setFeatureFlag = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    await checkRateLimit(`featureFlag_${request.auth.uid}`, 60, 3600000);

    const { key, defaultValue, description } = request.data;
    if (!key) throw new HttpsError('invalid-argument', 'key required');
    if (defaultValue === undefined) throw new HttpsError('invalid-argument', 'defaultValue required');

    const flagRef = db.collection('featureFlags').doc(key);
    const existing = await flagRef.get();
    const update = {
        key,
        defaultValue,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (description !== undefined) update.description = description;

    if (!existing.exists) {
        update.overrides = {};
        update.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await flagRef.set(update);
    } else {
        await flagRef.update(update);
    }

    await logAudit(request.auth.uid, 'feature_flag_set', { key, defaultValue });

    return { success: true };
});

exports.setStudioFlagOverride = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId, key, value } = request.data;
    if (!studioId || !key) throw new HttpsError('invalid-argument', 'studioId and key required');
    if (value === undefined) throw new HttpsError('invalid-argument', 'value required');

    const flagRef = db.collection('featureFlags').doc(key);
    const doc = await flagRef.get();
    if (!doc.exists) throw new HttpsError('not-found', `Flag '${key}' not found`);

    await flagRef.update({
        [`overrides.${studioId}`]: value,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logAudit(request.auth.uid, 'studio_flag_override', { studioId, key, value });

    return { success: true };
});

exports.getStudioFlags = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');

    const { studioId } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const snap = await db.collection('featureFlags').get();
    const merged = {};

    snap.docs.forEach(d => {
        const flag = d.data();
        const value = (flag.overrides && flag.overrides[studioId] !== undefined)
            ? flag.overrides[studioId]
            : flag.defaultValue;
        merged[flag.key] = value;
    });

    return { flags: merged };
});

exports.deleteStudioFlagOverride = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId, key } = request.data;
    if (!studioId || !key) throw new HttpsError('invalid-argument', 'studioId and key required');

    const flagRef = db.collection('featureFlags').doc(key);
    await flagRef.update({
        [`overrides.${studioId}`]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logAudit(request.auth.uid, 'studio_flag_override_deleted', { studioId, key });
    return { success: true };
});
