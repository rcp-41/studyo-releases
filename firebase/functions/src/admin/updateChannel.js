/**
 * H4 — Electron-updater Kanal Yönetimi (per studio)
 * Callable: setStudioUpdateChannel, getUpdateConfig
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logAudit } = require('./auditHelper');

const db = admin.firestore();

const VALID_CHANNELS = ['stable', 'beta', 'canary'];

// Feed URLs per channel — configure via env or Firebase config
const FEED_URLS = {
    stable: process.env.UPDATE_FEED_STABLE || 'https://releases.studyo.app/stable/latest.yml',
    beta: process.env.UPDATE_FEED_BETA || 'https://releases.studyo.app/beta/latest.yml',
    canary: process.env.UPDATE_FEED_CANARY || 'https://releases.studyo.app/canary/latest.yml',
};

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

exports.setStudioUpdateChannel = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId, organizationId, channel, minVersion } = request.data;
    if (!studioId || !organizationId) throw new HttpsError('invalid-argument', 'studioId and organizationId required');
    if (!VALID_CHANNELS.includes(channel)) {
        throw new HttpsError('invalid-argument', `channel must be one of: ${VALID_CHANNELS.join(', ')}`);
    }

    const studioRef = db.collection('organizations').doc(organizationId)
        .collection('studios').doc(studioId);

    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    const update = {
        'update.channel': channel,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (minVersion) update['update.minVersion'] = minVersion;

    await studioRef.update(update);

    await logAudit(request.auth.uid, 'studio_update_channel_set', { studioId, organizationId, channel, minVersion });

    return { success: true };
});

/**
 * getUpdateConfig — called by Electron client to determine which feed URL to use.
 * Returns feedUrl, channel, minVersion for the studio.
 */
exports.getUpdateConfig = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');

    const { studioId, organizationId } = request.data;
    if (!studioId || !organizationId) throw new HttpsError('invalid-argument', 'studioId and organizationId required');

    const studioRef = db.collection('organizations').doc(organizationId)
        .collection('studios').doc(studioId);

    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    // Studio-level override or global config
    const studioData = studioDoc.data();
    const channel = studioData.update?.channel || 'stable';
    const minVersion = studioData.update?.minVersion || null;

    // Fallback to global appVersioning config
    const globalDoc = await db.collection('appVersioning').doc('config').get();
    const globalChannel = globalDoc.exists ? (globalDoc.data().defaultChannel || 'stable') : 'stable';

    const effectiveChannel = VALID_CHANNELS.includes(channel) ? channel : globalChannel;

    return {
        channel: effectiveChannel,
        feedUrl: FEED_URLS[effectiveChannel],
        minVersion,
    };
});
