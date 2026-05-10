/**
 * F3 — Broadcast Queue Processor
 * Her dakika çalışır; broadcastQueue/{id} status:'pending' kayıtları işler.
 *
 * WhatsApp kanalı:
 *   Hedef stüdyoların müşteri telefonlarını çeker →
 *   whatsappOutbox/{studioId}/{msgId}: { phone, body, status:'pending', queuedAt }
 *   Stüdyo desktop client bu outbox'ı dinleyip kendi WA oturumu üzerinden gönderir.
 *
 * Email kanalı:
 *   mail/{id} koleksiyonuna yazar → Firebase Extension "firestore-send-email" gönderir.
 *   Extension kurulu değilse kayıt yine yazılır ama TODO bırakılır.
 */

'use strict';

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const db = admin.firestore();

const BATCH_LIMIT = 50;           // run başına max broadcast kaydı
const WA_RATE_PER_STUDIO = 10;    // stüdyo başına dakikada max mesaj
const WA_PHONE_COOLDOWN_MS = 60 * 60 * 1000; // 1 saat — aynı telefona tekrar gönderim engeli

// ─── Yardımcı: hedef stüdyoları çöz ────────────────────────────────────────

async function resolveStudios(target, targetIds) {
    const results = []; // [{ studioId, orgId }]

    if (target === 'all') {
        const orgsSnap = await db.collection('organizations').get();
        for (const orgDoc of orgsSnap.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios')
                .where('info.subscription_status', '==', 'active')
                .get();
            studiosSnap.docs.forEach(s => results.push({ studioId: s.id, orgId: orgDoc.id }));
        }
    } else if (target === 'orgIds' && Array.isArray(targetIds)) {
        for (const orgId of targetIds) {
            const studiosSnap = await db.collection('organizations').doc(orgId)
                .collection('studios')
                .where('info.subscription_status', '==', 'active')
                .get();
            studiosSnap.docs.forEach(s => results.push({ studioId: s.id, orgId }));
        }
    } else if (target === 'studioIds' && Array.isArray(targetIds)) {
        // studioId direkt verilmiş; orgId'yi bulmak için tara
        const orgsSnap = await db.collection('organizations').get();
        const targetSet = new Set(targetIds);
        for (const orgDoc of orgsSnap.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios').get();
            studiosSnap.docs
                .filter(s => targetSet.has(s.id))
                .forEach(s => results.push({ studioId: s.id, orgId: orgDoc.id }));
        }
    }

    return results;
}

// ─── WhatsApp kanalı ────────────────────────────────────────────────────────

async function dispatchWhatsApp(broadcastId, studios, body) {
    let queued = 0;
    const errors = [];

    for (const { studioId, orgId } of studios) {
        try {
            // Müşteri telefonlarını çek
            const customersSnap = await db
                .collection('organizations').doc(orgId)
                .collection('studios').doc(studioId)
                .collection('customers')
                .where('status', '!=', 'deleted')
                .select('phone', 'optOutWhatsapp')
                .get();

            const phones = customersSnap.docs
                .map(d => d.data())
                .filter(c => c.phone && !c.optOutWhatsapp)
                .map(c => c.phone);

            if (phones.length === 0) continue;

            // Rate limit: stüdyo başına bu çalışmada max WA_RATE_PER_STUDIO mesaj
            const limited = phones.slice(0, WA_RATE_PER_STUDIO);

            // Phone-level cooldown: son 1 saat içinde gönderilmişleri filtrele
            const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - WA_PHONE_COOLDOWN_MS);
            const outboxRef = db.collection('whatsappOutbox').doc(studioId);

            // Batch write
            const batch = db.batch();
            for (const phone of limited) {
                // Cooldown kontrolü: son gönderimi sorgula (sadece sent olanlar)
                const recentSnap = await outboxRef.collection('messages')
                    .where('phone', '==', phone)
                    .where('status', '==', 'sent')
                    .where('sentAt', '>=', cutoff)
                    .limit(1)
                    .get();

                if (!recentSnap.empty) continue; // Cooldown aktif, atla

                const msgRef = outboxRef.collection('messages').doc();
                batch.set(msgRef, {
                    broadcastId,
                    phone,
                    body,
                    status: 'pending',
                    queuedAt: admin.firestore.FieldValue.serverTimestamp(),
                    sentAt: null,
                    error: null,
                    retryCount: 0,
                });
                queued++;
            }
            await batch.commit();

        } catch (err) {
            errors.push(`studio:${studioId} — ${err.message}`);
        }
    }

    return { queued, errors };
}

