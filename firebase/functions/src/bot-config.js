/**
 * Bot Config — Creator Panel Management Functions
 * 
 * Manages bot configuration for each studio.
 * Only accessible by authenticated Creator Panel admins.
 * 
 * Also includes getBotStatus for studio admin read-only access.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const botCore = require('./bot-core');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Helper: validate creator/superadmin role ───
function requireCreator(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    const role = request.auth.token.role;
    if (role !== 'creator' && role !== 'superadmin') {
        throw new HttpsError('permission-denied', 'Creator access required');
    }
}

// ─── Helper: get bot config path ───
function getBotConfigPath(studioId, organizationId) {
    return organizationId
        ? `organizations/${organizationId}/studios/${studioId}/botConfig`
        : `studios/${studioId}/botConfig`;
}

/**
 * Get full bot configuration for a studio
 */
exports.getConfig = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const { studioId, organizationId } = request.data || {};
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const config = await botCore.getBotConfig(studioId, organizationId);
    return { success: true, data: config };
});

/**
 * Update bot general settings (system prompt, services, hours, etc.)
 * Creator only
 */
exports.updateSettings = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, settings } = request.data || {};
    if (!studioId || !settings) throw new HttpsError('invalid-argument', 'studioId and settings required');

    const path = getBotConfigPath(studioId, organizationId);
    await db.doc(`${path}/settings`).set({
        ...settings,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
    }, { merge: true });

    return { success: true };
});

/**
 * Update studio info (address, contact, FAQ, campaigns, payment, restrictions)
 * Creator only
 */
exports.updateStudioInfo = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, studioInfo } = request.data || {};
    if (!studioId || !studioInfo) throw new HttpsError('invalid-argument', 'studioId and studioInfo required');

    const path = getBotConfigPath(studioId, organizationId);
    await db.doc(`${path}/studioInfo`).set({
        ...studioInfo,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
    }, { merge: true });

    return { success: true };
});

/**
 * Update WhatsApp bot config (token, phone number, etc.)
 * Creator only
 */
exports.updateWhatsApp = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, config } = request.data || {};
    if (!studioId || !config) throw new HttpsError('invalid-argument', 'studioId and config required');

    const path = getBotConfigPath(studioId, organizationId);

    // Generate verify token if not set
    if (!config.verifyToken) {
        config.verifyToken = `studyo-verify-${crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Date.now()}`;
    }

    // Auto-set webhook URL
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new Error('GCLOUD_PROJECT env variable is required');
    }
    const region = process.env.FUNCTION_REGION || 'us-central1';
    config.webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/whatsappBot-webhook`;

    await db.doc(`${path}/whatsapp`).set({
        ...config,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Update bot registry
    if (config.phoneNumber) {
        await updateRegistry(studioId, organizationId, 'whatsapp', config.phoneNumber, config.enabled, config.verifyToken);
    }

    return {
        success: true,
        webhookUrl: config.webhookUrl,
        verifyToken: config.verifyToken
    };
});

/**
 * Update Voice bot config (Twilio credentials, etc.)
 * Creator only
 */
exports.updateVoice = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, config } = request.data || {};
    if (!studioId || !config) throw new HttpsError('invalid-argument', 'studioId and config required');

    const path = getBotConfigPath(studioId, organizationId);

    // Auto-set webhook URLs
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new Error('GCLOUD_PROJECT env variable is required');
    }
    const region = process.env.FUNCTION_REGION || 'us-central1';
    config.webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/voiceBot-incoming`;
    config.statusCallbackUrl = `https://${region}-${projectId}.cloudfunctions.net/voiceBot-status`;

    await db.doc(`${path}/voice`).set({
        ...config,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Update bot registry
    if (config.phoneNumber) {
        await updateRegistry(studioId, organizationId, 'voice', config.phoneNumber, config.enabled, null);
    }

    return {
        success: true,
        webhookUrl: config.webhookUrl,
        statusCallbackUrl: config.statusCallbackUrl
    };
});

/**
 * Toggle bot on/off for a specific channel
 * Creator only
 */
exports.toggle = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, channel, enabled } = request.data || {};
    if (!studioId || !channel) throw new HttpsError('invalid-argument', 'studioId and channel required');

    const path = getBotConfigPath(studioId, organizationId);
    const docName = channel === 'whatsapp' ? 'whatsapp' : 'voice';

    await db.doc(`${path}/${docName}`).update({
        enabled: !!enabled,
        updatedAt: FieldValue.serverTimestamp()
    });

    // Update registry
    const configDoc = await db.doc(`${path}/${docName}`).get();
    const phoneNumber = configDoc.data()?.phoneNumber;
    if (phoneNumber) {
        await updateRegistry(studioId, organizationId, channel, phoneNumber, !!enabled, configDoc.data()?.verifyToken);
    }

    return { success: true, enabled: !!enabled };
});

/**
 * Get bot status — available to studio admins (read-only)
 */
