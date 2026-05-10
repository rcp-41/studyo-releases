/**
 * D3 — Toplu Migration / Bulk Operations
 * Callable: bulkOperation — job oluştur + arka planda işle
 * Scheduler: processBulkJobs (her dakika)
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { checkRateLimit } = require('./rateLimit');
const { logAudit } = require('./auditHelper');

const db = admin.firestore();

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

const VALID_OPERATIONS = ['updatePlan', 'updateSubscription', 'sendAnnouncement', 'export', 'backup'];

// ─── Create bulk job ────────────────────────────────────────────────────────

exports.bulkOperation = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    await checkRateLimit(`bulkOp_${request.auth.uid}`, 20, 3600000);

    const { operation, studioIds, params = {} } = request.data;

    if (!VALID_OPERATIONS.includes(operation)) {
        throw new HttpsError('invalid-argument', `operation must be one of: ${VALID_OPERATIONS.join(', ')}`);
    }
    if (!Array.isArray(studioIds) || studioIds.length === 0) {
        throw new HttpsError('invalid-argument', 'studioIds must be a non-empty array');
    }
    if (studioIds.length > 200) {
        throw new HttpsError('invalid-argument', 'Maximum 200 studios per bulk job');
    }

    const jobRef = db.collection('bulkJobs').doc();
    const job = {
        id: jobRef.id,
        operation,
        studioIds,
        params,
        status: 'queued',
        totalCount: studioIds.length,
        doneCount: 0,
        failedCount: 0,
        errors: [],
        createdBy: request.auth.uid,
        startedAt: null,
        completedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await jobRef.set(job);

    await logAudit(request.auth.uid, 'bulk_job_created', { jobId: jobRef.id, operation, count: studioIds.length });

    return { success: true, jobId: jobRef.id };
});

// ─── List bulk jobs ─────────────────────────────────────────────────────────

exports.listBulkJobs = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const snap = await db.collection('bulkJobs')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    const jobs = snap.docs.map(d => {
        const data = d.data();
        return {
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            startedAt: data.startedAt?.toDate?.()?.toISOString() || null,
            completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        };
    });

    return { jobs };
});

// ─── Get single job ─────────────────────────────────────────────────────────

exports.getBulkJob = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    const { jobId } = request.data;
    if (!jobId) throw new HttpsError('invalid-argument', 'jobId required');

    const doc = await db.collection('bulkJobs').doc(jobId).get();
    if (!doc.exists) throw new HttpsError('not-found', 'Job not found');

    const data = doc.data();
    return {
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        startedAt: data.startedAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
    };
});

// ─── Scheduler: process queued jobs ─────────────────────────────────────────

exports.processBulkJobs = onSchedule('every 1 minutes', async () => {
    const snap = await db.collection('bulkJobs')
        .where('status', '==', 'queued')
        .orderBy('createdAt', 'asc')
        .limit(3)
        .get();

    if (snap.empty) return;

    for (const jobDoc of snap.docs) {
        const job = jobDoc.data();
        const jobRef = jobDoc.ref;

        await jobRef.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        let doneCount = 0;
        let failedCount = 0;
        const errors = [];

        for (const studioId of job.studioIds) {
            try {
                await processStudioOperation(job.operation, studioId, job.params || {});
                doneCount++;
            } catch (err) {
                failedCount++;
                errors.push({ studioId, error: err.message || String(err) });
            }
        }

        await jobRef.update({
            status: failedCount === job.studioIds.length ? 'failed' : 'done',
            doneCount,
            failedCount,
            errors,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[bulkJobs] job=${jobDoc.id} op=${job.operation} done=${doneCount} failed=${failedCount}`);
    }
});

// ─── Per-studio operation dispatch ──────────────────────────────────────────

async function processStudioOperation(operation, studioId, params) {
    // Find the studio across organizations
    const orgsSnap = await db.collection('organizations').get();
    let studioRef = null;

    for (const orgDoc of orgsSnap.docs) {
        const studioDoc = await orgDoc.ref.collection('studios').doc(studioId).get();
        if (studioDoc.exists) {
            studioRef = studioDoc.ref;
            break;
        }
    }

    if (!studioRef) throw new Error(`Studio not found: ${studioId}`);

    const now = admin.firestore.FieldValue.serverTimestamp();

    switch (operation) {
        case 'updatePlan': {
            const { plan } = params;
            if (!plan) throw new Error('plan param required');
            await studioRef.update({ plan, updatedAt: now });
            break;
        }
        case 'updateSubscription': {
            const { status, expiresAt } = params;
            const update = { 'subscription.status': status, updatedAt: now };
            if (expiresAt) update['subscription.expiresAt'] = admin.firestore.Timestamp.fromDate(new Date(expiresAt));
            await studioRef.update(update);
            break;
        }
        case 'sendAnnouncement': {
            const { title, message } = params;
            if (!title || !message) throw new Error('title and message required');
            await studioRef.collection('announcements').add({
                title, message,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'bulk',
            });
            break;
        }
        case 'export':
        case 'backup': {
            // Mark the studio for export/backup — actual processing handled by existing backup scheduler
            await studioRef.update({
                [`${operation}RequestedAt`]: now,
                updatedAt: now,
            });
            break;
        }
        default:
            throw new Error(`Unknown operation: ${operation}`);
    }
}