// ─── Email kanalı ───────────────────────────────────────────────────────────

async function dispatchEmail(broadcastId, studios, subject, body) {
    /**
     * TODO: Firebase Extension "firestore-send-email" kurulumu gerekiyor.
     * Extension kurulduktan sonra mail/{id} koleksiyonuna yazan bu kod
     * otomatik çalışır; ek değişiklik gerekmez.
     *
     * Kurulum adımları (kullanıcıya):
     *   1. Firebase Console > Extensions > "Send Email from Firestore" kur.
     *   2. SMTP veya SendGrid API key gir.
     *   3. Mail collection path: "mail"
     *   4. Kurulum tamamlandıktan sonra deploy: firebase deploy --only extensions
     *
     * SendGrid/Mailgun stub: mail/{id} dokümanı şu anda Firestore'a yazılıyor.
     * Extension olmadan bu dokümanlar birikir ama gönderilmez.
     */

    let queued = 0;
    const errors = [];

    for (const { studioId, orgId } of studios) {
        try {
            // Stüdyo yöneticisinin email adresini çek
            const studioDoc = await db
                .collection('organizations').doc(orgId)
                .collection('studios').doc(studioId)
                .get();

            const studioData = studioDoc.data();
            const email = studioData?.info?.email || studioData?.email;
            if (!email) continue;

            const mailRef = db.collection('mail').doc();
            await mailRef.set({
                broadcastId,
                studioId,
                to: [email],
                message: {
                    subject,
                    text: body,
                    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                // Extension bu alanları günceller:
                // delivery: { state: 'SUCCESS' | 'ERROR', ... }
            });
            queued++;

        } catch (err) {
            errors.push(`studio:${studioId} — ${err.message}`);
        }
    }

    return { queued, errors };
}

// ─── Ana scheduler ──────────────────────────────────────────────────────────

exports.processBroadcasts = onSchedule('every 1 minutes', async (_event) => {
    const pendingSnap = await db.collection('broadcastQueue')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(BATCH_LIMIT)
        .get();

    if (pendingSnap.empty) return;

    for (const doc of pendingSnap.docs) {
        const broadcast = doc.data();
        const { channel, target, targetIds, subject, body } = broadcast;

        // İşleniyor olarak işaretle (duplicate run engeli)
        await doc.ref.update({ status: 'processing', processedAt: admin.firestore.FieldValue.serverTimestamp() });

        try {
            const studios = await resolveStudios(target, targetIds);

            let dispatchedCount = 0;
            let allErrors = [];

            if (channel === 'whatsapp') {
                const result = await dispatchWhatsApp(doc.id, studios, body);
                dispatchedCount = result.queued;
                allErrors = result.errors;
            } else if (channel === 'email') {
                const result = await dispatchEmail(doc.id, studios, subject, body);
                dispatchedCount = result.queued;
                allErrors = result.errors;
            }

            const finalStatus = allErrors.length === 0
                ? 'sent'
                : dispatchedCount > 0
                    ? 'partial_sent'
                    : 'failed';

            await doc.ref.update({
                status: finalStatus,
                dispatchedCount,
                totalStudios: studios.length,
                errors: allErrors.slice(0, 20), // max 20 hata sakla
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        } catch (err) {
            await doc.ref.update({
                status: 'failed',
                errorMessage: err.message,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
});
