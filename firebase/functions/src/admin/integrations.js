const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

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
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'İşlem sırasında bir hata oluştu.');
    }
});
