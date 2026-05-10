const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('../handlers/DatabaseHandler');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();
const auth = admin.auth();

// A1 — Plan tier definitions
const PLAN_TIERS = {
    basic: { maxUsers: 5, maxStorage: 5368709120, features: { whatsapp: false, voiceBot: false, analytics: false } },
    pro: { maxUsers: 20, maxStorage: 21474836480, features: { whatsapp: true, voiceBot: false, analytics: true } },
    enterprise: { maxUsers: 100, maxStorage: 107374182400, features: { whatsapp: true, voiceBot: true, analytics: true } }
};

exports.createStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can create studios');
    }

    await checkRateLimit(`createStudio_${request.auth.uid}`, 10, 3600000);

    const {
        organizationId,
        name,
        ownerName,
        contactEmail,
        phone,
        adminPassword,
        userPassword,
        licenseKey,
        hwidLock,
        trialDays
    } = request.data;

    if (!organizationId) {
        throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    if (!name || !adminPassword || !userPassword) {
        throw new HttpsError('invalid-argument', 'Name, admin password and user password are required');
    }

    if (adminPassword.length < 8 || userPassword.length < 8) {
        throw new HttpsError('invalid-argument', 'Passwords must be at least 8 characters long');
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new HttpsError('invalid-argument', 'Invalid email format');
    }

    try {
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgDoc = await orgRef.get();
        if (!orgDoc.exists) {
            throw new HttpsError('not-found', 'Organization not found');
        }

        const studioRef = orgRef.collection('studios').doc();
        const studioId = studioRef.id;

        // B6: Always generate license key server-side (ignore any client-supplied key)
        const generatedLicenseKey = DatabaseHandler.generateLicenseKey();

        // B3: Build subscription block (trial or default active)
        let subscriptionBlock = null;
        if (trialDays && parseInt(trialDays) > 0) {
            const trialDaysInt = parseInt(trialDays);
            const now = new Date();
            const trialEndsAt = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + trialDaysInt * 86400000));
            subscriptionBlock = {
                startedAt: admin.firestore.Timestamp.fromDate(now),
                status: 'trial',
                trialEndsAt,
                expiresAt: trialEndsAt,
                graceEndsAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + (trialDaysInt + 3) * 86400000))
            };
        }

        const studioData = {
            info: {
                name,
                owner: ownerName || 'Studio Owner',
                email: contactEmail || '',
                contact: phone || '',
                subscription_status: 'active'
            },
            license: {
                hwid_lock: hwidLock || false,
                license_key: generatedLicenseKey,
                max_users: 5,
                hwid_registered: false,
                expires_at: null,
                last_validated_at: null
            },
            // A1: Default plan
            plan: { tier: 'basic', ...PLAN_TIERS.basic },
            // B1/B3: Subscription block
            ...(subscriptionBlock ? { subscription: subscriptionBlock } : {}),
            organizationId: organizationId,
            createdAt: new Date().toISOString(),
            createdBy: request.auth?.uid || 'system'
        };

        await studioRef.set(studioData);

        const adminEmail = `admin@${studioId}.studyo.app`;
        const userEmail = `user@${studioId}.studyo.app`;

        const adminRecord = await auth.createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: `${name} Admin`
        });

        await auth.setCustomUserClaims(adminRecord.uid, {
            role: 'admin',
            studioId: studioId,
            organizationId: organizationId
        });

        const userRecord = await auth.createUser({
            email: userEmail,
            password: userPassword,
            displayName: `${name} Personel`
        });

        await auth.setCustomUserClaims(userRecord.uid, {
            role: 'user',
            studioId: studioId,
            organizationId: organizationId
        });

        await studioRef.collection('system_users').doc('accounts').set({
            admin: {
                uid: adminRecord.uid,
                email: adminEmail,
                role: 'admin'
            },
            user: {
                uid: userRecord.uid,
                email: userEmail,
                role: 'user'
            }
        });

        await studioRef.collection('users').doc(adminRecord.uid).set({
            email: adminEmail,
            fullName: `${name} Admin`,
            role: 'admin',
            studioId,
            organizationId,
            isActive: true,
            createdAt: new Date().toISOString()
        });
        await studioRef.collection('users').doc(userRecord.uid).set({
            email: userEmail,
            fullName: `${name} Personel`,
            role: 'user',
            studioId,
            organizationId,
            isActive: true,
            createdAt: new Date().toISOString()
        });

        return {
            success: true,
            studioId: studioId,
            organizationId: organizationId,
            licenseKey: generatedLicenseKey,
            message: 'Studio created with Admin and User accounts'
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Studio creation failed:', error);
        throw new HttpsError('internal', 'Stüdyo oluşturma başarısız oldu. Lütfen tekrar deneyin.');
    }
});

