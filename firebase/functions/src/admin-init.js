/**
 * Admin Initialization & Management Functions
 * Multi-Tenant: organizations/{orgId}/studios/{studioId} yapısı
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const db = admin.firestore();
const auth = admin.auth();

// --- SECURITY: Firestore-backed Rate Limiting (survives cold starts) ---
async function checkRateLimit(key, maxCalls, windowMs) {
    const rateLimitRef = db.collection('_rateLimits').doc(key);
    const now = Date.now();

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            const data = doc.exists ? doc.data() : { count: 0, resetAt: now + windowMs };

            if (now > data.resetAt) {
                transaction.set(rateLimitRef, { count: 1, resetAt: now + windowMs });
            } else if (data.count >= maxCalls) {
                throw new HttpsError('resource-exhausted', 'Çok fazla istek. Lütfen bekleyin.');
            } else {
                transaction.update(rateLimitRef, { count: data.count + 1 });
            }
        });
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Rate limit check failed:', error);
    }
}

// --- SECURITY: TOTP Secret Encryption ---
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY; // 32-byte hex key

function encryptSecret(plaintext) {
    if (!TOTP_ENCRYPTION_KEY) {
        throw new Error('TOTP_ENCRYPTION_KEY not set — cannot encrypt TOTP secret');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TOTP_ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(ciphertext) {
    if (!TOTP_ENCRYPTION_KEY || !ciphertext.includes(':')) return ciphertext;
    const [ivHex, encrypted] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(TOTP_ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Initialize the first Super Admin (Creator)
 */
exports.initSuperAdmin = onCall({ enforceAppCheck: false }, async (request) => {
    await checkRateLimit('initSuperAdmin', 3, 3600000); // max 3 calls/hour
    const { email, password, secretKey } = request.data;

    // SECURITY: Secret key from environment variable - NO fallback
    const expectedSecretKey = process.env.SUPER_ADMIN_SECRET_KEY;
    if (!expectedSecretKey) {
        throw new HttpsError('failed-precondition', 'SUPER_ADMIN_SECRET_KEY environment variable is not set.');
    }

    if (secretKey !== expectedSecretKey) {
        throw new HttpsError('permission-denied', 'Invalid secret key');
    }

    // SECURITY: Check if creator already exists
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

// ============================================
// ORGANIZATION MANAGEMENT
// ============================================

/**
 * Create a new Organization
 * SECURITY: Only Creator can create organizations
 */
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
        throw new HttpsError('internal', 'Organizasyon oluşturma başarısız: ' + error.message);
    }
});

/**
 * Delete an Organization (cascade: deletes all studios + auth users)
 * SECURITY: Only Creator can delete organizations
 */
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

        // Delete all studios in the organization
        const studiosSnap = await orgRef.collection('studios').get();
        for (const studioDoc of studiosSnap.docs) {
            // Delete subcollections of each studio
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

            // Delete Auth users for this studio
            const usersSnap = await studioDoc.ref.collection('users').get();
            for (const userDoc of usersSnap.docs) {
                try { await auth.deleteUser(userDoc.id); } catch (e) { /* user may already be deleted */ }
            }

            await studioDoc.ref.delete();
        }

        // Delete organization document
        await orgRef.delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete organization error:', error);
        throw new HttpsError('internal', 'Organizasyon silme başarısız oldu.');
    }
});

/**
 * Update Organization Info
 * SECURITY: Only Creator or OrgAdmin can update
 */
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

    // Creator can update any org, org_admin can only update their own
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
        throw new HttpsError('internal', 'Organizasyon güncellenemedi: ' + error.message);
    }
});

/**
 * List all Organizations (Creator only)
 */
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

// ============================================
// STUDIO MANAGEMENT (under Organizations)
// ============================================

/**
 * Create a new Studio with Auto-Generated Admin & User accounts
 * Now creates under organizations/{orgId}/studios/{studioId}
 */
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
        // Validate organization exists
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

        // Write users to studio-scoped users subcollection
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

