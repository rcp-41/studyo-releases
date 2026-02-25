/**
 * Online Payments Cloud Functions
 * iyzico + PayTR payment gateway integration
 *
 * SETUP: API keys are stored in studio settings.
 * Users configure keys via Settings > API Integrations.
 *
 * iyzico Docs: https://dev.iyzipay.com/
 * PayTR Docs: https://dev.paytr.com/
 */

const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');
const crypto = require('crypto');

const FieldValue = admin.firestore.FieldValue;

/**
 * Initialize an iyzico payment
 */
exports.iyzicoCreatePayment = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { amount, customerName, customerEmail, customerPhone, archiveId, description } = request.data || {};

    if (!amount || !customerName || !customerEmail) {
        throw new HttpsError('invalid-argument', 'amount, customerName, and customerEmail are required');
    }

    try {
        // Get iyzico settings from studio config
        const studioInfo = await dbHandler.getStudioInfo();
        const settings = studioInfo.settings?.api || {};

        if (!settings.iyzico_enabled) {
            throw new HttpsError('failed-precondition', 'iyzico entegrasyonu aktif değil');
        }

        const apiKey = settings.iyzico_api_key;
        const secretKey = settings.iyzico_secret_key;
        const mode = settings.iyzico_mode || 'sandbox';

        if (!apiKey || !secretKey) {
            throw new HttpsError('failed-precondition', 'iyzico API anahtarları ayarlanmamış');
        }

        const baseUrl = mode === 'live'
            ? 'https://api.iyzipay.com'
            : 'https://sandbox-api.iyzipay.com';

        // Create payment request
        const conversationId = `pay_${Date.now()}_${crypto.randomUUID()}`;

        const paymentRequest = {
            locale: 'tr',
            conversationId,
            price: amount.toString(),
            paidPrice: amount.toString(),
            currency: 'TRY',
            installment: '1',
            paymentChannel: 'WEB',
            paymentGroup: 'PRODUCT',
            callbackUrl: `${baseUrl}/payment/callback`, // Will be replaced with actual callback
            buyer: {
                id: request.auth.uid,
                name: customerName.split(' ')[0] || 'Müşteri',
                surname: customerName.split(' ').slice(1).join(' ') || 'Bilinmiyor',
                email: customerEmail,
                gsmNumber: customerPhone || '',
                identityNumber: '11111111111', // Required by iyzico, using placeholder per their docs
                registrationAddress: studioInfo.info?.address || 'Studio Address',
                city: studioInfo.info?.city || 'Istanbul',
                country: 'Turkey',
                ip: request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0] || '127.0.0.1'
            },
            basketItems: [{
                id: archiveId || conversationId,
                name: description || 'Stüdyo Hizmeti',
                category1: 'Photography',
                itemType: 'VIRTUAL',
                price: amount.toString()
            }]
        };

        // Store payment intent
        await dbHandler.collection('paymentIntents').add({
            conversationId,
            amount: Number(amount),
            customerName,
            customerEmail,
            archiveId: archiveId || null,
            provider: 'iyzico',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        });

        // NOTE: Actual API call would be made here using the iyzico SDK
        // For now, return the payment intent data for frontend to handle
        return {
            success: true,
            conversationId,
            paymentRequest,
            message: 'Ödeme başlatma hazır. iyzico SDK entegrasyonu gerekli.'
        };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('iyzico payment error:', error);
        throw new HttpsError('internal', 'Ödeme başlatılamadı');
    }
});

/**
 * Initialize a PayTR payment (iFrame token)
 */
exports.paytrCreateToken = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { amount, customerName, customerEmail, customerPhone, archiveId, description } = request.data || {};

    if (!amount || !customerName || !customerEmail) {
        throw new HttpsError('invalid-argument', 'amount, customerName, and customerEmail are required');
    }

    try {
        const studioInfo = await dbHandler.getStudioInfo();
        const settings = studioInfo.settings?.api || {};

        if (!settings.paytr_enabled) {
            throw new HttpsError('failed-precondition', 'PayTR entegrasyonu aktif değil');
        }

        const merchantId = settings.paytr_merchant_id;
        const merchantKey = settings.paytr_merchant_key;
        const merchantSalt = settings.paytr_merchant_salt;

        if (!merchantId || !merchantKey || !merchantSalt) {
            throw new HttpsError('failed-precondition', 'PayTR API anahtarları ayarlanmamış');
        }

        const studioId = request.auth.token.studioId;
        const orderId = `ord_${studioId}_${Date.now()}_${crypto.randomUUID()}`;
        const paymentAmount = Math.round(amount * 100); // PayTR uses kuruş
        const noInstallment = '1';
        const maxInstallment = '0';
        const testMode = settings.paytr_mode === 'test' ? '1' : '0';

        // Generate PayTR hash
        const basketJson = Buffer.from(JSON.stringify([
            [description || 'Stüdyo Hizmeti', amount.toString(), 1]
        ])).toString('base64');

        const hashStr = `${merchantId}${request.auth.uid}${orderId}${paymentAmount}${noInstallment}${maxInstallment}TRY${testMode}`;
        const paytrToken = crypto
            .createHmac('sha256', merchantKey)
            .update(hashStr + merchantSalt)
            .digest('base64');

        // Store payment intent
        await dbHandler.collection('paymentIntents').add({
            orderId,
            amount: Number(amount),
            customerName,
            customerEmail,
            archiveId: archiveId || null,
            provider: 'paytr',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        });

        return {
            success: true,
            orderId,
            merchantId,
            userIp: request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0] || '127.0.0.1',
            merchantOid: orderId,
            email: customerEmail,
            paymentAmount,
            paytrToken,
            userName: customerName,
            userPhone: customerPhone || '',
            basketJson,
            testMode,
            noInstallment,
            maxInstallment,
            message: 'PayTR token oluşturuldu. iFrame entegrasyonu ile ödeme alınabilir.'
        };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('PayTR token error:', error);
        throw new HttpsError('internal', 'Ödeme token oluşturulamadı');
    }
});

