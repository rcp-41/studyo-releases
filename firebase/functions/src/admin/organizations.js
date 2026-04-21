const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('../handlers/DatabaseHandler');
const { checkRateLimit } = require('./rateLimit');

const db = admin.firestore();
const auth = admin.auth();

exports.initSuperAdmin = onCall({ enforceAppCheck: false }, async (request) => {
    await checkRateLimit('initSuperAdmin', 3, 3600000);
    const { email, password, secretKey } = request.data;

    const expectedSecretKey = process.env.SUPER_ADMIN_SECRET_KEY;
    if (!expectedSecretKey) {
        throw new HttpsError('failed-precondition', 'SUPER_ADMIN_SECRET_KEY environment variable is not set.');
    }

    if (secretKey !== expectedSecretKey) {
        throw new HttpsError('permission-denied', 'Invalid secret key');
    }

    const existingCreators = await auth.listUsers(1000);
    const hasCreator = existingCreators.users.some(u => u.customClaims?.role === 'creator');

    if (hasCreator) {
        throw new HttpsError('already-exists', 'Super Admin already exists. This function can only be called once.');
    }

    try {
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({
                    email,
                    password,
                    displayName: 'Super Admin'
                });
            } else {
                throw e;
            }
        }
        await auth.setCustomUserClaims(userRecord.uid, {
            role: 'creator',
            super_admin: true
        });
        return { success: true, message: 'Super Admin initialized' };
    } catch (error) {
        console.error('Super Admin initialization failed:', error);
        throw new HttpsError('internal', 'İşlem başarısız oldu. Lütfen tekrar deneyin.');
    }
});

exports.createOrganization = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can create organizations');
    }

    const { name, owner, slug } = request.data;
    if (!name) {
        throw new HttpsError('invalid-argument', 'Organization name is required');
    }

    try {
        const result = await DatabaseHandler.createOrganization({ name, owner, slug });
        return result;
    } catch (error) {
        console.error('Create organization error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

exports.deleteOrganization = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can delete organizations');
    }

    const { organizationId } = request.data;
    if (!organizationId) {
        throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    try {
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgDoc = await orgRef.get();
        if (!orgDoc.exists) {
            throw new HttpsError('not-found', 'Organization not found');
        }

        const studiosSnap = await orgRef.collection('studios').get();
        for (const studioDoc of studiosSnap.docs) {
            const subcollections = [
                'archives', 'appointments', 'customers', 'shoots', 'payments',
                'settings', 'shootTypes', 'locations', 'photographers', 'packages',
                'system_users', 'activityLogs', 'auditLogs', 'paymentIntents',
                'counters', 'leaves', 'users', 'finance', 'schools', 'priceLists',
                'subscription_history'
            ];
            for (const sub of subcollections) {
                const snap = await studioDoc.ref.collection(sub).limit(500).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }

            const usersSnap = await studioDoc.ref.collection('users').get();
            for (const userDoc of usersSnap.docs) {
                try {
                    await auth.deleteUser(userDoc.id);
                } catch (e) {
                    if (e.code !== 'auth/user-not-found') {
                        console.error('Failed to delete auth user:', userDoc.id, e);
                        throw e;
                    }
                }
            }

            await studioDoc.ref.delete();
        }

        await orgRef.delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete organization error:', error);
        throw new HttpsError('internal', 'Organizasyon silme başarısız oldu.');
    }
});

exports.updateOrganization = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const role = request.auth.token?.role;
    const userOrgId = request.auth.token?.organizationId;
    const { organizationId, data } = request.data || {};

    if (!organizationId || !data) {
        throw new HttpsError('invalid-argument', 'organizationId and data required');
    }

    if (role !== 'creator' && !(role === 'org_admin' && userOrgId === organizationId)) {
        throw new HttpsError('permission-denied', 'Only Creator or Org Admin can update organization');
    }

    const ALLOWED_FIELDS = ['name', 'owner', 'notes'];
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

    try {
        await db.collection('organizations').doc(organizationId).update(updates);
        return { success: true };
    } catch (error) {
        console.error('updateOrganization error:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});

exports.listOrganizations = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can list all organizations');
    }

    try {
        const organizations = await DatabaseHandler.listAllOrganizations();
        return { success: true, organizations };
    } catch (error) {
        console.error('listOrganizations error:', error);
        throw new HttpsError('internal', 'Organizasyonlar listelenemedi');
    }
});
