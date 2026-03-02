/**
 * Voice Bot — Twilio Voice Webhook Handler
 * 
 * Handles incoming phone calls via Twilio, uses Twilio's built-in
 * speech recognition, processes with bot-core, and responds with TTS.
 * 
 * Each studio has its own Twilio phone number registered in botRegistry.
 */

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const botCore = require('./bot-core');

const db = admin.firestore();

/**
 * Generate TwiML XML response
 */
function twiml(content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${content}
</Response>`;
}

/**
 * Incoming Call Handler
 * 
 * Twilio webhook when a call comes in.
 * Greets the caller and starts listening.
 * 
 * URL: https://<region>-<project>.cloudfunctions.net/voiceBot-incoming
 */
exports.incoming = onRequest({
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 120
}, async (req, res) => {
    try {
        const callerPhone = req.body?.From || req.body?.Caller || '';
        const calledPhone = req.body?.To || req.body?.Called || '';

        console.log(`[voice-bot] Incoming call from ${callerPhone} to ${calledPhone}`);

        // Find which studio this call belongs to
        const normalizedCalled = normalizePhone(calledPhone);
        const studio = await botCore.findStudioByPhone(normalizedCalled, 'voice');

        if (!studio) {
            console.warn(`[voice-bot] No studio found for phone: ${calledPhone}`);
            res.set('Content-Type', 'text/xml');
            return res.send(twiml(
                '<Say language="tr-TR" voice="Google.tr-TR-Standard-A">Bu numaraya ait bir stüdyo bulunamadı. Lütfen doğru numarayı arayın.</Say><Hangup/>'
            ));
        }

        // Get greeting message
        const config = await botCore.getBotConfig(studio.studioId, studio.organizationId);
        const greeting = config.settings?.greetingMessage || 'Hoş geldiniz! Size nasıl yardımcı olabilirim?';

        // Store studio info in call session via query parameters
        const gatherUrl = buildFunctionUrl('voiceBot-gather') +
            `?studioId=${studio.studioId}` +
            `&orgId=${studio.organizationId || ''}` +
            `&phone=${encodeURIComponent(callerPhone)}`;

        res.set('Content-Type', 'text/xml');
        return res.send(twiml(`
    <Say language="tr-TR" voice="Google.tr-TR-Standard-A">${escapeXml(greeting)}</Say>
    <Gather input="speech" language="tr-TR" speechTimeout="3" timeout="10" action="${escapeXml(gatherUrl)}" method="POST">
        <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Lütfen konuşmaya başlayın.</Say>
    </Gather>
    <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Sesini duyamadım. Lütfen tekrar arayın.</Say>
    <Hangup/>`));

    } catch (err) {
        console.error('[voice-bot] incoming error:', err);
        res.set('Content-Type', 'text/xml');
        return res.send(twiml(
            '<Say language="tr-TR" voice="Google.tr-TR-Standard-A">Bir hata oluştu. Lütfen daha sonra tekrar arayın.</Say><Hangup/>'
        ));
    }
});

/**
 * Gather Handler — Process speech input
 * 
 * Called by Twilio after the caller speaks.
 * Sends transcript to bot-core, then responds with TTS.
 * 
 * URL: https://<region>-<project>.cloudfunctions.net/voiceBot-gather
 */
exports.gather = onRequest({
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60
}, async (req, res) => {
    try {
        const studioId = req.query.studioId || req.body.studioId;
        const organizationId = req.query.orgId || req.body.orgId || null;
        const callerPhone = req.query.phone || req.body.From || '';
        const speechResult = req.body?.SpeechResult || '';

        console.log(`[voice-bot] Speech from ${callerPhone}: "${speechResult}"`);

        if (!speechResult) {
            // No speech detected — ask again or hang up
            const gatherUrl = buildFunctionUrl('voiceBot-gather') +
                `?studioId=${studioId}` +
                `&orgId=${organizationId || ''}` +
                `&phone=${encodeURIComponent(callerPhone)}`;

            res.set('Content-Type', 'text/xml');
            return res.send(twiml(`
    <Gather input="speech" language="tr-TR" speechTimeout="3" timeout="10" action="${escapeXml(gatherUrl)}" method="POST">
        <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Sizi duyamadım. Lütfen tekrar söyleyin.</Say>
    </Gather>
    <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Görüşmek üzere. İyi günler!</Say>
    <Hangup/>`));
        }

        // Process through bot core
        const result = await botCore.processMessage(
            studioId,
            organizationId,
            normalizePhone(callerPhone),
            speechResult,
            'voice'
        );

        const replyText = result.reply || 'Yanıt oluşturulamadı.';

        // Continue conversation — gather more speech after response
        const gatherUrl = buildFunctionUrl('voiceBot-gather') +
            `?studioId=${studioId}` +
            `&orgId=${organizationId || ''}` +
            `&phone=${encodeURIComponent(callerPhone)}`;

        res.set('Content-Type', 'text/xml');
        return res.send(twiml(`
    <Say language="tr-TR" voice="Google.tr-TR-Standard-A">${escapeXml(replyText)}</Say>
    <Pause length="1"/>
    <Gather input="speech" language="tr-TR" speechTimeout="3" timeout="15" action="${escapeXml(gatherUrl)}" method="POST">
        <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Başka bir sorunuz var mı?</Say>
    </Gather>
    <Say language="tr-TR" voice="Google.tr-TR-Standard-A">Bizi aradığınız için teşekkürler. İyi günler!</Say>
    <Hangup/>`));

    } catch (err) {
        console.error('[voice-bot] gather error:', err);
        res.set('Content-Type', 'text/xml');
        return res.send(twiml(
            '<Say language="tr-TR" voice="Google.tr-TR-Standard-A">Bir hata oluştu. Lütfen daha sonra tekrar arayın.</Say><Hangup/>'
        ));
    }
});

/**
 * Call Status Callback
 * Twilio calls this when a call ends — update stats
 */
exports.status = onRequest({ cors: true }, async (req, res) => {
    try {
        const callStatus = req.body?.CallStatus || '';
        const callerPhone = req.body?.From || '';
        const calledPhone = req.body?.To || '';
        const duration = parseInt(req.body?.CallDuration || '0', 10);

        console.log(`[voice-bot] Call status: ${callStatus} from ${callerPhone} (${duration}s)`);

        // Could update analytics here if needed

    } catch (err) {
        console.error('[voice-bot] status callback error:', err);
    }

    res.status(200).send('OK');
});

/**
 * Build full Cloud Function URL
 */
function buildFunctionUrl(functionName) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'studyo-live-2026';
    const region = process.env.FUNCTION_REGION || 'us-central1';
    return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Normalize phone number
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/[^0-9+]/g, '');

    if (cleaned.startsWith('+90')) {
        cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('90') && cleaned.length === 12) {
        cleaned = '0' + cleaned.substring(2);
    }

    return cleaned;
}
