const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('../handlers/DatabaseHandler');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();
const auth = admin.auth();

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
        hwidLock
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
                license_key: licenseKey || DatabaseHandler.generateLicenseKey(),
                max_users: 5,
                hwid_registered: false,
                expires_at: null,
                last_validated_at: null
            },
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