/**
 * Delete a Studio with cascade cleanup (subcollections, Auth users, etc.)
 * SECURITY: Only Creator can delete studios
 */
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

        // 1. Delete subcollections
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

        // 2. Delete Auth users for this studio
        const usersSnap = await studioRef.collection('users').get();
        for (const userDoc of usersSnap.docs) {
            try { await auth.deleteUser(userDoc.id); } catch (e) { /* user may already be deleted */ }
            await userDoc.ref.delete();
        }

        // 3. Delete studio document
        await studioRef.delete();

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Delete studio error:', error);
        throw new HttpsError('internal', 'Stüdyo silme başarısız oldu.');
    }
});

/**
 * Trigger Build
 * SECURITY: Only Creator can trigger builds
 */
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

/**
 * Validate Serial Key and return associated Studio info
 * No auth required — this runs during initial setup before login
 * Searches across all organizations
 */
exports.validateSerialKey = onCall({ enforceAppCheck: false }, async (request) => {
    // SECURITY: Rate limit by IP since this is unauthenticated
    const clientIp = request.rawRequest?.ip || 'unknown';
    await checkRateLimit(`validateSerialKey_${clientIp}`, 10, 600000); // max 10 per 10 minutes

    const { serialKey } = request.data;

    if (!serialKey || typeof serialKey !== 'string') {
        throw new HttpsError('invalid-argument', 'Serial key is required');
    }

    const cleanKey = serialKey.trim().toUpperCase();

    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
        throw new HttpsError('invalid-argument', 'Invalid serial key format. Expected: XXXX-XXXX-XXXX-XXXX');
    }

    try {
        // Search across all organizations
        const orgsSnap = await db.collection('organizations').get();
        console.log(`[validateSerialKey] Searching ${orgsSnap.size} organizations for key: ${cleanKey}`);

        for (const orgDoc of orgsSnap.docs) {
            console.log(`[validateSerialKey] Checking org: ${orgDoc.id} (${orgDoc.data().name || 'unnamed'})`);

            // First try indexed query
            const studiosSnap = await orgDoc.ref.collection('studios')
                .where('license.license_key', '==', cleanKey)
                .limit(1)
                .get();

            if (!studiosSnap.empty) {
                const studioDoc = studiosSnap.docs[0];
                const studioData = studioDoc.data();
                console.log(`[validateSerialKey] FOUND via indexed query in org ${orgDoc.id}, studio ${studioDoc.id}`);

                return {
                    success: true,
                    studioId: studioDoc.id,
                    organizationId: orgDoc.id,
                    studioName: studioData.info?.name || 'Studio'
                };
            }

            // Fallback: manually scan studios (in case field path is different)
            const allStudios = await orgDoc.ref.collection('studios').get();
            console.log(`[validateSerialKey] Org ${orgDoc.id} has ${allStudios.size} studios, scanning manually...`);
            for (const sDoc of allStudios.docs) {
                const sData = sDoc.data();
                const storedKey = sData.license?.license_key || sData.licenseKey || sData.license_key || sData.serialKey;
                console.log(`[validateSerialKey]   Studio ${sDoc.id} (${sData.info?.name}): license_key=${storedKey}`);

                if (storedKey && storedKey.toUpperCase() === cleanKey) {
                    console.log(`[validateSerialKey] FOUND via manual scan! Studio ${sDoc.id}`);
                    return {
                        success: true,
                        studioId: sDoc.id,
                        organizationId: orgDoc.id,
                        studioName: sData.info?.name || 'Studio'
                    };
                }
            }
        }

        console.log(`[validateSerialKey] Key ${cleanKey} NOT FOUND in any organization`);
        throw new HttpsError('not-found', 'No studio found with this serial key');
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        console.error('Error validating serial key:', error);
        throw new HttpsError('internal', 'Failed to validate serial key');
    }
});

/**
 * Enable 2FA (TOTP) for Creator account
 */
