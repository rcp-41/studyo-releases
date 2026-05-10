/**
 * Faz 3 — Stüdyo Veri Operasyonları & İzleme
 * A3: cloneStudio, A4: moveStudio
 * D1: exportStudioData, D2: createBackup / listBackups
 * D5: resetStudioData (2FA korumalı override)
 * E2: getStudioStorageUsage
 * E3: getAppCheckStats / recordAppCheckRejection
 * E4: getErrorLogs (geliştirilmiş)
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { encryptSecret, decryptSecret, TOTP_ENCRYPTION_KEY } = require('./rateLimit');
const crypto = require('crypto');

const db = admin.firestore();

// ─────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────

function assertCreator(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    if (request.auth.token?.role !== 'creator') throw new HttpsError('permission-denied', 'Only Creator');
}

/**
 * Recursive copy of all subcollections from srcRef to dstRef (max 1000 docs).
 * Returns total doc count copied.
 */
async function recursiveCopy(srcRef, dstRef, collectionNames) {
    let total = 0;
    for (const col of collectionNames) {
        const snap = await srcRef.collection(col).limit(1000).get();
        if (snap.empty) continue;
        const batch = db.batch();
        snap.docs.forEach(doc => {
            batch.set(dstRef.collection(col).doc(doc.id), doc.data());
            total++;
        });
        await batch.commit();
    }
    return total;
}

/**
 * TOTP verification helper (replicates verifyTotp logic inline).
 * Returns true if code valid for uid, throws HttpsError otherwise.
 */
async function assertTotp(uid, code) {
    if (!TOTP_ENCRYPTION_KEY) throw new HttpsError('failed-precondition', '2FA yapılandırması eksik');
    if (!code || String(code).length !== 6) throw new HttpsError('invalid-argument', '6 haneli TOTP kodu gerekli');

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data().totpSecret) {
        throw new HttpsError('failed-precondition', '2FA bu hesapta etkinleştirilmemiş. Önce 2FA\'yı aktive edin.');
    }
    if (!userDoc.data().totpEnabled) {
        throw new HttpsError('failed-precondition', '2FA henüz doğrulanmamış. Ayarlar > Güvenlik ekranından etkinleştirin.');
    }

    const secret = decryptSecret(userDoc.data().totpSecret);
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const timeStep = Math.floor(Date.now() / 30000);

    const verifyStep = (step) => {
        let bits = '';
        for (const char of secret) {
            const val = base32Chars.indexOf(char.toUpperCase());
            if (val >= 0) bits += val.toString(2).padStart(5, '0');
        }
        const keyBytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) keyBytes.push(parseInt(bits.substr(i, 8), 2));
        const key = Buffer.from(keyBytes);
        const tb = Buffer.alloc(8);
        tb.writeUInt32BE(0, 0); tb.writeUInt32BE(step, 4);
        const hmac = crypto.createHmac('sha1', key).update(tb).digest();
        const offset = hmac[hmac.length - 1] & 0xf;
        const otp = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
        return otp.toString().padStart(6, '0');
    };

    const codeStr = String(code);
    const valid = [timeStep - 1, timeStep, timeStep + 1].some(s => {
        const expected = verifyStep(s);
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(codeStr));
    });

    if (!valid) throw new HttpsError('permission-denied', 'Geçersiz TOTP kodu');
}

// ─────────────────────────────────────────────────────────
// A3 — Stüdyo Klonlama
// ─────────────────────────────────────────────────────────

const CLONE_COLLECTIONS = ['botConfig', 'packages', 'shootTypes', 'locations', 'photographers', 'priceLists', 'settings'];