exports.deleteStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can delete studios');
    }

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId) {
        throw new HttpsError('invalid-argument', 'organizationId and studioId are required');
    }

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();
        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const subcollections = [
            'archives', 'appointments', 'customers', 'shoots', 'payments',
            'settings', 'shootTypes', 'locations', 'photographers', 'packages',
            'system_users', 'activityLogs', 'auditLogs', 'paymentIntents',
            'counters', 'leaves', 'users', 'finance', 'schools', 'priceLists',
            'subscription_history'
        ];
        for (const sub of subcollections) {
            const snap = await studioRef.collection(sub).limit(500).get();
            if (!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }

        const usersSnap = await studioRef.collection('users').get();
        for (const userDoc of usersSnap.docs) {
            try {
                await auth.deleteUser(userDoc.id);
            } catch (e) {
                if (e.code !== 'auth/user-not-found') {
                    console.error('Failed to delete auth user:', userDoc.id, e);
                    throw e;
                }
            }
            await userDoc.ref.delete();
        }

        await studioRef.delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete studio error:', error);
        throw new HttpsError('internal', 'Stüdyo silme başarısız oldu.');
    }
});

exports.triggerBuild = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can trigger builds');
    }

    const { studioId, studioName } = request.data;

    return {
        success: true,
        message: `Build triggered for ${studioName} (Simulation)`,
        buildId: 'bld_' + Date.now()
    };
});

exports.getStudiosWithStats = onCall({ enforceAppCheck: false, memory: '512MiB' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can view studio stats');
    }

    try {
        const now = new Date();
        const allStudios = [];
        const processedStudioIds = new Set();

        const processStudio = async (studioDoc, orgId, orgName) => {
            const studioId = studioDoc.id;
            if (processedStudioIds.has(studioId)) return null;
            processedStudioIds.add(studioId);

            const data = studioDoc.data();
            const studioRef = studioDoc.ref;

            const [archivesCountSnap, appointmentsCountSnap, customersCountSnap, whatsappSnap] = await Promise.all([
                studioRef.collection('archives').count().get(),
                studioRef.collection('appointments').count().get(),
                studioRef.collection('customers').count().get(),
                studioRef.collection('settings').doc('whatsapp_status').get()
            ]);

            const studioCreated = data.createdAt?.toDate?.() || now;
            const activeSince = Math.floor((now - studioCreated) / (1000 * 60 * 60 * 24));
            const whatsappEnabled = whatsappSnap.exists && !!(whatsappSnap.data()?.connected);

            return {
                id: studioId,
                organizationId: orgId,
                organizationName: orgName,
                ...data,
                stats: {
                    archiveCount: archivesCountSnap.data().count,
                    appointmentCount: appointmentsCountSnap.data().count,
                    totalCustomers: customersCountSnap.data().count,
                    monthlyRevenue: 0,
                    activeSince,
                    whatsappEnabled
                }
            };
        };

        const orgsSnap = await db.collection('organizations').get();
        for (const orgDoc of orgsSnap.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios').get();
            const results = await Promise.all(
                studiosSnap.docs.map(doc => processStudio(doc, orgDoc.id, orgDoc.data().name || orgDoc.id))
            );
            allStudios.push(...results.filter(Boolean));
        }

        const legacySnap = await db.collection('studios').get();
        const legacyResults = await Promise.all(
            legacySnap.docs.map(doc => processStudio(doc, 'legacy', 'Bağımsız'))
        );
        allStudios.push(...legacyResults.filter(Boolean));

        return { success: true, studios: allStudios };
    } catch (error) {
        console.error('getStudiosWithStats error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

exports.getWhatsappStatus = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can view WhatsApp status');
    }

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId) {
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');
    }

    try {
        const statusDoc = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('studios')
            .doc(studioId)
            .collection('settings')
            .doc('whatsapp_status')
            .get();

        if (!statusDoc.exists) {
            return { success: true, status: null };
        }

        return { success: true, status: statusDoc.data() };
    } catch (error) {
        console.error('getWhatsappStatus error:', error);
        throw new HttpsError('internal', 'WhatsApp durumu alınamadı');
    }
});

