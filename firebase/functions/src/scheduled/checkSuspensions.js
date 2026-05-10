/**
 * A2 — Auto-reactivate suspended studios
 * Runs every hour, checks reactivateAt field
 */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.checkSuspensions = onSchedule('every 60 minutes', async (event) => {
    const db = admin.firestore();
    const now = new Date();
    let reactivatedCount = 0;

    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const studiosSnap = await orgDoc.ref.collection('studios')
            .where('suspension.active', '==', true)
            .where('suspension.reactivateAt', '<=', admin.firestore.Timestamp.fromDate(now))
            .get();

        if (studiosSnap.empty) continue;

        const batch = db.batch();
        studiosSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                'info.subscription_status': 'active',
                'suspension.active': false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        reactivatedCount += studiosSnap.size;

        for (const studioDoc of studiosSnap.docs) {
            const ts = admin.firestore.FieldValue.serverTimestamp();
            await studioDoc.ref.collection('auditLogs').add({
                action: 'studio_auto_reactivated',
                performedBy: 'system',
                reason: 'reactivateAt reached',
                createdAt: ts
            });
            await studioDoc.ref.collection('activityTimeline').add({
                event: 'studio_auto_reactivated',
                performedBy: 'system',
                createdAt: ts
            });
        }
    }

    console.log(`checkSuspensions: ${reactivatedCount} stüdyo otomatik aktifleştirildi.`);
});
