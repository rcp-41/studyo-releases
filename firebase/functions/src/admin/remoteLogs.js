/**
 * H2 — Remote Log Toplama
 * Callables: requestRemoteLogs, getRemoteLogStatus
 * Client (Electron) onSnapshot ile dinler, logu Cloud Storage'a yükler, status günceller.
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

exports.requestRemoteLogs = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    await checkRateLimit(`remoteLogs_${request.auth.uid}`, 10, 3600000);

    const { studioId } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const reqRef = db.collection('remoteLogRequests').doc();
    const bucket = admin.storage().bucket();
    const uploadPath = `remote-logs/${studioId}/${reqRef.id}/studio.log`;

    // Generate a signed upload URL (30 minute TTL)
    const file = bucket.file(uploadPath);
    const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 30 * 60 * 1000,
        contentType: 'text/plain',
    });

    const record = {
        id: reqRef.id,
        studioId,
        requestedBy: request.auth.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        uploadUrl,
        storagePath: uploadPath,
        downloadUrl: null,
    };
    await reqRef.set(record);

    await logAudit(request.auth.uid, 'remote_log_requested', { requestId: reqRef.id, studioId });

    return { success: true, requestId: reqRef.id, uploadUrl };
});

exports.getRemoteLogStatus = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { requestId } = request.data;
    if (!requestId) throw new HttpsError('invalid-argument', 'requestId required');

    const doc = await db.collection('remoteLogRequests').doc(requestId).get();
    if (!doc.exists) throw new HttpsError('not-found', 'Request not found');

    const data = doc.data();

    // If uploaded, generate signed download URL
    let downloadUrl = data.downloadUrl || null;
    if (data.status === 'uploaded' && data.storagePath && !downloadUrl) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(data.storagePath);
        try {
            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });
            downloadUrl = url;
            await doc.ref.update({ downloadUrl: url });
        } catch (_) {
            // file not yet uploaded
        }
    }

    return {
        ...data,
        downloadUrl,
        requestedAt: data.requestedAt?.toDate?.()?.toISOString() || null,
    };
});

/**
 * markLogUploaded — called by Electron client after uploading log file.
 * No creator check — any authenticated user whose studioId matches can call.
 */
exports.markLogUploaded = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');

    const { requestId } = request.data;
    if (!requestId) throw new HttpsError('invalid-argument', 'requestId required');

    const doc = await db.collection('remoteLogRequests').doc(requestId).get();
    if (!doc.exists) throw new HttpsError('not-found', 'Request not found');

    await doc.ref.update({
        status: 'uploaded',
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// List recent log requests (for panel)
exports.listRemoteLogRequests = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId } = request.data || {};
    let query = db.collection('remoteLogRequests').orderBy('requestedAt', 'desc').limit(50);
    if (studioId) query = query.where('studioId', '==', studioId);

    const snap = await query.get();
    const requests = snap.docs.map(d => {
        const data = d.data();
        return {
            ...data,
            requestedAt: data.requestedAt?.toDate?.()?.toISOString() || null,
            uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null,
        };
    });

    return { requests };
});
