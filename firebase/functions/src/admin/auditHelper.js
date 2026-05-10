/**
 * Shared audit helper — avoids circular deps with handlers/auditLogger.js
 */
const admin = require('firebase-admin');
const db = admin.firestore();

async function logAudit(uid, action, details = {}) {
    try {
        await db.collection('auditLogs').add({
            uid,
            action,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('[auditHelper] Failed to write audit log:', err.message);
    }
}

module.exports = { logAudit };