exports.cloneStudio = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { sourceStudioId, sourceOrgId, newName, targetOrgId, options = {} } = request.data || {};
    if (!sourceStudioId || !sourceOrgId || !newName) {
        throw new HttpsError('invalid-argument', 'sourceStudioId, sourceOrgId, newName zorunlu');
    }

    const srcRef = db.collection('organizations').doc(sourceOrgId).collection('studios').doc(sourceStudioId);
    const srcDoc = await srcRef.get();
    if (!srcDoc.exists) throw new HttpsError('not-found', 'Kaynak stüdyo bulunamadı');

    const dstOrgId = targetOrgId || sourceOrgId;
    const dstRef = db.collection('organizations').doc(dstOrgId).collection('studios').doc();
    const newStudioId = dstRef.id;

    // New license key
    const { DatabaseHandler } = (() => { try { return require('../handlers/DatabaseHandler'); } catch { return { DatabaseHandler: null }; } })();
    const newLicenseKey = (() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const seg = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `${seg()}-${seg()}-${seg()}-${seg()}`;
    })();

    const srcData = srcDoc.data();
    const cloneData = {
        info: { ...srcData.info, name: newName },
        license: { ...(srcData.license || {}), license_key: newLicenseKey, hwid_registered: false, hwid_lock: false },
        plan: srcData.plan || { tier: 'basic' },
        organizationId: dstOrgId,
        clonedFrom: sourceStudioId,
        clonedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString(),
        createdBy: request.auth.uid
    };

    await dstRef.set(cloneData);

    // Determine which collections to copy
    const selectedCols = CLONE_COLLECTIONS.filter(col => {
        if (col === 'botConfig') return options.bot !== false;
        if (col === 'packages') return options.packages !== false;
        if (col === 'shootTypes') return options.shootTypes !== false;
        return options.settings !== false || !['settings'].includes(col);
    });

    const copiedCount = await recursiveCopy(srcRef, dstRef, selectedCols);

    await dstRef.collection('auditLogs').add({
        action: 'studio_cloned',
        clonedFrom: sourceStudioId,
        clonedAt: admin.firestore.FieldValue.serverTimestamp(),
        copiedCollections: selectedCols,
        copiedDocs: copiedCount,
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, newStudioId, licenseKey: newLicenseKey, copiedCollections: selectedCols, copiedDocs: copiedCount };
});

// ─────────────────────────────────────────────────────────
// A4 — Stüdyo Taşıma (organizasyon arası)
// ─────────────────────────────────────────────────────────

const MOVE_COLLECTIONS = [
    'archives', 'appointments', 'customers', 'shoots', 'payments',
    'settings', 'shootTypes', 'locations', 'photographers', 'packages',
    'system_users', 'activityLogs', 'auditLogs', 'paymentIntents',
    'counters', 'leaves', 'users', 'finance', 'schools', 'priceLists',
    'subscription_history', 'activityTimeline', 'botConfig', 'devices', 'errorLogs'
];

