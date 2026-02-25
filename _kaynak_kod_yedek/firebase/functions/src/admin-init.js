/**
 * Admin Initialization & Management Functions
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

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
        console.warn('TOTP_ENCRYPTION_KEY not set, storing secret unencrypted');
        return plaintext;
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

/**
 * Create a new Studio with Auto-Generated Admin & User accounts
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
        name,
        ownerName,
        contactEmail,
        phone,
        adminPassword,
        userPassword,
        licenseKey,
        hwidLock
    } = request.data;

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
        const studioRef = db.collection('studios').doc();
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
                license_key: licenseKey || null,
                max_users: 5
            },
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
            studioId: studioId
        });

        const userRecord = await auth.createUser({
            email: userEmail,
            password: userPassword,
            displayName: `${name} Personel`
        });

        await auth.setCustomUserClaims(userRecord.uid, {
            role: 'user',
            studioId: studioId
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
            isActive: true,
            createdAt: new Date().toISOString()
        });
        await studioRef.collection('users').doc(userRecord.uid).set({
            email: userEmail,
            fullName: `${name} Personel`,
            role: 'user',
            studioId,
            isActive: true,
            createdAt: new Date().toISOString()
        });

        return {
            success: true,
            studioId: studioId,
            message: 'Studio created with Admin and User accounts'
        };
    } catch (error) {
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

    const { studioId } = request.data;
    if (!studioId) {
        throw new HttpsError('invalid-argument', 'studioId is required');
    }

    try {
        const studioRef = db.collection('studios').doc(studioId);
        const studioDoc = await studioRef.get();
        if (!studioDoc.exists) {
            throw new HttpsError('not-found', 'Studio not found');
        }

        // 1. Delete subcollections
        const subcollections = [
            'archives', 'appointments', 'customers', 'shoots', 'payments',
            'settings', 'shootTypes', 'locations', 'photographers', 'packages',
            'system_users', 'activityLogs', 'auditLogs', 'paymentIntents',
            'counters', 'leaves'
        ];
        for (const sub of subcollections) {
            const snap = await studioRef.collection(sub).limit(500).get();
            if (!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }

        // 2. Delete Auth users for this studio (from studio subcollection)
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
        const studiosRef = db.collection('studios');
        const snapshot = await studiosRef.where('license.license_key', '==', cleanKey).limit(1).get();

        if (snapshot.empty) {
            throw new HttpsError('not-found', 'No studio found with this serial key');
        }

        const studioDoc = snapshot.docs[0];
        const studioData = studioDoc.data();

        return {
            success: true,
            studioId: studioDoc.id,
            studioName: studioData.info?.name || 'Studio'
        };
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
 * Get Studios With Stats
 * Returns all studios with expanded stats
 */
exports.getStudiosWithStats = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can view studio stats');
    }

    try {
        const studiosSnap = await db.collection('studios').get();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const studiosWithStats = await Promise.all(
            studiosSnap.docs.map(async (studioDoc) => {
                const studioId = studioDoc.id;
                const data = studioDoc.data();

                const studioRef = db.collection('studios').doc(studioId);

                const [archivesSnap, appointmentsCountSnap, whatsappSnap] = await Promise.all([
                    studioRef.collection('archives').get(),           // full docs for revenue/customer calc
                    studioRef.collection('appointments').count().get(),
                    studioRef.collection('settings').doc('whatsapp_status').get()
                ]);

                // totalCustomers = unique phone numbers in archives
                const phones = new Set();
                let monthlyRevenue = 0;

                archivesSnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.phone || d.customerPhone) phones.add(d.phone || d.customerPhone);

                    // monthlyRevenue: paid amounts in current month
                    const paid = Number(d.paidAmount) || 0;
                    const createdAt = d.createdAt?.toDate?.() || null;
                    if (paid > 0 && createdAt && createdAt >= monthStart) {
                        monthlyRevenue += paid;
                    }
                });

                // activeSince: days since studio created
                const studioCreated = data.createdAt?.toDate?.() || now;
                const activeSince = Math.floor((now - studioCreated) / (1000 * 60 * 60 * 24));

                // whatsappEnabled
                const whatsappEnabled = whatsappSnap.exists && !!(whatsappSnap.data()?.connected);

                return {
                    id: studioId,
                    ...data,
                    stats: {
                        archiveCount: archivesSnap.size,
                        appointmentCount: appointmentsCountSnap.data().count,
                        totalCustomers: phones.size,
                        monthlyRevenue,
                        activeSince,
                        whatsappEnabled
                    }
                };
            })
        );

        return { success: true, studios: studiosWithStats };
    } catch (error) {
        console.error('getStudiosWithStats error:', error);
        throw new HttpsError('internal', 'Stüdyo istatistikleri alınamadı');
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

    const { studioId } = request.data;
    if (!studioId) {
        throw new HttpsError('invalid-argument', 'studioId required');
    }

    try {
        const statusDoc = await db
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
 * Allowed fields: name, address, phone, email, licenseKey, isActive, plan
 */
exports.updateStudio = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can update studio info');
    }

    const { studioId, data } = request.data || {};
    if (!studioId || !data) {
        throw new HttpsError('invalid-argument', 'studioId and data required');
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
        await db.collection('studios').doc(studioId).update(updates);
        return { success: true };
    } catch (error) {
        console.error('updateStudio error:', error);
        throw new HttpsError('internal', 'Stüdyo güncellenemedi: ' + error.message);
    }
});

/**
 * Update Integration Config for a studio
 * Stores in studios/{studioId}/integrations/{type} subcollection
 * type: 'woocommerce' | 'iyzico' | 'stripe' | 'whatsapp'
 */
exports.updateIntegration = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }
    if (request.auth.token?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Only Creator can update integrations');
    }

    const { studioId, type, config } = request.data || {};
    if (!studioId || !type || !config) {
        throw new HttpsError('invalid-argument', 'studioId, type and config required');
    }

    const ALLOWED_TYPES = ['woocommerce', 'iyzico', 'stripe', 'whatsapp'];
    if (!ALLOWED_TYPES.includes(type)) {
        throw new HttpsError('invalid-argument', `Integration type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    }

    try {
        // Use integrations subcollection: studios/{id}/integrations/{type}
        await db
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