exports.getBotStatus = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    // Works for both creator and studio users
    const studioId = request.auth.token.studioId || request.data?.studioId;
    const organizationId = request.auth.token.organizationId || request.data?.organizationId;

    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const config = await botCore.getBotConfig(studioId, organizationId);

    // Get today's message count
    const basePath = organizationId
        ? `organizations/${organizationId}/studios/${studioId}`
        : `studios/${studioId}`;

    const today = new Date().toISOString().split('T')[0];
    let todayMessages = 0;
    try {
        const counterDoc = await db.doc(`${basePath}/botConfig/dailyCounters`).get();
        if (counterDoc.exists) {
            todayMessages = counterDoc.data()[today] || 0;
        }
    } catch (_) { }

    // Get today's stats (appointments created, complaints)
    let todayAppointments = 0;
    let todayComplaints = 0;
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const apptSnap = await db.collection(`${basePath}/conversations`)
            .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
            .get();

        apptSnap.forEach(doc => {
            const data = doc.data();
            todayAppointments += data.appointmentsCreated || 0;
        });

        const complaintSnap = await db.collection(`${basePath}/complaints`)
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
            .get();
        todayComplaints = complaintSnap.size;
    } catch (_) { }

    return {
        success: true,
        data: {
            whatsapp: {
                enabled: config.whatsapp?.enabled || false,
                phoneNumber: config.whatsapp?.phoneNumber || null
            },
            voice: {
                enabled: config.voice?.enabled || false,
                phoneNumber: config.voice?.phoneNumber || null
            },
            todayMessages,
            todayAppointments,
            todayComplaints
        }
    };
});

/**
 * Get conversations list — accessible to both creator and studio admin
 */
exports.getConversations = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const studioId = request.auth.token.studioId || request.data?.studioId;
    const organizationId = request.auth.token.organizationId || request.data?.organizationId;
    const { channel, limit: pageLimit } = request.data || {};

    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const dbHandler = new DatabaseHandler(studioId, organizationId);
    let query = dbHandler.collection('conversations')
        .orderBy('lastMessage', 'desc')
        .limit(pageLimit || 50);

    if (channel) {
        query = query.where('channel', '==', channel);
    }

    const snapshot = await query.get();
    const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return { success: true, data: conversations };
});

/**
 * Get messages for a conversation
 */
exports.getMessages = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const studioId = request.auth.token.studioId || request.data?.studioId;
    const organizationId = request.auth.token.organizationId || request.data?.organizationId;
    const { phone, limit: pageLimit } = request.data || {};

    if (!studioId || !phone) throw new HttpsError('invalid-argument', 'studioId and phone required');

    const dbHandler = new DatabaseHandler(studioId, organizationId);
    const snapshot = await dbHandler.collection('conversations').doc(phone)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(pageLimit || 100)
        .get();

    const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return { success: true, data: messages };
});

/**
 * Get bot statistics
 * Creator only
 */
exports.getStats = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId } = request.data || {};
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const basePath = organizationId
        ? `organizations/${organizationId}/studios/${studioId}`
        : `studios/${studioId}`;

    // Get last 7 days of counters
    const counterDoc = await db.doc(`${basePath}/botConfig/dailyCounters`).get();
    const counters = counterDoc.exists ? counterDoc.data() : {};

    // Get total conversations
    const convSnap = await db.collection(`${basePath}/conversations`).get();
    const totalConversations = convSnap.size;

    // Get total complaints
    const complaintSnap = await db.collection(`${basePath}/complaints`).get();
    const totalComplaints = complaintSnap.size;

    return {
        success: true,
        data: {
            dailyCounters: counters,
            totalConversations,
            totalComplaints
        }
    };
});

/**
 * Remove bot from a studio
 * Creator only — disables and removes registry entry
 */
exports.remove = onCall({ enforceAppCheck: false }, async (request) => {
    requireCreator(request);

    const { studioId, organizationId, channel } = request.data || {};
    if (!studioId || !channel) throw new HttpsError('invalid-argument', 'studioId and channel required');

    const path = getBotConfigPath(studioId, organizationId);
    const docName = channel === 'whatsapp' ? 'whatsapp' : 'voice';

    // Disable
    await db.doc(`${path}/${docName}`).update({
        enabled: false,
        updatedAt: FieldValue.serverTimestamp()
    });

    // Remove from registry
    const registrySnap = await db.collection('botRegistry')
        .where('studioId', '==', studioId)
        .where('channel', '==', channel)
        .get();

    const batch = db.batch();
    registrySnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return { success: true };
});

// ─── Internal: Update global bot registry ───
async function updateRegistry(studioId, organizationId, channel, phoneNumber, isActive, verifyToken) {
    // Normalize phone for matching
    let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/[^0-9+]/g, '');
    if (normalized.startsWith('+90')) normalized = '0' + normalized.substring(3);
    else if (normalized.startsWith('90') && normalized.length === 12) normalized = '0' + normalized.substring(2);

    // Check existing
    const existing = await db.collection('botRegistry')
        .where('studioId', '==', studioId)
        .where('channel', '==', channel)
        .get();

    if (!existing.empty) {
        // Update existing
        const doc = existing.docs[0];
        await doc.ref.update({
            phoneNumber: normalized,
            isActive: !!isActive,
            verifyToken: verifyToken || null,
            updatedAt: FieldValue.serverTimestamp()
        });
    } else {
        // Create new
        await db.collection('botRegistry').add({
            studioId,
            organizationId: organizationId || null,
            channel,
            phoneNumber: normalized,
            isActive: !!isActive,
            verifyToken: verifyToken || null,
            createdAt: FieldValue.serverTimestamp()
        });
    }
}
