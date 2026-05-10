/**
 * Faz 4 — Kullanici Yönetimi & Güvenlik
 * C1: searchUsers, C2: sendPasswordReset
 * C3: startImpersonation, endImpersonation
 * C4: revokeUserSessions
 * G1: blockDevice, unblockDevice
 * G2: updateIpWhitelist
 * G3: grantAppCheckOverride, revokeAppCheckOverride
 * G4: RBAC — setCreatorRole, listCreatorUsers, inviteCreator
 * F1/F2: createAnnouncement, listAnnouncements, deleteAnnouncement
 * F3: broadcastMessage
 * H5: getBuildHistory (+ build endpoint hook)
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();
const auth = admin.auth();

// ─────────────────────────────────────────────────────────
// RBAC helpers
// ─────────────────────────────────────────────────────────

const CREATOR_ROLES = ['super', 'support', 'finance', 'readonly'];

const ROLE_PERMISSIONS = {
    super: ['*'],
    support: ['searchUsers', 'sendPasswordReset', 'startImpersonation', 'endImpersonation', 'revokeUserSessions', 'getAuditLogs', 'grantAppCheckOverride', 'revokeAppCheckOverride', 'blockDevice', 'unblockDevice', 'getBuildHistory', 'listAnnouncements', 'createAnnouncement', 'deleteAnnouncement', 'broadcastMessage', 'updateIpWhitelist'],
    finance: ['updateSubscription', 'changeStudioPlan', 'createCoupon', 'listCoupons', 'redeemCoupon', 'setTrialSubscription'],
    readonly: []
};

function hasPermission(creatorRole, action) {
    if (!creatorRole) return false;
    const perms = ROLE_PERMISSIONS[creatorRole] || [];
    return perms.includes('*') || perms.includes(action);
}

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator role');
}

function assertCreatorWithPermission(request, action) {
    assertCreator(request);
    const creatorRole = request.auth.token?.creator_role || 'super';
    if (!hasPermission(creatorRole, action)) {
        throw new HttpsError('permission-denied', `Role '${creatorRole}' cannot perform '${action}'`);
    }
}

async function writeAuditLog(action, actorUid, details = {}) {
    await db.collection('creatorAuditLogs').add({
        action,
        actorUid,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

// ─────────────────────────────────────────────────────────
// IP Whitelist cache (in-memory, TTL 60s)
// ─────────────────────────────────────────────────────────

const ipWhitelistCache = new Map(); // studioId -> { cidrs, cachedAt }
const IP_CACHE_TTL = 60000;

async function checkIpWhitelist(studioId, requestIp) {
    if (!studioId || !requestIp) return;

    const cached = ipWhitelistCache.get(studioId);
    const now = Date.now();

    let cidrs;
    if (cached && now - cached.cachedAt < IP_CACHE_TTL) {
        cidrs = cached.cidrs;
    } else {
        // Search across all orgs for this studio
        const orgsSnap = await db.collection('organizations').limit(200).get();
        let found = false;
        for (const org of orgsSnap.docs) {
            const studioDoc = await db.collection('organizations').doc(org.id).collection('studios').doc(studioId).get();
            if (studioDoc.exists) {
                cidrs = studioDoc.data()?.security?.ipWhitelist || [];
                found = true;
                break;
            }
        }
        if (!found) cidrs = [];
        ipWhitelistCache.set(studioId, { cidrs, cachedAt: now });
    }

    if (!cidrs || cidrs.length === 0) return; // no restriction

    const ipInWhitelist = cidrs.some(cidr => isIpInCidr(requestIp, cidr));
    if (!ipInWhitelist) {
        throw new HttpsError('permission-denied', `IP ${requestIp} not in whitelist`);
    }
}

function ipToLong(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function isIpInCidr(ip, cidr) {
    try {
        if (!cidr.includes('/')) return ip === cidr;
        const [range, bits] = cidr.split('/');
        const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1) >>> 0;
        return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────
// C1 — Global kullanici arama
// ─────────────────────────────────────────────────────────

exports.searchUsers = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'searchUsers');
    await checkRateLimit(`searchUsers_${request.auth.uid}`, 30, 60000);

    const { query, type = 'email', limit = 20 } = request.data;
    if (!query || query.length < 2) throw new HttpsError('invalid-argument', 'Query must be at least 2 characters');

    const results = [];

    // Firebase Auth lookup
    try {
        let authUser = null;
        if (type === 'email') authUser = await auth.getUserByEmail(query).catch(() => null);
        else if (type === 'phone') authUser = await auth.getUserByPhoneNumber(query).catch(() => null);

        if (authUser) {
            results.push({
                uid: authUser.uid,
                email: authUser.email,
                phone: authUser.phoneNumber,
                displayName: authUser.displayName,
                lastLogin: authUser.metadata?.lastSignInTime,
                source: 'auth',
                studioName: null,
                orgName: null,
                studioId: null,
                role: authUser.customClaims?.role
            });
        }
    } catch (e) {
        console.warn('Auth lookup failed:', e.message);
    }

    // Firestore collectionGroup search across organizations/*/studios/*/users
    try {
        let firestoreQuery;
        if (type === 'email') {
            firestoreQuery = db.collectionGroup('users').where('email', '==', query).limit(limit);
        } else if (type === 'phone') {
            firestoreQuery = db.collectionGroup('users').where('phone', '==', query).limit(limit);
        } else {
            // name search — prefix match via >= and <
            firestoreQuery = db.collectionGroup('users')
                .where('displayName', '>=', query)
                .where('displayName', '<', query + '')
                .limit(limit);
        }

        const snap = await firestoreQuery.get();
        for (const doc of snap.docs) {
            const data = doc.data();
            const pathParts = doc.ref.path.split('/');
            // organizations/{orgId}/studios/{studioId}/users/{uid}
            const orgId = pathParts[1];
            const studioId = pathParts[3];

            const alreadyFound = results.find(r => r.uid === data.uid || r.uid === doc.id);
            if (!alreadyFound) {
                // Fetch org/studio names
                let orgName = orgId;
                let studioName = studioId;
                try {
                    const orgDoc = await db.collection('organizations').doc(orgId).get();
                    if (orgDoc.exists) orgName = orgDoc.data().name || orgId;
                    const studioDoc = await db.collection('organizations').doc(orgId).collection('studios').doc(studioId).get();
                    if (studioDoc.exists) studioName = studioDoc.data().name || studioId;
                } catch { /* ignore */ }

                results.push({
                    uid: data.uid || doc.id,
                    email: data.email,
                    phone: data.phone,
                    displayName: data.displayName,
                    lastLogin: data.lastLogin,
                    studioName,
                    orgName,
                    studioId,
                    orgId,
                    role: data.role,
                    source: 'firestore'
                });
            }
        }
    } catch (e) {
        console.warn('Firestore collectionGroup search failed:', e.message);
    }

    return { users: results.slice(0, limit) };
});