exports.updateStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can update studio info');
    }

    const { organizationId, studioId, data } = request.data || {};
    if (!organizationId || !studioId || !data) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and data required');
    }

    const ALLOWED_FIELDS = ['name', 'address', 'phone', 'email', 'licenseKey', 'isActive', 'plan', 'notes'];
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
        if (data[field] !== undefined) {
            updates[field] = data[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        throw new HttpsError('invalid-argument', 'No valid fields to update');
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = request.auth.uid;

    try {
        await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).update(updates);
        return { success: true };
    } catch (error) {
        console.error('updateStudio error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

exports.suspendStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, reason } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);

        await studioRef.update({
            'info.subscription_status': 'suspended',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await studioRef.collection('subscription_history').add({
            action: 'suspended',
            reason: reason || 'No reason provided',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await studioRef.collection('auditLogs').add({
            action: 'studio_suspended',
            reason: reason || '',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('suspendStudio error:', error);
        throw new HttpsError('internal', 'Stüdyo askıya alma başarısız');
    }
});

exports.activateStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);

        await studioRef.update({
            'info.subscription_status': 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await studioRef.collection('subscription_history').add({
            action: 'activated',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('activateStudio error:', error);
        throw new HttpsError('internal', 'Stüdyo aktifleştirme başarısız');
    }
});

exports.getAuditLogs = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, limit: maxLimit } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const logsSnap = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('auditLogs')
            .orderBy('timestamp', 'desc')
            .limit(maxLimit || 50)
            .get();

        const logs = logsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, logs };
    } catch (error) {
        console.error('getAuditLogs error:', error);
        throw new HttpsError('internal', 'Audit logları alınamadı');
    }
});

