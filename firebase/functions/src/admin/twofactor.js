const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { encryptSecret, decryptSecret, TOTP_ENCRYPTION_KEY } = require('./rateLimit');

const db = admin.firestore();
const auth = admin.auth();

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

        const secret = decryptSecret(userDoc.data().totpSecret);

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

        const isValid = [timeStep - 1, timeStep, timeStep + 1].some(step => {
            const expected = verifyForStep(step);
            if (typeof expected !== 'string' || expected.length !== code.length) return false;
            return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
        });

        if (!isValid) {
            return { success: false, message: 'Geçersiz kod' };
        }

        if (!userDoc.data().totpEnabled) {
            await db.collection('users').doc(request.auth.uid).update({ totpEnabled: true });
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