exports.enable2FA = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can enable 2FA');
    }
    if (!TOTP_ENCRYPTION_KEY) {
        throw new HttpsError('failed-precondition', '2FA yapılandırması eksik. Yöneticiyle iletişime geçin.');
    }

    try {
        const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        const bytes = crypto.randomBytes(20);
        for (let i = 0; i < 20; i++) {
            secret += base32Chars[bytes[i] % 32];
        }

        // SECURITY: Encrypt TOTP secret before storing
        await db.collection('users').doc(request.auth.uid).update({
            totpSecret: encryptSecret(secret),
            totpEnabled: false
        });

        const otpauthUrl = `otpauth://totp/Studyo%20Creator:${encodeURIComponent(request.auth.token.email)}?secret=${secret}&issuer=Studyo%20Creator&algorithm=SHA1&digits=6&period=30`;

        return {
            success: true,
            secret,
            otpauthUrl
        };
    } catch (error) {
        console.error('Enable 2FA error:', error);
        throw new HttpsError('internal', '2FA etkinleştirme başarısız');
    }
});

/**
 * Verify a TOTP code (during login or 2FA setup confirmation)
 */
exports.verifyTotp = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    if (!TOTP_ENCRYPTION_KEY) {
        throw new HttpsError('failed-precondition', '2FA yapılandırması eksik. Yöneticiyle iletişime geçin.');
    }

    const { code } = request.data || {};
    if (!code || code.length !== 6) {
        throw new HttpsError('invalid-argument', '6 haneli kod gerekli');
    }

    try {
        const userDoc = await db.collection('users').doc(request.auth.uid).get();
        if (!userDoc.exists || !userDoc.data().totpSecret) {
            throw new HttpsError('failed-precondition', '2FA ayarlanmamış');
        }

        // SECURITY: Decrypt TOTP secret
        const secret = decryptSecret(userDoc.data().totpSecret);

        // Simple TOTP verification (RFC 6238)
        const timeStep = Math.floor(Date.now() / 30000);

        const verifyForStep = (step) => {
            const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let bits = '';
            for (const char of secret) {
                const val = base32Chars.indexOf(char.toUpperCase());
                if (val >= 0) bits += val.toString(2).padStart(5, '0');
            }
            const keyBytes = [];
            for (let i = 0; i + 8 <= bits.length; i += 8) {
                keyBytes.push(parseInt(bits.substr(i, 8), 2));
            }
            const key = Buffer.from(keyBytes);

            const timeBuffer = Buffer.alloc(8);
            timeBuffer.writeUInt32BE(0, 0);
            timeBuffer.writeUInt32BE(step, 4);

            const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
            const offset = hmac[hmac.length - 1] & 0xf;
            const otp = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;

            return otp.toString().padStart(6, '0');
        };

        const isValid = [timeStep - 1, timeStep, timeStep + 1].some(step =>
            verifyForStep(step) === code
        );

        if (!isValid) {
            return { success: false, message: 'Geçersiz kod' };
        }

        // If first verification, enable 2FA permanently
        if (!userDoc.data().totpEnabled) {
            await db.collection('users').doc(request.auth.uid).update({ totpEnabled: true });
            // SECURITY: Use getUser().customClaims instead of spreading token
            const currentUser = await auth.getUser(request.auth.uid);
            const currentClaims = currentUser.customClaims || {};
            await auth.setCustomUserClaims(request.auth.uid, {
                ...currentClaims,
                totp_enabled: true
            });
        }

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('TOTP verify error:', error);
        throw new HttpsError('internal', '2FA doğrulama başarısız');
    }
});

