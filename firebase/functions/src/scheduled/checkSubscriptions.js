/**
 * B1 / B3 — Subscription & Trial lifecycle scheduler
 * Runs daily: active/trial → grace_period → suspended
 */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.checkSubscriptions = onSchedule('every 24 hours', async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);

    let gracedCount = 0;
    let suspendedCount = 0;

    const orgsSnap = await db.collection('organizations').get();

    for (const orgDoc of orgsSnap.docs) {
        // 1) active/trial → grace_period (expiresAt passed)
        const activeSnap = await orgDoc.ref.collection('studios')
            .where('subscription.expiresAt', '<=', nowTs)
            .where('subscription.status', 'in', ['active', 'trial'])
            .get();

        if (!activeSnap.empty) {
            const batch = db.batch();
            activeSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    'subscription.status': 'grace_period',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            gracedCount += activeSnap.size;

            for (const studioDoc of activeSnap.docs) {
                const ts = admin.firestore.FieldValue.serverTimestamp();
                await studioDoc.ref.collection('auditLogs').add({
                    action: 'subscription_grace_period',
                    performedBy: 'system',
                    createdAt: ts
                });
                await studioDoc.ref.collection('activityTimeline').add({
                    event: 'subscription_grace_period',
                    performedBy: 'system',
                    createdAt: ts
                });
            }
        }

        // 2) grace_period → suspended (graceEndsAt passed)
        const graceSnap = await orgDoc.ref.collection('studios')
            .where('subscription.graceEndsAt', '<=', nowTs)
            .where('subscription.status', '==', 'grace_period')
            .get();

        if (!graceSnap.empty) {
            const batch = db.batch();
            graceSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    'subscription.status': 'expired',
                    'info.subscription_status': 'suspended',
                    'suspension': {
                        active: true,
                        reason: 'Abonelik süresi doldu',
                        suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                        suspendedBy: 'system',
                        reactivateAt: null
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            suspendedCount += graceSnap.size;

            for (const studioDoc of graceSnap.docs) {
                const ts = admin.firestore.FieldValue.serverTimestamp();
                await studioDoc.ref.collection('auditLogs').add({
                    action: 'studio_auto_suspended_expired',
                    performedBy: 'system',
                    reason: 'Grace period ended',
                    createdAt: ts
                });
                await studioDoc.ref.collection('activityTimeline').add({
                    event: 'studio_auto_suspended',
                    reason: 'Grace period ended',
                    performedBy: 'system',
                    createdAt: ts
                });
            }
        }
    }

    console.log(`checkSubscriptions: ${gracedCount} grace_period'e alındı, ${suspendedCount} otomatik askıya alındı.`);
});
