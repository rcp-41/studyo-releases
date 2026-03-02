/**
 * WhatsApp Bot — Cloud API Webhook Handler
 * 
 * Receives incoming WhatsApp messages via Meta Cloud API webhook,
 * routes to the correct studio, processes with bot-core, and replies.
 * 
 * Each studio has its own WhatsApp number registered in botRegistry.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const botCore = require('./bot-core');

const db = admin.firestore();

/**
 * WhatsApp Cloud API Webhook
 * 
 * GET  - Meta verification challenge
 * POST - Incoming message processing
 * 
 * URL: https://<region>-<project>.cloudfunctions.net/whatsappBot-webhook
 */
exports.webhook = onRequest({
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60
}, async (req, res) => {

    // === GET: Webhook Verification ===
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe') {
            // Find any active bot registry with this verify token
            try {
                const registrySnap = await db.collection('botRegistry')
                    .where('channel', '==', 'whatsapp')
                    .where('isActive', '==', true)
                    .get();

                let verified = false;
                for (const doc of registrySnap.docs) {
                    const data = doc.data();
                    if (data.verifyToken === token) {
                        verified = true;
                        break;
                    }
                }

                if (verified) {
                    console.log('[whatsapp-bot] Webhook verified');
                    return res.status(200).send(challenge);
                }
            } catch (err) {
                console.error('[whatsapp-bot] Verification error:', err);
            }

            return res.status(403).send('Forbidden');
        }
        return res.status(400).send('Bad Request');
    }

    // === POST: Incoming Message ===
    if (req.method === 'POST') {
        try {
            const body = req.body;

            // Meta sends various event types, we only care about messages
            if (!body?.entry?.[0]?.changes?.[0]?.value?.messages) {
                return res.status(200).send('OK'); // Acknowledge non-message events
            }

            const change = body.entry[0].changes[0].value;
            const message = change.messages[0];
            const senderPhone = message.from; // e.g., "905551234567"
            const recipientPhone = change.metadata?.display_phone_number; // Bot's phone number

            // Find which studio this message belongs to
            const normalizedRecipient = normalizePhone(recipientPhone);
            const studio = await botCore.findStudioByPhone(normalizedRecipient, 'whatsapp');

            if (!studio) {
                console.warn(`[whatsapp-bot] No studio found for phone: ${recipientPhone}`);
                return res.status(200).send('OK');
            }

            // Extract message text
            let messageText = '';
            let isVoiceNote = false;

            if (message.type === 'text') {
                messageText = message.text?.body || '';
            } else if (message.type === 'audio') {
                // Voice note — download and transcribe
                isVoiceNote = true;
                messageText = await handleVoiceNote(message.audio, studio, change.metadata);
            } else if (message.type === 'interactive') {
                // Button/list reply
                messageText = message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title || '';
            } else {
                // Unsupported message type
                messageText = '[Desteklenmeyen mesaj türü]';
            }

            if (!messageText) {
                return res.status(200).send('OK');
            }

            console.log(`[whatsapp-bot] Message from ${senderPhone} to studio ${studio.studioId}: ${messageText.substring(0, 100)}`);

            // Process message through bot core
            const result = await botCore.processMessage(
                studio.studioId,
                studio.organizationId,
                normalizePhone(senderPhone),
                messageText,
                'whatsapp'
            );

            // Send reply via WhatsApp Cloud API
            if (result.reply) {
                const config = await botCore.getBotConfig(studio.studioId, studio.organizationId);
                await sendWhatsAppMessage(
                    config.whatsapp.accessToken,
                    config.whatsapp.phoneNumberId,
                    senderPhone,
                    result.reply
                );
            }

            return res.status(200).send('OK');

        } catch (err) {
            console.error('[whatsapp-bot] Error processing message:', err);
            return res.status(200).send('OK'); // Always return 200 to Meta
        }
    }

    res.status(405).send('Method Not Allowed');
});

/**
 * Send a text message via WhatsApp Cloud API
 */
async function sendWhatsAppMessage(accessToken, phoneNumberId, to, text) {
    const fetch = require('node-fetch');

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: {
                    preview_url: false,
                    body: text.substring(0, 4096) // WhatsApp text limit
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[whatsapp-bot] Send message failed:', JSON.stringify(data));
            throw new Error(`WhatsApp API error: ${data.error?.message || response.status}`);
        }

        console.log(`[whatsapp-bot] Message sent to ${to}`);
        return data;
    } catch (err) {
        console.error('[whatsapp-bot] sendWhatsAppMessage error:', err.message);
        throw err;
    }
}

/**
 * Handle voice note — download audio and transcribe
 * For now, sends a text response asking to type instead.
 * TODO: Integrate Google Speech-to-Text for voice note transcription.
 */
async function handleVoiceNote(audio, studio, metadata) {
    // Future: download audio via Graph API, transcribe with Google STT
    // For MVP, we acknowledge the voice note
    return '[Sesli mesaj gönderildi — henüz sesli mesaj desteği aktif değil. Lütfen yazarak iletişime geçin.]';
}

/**
 * Normalize phone number for consistent matching
 * Handles various Turkish phone formats
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/[^0-9+]/g, '');

    // Convert +90 prefix to 0
    if (cleaned.startsWith('+90')) {
        cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('90') && cleaned.length === 12) {
        cleaned = '0' + cleaned.substring(2);
    }

    return cleaned;
}

/**
 * Send a proactive/template message to a customer
 * Called from bot-config when testing the bot
 */
exports.sendTestMessage = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { studioId, organizationId, phone, message } = request.data || {};
    if (!studioId || !phone || !message) {
        throw new HttpsError('invalid-argument', 'studioId, phone, and message are required');
    }

    const config = await botCore.getBotConfig(studioId, organizationId);
    if (!config.whatsapp?.accessToken || !config.whatsapp?.phoneNumberId) {
        throw new HttpsError('failed-precondition', 'WhatsApp not configured for this studio');
    }

    await sendWhatsAppMessage(
        config.whatsapp.accessToken,
        config.whatsapp.phoneNumberId,
        phone.replace(/^0/, '90'), // Convert 05xx to 905xx for WhatsApp
        message
    );

    return { success: true };
});