/**
 * Get Studios With Stats (searches across all organizations)
 * Returns all studios with expanded stats
 */
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

        // Helper: process a studio document into stats object (lightweight — only count() queries)
        const processStudio = async (studioDoc, orgId, orgName) => {
            const studioId = studioDoc.id;
            if (processedStudioIds.has(studioId)) return null;
            processedStudioIds.add(studioId);

            const data = studioDoc.data();
            const studioRef = studioDoc.ref;

            // ONLY use count() aggregation — never load full documents
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

        // 1. Query organizations/{orgId}/studios/ (new multi-tenant path)
        const orgsSnap = await db.collection('organizations').get();
        for (const orgDoc of orgsSnap.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios').get();
            const results = await Promise.all(
                studiosSnap.docs.map(doc => processStudio(doc, orgDoc.id, orgDoc.data().name || orgDoc.id))
            );
            allStudios.push(...results.filter(Boolean));
        }

        // 2. Legacy fallback: query root-level studios/ collection
        const legacySnap = await db.collection('studios').get();
        const legacyResults = await Promise.all(
            legacySnap.docs.map(doc => processStudio(doc, 'legacy', 'Bağımsız'))
        );
        allStudios.push(...legacyResults.filter(Boolean));

        return { success: true, studios: allStudios };
    } catch (error) {
        console.error('getStudiosWithStats error:', error);
        throw new HttpsError('internal', 'Stüdyo istatistikleri alınamadı: ' + error.message);
    }
});

/**
 * Get WhatsApp Status for a specific studio (creator only)
 */
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

/**
 * Update Studio Info (creator only)
 */
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
        throw new HttpsError('internal', 'Stüdyo güncellenemedi: ' + error.message);
    }
});

/**
 * Update Integration Config for a studio
 */
