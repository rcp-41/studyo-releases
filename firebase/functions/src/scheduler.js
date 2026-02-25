/**
 * Scheduled Cloud Functions
 * Otomatik zamanlı görevler (lisans süresi kontrolü vb.)
 */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

/**
 * Check and expire studios with expired licenses
 * Runs every 24 hours, scans all organizations
 */
exports.checkExpiredLicenses = onSchedule('every 24 hours', async (event) => {
    const db = admin.firestore();
    const now = new Date();

    // Tüm organizasyonlardaki stüdyoları tara
    const orgsSnap = await db.collection('organizations').get();
    let expiredCount = 0;

    for (const orgDoc of orgsSnap.docs) {
        const studiosSnap = await orgDoc.ref.collection('studios')
            .where('license.expires_at', '<=', now)
            .where('info.subscription_status', '==', 'active')
            .get();

        if (!studiosSnap.empty) {
            const batch = db.batch();
            studiosSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    'info.subscription_status': 'expired',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            expiredCount += studiosSnap.size;

            // Write audit logs for each expired studio
            for (const studioDoc of studiosSnap.docs) {
                await studioDoc.ref.collection('auditLogs').add({
                    action: 'license_expired',
                    performedBy: 'system',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                // Record in subscription_history
                await studioDoc.ref.collection('subscription_history').add({
                    action: 'expired',
                    reason: 'License period ended',
                    performedBy: 'system',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }

    console.log(`checkExpiredLicenses: ${expiredCount} stüdyo süresi doldu olarak işaretlendi.`);
});
