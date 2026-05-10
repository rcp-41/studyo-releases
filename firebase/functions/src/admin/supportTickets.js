/**
 * H1 — Ticket Sistemi
 * Koleksiyon: supportTickets/{ticketId}
 * Callables: createTicket, listTickets, replyTicket, updateTicketStatus
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

exports.createTicket = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    await checkRateLimit(`createTicket_${request.auth.uid}`, 30, 3600000);

    const { studioId, orgId, subject, body, priority = 'normal' } = request.data;
    if (!studioId || !subject || !body) {
        throw new HttpsError('invalid-argument', 'studioId, subject and body required');
    }
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
        throw new HttpsError('invalid-argument', `priority must be one of: ${validPriorities.join(', ')}`);
    }

    const ticketRef = db.collection('supportTickets').doc();
    const ticket = {
        id: ticketRef.id,
        studioId,
        orgId: orgId || null,
        openedBy: request.auth.uid,
        subject,
        body,
        status: 'open',
        priority,
        assignedTo: null,
        messages: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ticketRef.set(ticket);

    await logAudit(request.auth.uid, 'ticket_created', { ticketId: ticketRef.id, studioId, subject });

    return { success: true, ticketId: ticketRef.id };
});

exports.listTickets = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { status, studioId, assignedTo, limit: limitNum = 50 } = request.data || {};

    let query = db.collection('supportTickets').orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);
    if (studioId) query = query.where('studioId', '==', studioId);
    if (assignedTo) query = query.where('assignedTo', '==', assignedTo);
    query = query.limit(Math.min(limitNum, 200));

    const snap = await query.get();

    const tickets = snap.docs.map(d => {
        const data = d.data();
        return {
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
    });

    return { tickets };
});

exports.replyTicket = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { ticketId, message } = request.data;
    if (!ticketId || !message) throw new HttpsError('invalid-argument', 'ticketId and message required');

    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();
    if (!ticketDoc.exists) throw new HttpsError('not-found', 'Ticket not found');

    const msg = {
        uid: request.auth.uid,
        message,
        sentAt: new Date().toISOString(),
    };

    await ticketRef.update({
        messages: admin.firestore.FieldValue.arrayUnion(msg),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Auto-move to in_progress if still open
        status: ticketDoc.data().status === 'open' ? 'in_progress' : ticketDoc.data().status,
    });

    await logAudit(request.auth.uid, 'ticket_replied', { ticketId });

    return { success: true };
});

exports.updateTicketStatus = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { ticketId, status, assignedTo } = request.data;
    const validStatuses = ['open', 'in_progress', 'closed'];
    if (!ticketId || !validStatuses.includes(status)) {
        throw new HttpsError('invalid-argument', `ticketId and valid status required (${validStatuses.join(', ')})`);
    }

    const update = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (assignedTo !== undefined) update.assignedTo = assignedTo;

    await db.collection('supportTickets').doc(ticketId).update(update);
    await logAudit(request.auth.uid, 'ticket_status_updated', { ticketId, status });

    return { success: true };
});