// ─────────────────────────────────────────────────────────
// C2 — Password reset email
// ─────────────────────────────────────────────────────────

exports.sendPasswordReset = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'sendPasswordReset');

    const { uid } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required');

    const userRecord = await auth.getUser(uid).catch(() => null);
    if (!userRecord) throw new HttpsError('not-found', 'User not found');
    if (!userRecord.email) throw new HttpsError('failed-precondition', 'User has no email address');

    const link = await auth.generatePasswordResetLink(userRecord.email);

    await writeAuditLog('sendPasswordReset', request.auth.uid, {
        targetUid: uid,
        targetEmail: userRecord.email
    });

    return { success: true, link };
});

// ─────────────────────────────────────────────────────────
// C3 — Impersonation / destek modu
// ─────────────────────────────────────────────────────────

exports.startImpersonation = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'startImpersonation');

    const { targetUid, reason } = request.data;
    if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
    if (!reason || reason.trim().length < 5) throw new HttpsError('invalid-argument', 'reason is required (min 5 chars)');

    const targetUser = await auth.getUser(targetUid).catch(() => null);
    if (!targetUser) throw new HttpsError('not-found', 'Target user not found');

    const creatorUid = request.auth.uid;
    const sessionId = db.collection('impersonationSessions').doc().id;
    const endsAt = admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000);

    const customToken = await auth.createCustomToken(targetUid, {
        impersonatedBy: creatorUid,
        impersonationSessionId: sessionId
    });

    await db.collection('impersonationSessions').doc(sessionId).set({
        sessionId,
        creatorUid,
        targetUid,
        targetEmail: targetUser.email || null,
        reason,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        endsAt,
        active: true
    });

    await writeAuditLog('startImpersonation', creatorUid, { targetUid, reason, sessionId });

    return { success: true, sessionId, customToken, endsAt: endsAt.toMillis() };
});