/**
 * Payment callback handler (HTTP endpoint for PayTR/iyzico callbacks)
 * SECURITY: Verifies PayTR HMAC hash + uses studioId from orderId for direct lookup
 */
exports.callback = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { merchant_oid, status, total_amount, hash } = req.body;

        if (!merchant_oid || !hash) {
            res.status(400).send('Bad Request');
            return;
        }

        const db = admin.firestore();

        // SECURITY: Parse studioId from orderId format: ord_{studioId}_{timestamp}_{uuid}
        const orderParts = merchant_oid.split('_');
        let targetStudioId = null;
        if (orderParts.length >= 3 && orderParts[0] === 'ord') {
            targetStudioId = orderParts[1];
        }

        if (!targetStudioId) {
            console.error('Could not parse studioId from orderId:', merchant_oid);
            res.status(400).send('Invalid order ID format');
            return;
        }

        // SECURITY: Verify PayTR HMAC hash
        const studioDoc = await db.collection('studios').doc(targetStudioId).get();
        if (!studioDoc.exists) {
            console.error('Studio not found for payment callback:', targetStudioId);
            res.status(404).send('Studio not found');
            return;
        }

        const settings = studioDoc.data()?.settings?.api || {};
        const merchantKey = settings.paytr_merchant_key;
        const merchantSalt = settings.paytr_merchant_salt;

        if (merchantKey && merchantSalt) {
            const expectedHash = crypto
                .createHmac('sha256', merchantKey)
                .update(merchant_oid + merchantSalt + status + total_amount)
                .digest('base64');

            if (hash !== expectedHash) {
                console.error('Payment callback hash mismatch', { merchant_oid });
                res.status(403).send('Invalid hash');
                return;
            }
        } else {
            console.error('Cannot verify hash - merchant credentials not found', { merchant_oid, targetStudioId });
            res.status(403).send('Cannot verify callback');
            return;
        }

        // Direct studio lookup instead of scanning all studios
        const studioRef = db.collection('studios').doc(targetStudioId);
        const intentSnapshot = await studioRef
            .collection('paymentIntents')
            .where('orderId', '==', merchant_oid)
            .limit(1)
            .get();

        if (!intentSnapshot.empty) {
            const intentDoc = intentSnapshot.docs[0];
            await intentDoc.ref.update({
                status: status === 'success' ? 'paid' : 'failed',
                callbackData: req.body,
                completedAt: FieldValue.serverTimestamp()
            });

            if (status === 'success' && intentDoc.data().archiveId) {
                const archiveRef = studioRef.collection('archives').doc(intentDoc.data().archiveId);
                const archiveDoc = await archiveRef.get();
                if (archiveDoc.exists) {
                    const archive = archiveDoc.data();
                    const paidAmount = (archive.paidAmount || 0) + Number(total_amount / 100);
                    await archiveRef.update({
                        paidAmount,
                        remainingAmount: Math.max(0, (archive.totalAmount || 0) - paidAmount),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }
            }
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('Payment callback error:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Get payment status
 */
exports.getPaymentStatus = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const dbHandler = DatabaseHandler.fromRequest(request);
    const { orderId } = request.data || {};

    if (!orderId) {
        throw new HttpsError('invalid-argument', 'orderId is required');
    }

    try {
        const snapshot = await dbHandler.collection('paymentIntents')
            .where('orderId', '==', orderId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            throw new HttpsError('not-found', 'Ödeme bulunamadı');
        }

        const payment = snapshot.docs[0].data();
        return {
            success: true,
            data: {
                orderId: payment.orderId,
                status: payment.status,
                amount: payment.amount,
                provider: payment.provider,
                createdAt: payment.createdAt?.toDate?.()?.toISOString()
            }
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Ödeme durumu alınamadı');
    }
});