exports.moveStudio = onCall({ enforceAppCheck: false, timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    assertCreator(request);

    const { studioId, fromOrgId, toOrgId } = request.data || {};
    if (!studioId || !fromOrgId || !toOrgId) throw new HttpsError('invalid-argument', 'studioId, fromOrgId, toOrgId zorunlu');
    if (fromOrgId === toOrgId) throw new HttpsError('invalid-argument', 'Kaynak ve hedef org aynı olamaz');

    const srcRef = db.collection('organizations').doc(fromOrgId).collection('studios').doc(studioId);
    const srcDoc = await srcRef.get();
    if (!srcDoc.exists) throw new HttpsError('not-found', 'Stüdyo bulunamadı');

    const toOrgDoc = await db.collection('organizations').doc(toOrgId).get();
    if (!toOrgDoc.exists) throw new HttpsError('not-found', 'Hedef organizasyon bulunamadı');

    const moveId = `move_${studioId}_${Date.now()}`;
    const moveRef = db.collection('pending_moves').doc(moveId);
    await moveRef.set({ studioId, fromOrgId, toOrgId, status: 'in_progress', startedAt: admin.firestore.FieldValue.serverTimestamp(), performedBy: request.auth.uid });

    try {
        const dstRef = db.collection('organizations').doc(toOrgId).collection('studios').doc(studioId);

        // Copy studio doc with updated organizationId
        const updatedData = { ...srcDoc.data(), organizationId: toOrgId, movedAt: new Date().toISOString(), movedBy: request.auth.uid };
        await dstRef.set(updatedData);

        // Copy subcollections
        let totalCopied = 0;
        for (const col of MOVE_COLLECTIONS) {
            const snap = await srcRef.collection(col).limit(1000).get();
            if (snap.empty) continue;
            const batch = db.batch();
            snap.docs.forEach(doc => { batch.set(dstRef.collection(col).doc(doc.id), doc.data()); totalCopied++; });
            await batch.commit();
        }

        // Delete source subcollections then source doc
        for (const col of MOVE_COLLECTIONS) {
            const snap = await srcRef.collection(col).limit(500).get();
            if (snap.empty) continue;
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        await srcRef.delete();

        // Audit logs on destination
        await dstRef.collection('auditLogs').add({
            action: 'studio_moved_in',
            fromOrgId, toOrgId, moveId,
            totalDocsCopied: totalCopied,
            performedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await moveRef.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp(), totalDocsCopied: totalCopied });

        return { success: true, moveId, totalDocsCopied: totalCopied };
    } catch (err) {
        await moveRef.update({ status: 'failed', error: err.message, failedAt: admin.firestore.FieldValue.serverTimestamp() });
        console.error('moveStudio error:', err);
        throw new HttpsError('internal', 'Stüdyo taşıma başarısız: ' + err.message);
    }
});

// ─────────────────────────────────────────────────────────
// D1 — Stüdyo Veri Export
// ─────────────────────────────────────────────────────────

const EXPORT_COLLECTIONS = ['archives', 'appointments', 'customers', 'shoots', 'packages', 'shootTypes', 'locations', 'photographers', 'priceLists', 'settings', 'finance'];

exports.exportStudioData = onCall({ enforceAppCheck: false, timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    assertCreator(request);

    const { organizationId, studioId, collections, format = 'json' } = request.data || {};
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId ve studioId zorunlu');

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Stüdyo bulunamadı');

    const requestedCols = Array.isArray(collections) && collections.length > 0
        ? collections.filter(c => EXPORT_COLLECTIONS.includes(c))
        : EXPORT_COLLECTIONS;

    if (requestedCols.length === 0) throw new HttpsError('invalid-argument', 'Geçerli koleksiyon seçin');

    // Collect data
    const exportData = {};
    for (const col of requestedCols) {
        let docs = [];
        let lastDoc = null;
        let hasMore = true;
        while (hasMore) {
            let q = studioRef.collection(col).limit(500);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty) { hasMore = false; break; }
            snap.docs.forEach(d => docs.push({ id: d.id, ...d.data() }));
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < 500) hasMore = false;
        }
        exportData[col] = docs;
    }

    const timestamp = Date.now();
    const bucket = admin.storage().bucket();
    const fileName = `exports/${studioId}/${timestamp}.json`;

    // Serialize timestamps
    const serialized = JSON.stringify(exportData, (k, v) => {
        if (v && typeof v === 'object' && v._seconds !== undefined) return new Date(v._seconds * 1000).toISOString();
        return v;
    }, 2);

    const file = bucket.file(fileName);
    await file.save(Buffer.from(serialized, 'utf8'), { metadata: { contentType: 'application/json' } });

    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 24 * 3600 * 1000 });

    await studioRef.collection('auditLogs').add({
        action: 'data_exported',
        collections: requestedCols,
        format,
        fileName,
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, signedUrl, fileName, collections: requestedCols, expiresIn: '24h' };
});

// ─────────────────────────────────────────────────────────
// D2 — Firestore Snapshot/Backup
// ─────────────────────────────────────────────────────────

const BACKUP_COLLECTIONS = [
    'archives', 'appointments', 'customers', 'shoots', 'packages', 'shootTypes',
    'locations', 'photographers', 'priceLists', 'settings', 'finance', 'users',
    'system_users', 'activityLogs', 'auditLogs', 'counters', 'leaves', 'schools',
    'subscription_history', 'activityTimeline', 'botConfig', 'devices'
];

