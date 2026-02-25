/**
 * Auth Cloud Functions
 * Authentication-related functions (profile)
 *
 * User management (CRUD) is in users.js
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

// --- Firebase AppCheck ---
// When APPCHECK_ENABLED=true, onCall functions will reject requests without a valid AppCheck token.
// See index.js for full documentation on enabling AppCheck.
const APPCHECK_ENFORCED = process.env.APPCHECK_ENABLED === 'true';

// --- SECURITY: In-memory Rate Limiter ---
// Uses a Map with IP-based tracking and automatic TTL cleanup.
// Note: In-memory state is per-instance and resets on cold starts.
// For stricter enforcement across instances, use Firestore-backed rate limiting (see admin-init.js).
const rateLimitStore = new Map();

const RATE_LIMIT_CLEANUP_INTERVAL = 60000; // Clean expired entries every 60s
let lastCleanup = Date.now();

/**
 * In-memory rate limiter with sliding window.
 * @param {string} key - Unique key (e.g. IP address or uid)
 * @param {number} maxAttempts - Max allowed attempts within the window
 * @param {number} windowMs - Time window in milliseconds
 * @throws {HttpsError} if rate limit exceeded
 */
function checkInMemoryRateLimit(key, maxAttempts, windowMs) {
    const now = Date.now();

    // Periodic cleanup of expired entries to prevent memory leaks
    if (now - lastCleanup > RATE_LIMIT_CLEANUP_INTERVAL) {
        for (const [k, v] of rateLimitStore) {
            if (now > v.resetAt) rateLimitStore.delete(k);
        }
        lastCleanup = now;
    }

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        // Window expired or first request — start fresh
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return;
    }

    if (entry.count >= maxAttempts) {
        const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
        throw new HttpsError('resource-exhausted', `Çok fazla istek. ${retryAfterSec} saniye sonra tekrar deneyin.`);
    }

    entry.count++;
}

/**
 * Extract client IP from Cloud Function request for rate limiting.
 * @param {Object} request - onCall request object
 * @returns {string}
 */
function getClientIp(request) {
    return request.rawRequest?.ip
        || request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || 'unknown';
}

/**
 * Get current user profile
 * Multi-Tenant: reads from organizations/{orgId}/studios/{studioId}/users/{uid}
 * Fallback to top-level users for creator accounts
 */
exports.getProfile = onCall({ enforceAppCheck: APPCHECK_ENFORCED }, async (request) => {
    // SECURITY: Rate limit profile fetches by IP — 30 requests per minute
    const clientIp = getClientIp(request);
    checkInMemoryRateLimit(`getProfile_${clientIp}`, 30, 60000);

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User ID not found');
    }

    try {
        const organizationId = request.auth.token?.organizationId;
        const studioId = request.auth.token?.studioId;
        let doc;

        if (organizationId && studioId) {
            // Studio user: read from organization/studio subcollection
            doc = await db.collection('organizations').doc(organizationId)
                .collection('studios').doc(studioId)
                .collection('users').doc(uid).get();
        }

        // Fallback: top-level users (creator users or migration period)
        if (!doc || !doc.exists) {
            doc = await db.collection('users').doc(uid).get();
        }

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Kullanıcı profili bulunamadı.');
        }
        return { uid, ...doc.data() };
    } catch (error) {
        if (error.code) throw error;
        console.error('GetProfile Error:', error);
        throw new HttpsError('internal', 'Profil yükleme başarısız oldu.');
    }
});

// Export rate limiting utilities for use by other modules
exports._rateLimiting = {
    checkInMemoryRateLimit,
    getClientIp
};
