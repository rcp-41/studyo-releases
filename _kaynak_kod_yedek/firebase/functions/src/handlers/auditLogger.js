/**
 * Audit Logger - Backend audit trail handler
 * Stores activity logs for security and compliance.
 * Called from the client-side auditLog.js service.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const FieldValue = admin.firestore.FieldValue;
const db = admin.firestore();

/**
 * Log an activity (called from client auditLog.js)
 */
exports.log = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const studioId = request.auth.token?.studioId;
    const { action, targetId, details } = request.data || {};

    if (!action) {
        throw new HttpsError('invalid-argument', 'action is required');
    }

    try {
        // SECURITY: Always use server timestamp, ignore client-provided timestamp
        const logEntry = {
            action,
            userId: request.auth.uid,
            userName: request.auth.token?.name || request.auth.token?.email || 'unknown',
            targetId: targetId || null,
            details: details || {},
            timestamp: new Date().toISOString(),
            ip: request.rawRequest?.ip || null,
            studioId: studioId || null,
            createdAt: FieldValue.serverTimestamp()
        };

        if (studioId) {
            await db.collection('studios').doc(studioId).collection('auditLogs').add(logEntry);
        } else {
            await db.collection('globalAuditLogs').add(logEntry);
        }

        return { success: true };
    } catch (error) {
        console.error('Audit log error:', error);
        return { success: false };
    }
});

/**
 * Get audit logs for a studio (admin only)
 */
exports.getLogs = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const studioId = request.auth.token?.studioId;
    if (!studioId) {
        throw new HttpsError('failed-precondition', 'studioId not found');
    }

    const { limit: queryLimit = 50, action } = request.data || {};

    try {
        let query = db.collection('studios').doc(studioId).collection('auditLogs')
            .orderBy('createdAt', 'desc')
            .limit(Math.min(queryLimit, 200));

        if (action) {
            query = query.where('action', '==', action);
        }

        const snapshot = await query.get();
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        return { success: true, data: logs };
    } catch (error) {
        console.error('Get audit logs error:', error);
        throw new HttpsError('internal', 'Audit log alınamadı');
    }
});

/**
 * Helper function for server-side audit logging (called from other Cloud Functions)
 */
async function logActivity(studioId, action, userId, details = {}, targetId = null) {
    try {
        const logEntry = {
            action,
            userId,
            targetId,
            details,
            timestamp: new Date().toISOString(),
            createdAt: FieldValue.serverTimestamp()
        };

        if (studioId) {
            await db.collection('studios').doc(studioId).collection('auditLogs').add(logEntry);
        }
    } catch (error) {
        console.error('Server-side audit log error:', error);
    }
}

exports.logActivity = logActivity;