async function performBackup(organizationId, studioId) {
    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const backupData = { studioId, organizationId, backedUpAt: new Date().toISOString(), collections: {} };

    for (const col of BACKUP_COLLECTIONS) {
        let docs = [];
        let lastDoc = null;
        let hasMore = true;
        while (hasMore) {
            let q = studioRef.collection(col).limit(500);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty) { hasMore = false; break; }
            snap.docs.forEach(d => docs.push({ id: d.id, ...d.data() }));
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < 500) hasMore = false;
        }
        backupData.collections[col] = docs;
    }

    const timestamp = Date.now();
    const fileName = `backups/${studioId}/${timestamp}.json`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(fileName);

    const serialized = JSON.stringify(backupData, (k, v) => {
        if (v && typeof v === 'object' && v._seconds !== undefined) return new Date(v._seconds * 1000).toISOString();
        return v;
    });

    await file.save(Buffer.from(serialized, 'utf8'), { metadata: { contentType: 'application/json' } });
    return { fileName, timestamp };
}

exports.createBackup = onCall({ enforceAppCheck: false, timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    assertCreator(request);

    const { organizationId, studioId } = request.data || {};
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId ve studioId zorunlu');

    const studioDoc = await db.collection('organizations').doc(organizationId).collection('studios').doc(studioId).get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Stüdyo bulunamadı');

    const { fileName, timestamp } = await performBackup(organizationId, studioId);

    const bucket = admin.storage().bucket();
    const [signedUrl] = await bucket.file(fileName).getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 3600 * 1000 });

    await db.collection('organizations').doc(organizationId).collection('studios').doc(studioId)
        .collection('auditLogs').add({
            action: 'backup_created', fileName,
            performedBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

    return { success: true, signedUrl, fileName, expiresIn: '7d' };
});

exports.listBackups = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId } = request.data || {};
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId zorunlu');

    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: `backups/${studioId}/` });

    const backups = await Promise.all(files.map(async (f) => {
        const [url] = await f.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 3600 * 1000 });
        return {
            name: f.name,
            size: parseInt(f.metadata.size || 0),
            created: f.metadata.timeCreated,
            signedUrl: url
        };
    }));

    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    return { success: true, backups };
});

// ─────────────────────────────────────────────────────────
// D5 — Veri Sıfırlama 2FA Korumalı
// ─────────────────────────────────────────────────────────

exports.resetStudioDataSecure = onCall({
    enforceAppCheck: false,
    timeoutSeconds: 540,
    memory: '1GiB'
}, async (request) => {
    assertCreator(request);

    const { organizationId, studioId, resetOption, totpCode } = request.data || {};
    if (!organizationId || !studioId || !resetOption) {
        throw new HttpsError('invalid-argument', 'organizationId, studioId, resetOption zorunlu');
    }

    // 2FA check
    await assertTotp(request.auth.uid, totpCode);

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioSnap = await studioRef.get();
    if (!studioSnap.exists) throw new HttpsError('not-found', 'Stüdyo bulunamadı');

    const collectionsToReset = [];
    if (resetOption === 'archives') {
        collectionsToReset.push('archives', 'customers');
    } else if (resetOption === 'all') {
        collectionsToReset.push('archives', 'customers', 'schools', 'priceLists', 'shootTypes', 'packages', 'gifts', 'appointments', 'shoots', 'locations', 'photographers');
    } else {
        throw new HttpsError('invalid-argument', '"archives" veya "all" olmalı');
    }

    const deletedCounts = {};
    const bulkWriter = db.bulkWriter();
    let totalDeleted = 0;

    for (const col of collectionsToReset) {
        let colCount = 0;
        let hasMore = true;
        let lastDoc = null;
        while (hasMore) {
            let q = studioRef.collection(col).select().limit(500);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty) { hasMore = false; break; }
            snap.docs.forEach(doc => { bulkWriter.delete(doc.ref); colCount++; });
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < 500) hasMore = false;
        }
        deletedCounts[col] = colCount;
        totalDeleted += colCount;
    }

    await bulkWriter.close();

    const ip = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || 'unknown';
    const userAgent = request.rawRequest?.headers?.['user-agent'] || 'unknown';

    await studioRef.collection('auditLogs').add({
        action: 'RESET_STUDIO_DATA_SECURE',
        resetOption,
        deletedCollections: collectionsToReset,
        deletedCounts,
        totalDeleted,
        ip,
        userAgent,
        performedBy: request.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, totalDeleted, deletedCounts, deletedCollections: collectionsToReset };
});

