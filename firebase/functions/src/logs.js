const { onCall } = require('firebase-functions/v2/https');
const { DatabaseHandler } = require('./handlers/DatabaseHandler');

exports.createActivityLog = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new Error('Yetkilendirme gerekli');
    const db = new DatabaseHandler(request);
    const { action, details, computerName, ipAddress, sessionId, timestamp } = request.data;

    await db.add('activityLogs', {
        userId: request.auth.uid,
        userEmail: request.auth.token.email || '',
        action: action || '',
        details: details || '',
        computerName: computerName || '',
        ipAddress: ipAddress || '',
        sessionId: sessionId || '',
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        createdAt: new Date()
    });
    return { success: true };
});

exports.createErrorLog = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new Error('Yetkilendirme gerekli');
    const db = new DatabaseHandler(request);

    await db.add('errorLogs', {
        userId: request.auth.uid,
        userEmail: request.auth.token.email || '',
        type: request.data.type || 'unknown',
        message: request.data.message || '',
        stack: (request.data.stack || '').substring(0, 2000),
        url: request.data.url || '',
        computerName: request.data.computerName || '',
        ipAddress: request.data.ipAddress || '',
        userAgent: (request.data.userAgent || '').substring(0, 200),
        timestamp: request.data.timestamp ? new Date(request.data.timestamp) : new Date(),
        createdAt: new Date()
    });
    return { success: true };
});
