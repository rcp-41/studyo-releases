/**
 * Users Cloud Functions
 * User management (CRUD, password reset, leaves)
 * 
 * Multi-Tenant: Users are stored under organizations/{orgId}/studios/{studioId}/users/{uid}
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { userSchema, leaveSchema, validate } = require('./validators/schemas');
const { APPCHECK_ENABLED } = require('./config');

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;

// Helper: get studio-scoped users collection reference (with legacy fallback)
const usersCollection = (organizationId, studioId) => {
    if (organizationId) {
        return db.collection('organizations').doc(organizationId).collection('studios').doc(studioId).collection('users');
    }
    // Legacy fallback
    return db.collection('studios').doc(studioId).collection('users');
};

// Helper: require admin role
const requireAdmin = (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }
    const studioId = request.auth.token.studioId;
    const organizationId = request.auth.token.organizationId || null;
    if (!studioId) {
        throw new HttpsError('failed-precondition', 'studioId not found in auth token');
    }
    return { studioId, organizationId };
};

/**
 * List all users (admin only)
 */
exports.getAll = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    try {
        const snapshot = await usersCollection(organizationId, studioId)
            .orderBy('createdAt', 'desc')
            .get();

        const users = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }));

        return { data: users };
    } catch (error) {
        console.error('List Users Error:', error);
        throw new HttpsError('internal', 'Kullanıcı listeleme başarısız oldu.');
    }
});

/**
 * Create a new user
 */
exports.create = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    // Zod validation
    const validated = validate(userSchema, {
        email: request.data.email || `placeholder@studio.local`,
        password: request.data.password,
        fullName: request.data.fullName,
        role: request.data.role || 'user'
    }, 'kullanıcı');

    const { email, password, fullName, username, phone, role = 'user' } = { ...request.data, ...validated };

    const authEmail = email || `${(username || fullName.replace(/\s+/g, '').toLowerCase())}@studio-${studioId}.local`;

    try {
        const userRecord = await auth.createUser({
            email: authEmail,
            password,
            displayName: fullName
        });

        await auth.setCustomUserClaims(userRecord.uid, { role, studioId, organizationId });

        await usersCollection(organizationId, studioId).doc(userRecord.uid).set({
            email: authEmail,
            username: username || '',
            fullName,
            phone: phone || '',
            role,
            studioId,
            organizationId,
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        return { uid: userRecord.uid, success: true };
    } catch (error) {
        console.error('User creation failed:', error);
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'Bu e-posta adresi zaten kullanımda.');
        }
        throw new HttpsError('internal', 'Kullanıcı oluşturma başarısız oldu.');
    }
});

/**
 * Update user (role, fullName, email, isActive)
 */
exports.update = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const { id, data } = request.data;
    const uid = id;

    if (!uid) {
        throw new HttpsError('invalid-argument', 'User ID required');
    }

    // Verify user belongs to this studio
    const userDoc = await usersCollection(organizationId, studioId).doc(uid).get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    }
    if (userDoc.data().studioId !== studioId) {
        throw new HttpsError('permission-denied', 'Cannot modify users from other studios');
    }

    const { fullName, email, role, isActive } = data || {};

    // Role whitelist
    if (role) {
        const allowedRoles = ['admin', 'user'];
        if (!allowedRoles.includes(role)) {
            throw new HttpsError('invalid-argument', `Invalid role. Allowed: ${allowedRoles.join(', ')}`);
        }
    }

    try {
        // Update Firebase Auth
        const authUpdates = {};
        if (fullName) authUpdates.displayName = fullName;
        if (email) authUpdates.email = email;
        if (typeof isActive === 'boolean') authUpdates.disabled = !isActive;
        if (Object.keys(authUpdates).length > 0) {
            await auth.updateUser(uid, authUpdates);
        }

        // Update custom claims if role changed
        if (role) {
            const currentClaims = (await auth.getUser(uid)).customClaims || {};
            await auth.setCustomUserClaims(uid, { ...currentClaims, role });
        }

        // Update Firestore
        const firestoreUpdates = { updatedAt: FieldValue.serverTimestamp() };
        if (fullName) firestoreUpdates.fullName = fullName;
        if (email) firestoreUpdates.email = email;
        if (role) firestoreUpdates.role = role;
        if (typeof isActive === 'boolean') firestoreUpdates.isActive = isActive;

        await usersCollection(organizationId, studioId).doc(uid).update(firestoreUpdates);

        return { success: true };
    } catch (error) {
        console.error('User update failed:', error);
        throw new HttpsError('internal', 'Kullanıcı güncelleme başarısız oldu.');
    }
});