// ─────────────────────────────────────────────────────────
// E2 — Depolama Kullanımı
// ─────────────────────────────────────────────────────────

exports.getStudioStorageUsage = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { organizationId, studioId } = request.data || {};
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId ve studioId zorunlu');

    // Cache check (1 hour TTL)
    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Stüdyo bulunamadı');

    const cached = studioDoc.data()?.usage?.storage;
    if (cached?.lastCalcAt) {
        const lastCalc = cached.lastCalcAt?.toDate?.() || new Date(cached.lastCalcAt);
        if (Date.now() - lastCalc.getTime() < 3600 * 1000) {
            return { success: true, ...cached, fromCache: true };
        }
    }

    // Compute fresh
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: `studios/${studioId}/` });

    let bytes = 0;
    const fileCount = files.length;
    const topFiles = [];

    files.forEach(f => {
        const size = parseInt(f.metadata.size || 0);
        bytes += size;
        topFiles.push({ name: f.name, size });
    });

    topFiles.sort((a, b) => b.size - a.size);
    const top10 = topFiles.slice(0, 10);

    const usage = {
        bytes,
        fileCount,
        lastCalcAt: admin.firestore.FieldValue.serverTimestamp(),
        top10Paths: top10
    };

    await studioRef.update({ 'usage.storage': usage });

    return { success: true, bytes, fileCount, top10Paths: top10, fromCache: false };
});

// ─────────────────────────────────────────────────────────
// E3 — AppCheck Reject Sayacı
// ─────────────────────────────────────────────────────────