exports.endImpersonation = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'endImpersonation');

    const { sessionId } = request.data;
    if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId is required');

    const sessionRef = db.collection('impersonationSessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) throw new HttpsError('not-found', 'Session not found');

    await sessionRef.update({
        active: false,
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        endedBy: request.auth.uid
    });

    await writeAuditLog('endImpersonation', request.auth.uid, { sessionId });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// C4 — Oturum sonlandirma
// ─────────────────────────────────────────────────────────

exports.revokeUserSessions = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'revokeUserSessions');

    const { uid } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required');

    await auth.revokeRefreshTokens(uid);

    // Signal Studyo client to force logout via Firestore listener
    await db.collection('forceLogoutTokens').doc(uid).set({
        uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        revokedBy: request.auth.uid
    });

    await writeAuditLog('revokeUserSessions', request.auth.uid, { targetUid: uid });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// G1 — Cihaz kalici blok
// ─────────────────────────────────────────────────────────

exports.blockDevice = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'blockDevice');

    const { deviceId, reason, organizationId, studioId } = request.data;
    if (!deviceId) throw new HttpsError('invalid-argument', 'deviceId is required');
    if (!reason) throw new HttpsError('invalid-argument', 'reason is required');

    const batch = db.batch();

    // Global block record
    const blockedRef = db.collection('blockedDevices').doc(deviceId);
    batch.set(blockedRef, {
        hwid: deviceId,
        blockedAt: admin.firestore.FieldValue.serverTimestamp(),
        blockedBy: request.auth.uid,
        reason
    });

    // Update studio device status if orgId/studioId provided
    if (organizationId && studioId) {
        const deviceRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId);
        batch.update(deviceRef, { status: 'blocked', blockedAt: admin.firestore.FieldValue.serverTimestamp(), blockedReason: reason });
    }

    await batch.commit();

    await writeAuditLog('blockDevice', request.auth.uid, { deviceId, reason, organizationId, studioId });

    return { success: true };
});

exports.unblockDevice = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'unblockDevice');

    const { deviceId, organizationId, studioId } = request.data;
    if (!deviceId) throw new HttpsError('invalid-argument', 'deviceId is required');

    await db.collection('blockedDevices').doc(deviceId).delete();

    if (organizationId && studioId) {
        await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId)
            .update({ status: 'approved', blockedAt: null, blockedReason: null });
    }

    await writeAuditLog('unblockDevice', request.auth.uid, { deviceId, organizationId, studioId });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// G2 — Per-studio IP whitelist
// ─────────────────────────────────────────────────────────

exports.updateIpWhitelist = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'updateIpWhitelist');

    const { organizationId, studioId, cidrs } = request.data;
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId and studioId required');
    if (!Array.isArray(cidrs)) throw new HttpsError('invalid-argument', 'cidrs must be an array');

    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    for (const cidr of cidrs) {
        if (!cidrRegex.test(cidr)) {
            throw new HttpsError('invalid-argument', `Invalid CIDR: ${cidr}`);
        }
    }

    await db.collection('organizations').doc(organizationId)
        .collection('studios').doc(studioId)
        .update({ 'security.ipWhitelist': cidrs });

    // Invalidate cache
    ipWhitelistCache.delete(studioId);

    await writeAuditLog('updateIpWhitelist', request.auth.uid, { organizationId, studioId, cidrs });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// G3 — AppCheck geçici override