// D4: Creator-wide audit log endpoint — supports date range, studio, action filters
exports.getCreatorAuditLogs = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const {
        organizationId,
        studioId,
        action: filterAction,
        dateFrom,
        dateTo,
        limit: rawLimit = 50,
        startAfter: startAfterId
    } = request.data || {};

    const maxLimit = Math.min(parseInt(rawLimit) || 50, 200);

    try {
        if (organizationId && studioId) {
            // Single studio query
            let query = db.collection('organizations').doc(organizationId)
                .collection('studios').doc(studioId)
                .collection('auditLogs')
                .orderBy('createdAt', 'desc');
            if (filterAction) query = query.where('action', '==', filterAction);
            if (dateFrom) query = query.where('createdAt', '>=', new Date(dateFrom));
            if (dateTo) query = query.where('createdAt', '<=', new Date(dateTo));
            query = query.limit(maxLimit);

            const snap = await query.get();
            const logs = snap.docs.map(doc => ({
                id: doc.id, ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
            }));
            return { success: true, logs };
        }

        // Cross-studio: collectionGroup query
        let query = db.collectionGroup('auditLogs').orderBy('createdAt', 'desc');
        if (filterAction) query = query.where('action', '==', filterAction);
        if (organizationId) query = query.where('organizationId', '==', organizationId);
        if (dateFrom) query = query.where('createdAt', '>=', new Date(dateFrom));
        if (dateTo) query = query.where('createdAt', '<=', new Date(dateTo));
        query = query.limit(maxLimit);

        const snap = await query.get();
        const logs = snap.docs.map(doc => ({
            id: doc.id, ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        return { success: true, logs };
    } catch (error) {
        console.error('getCreatorAuditLogs error:', error);
        throw new HttpsError('internal', 'Audit logları alınamadı');
    }
});

exports.getErrorLogs = onCall({ enforceAppCheck: false }, async (request) => {
    if (request.auth?.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Yetkisiz erişim');
    }
    const { studioId, limit = 100 } = request.data || {};
    let query;
    if (studioId) {
        query = db.collection('studios').doc(studioId)
            .collection('errorLogs').orderBy('createdAt', 'desc').limit(limit);
    } else {
        query = db.collectionGroup('errorLogs').orderBy('createdAt', 'desc').limit(limit);
    }
    const snap = await query.get();
    return { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

// E1: Get activity timeline for a studio (last 30 days)
exports.getActivityTimeline = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, limit: rawLimit = 30 } = request.data || {};
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    const limitNum = Math.min(parseInt(rawLimit) || 30, 100);

    try {
        const snap = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('activityTimeline')
            .orderBy('createdAt', 'desc')
            .limit(limitNum)
            .get();

        const events = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        return { success: true, events };
    } catch (error) {
        console.error('getActivityTimeline error:', error);
        throw new HttpsError('internal', 'Aktivite verisi alınamadı');
    }
});

// ============================================================
// A1 — Plan Değişikliği
// ============================================================

exports.changeStudioPlan = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, newTier } = request.data || {};
    if (!organizationId || !studioId || !newTier) throw new HttpsError('invalid-argument', 'organizationId, studioId, newTier required');
    if (!PLAN_TIERS[newTier]) throw new HttpsError('invalid-argument', `Invalid tier. Must be: ${Object.keys(PLAN_TIERS).join(', ')}`);

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    const current = studioDoc.data();
    const oldPlan = current.plan || null;
    const tierConfig = PLAN_TIERS[newTier];
    const newPlan = { tier: newTier, ...tierConfig, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    await studioRef.update({ plan: newPlan, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    await studioRef.collection('auditLogs').add({
        action: 'plan_changed',
        oldPlan: oldPlan || null,
        newPlan: { tier: newTier },
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await studioRef.collection('activityTimeline').add({
        event: 'plan_changed',
        oldTier: oldPlan?.tier || null,
        newTier,
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, plan: { tier: newTier, ...tierConfig } };
});

// ============================================================
// A2 — Geçici Devre Dışı + Neden + Auto-reactivate
// ============================================================

exports.suspendStudioWithReason = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, reason, reactivateAfterDays } = request.data || {};
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId and studioId required');
    if (!reason || !reason.trim()) throw new HttpsError('invalid-argument', 'reason is required');

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    const now = admin.firestore.FieldValue.serverTimestamp();
    const reactivateAt = reactivateAfterDays
        ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + reactivateAfterDays * 86400000))
        : null;

    const suspension = {
        active: true,
        reason: reason.trim(),
        suspendedAt: now,
        suspendedBy: request.auth.uid,
        reactivateAt: reactivateAt
    };

    await studioRef.update({
        'info.subscription_status': 'suspended',
        suspension,
        updatedAt: now
    });

    await studioRef.collection('auditLogs').add({
        action: 'studio_suspended_with_reason',
        reason: reason.trim(),
        reactivateAfterDays: reactivateAfterDays || null,
        performedBy: request.auth.uid,
        createdAt: now
    });

    await studioRef.collection('activityTimeline').add({
        event: 'studio_suspended',
        reason: reason.trim(),
        reactivateAt: reactivateAt,
        performedBy: request.auth.uid,
        createdAt: now
    });

    return { success: true };
});

// ============================================================
// B1 — Abonelik Güncelleme (Manuel)
// ============================================================