exports.updateIntegration = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can update integrations');
    }

    const { organizationId, studioId, type, config } = request.data || {};
    if (!organizationId || !studioId || !type || !config) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId, type and config required');
    }

    const ALLOWED_TYPES = ['woocommerce', 'iyzico', 'stripe', 'whatsapp'];
    if (!ALLOWED_TYPES.includes(type)) {
        throw new HttpsError('invalid-argument', `Integration type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    }

    try {
        await db
            .collection('organizations')
            .doc(organizationId)
            .collection('studios')
            .doc(studioId)
            .collection('integrations')
            .doc(type)
            .set({
                ...config,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid
            }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('updateIntegration error:', error);
        throw new HttpsError('internal', 'Entegrasyon güncellenemedi: ' + error.message);
    }
});

// ============================================
// HWID & LICENSE MANAGEMENT (Faz 1 & 2)
// ============================================

/**
 * Register HWID for a studio (first-time setup)
 */
exports.registerHwid = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { hwid, macAddress } = request.data;
    if (!hwid) {
        throw new HttpsError('invalid-argument', 'HWID is required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    try {
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const license = studioDoc.data().license || {};

        // If HWID already registered, check if it matches
        if (license.hwid_registered && license.hwid_lock) {
            if (license.hwid_lock !== hwid) {
                throw new HttpsError('permission-denied', 'This studio is already registered to another device');
            }
            return { success: true, message: 'HWID already registered' };
        }

        // Register HWID
        await studioRef.update({
            'license.hwid_lock': hwid,
            'license.mac_address': macAddress || null,
            'license.hwid_registered': true,
            'license.registered_at': admin.firestore.FieldValue.serverTimestamp(),
            'license.last_validated_at': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Write audit log
        await studioRef.collection('auditLogs').add({
            action: 'hwid_registered',
            hwid: hwid,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'HWID registered successfully' };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('registerHwid error:', error);
        throw new HttpsError('internal', 'HWID kaydı başarısız');
    }
});

// ============================================
// DEVICE MANAGEMENT & HWID APPROVAL (Çoklu Cihaz)
// ============================================

/**
 * Request HWID Approval — called from Electron Setup (no auth required)
 * Creates a pending device record for creator to approve
 */
exports.requestHwidApproval = onCall({ enforceAppCheck: false }, async (request) => {
    const { organizationId, studioId, licenseKey, hwid, macAddress, hostname, ipAddress, deviceInfo } = request.data || {};

    if (!organizationId || !studioId || !licenseKey || !hwid) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId, licenseKey and hwid are required');
    }

    try {
        // Validate license key matches the studio
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const studioData = studioDoc.data();
        if (studioData.license?.license_key !== licenseKey.trim().toUpperCase()) {
            throw new HttpsError('permission-denied', 'License key does not match');
        }

        // Check if this HWID already has an approved device
        const devicesRef = studioRef.collection('devices');
        const existingApproved = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'approved')
            .limit(1)
            .get();

        if (!existingApproved.empty) {
            // Already approved — update last active and return success
            const deviceDoc = existingApproved.docs[0];
            await deviceDoc.ref.update({
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress || null
            });
            return { success: true, status: 'approved', message: 'Device already approved' };
        }

        // Check if this HWID already has a pending request
        const existingPending = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existingPending.empty) {
            return { success: true, status: 'pending', message: 'Approval request already pending' };
        }

        // Create new pending device request
        await devicesRef.add({
            hwid,
            hostname: hostname || 'Bilinmeyen',
            macAddress: macAddress || null,
            ipAddress: ipAddress || null,
            status: 'pending',
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedAt: null,
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            deviceInfo: deviceInfo || {}
        });

        return { success: true, status: 'pending', message: 'HWID approval requested' };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('requestHwidApproval error:', error);
        throw new HttpsError('internal', 'HWID onay isteği başarısız');
    }
});

/**
 * Check HWID approval status — called from Electron Setup polling (no auth required)
 */
exports.checkHwidStatus = onCall({ enforceAppCheck: false }, async (request) => {
    const { organizationId, studioId, hwid } = request.data || {};

    if (!organizationId || !studioId || !hwid) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and hwid are required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef
            .where('hwid', '==', hwid)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { success: true, status: 'not_found' };
        }

        const device = snapshot.docs[0].data();
        return { success: true, status: device.status };
    } catch (error) {
        console.error('checkHwidStatus error:', error);
        throw new HttpsError('internal', 'Durum kontrolü başarısız');
    }
});

/**
 * Approve a device — Creator only
 */
exports.approveDevice = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can approve devices');
    }

    const { organizationId, studioId, deviceId } = request.data || {};
    if (!organizationId || !studioId || !deviceId) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and deviceId are required');
    }

    try {
        const deviceRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId);

        const deviceDoc = await deviceRef.get();
        if (!deviceDoc.exists) {
            throw new HttpsError('not-found', 'Device not found');
        }

        const deviceData = deviceDoc.data();
        if (deviceData.status === 'approved') {
            return { success: true, message: 'Device already approved' };
        }

        await deviceRef.update({
            status: 'approved',
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: request.auth.uid
        });

        // Also update legacy hwid_lock field for backward compatibility (first approved device)
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();
        const license = studioDoc.data()?.license || {};

        if (!license.hwid_lock || !license.hwid_registered) {
            await studioRef.update({
                'license.hwid_lock': deviceData.hwid,
                'license.mac_address': deviceData.macAddress || null,
                'license.hwid_registered': true,
                'license.registered_at': admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Audit log
        await studioRef.collection('auditLogs').add({
            action: 'device_approved',
            deviceId,
            hwid: deviceData.hwid,
            hostname: deviceData.hostname,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('approveDevice error:', error);
        throw new HttpsError('internal', 'Cihaz onaylama başarısız');
    }
});

/**
 * Reject a device — Creator only
 */
exports.rejectDevice = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can reject devices');
    }

    const { organizationId, studioId, deviceId } = request.data || {};
    if (!organizationId || !studioId || !deviceId) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId and deviceId are required');
    }

    try {
        const deviceRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices').doc(deviceId);

        const deviceDoc = await deviceRef.get();
        if (!deviceDoc.exists) {
            throw new HttpsError('not-found', 'Device not found');
        }

        await deviceRef.update({
            status: 'rejected',
            rejectedBy: request.auth.uid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Audit log
        const studioRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId);
        await studioRef.collection('auditLogs').add({
            action: 'device_rejected',
            deviceId,
            hwid: deviceDoc.data().hwid,
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('rejectDevice error:', error);
        throw new HttpsError('internal', 'Cihaz reddetme başarısız');
    }
});

/**
 * Get all devices for a studio — Creator only
 */
exports.getStudioDevices = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can view devices');
    }

    const { organizationId, studioId } = request.data || {};
    if (!organizationId || !studioId) {
        throw new HttpsError('invalid-argument', 'organizationId and studioId are required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef.orderBy('requestedAt', 'desc').get();
        const devices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate?.()?.toISOString() || null,
            approvedAt: doc.data().approvedAt?.toDate?.()?.toISOString() || null,
            lastActiveAt: doc.data().lastActiveAt?.toDate?.()?.toISOString() || null,
            rejectedAt: doc.data().rejectedAt?.toDate?.()?.toISOString() || null
        }));

        return { success: true, devices };
    } catch (error) {
        console.error('getStudioDevices error:', error);
        throw new HttpsError('internal', 'Cihaz listesi alınamadı');
    }
});

/**
 * Device heartbeat — updates lastActiveAt and IP (requires auth)
 */
exports.deviceHeartbeat = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    const { hwid, ipAddress } = request.data || {};
    if (!hwid) {
        throw new HttpsError('invalid-argument', 'hwid is required');
    }

    try {
        const devicesRef = db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId)
            .collection('devices');

        const snapshot = await devicesRef
            .where('hwid', '==', hwid)
            .where('status', '==', 'approved')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                ipAddress: ipAddress || null
            });
        }

        return { success: true };
    } catch (error) {
        console.error('deviceHeartbeat error:', error);
        // Don't throw — heartbeat failures shouldn't break the app
        return { success: false };
    }
});

/**
 * Check Subscription status
 */
exports.checkSubscription = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const organizationId = request.auth.token?.organizationId;
    const studioId = request.auth.token?.studioId;
    if (!organizationId || !studioId) {
        throw new HttpsError('failed-precondition', 'User must be assigned to a studio');
    }

    try {
        const studioDoc = await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).get();

        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        const data = studioDoc.data();
        const status = data.info?.subscription_status || 'active';
        const license = data.license || {};

        return {
            success: true,
            subscription_status: status,
            hwid_registered: license.hwid_registered || false,
            hwid_lock: license.hwid_lock || null,
            expires_at: license.expires_at || null,
            is_active: license.is_active !== false
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('checkSubscription error:', error);
        throw new HttpsError('internal', 'Abonelik durumu kontrol edilemedi');
    }
});

/**
 * Reset HWID for a studio (Creator only)
 */
exports.resetHwid = onCall({ enforceAppCheck: false }, async (request) => {
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
            'license.hwid_lock': null,
            'license.mac_address': null,
            'license.hwid_registered': false,
            'license.registered_at': null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Audit log
        await studioRef.collection('auditLogs').add({
            action: 'hwid_reset',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('resetHwid error:', error);
        throw new HttpsError('internal', 'HWID sıfırlama başarısız');
    }
});

/**
 * Regenerate License Key for a studio (Creator only)
 */
exports.regenerateLicenseKey = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId)
        throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    try {
        const newKey = DatabaseHandler.generateLicenseKey();

        await db.collection('organizations').doc(organizationId)
            .collection('studios').doc(studioId).update({
                'license.license_key': newKey,
                'license.hwid_lock': null,
                'license.hwid_registered': false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        return { success: true, newLicenseKey: newKey };
    } catch (error) {
        console.error('regenerateLicenseKey error:', error);
        throw new HttpsError('internal', 'Lisans anahtarı yenileme başarısız');
    }
});

/**
 * Suspend a Studio (Creator only)
 */
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

        // Record in subscription_history
        await studioRef.collection('subscription_history').add({
            action: 'suspended',
            reason: reason || 'No reason provided',
            performedBy: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Audit log
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

/**
 * Activate a Studio (Creator only)
 */
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

        // Record in subscription_history
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

/**
 * Get Audit Logs for a studio (Creator only)
 */
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

/**
 * Get Error Logs across all studios (Creator only)
 */
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