// ─────────────────────────────────────────────────────────

exports.grantAppCheckOverride = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'grantAppCheckOverride');

    const { studioId, durationMinutes, reason } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');
    if (!durationMinutes || durationMinutes < 1) throw new HttpsError('invalid-argument', 'durationMinutes must be >= 1');
    if (!reason) throw new HttpsError('invalid-argument', 'reason required');

    const until = admin.firestore.Timestamp.fromMillis(Date.now() + durationMinutes * 60 * 1000);

    await db.collection('appCheckOverrides').doc(studioId).set({
        studioId,
        active: true,
        until,
        grantedBy: request.auth.uid,
        reason,
        grantedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeAuditLog('grantAppCheckOverride', request.auth.uid, { studioId, durationMinutes, reason });

    // TODO: If durationMinutes > 60, send admin email alert

    return { success: true, until: until.toMillis() };
});

exports.revokeAppCheckOverride = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'revokeAppCheckOverride');

    const { studioId } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    await db.collection('appCheckOverrides').doc(studioId).update({
        active: false,
        revokedBy: request.auth.uid,
        revokedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeAuditLog('revokeAppCheckOverride', request.auth.uid, { studioId });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// G4 — RBAC — Creator alt rolleri
// ─────────────────────────────────────────────────────────

exports.setCreatorRole = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    const callerRole = request.auth.token?.creator_role || 'super';
    if (callerRole !== 'super') throw new HttpsError('permission-denied', 'Only super creators can set roles');

    const { targetUid, newRole } = request.data;
    if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required');
    if (!CREATOR_ROLES.includes(newRole)) throw new HttpsError('invalid-argument', `newRole must be one of: ${CREATOR_ROLES.join(', ')}`);

    const currentClaims = (await auth.getUser(targetUid)).customClaims || {};
    await auth.setCustomUserClaims(targetUid, { ...currentClaims, creator_role: newRole });

    await db.collection('creator_users').doc(targetUid).set(
        { creator_role: newRole, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: request.auth.uid },
        { merge: true }
    );

    await writeAuditLog('setCreatorRole', request.auth.uid, { targetUid, newRole });

    return { success: true };
});

exports.listCreatorUsers = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const snap = await db.collection('creator_users').get();
    const users = await Promise.all(snap.docs.map(async doc => {
        let authUser = null;
        try { authUser = await auth.getUser(doc.id); } catch { /* ignore */ }
        return {
            uid: doc.id,
            ...doc.data(),
            email: authUser?.email,
            displayName: authUser?.displayName,
            lastLogin: authUser?.metadata?.lastSignInTime
        };
    }));

    return { users };
});

exports.inviteCreator = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);
    const callerRole = request.auth.token?.creator_role || 'super';
    if (callerRole !== 'super') throw new HttpsError('permission-denied', 'Only super creators can invite');

    const { email, role = 'readonly' } = request.data;
    if (!email) throw new HttpsError('invalid-argument', 'email required');
    if (!CREATOR_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Invalid role');

    let userRecord = await auth.getUserByEmail(email).catch(() => null);
    if (!userRecord) {
        const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
        userRecord = await auth.createUser({ email, password: tempPassword });
    }

    await auth.setCustomUserClaims(userRecord.uid, {
        ...(userRecord.customClaims || {}),
        role: 'creator',
        creator_role: role
    });

    await db.collection('creator_users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        creator_role: role,
        invitedBy: request.auth.uid,
        invitedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const resetLink = await auth.generatePasswordResetLink(email);

    await writeAuditLog('inviteCreator', request.auth.uid, { targetEmail: email, role, targetUid: userRecord.uid });

    return { success: true, uid: userRecord.uid, resetLink };
});