exports.recordAppCheckRejection = onCall({ enforceAppCheck: false }, async (request) => {
    // Called internally when AppCheck fails in other callables
    const { organizationId, studioId, ip } = request.data || {};
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${organizationId || 'unknown'}_${studioId || 'unknown'}_${date}`;
    const rejRef = db.collection('appCheckRejections').doc(key);

    try {
        await db.runTransaction(async (tx) => {
            const doc = await tx.get(rejRef);
            if (doc.exists) {
                tx.update(rejRef, {
                    count: admin.firestore.FieldValue.increment(1),
                    ips: admin.firestore.FieldValue.arrayUnion(ip || 'unknown'),
                    lastRejectedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                // Threshold notification
                const newCount = (doc.data().count || 0) + 1;
                if (newCount >= 10) {
                    tx.update(rejRef, { adminAlert: true });
                }
            } else {
                tx.set(rejRef, {
                    organizationId, studioId, date,
                    count: 1,
                    ips: [ip || 'unknown'],
                    adminAlert: false,
                    firstRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastRejectedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        return { success: true };
    } catch (err) {
        console.error('recordAppCheckRejection error:', err);
        return { success: false };
    }
});

exports.getAppCheckStats = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId, daysBack = 30 } = request.data || {};
    const fromDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

    let query = db.collection('appCheckRejections').where('date', '>=', fromDate);
    if (studioId) query = query.where('studioId', '==', studioId);
    query = query.orderBy('date', 'desc').limit(100);

    const snap = await query.get();
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalRejections = records.reduce((s, r) => s + (r.count || 0), 0);

    return { success: true, records, totalRejections, daysBack };
});

// ─────────────────────────────────────────────────────────
// E4 — Error Logs (geliştirilmiş)
// ─────────────────────────────────────────────────────────

exports.getErrorLogsAdvanced = onCall({ enforceAppCheck: false }, async (request) => {
    assertCreator(request);

    const { studioId, severity, dateFrom, dateTo, limit: rawLimit = 100, searchText } = request.data || {};
    const maxLimit = Math.min(parseInt(rawLimit) || 100, 500);

    let query = db.collectionGroup('errorLogs').orderBy('createdAt', 'desc');

    if (severity) query = query.where('severity', '==', severity);
    if (dateFrom) query = query.where('createdAt', '>=', new Date(dateFrom));
    if (dateTo) query = query.where('createdAt', '<=', new Date(dateTo));
    if (studioId) query = query.where('studioId', '==', studioId);

    query = query.limit(maxLimit);

    const snap = await query.get();
    let logs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().timestamp || null
    }));

    // Client-side text filter (Firestore doesn't support full-text)
    if (searchText) {
        const lower = searchText.toLowerCase();
        logs = logs.filter(l =>
            (l.message || '').toLowerCase().includes(lower) ||
            (l.stack || '').toLowerCase().includes(lower)
        );
    }

    // 7-day trend by severity
    const trend = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        trend[d] = { info: 0, warn: 0, error: 0, fatal: 0 };
    }
    logs.forEach(l => {
        const day = (l.createdAt || '').slice(0, 10);
        if (trend[day]) trend[day][l.severity || 'error']++;
    });

    return { success: true, logs, trend: Object.entries(trend).map(([date, counts]) => ({ date, ...counts })) };
});

// ─────────────────────────────────────────────────────────
// Scheduled: Daily Backup (03:00 UTC)
// ─────────────────────────────────────────────────────────

exports.dailyBackup = onSchedule({ schedule: '0 3 * * *', timeZone: 'UTC', timeoutSeconds: 540, memory: '1GiB' }, async () => {
    console.log('[dailyBackup] Starting...');
    const orgsSnap = await db.collection('organizations').get();

    for (const orgDoc of orgsSnap.docs) {
        const studiosSnap = await orgDoc.ref.collection('studios')
            .where('info.subscription_status', '==', 'active').get();

        for (const studioDoc of studiosSnap.docs) {
            try {
                await performBackup(orgDoc.id, studioDoc.id);
                console.log(`[dailyBackup] Backed up: ${studioDoc.id}`);
            } catch (err) {
                console.error(`[dailyBackup] Failed for ${studioDoc.id}:`, err.message);
            }
        }
    }

    // Auto-delete backups older than 30 days
    const bucket = admin.storage().bucket();
    const [allFiles] = await bucket.getFiles({ prefix: 'backups/' });
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    for (const f of allFiles) {
        const created = new Date(f.metadata.timeCreated).getTime();
        if (created < cutoff) {
            try { await f.delete(); } catch (e) { console.warn('delete old backup error:', e.message); }
        }
    }
    console.log('[dailyBackup] Done.');
});

// ─────────────────────────────────────────────────────────
// Scheduled: Calc Storage Usage (every 12h)
// ─────────────────────────────────────────────────────────

exports.calcStorageUsage = onSchedule({ schedule: '0 */12 * * *', timeZone: 'UTC', memory: '512MiB' }, async () => {
    console.log('[calcStorageUsage] Starting...');
    const orgsSnap = await db.collection('organizations').get();

    for (const orgDoc of orgsSnap.docs) {
        const studiosSnap = await orgDoc.ref.collection('studios').get();
        for (const studioDoc of studiosSnap.docs) {
            try {
                const bucket = admin.storage().bucket();
                const [files] = await bucket.getFiles({ prefix: `studios/${studioDoc.id}/` });
                let bytes = 0;
                files.forEach(f => { bytes += parseInt(f.metadata.size || 0); });
                await studioDoc.ref.update({
                    'usage.storage': {
                        bytes, fileCount: files.length,
                        lastCalcAt: admin.firestore.FieldValue.serverTimestamp()
                    }
                });
            } catch (err) {
                console.error(`[calcStorageUsage] Failed for ${studioDoc.id}:`, err.message);
            }
        }
    }
    console.log('[calcStorageUsage] Done.');
});