exports.updateSubscription = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, expiresAt } = request.data || {};
    if (!organizationId || !studioId || !expiresAt) throw new HttpsError('invalid-argument', 'organizationId, studioId, expiresAt required');

    const expiresDate = new Date(expiresAt);
    if (isNaN(expiresDate.getTime())) throw new HttpsError('invalid-argument', 'Invalid expiresAt date');

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresTimestamp = admin.firestore.Timestamp.fromDate(expiresDate);
    const graceEndsAt = admin.firestore.Timestamp.fromDate(new Date(expiresDate.getTime() + 3 * 86400000));

    const subscription = {
        startedAt: studioDoc.data().subscription?.startedAt || now,
        expiresAt: expiresTimestamp,
        status: 'active',
        graceEndsAt
    };

    await studioRef.update({
        subscription,
        'info.subscription_status': 'active',
        updatedAt: now
    });

    await studioRef.collection('auditLogs').add({
        action: 'subscription_updated',
        expiresAt: expiresDate.toISOString(),
        performedBy: request.auth.uid,
        createdAt: now
    });

    return { success: true, subscription: { expiresAt: expiresDate.toISOString() } };
});

// ============================================================
// B3 — Trial Yönetimi (createStudio artık trialDays alıyor — ayrı callable değil)
// Ayrı trial başlatma callable'ı stüdyo oluşturulduktan sonra veya standalone kullanım için
// ============================================================

exports.setTrialSubscription = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, trialDays } = request.data || {};
    if (!organizationId || !studioId || !trialDays) throw new HttpsError('invalid-argument', 'organizationId, studioId, trialDays required');

    const days = parseInt(trialDays);
    if (isNaN(days) || days < 1 || days > 365) throw new HttpsError('invalid-argument', 'trialDays must be 1-365');

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    const now = new Date();
    const trialEndsAt = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + days * 86400000));

    const subscription = {
        startedAt: admin.firestore.Timestamp.fromDate(now),
        status: 'trial',
        trialEndsAt,
        expiresAt: trialEndsAt,
        graceEndsAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + (days + 3) * 86400000))
    };

    await studioRef.update({
        subscription,
        'info.subscription_status': 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await studioRef.collection('auditLogs').add({
        action: 'trial_started',
        trialDays: days,
        trialEndsAt: trialEndsAt.toDate().toISOString(),
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, trialEndsAt: trialEndsAt.toDate().toISOString() };
});

// ============================================================
// B4 — Kupon Kodu
// ============================================================

exports.createCoupon = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { code, type, value, expiresAt, usageLimit, allowedOrgs } = request.data || {};
    if (!code || !type || !value) throw new HttpsError('invalid-argument', 'code, type, value required');
    if (!['discount', 'extension'].includes(type)) throw new HttpsError('invalid-argument', 'type must be discount or extension');
    if (typeof value !== 'number' || value <= 0) throw new HttpsError('invalid-argument', 'value must be positive number');

    const codeUpper = code.trim().toUpperCase();
    const couponRef = db.collection('coupons').doc(codeUpper);
    const existing = await couponRef.get();
    if (existing.exists) throw new HttpsError('already-exists', 'Coupon code already exists');

    const couponData = {
        code: codeUpper,
        type,
        value,
        expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt)) : null,
        usageLimit: usageLimit || null,
        usedCount: 0,
        allowedOrgs: allowedOrgs || [],
        createdBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await couponRef.set(couponData);

    return { success: true, code: codeUpper };
});

exports.listCoupons = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const snap = await db.collection('coupons').orderBy('createdAt', 'desc').limit(100).get();
    const coupons = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString() || null,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
    }));
    return { success: true, coupons };
});

