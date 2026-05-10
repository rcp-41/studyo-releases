/**
 * E5 — Online Indicator
 * Callable: getOnlineUsers(studioId) → last 60s active users
 * Client heartbeat writes to studios/{sId}/onlineUsers/{uid} directly via Firestore SDK.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

exports.getOnlineUsers = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60000));

    // Find studio across orgs to get the correct path
    const orgsSnap = await db.collection('organizations').get();
    let onlineSnap = null;

    for (const orgDoc of orgsSnap.docs) {
        const studioDoc = await orgDoc.ref.collection('studios').doc(studioId).get();
        if (studioDoc.exists) {
            onlineSnap = await studioDoc.ref.collection('onlineUsers')
                .where('lastHeartbeatAt', '>=', cutoff)
                .get();
            break;
        }
    }

    if (!onlineSnap) {
        return { count: 0, users: [] };
    }

    const users = onlineSnap.docs.map(d => ({
        uid: d.id,
        lastHeartbeatAt: d.data().lastHeartbeatAt?.toDate?.()?.toISOString() || null,
        displayName: d.data().displayName || null,
    }));

    return { count: users.length, users };
});

/**
 * heartbeat — called by Electron client every 30s.
 * Writes to studios/{sId}/onlineUsers/{uid}.
 * Any authenticated studio user can call this (not creator-only).
 */
exports.heartbeat = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');

    const { studioId, organizationId, displayName } = request.data;
    if (!studioId || !organizationId) {
        throw new HttpsError('invalid-argument', 'studioId and organizationId required');
    }

    const ref = db
        .collection('organizations').doc(organizationId)
        .collection('studios').doc(studioId)
        .collection('onlineUsers').doc(request.auth.uid);

    await ref.set({
        lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: displayName || null,
    }, { merge: true });

    return { success: true };
});