// ─────────────────────────────────────────────────────────
// F1/F2 — Duyurular (Announcements)
// ─────────────────────────────────────────────────────────

exports.createAnnouncement = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'createAnnouncement');

    const { title, body, level = 'info', startsAt, endsAt, target = 'all', targetIds = [], dismissible = true } = request.data;
    if (!title || !body) throw new HttpsError('invalid-argument', 'title and body required');
    if (!['info', 'warning', 'critical'].includes(level)) throw new HttpsError('invalid-argument', 'Invalid level');
    if (!['all', 'orgIds', 'studioIds'].includes(target)) throw new HttpsError('invalid-argument', 'Invalid target');

    const ref = db.collection('announcements').doc();
    const announcement = {
        id: ref.id,
        title,
        body,
        level,
        target,
        targetIds,
        dismissible,
        createdBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        startsAt: startsAt ? admin.firestore.Timestamp.fromMillis(startsAt) : admin.firestore.FieldValue.serverTimestamp(),
        endsAt: endsAt ? admin.firestore.Timestamp.fromMillis(endsAt) : null,
        active: true
    };

    await ref.set(announcement);
    await writeAuditLog('createAnnouncement', request.auth.uid, { announcementId: ref.id, title, level, target });

    return { success: true, id: ref.id };
});

exports.listAnnouncements = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'listAnnouncements');

    const { activeOnly = false } = request.data || {};
    let query = db.collection('announcements').orderBy('createdAt', 'desc').limit(100);
    if (activeOnly) query = query.where('active', '==', true);

    const snap = await query.get();
    return {
        announcements: snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toMillis?.() || null,
            startsAt: d.data().startsAt?.toMillis?.() || null,
            endsAt: d.data().endsAt?.toMillis?.() || null
        }))
    };
});

exports.deleteAnnouncement = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'deleteAnnouncement');

    const { id } = request.data;
    if (!id) throw new HttpsError('invalid-argument', 'id required');

    await db.collection('announcements').doc(id).update({
        active: false,
        deletedBy: request.auth.uid,
        deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeAuditLog('deleteAnnouncement', request.auth.uid, { announcementId: id });

    return { success: true };
});

// ─────────────────────────────────────────────────────────
// F3 — Toplu broadcast (WhatsApp/email)
// ─────────────────────────────────────────────────────────

exports.broadcastMessage = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'broadcastMessage');

    const { channel, target = 'all', targetIds = [], subject, body, templateId } = request.data;
    if (!['whatsapp', 'email'].includes(channel)) throw new HttpsError('invalid-argument', 'channel must be whatsapp or email');
    if (!body) throw new HttpsError('invalid-argument', 'body required');
    if (channel === 'email' && !subject) throw new HttpsError('invalid-argument', 'subject required for email');

    const queueRef = db.collection('broadcastQueue').doc();
    await queueRef.set({
        id: queueRef.id,
        channel,
        target,
        targetIds,
        subject: subject || null,
        body,
        templateId: templateId || null,
        status: 'pending',
        createdBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: null,
        errorMessage: null
    });

    await writeAuditLog('broadcastMessage', request.auth.uid, { channel, target, queueId: queueRef.id });

    return { success: true, queueId: queueRef.id };
});

// ─────────────────────────────────────────────────────────
// H5 — Build geçmişi
// ─────────────────────────────────────────────────────────

exports.getBuildHistory = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreatorWithPermission(request, 'getBuildHistory');

    const { studioId, limit = 20 } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    const snap = await db.collection('studios').doc(studioId)
        .collection('buildHistory')
        .orderBy('builtAt', 'desc')
        .limit(Math.min(limit, 50))
        .get();

    return {
        builds: snap.docs.map(d => ({
            buildId: d.id,
            ...d.data(),
            builtAt: d.data().builtAt?.toMillis?.() || null
        }))
    };
});

// Export IP whitelist checker for use in other callables
exports.checkIpWhitelist = checkIpWhitelist;
exports.hasPermission = hasPermission;
exports.CREATOR_ROLES = CREATOR_ROLES;