exports.redeemCoupon = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId, code } = request.data || {};
    if (!organizationId || !studioId || !code) throw new HttpsError('invalid-argument', 'organizationId, studioId, code required');

    const codeUpper = code.trim().toUpperCase();
    const couponRef = db.collection('coupons').doc(codeUpper);
    const couponDoc = await couponRef.get();
    if (!couponDoc.exists) throw new HttpsError('not-found', 'Coupon not found');

    const coupon = couponDoc.data();

    // Validate
    if (coupon.expiresAt && coupon.expiresAt.toDate() < new Date()) {
        throw new HttpsError('failed-precondition', 'Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new HttpsError('resource-exhausted', 'Coupon usage limit reached');
    }
    if (coupon.allowedOrgs && coupon.allowedOrgs.length > 0 && !coupon.allowedOrgs.includes(organizationId)) {
        throw new HttpsError('permission-denied', 'Coupon not valid for this organization');
    }

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    let result = { applied: false, message: '' };

    if (coupon.type === 'extension') {
        const studio = studioDoc.data();
        const currentExpiry = studio.subscription?.expiresAt?.toDate?.() || new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(baseDate.getTime() + coupon.value * 86400000);
        const newExpiryTs = admin.firestore.Timestamp.fromDate(newExpiry);
        const graceEndsAt = admin.firestore.Timestamp.fromDate(new Date(newExpiry.getTime() + 3 * 86400000));

        await studioRef.update({
            'subscription.expiresAt': newExpiryTs,
            'subscription.graceEndsAt': graceEndsAt,
            'subscription.status': 'active',
            'info.subscription_status': 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        result = { applied: true, message: `Abonelik ${coupon.value} gün uzatıldı`, newExpiresAt: newExpiry.toISOString() };
    } else if (coupon.type === 'discount') {
        // Flag for future payment integration
        await studioRef.update({
            'pendingDiscount': { couponCode: codeUpper, discountValue: coupon.value, appliedAt: admin.firestore.FieldValue.serverTimestamp() },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        result = { applied: true, message: `%${coupon.value} indirim kodu uygulandı (ödeme entegrasyonu bekleniyor)` };
    }

    // Increment usedCount
    await couponRef.update({ usedCount: admin.firestore.FieldValue.increment(1) });

    // Audit log on studio
    await studioRef.collection('auditLogs').add({
        action: 'coupon_redeemed',
        couponCode: codeUpper,
        couponType: coupon.type,
        couponValue: coupon.value,
        result: result.message,
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, ...result };
});

// ============================================================
// F4 — Sürüm Güncelleme Zorunluluk Bayrağı
// ============================================================

exports.getVersioning = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const doc = await db.collection('appVersioning').doc('config').get();
    if (!doc.exists) {
        return { success: true, config: { latestVersion: '1.0.0', minRequiredVersion: '1.0.0', channel: 'stable', forceUpdate: false, releaseNotes: '' } };
    }
    return { success: true, config: doc.data() };
});

exports.updateVersioning = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');

    const { latestVersion, minRequiredVersion, channel, forceUpdate, releaseNotes } = request.data || {};
    if (!latestVersion || !minRequiredVersion) throw new HttpsError('invalid-argument', 'latestVersion and minRequiredVersion required');

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(latestVersion) || !versionRegex.test(minRequiredVersion)) {
        throw new HttpsError('invalid-argument', 'Versions must be in semver format (e.g., 1.2.3)');
    }

    const config = {
        latestVersion,
        minRequiredVersion,
        channel: channel || 'stable',
        forceUpdate: !!forceUpdate,
        releaseNotes: releaseNotes || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
    };

    await db.collection('appVersioning').doc('config').set(config, { merge: true });

    return { success: true, config };
});

// ============================================================
// E1: Record login activity - called by Electron client on each login
// ============================================================

exports.recordLogin = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { organizationId, studioId, appVersion } = request.data || {};
    const uid = request.auth.uid;
    const ip = request.rawRequest?.ip || null;

    // Use claims as fallback for org/studio ids
    const orgId = organizationId || request.auth.token?.organizationId;
    const sId = studioId || request.auth.token?.studioId;

    if (!orgId || !sId) {
        // For creator users (no studioId claim) just return success — nothing to record
        return { success: true };
    }

    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('organizations').doc(orgId)
            .collection('studios').doc(sId).update({
                'activity.last_login_at': now,
                'activity.last_login_ip': ip,
                'activity.last_app_version': appVersion || null,
                updatedAt: now
            });

        // Append to activity timeline (last 30 days retention via TTL-like query in UI)
        await db.collection('organizations').doc(orgId)
            .collection('studios').doc(sId)
            .collection('activityTimeline').add({
                event: 'login',
                uid,
                ip,
                appVersion: appVersion || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

        return { success: true };
    } catch (error) {
        console.error('recordLogin error:', error);
        // Non-fatal — don't block client login
        return { success: false };
    }
});
