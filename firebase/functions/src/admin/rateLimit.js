const admin = require('firebase-admin');
const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;

async function checkRateLimit(key, maxCalls, windowMs) {
    const rateLimitRef = db.collection('_rateLimits').doc(key);
    const now = Date.now();

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            const data = doc.exists ? doc.data() : { count: 0, resetAt: now + windowMs };
            const expiresAt = admin.firestore.Timestamp.fromMillis(now + windowMs * 2);

            if (now > data.resetAt) {
                transaction.set(rateLimitRef, { count: 1, resetAt: now + windowMs, expiresAt });
            } else if (data.count >= maxCalls) {
                throw new HttpsError('resource-exhausted', 'Çok fazla istek. Lütfen bekleyin.');
            } else {
                transaction.update(rateLimitRef, { count: data.count + 1, expiresAt });
            }
        });
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('Rate limit check failed:', error);
    }
}

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

module.exports = {
    checkRateLimit,
    encryptSecret,
    decryptSecret,
    TOTP_ENCRYPTION_KEY,
};