/**
 * Delete user
 */
exports.delete = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const { id } = request.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'User ID required');
    }

    const userDoc = await usersCollection(organizationId, studioId).doc(id).get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    }
    if (userDoc.data().studioId !== studioId) {
        throw new HttpsError('permission-denied', 'Cannot delete users from other studios');
    }

    try {
        await auth.deleteUser(id);
        await usersCollection(organizationId, studioId).doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('User delete failed:', error);
        throw new HttpsError('internal', 'Kullanıcı silme başarısız oldu.');
    }
});

/**
 * Toggle user active status
 */
exports.toggleStatus = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const { id } = request.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'User ID required');
    }

    const userDoc = await usersCollection(organizationId, studioId).doc(id).get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    }
    if (userDoc.data().studioId !== studioId) {
        throw new HttpsError('permission-denied', 'Cannot modify users from other studios');
    }

    try {
        const currentActive = userDoc.data().isActive !== false;
        const newActive = !currentActive;

        await auth.updateUser(id, { disabled: !newActive });
        await usersCollection(organizationId, studioId).doc(id).update({
            isActive: newActive,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, isActive: newActive };
    } catch (error) {
        console.error('Toggle status failed:', error);
        throw new HttpsError('internal', 'Durum güncelleme başarısız oldu.');
    }
});

/**
 * Reset user password (admin only)
 */
exports.resetPassword = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const { uid, password } = request.data;
    if (!uid || !password) {
        throw new HttpsError('invalid-argument', 'uid and password required');
    }

    if (password.length < 8) {
        throw new HttpsError('invalid-argument', 'Password must be at least 8 characters');
    }

    const userDoc = await usersCollection(organizationId, studioId).doc(uid).get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    }
    if (userDoc.data().studioId !== studioId) {
        throw new HttpsError('permission-denied', 'Cannot modify users from other studios');
    }

    try {
        await auth.updateUser(uid, { password });
        return { success: true };
    } catch (error) {
        console.error('Password reset failed:', error);
        throw new HttpsError('internal', 'Şifre sıfırlama başarısız oldu.');
    }
});

/**
 * Get staff leaves
 */
exports.getLeaves = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    try {
        const snapshot = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).collection('leaves')
            .orderBy('startDate', 'desc')
            .get();

        const leaves = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate?.()?.toISOString() || doc.data().startDate,
            endDate: doc.data().endDate?.toDate?.()?.toISOString() || doc.data().endDate,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }));

        return { data: leaves };
    } catch (error) {
        console.error('Get leaves failed:', error);
        throw new HttpsError('internal', 'İzin listesi alınamadı.');
    }
});

/**
 * Add staff leave
 */
exports.addLeave = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const validated = validate(leaveSchema, request.data, 'izin');
    const { userId, startDate, endDate, type, note } = validated;

    const userDoc = await usersCollection(organizationId, studioId).doc(userId).get();
    if (!userDoc.exists || userDoc.data().studioId !== studioId) {
        throw new HttpsError('not-found', 'Kullanıcı bulunamadı.');
    }

    try {
        const leaveData = {
            userId,
            userName: userDoc.data().fullName || '',
            studioId,
            organizationId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            type,
            note: note || '',
            createdAt: FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).collection('leaves').add(leaveData);
        return { id: docRef.id, success: true };
    } catch (error) {
        console.error('Add leave failed:', error);
        throw new HttpsError('internal', 'İzin ekleme başarısız oldu.');
    }
});

/**
 * Delete staff leave
 */
exports.deleteLeave = onCall({ enforceAppCheck: APPCHECK_ENABLED }, async (request) => {
    const { studioId, organizationId } = requireAdmin(request);

    const { id } = request.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'Leave ID required');
    }

    try {
        const leaveDoc = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).collection('leaves').doc(id).get();
        if (!leaveDoc.exists) {
            throw new HttpsError('not-found', 'İzin kaydı bulunamadı.');
        }

        await leaveDoc.ref.delete();
        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete leave failed:', error);
        throw new HttpsError('internal', 'İzin silme başarısız oldu.');
    }
});
