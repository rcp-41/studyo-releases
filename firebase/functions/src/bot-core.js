/**
 * Bot Core — Shared AI Brain for WhatsApp & Voice Bots
 * 
 * Ortak beyin: Gemini 2.5 Flash ile müşteri tanıma, randevu oluşturma,
 * şikayet kaydetme ve bilgi verme. Her iki kanal (WhatsApp & Twilio Voice)
 * bu modülü kullanır.
 */

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Gemini API key from environment / Firebase config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Get bot configuration for a studio
 * @param {string} studioId 
 * @param {string} organizationId
 * @returns {Object} { whatsapp, voice, settings }
 */
async function getBotConfig(studioId, organizationId) {
    const basePath = organizationId
        ? `organizations/${organizationId}/studios/${studioId}`
        : `studios/${studioId}`;

    const [whatsappDoc, voiceDoc, settingsDoc, studioInfoDoc] = await Promise.all([
        db.doc(`${basePath}/botConfig/whatsapp`).get(),
        db.doc(`${basePath}/botConfig/voice`).get(),
        db.doc(`${basePath}/botConfig/settings`).get(),
        db.doc(`${basePath}/botConfig/studioInfo`).get()
    ]);

    return {
        whatsapp: whatsappDoc.exists ? whatsappDoc.data() : null,
        voice: voiceDoc.exists ? voiceDoc.data() : null,
        settings: settingsDoc.exists ? settingsDoc.data() : null,
        studioInfo: studioInfoDoc.exists ? studioInfoDoc.data() : null
    };
}

/**
 * Lookup customer by phone number
 * Reuses the same logic as customers.lookupByPhone
 * @param {DatabaseHandler} dbHandler
 * @param {string} phone
 * @returns {Object|null} customer data
 */
async function lookupCustomer(dbHandler, phone) {
    if (!phone || phone.length < 4) return null;

    const cleanedPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

    try {
        // Try cleaned phone
        let snapshot = await dbHandler.collection('customers')
            .where('phone', '==', cleanedPhone)
            .limit(1)
            .get();

        if (snapshot.empty) {
            // Try original format
            snapshot = await dbHandler.collection('customers')
                .where('phone', '==', phone.trim())
                .limit(1)
                .get();
        }

        if (snapshot.empty) {
            // Try without leading zero (Turkish format: 05xx → 5xx)
            const noLeadingZero = cleanedPhone.replace(/^0/, '');
            snapshot = await dbHandler.collection('customers')
                .where('phone', '==', noLeadingZero)
                .limit(1)
                .get();
        }

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (err) {
        console.error('[bot-core] lookupCustomer error:', err.message);
        return null;
    }
}

/**
 * Get customer's recent archive records
 * @param {DatabaseHandler} dbHandler
 * @param {string} phone
 * @param {number} limit
 * @returns {Array} recent archives
 */
async function getCustomerHistory(dbHandler, phone, limit = 5) {
    if (!phone) return [];

    try {
        const cleanedPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

        // Search archives by phone
        const snapshot = await dbHandler.collection('archives')
            .orderBy('createdAt', 'desc')
            .limit(500) // fetch batch, then filter by phone
            .get();

        const results = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const archivePhone = (data.phone || '').replace(/\s+/g, '').replace(/[^0-9+]/g, '');
            if (archivePhone === cleanedPhone || archivePhone === phone.trim()) {
                results.push({
                    archiveNumber: data.archiveNumber,
                    fullName: data.fullName,
                    shootTypeName: data.shootTypeName || data.shootType,
                    shootDate: data.shootDate,
                    totalAmount: data.totalAmount,
                    paidAmount: data.paidAmount,
                    status: data.status
                });
                if (results.length >= limit) break;
            }
        }
        return results;
    } catch (err) {
        console.error('[bot-core] getCustomerHistory error:', err.message);
        return [];
    }
}

/**
 * Load conversation history for a phone number
 * @param {DatabaseHandler} dbHandler
 * @param {string} phone
 * @param {number} limit
 * @returns {Array} messages
 */
async function loadConversationHistory(dbHandler, phone, limit = 20) {
    try {
        const convRef = dbHandler.collection('conversations').doc(phone);
        const messagesSnap = await convRef.collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const messages = [];
        messagesSnap.forEach(doc => {
            const data = doc.data();
            messages.push({
                role: data.role,
                content: data.content,
                timestamp: data.timestamp
            });
        });

        return messages.reverse(); // Chronological order
    } catch (err) {
        // Conversation may not exist yet
        return [];
    }
}

/**
 * Save a message to conversation history
 * @param {DatabaseHandler} dbHandler
 * @param {string} phone
 * @param {string} customerName
 * @param {string} role - 'user' | 'assistant'
 * @param {string} content
 * @param {string} channel - 'whatsapp' | 'voice'
 * @param {Object|null} actionData - if an action was taken
 */
async function saveConversation(dbHandler, phone, customerName, role, content, channel, actionData = null) {
    try {
        const convRef = dbHandler.collection('conversations').doc(phone);

        // Update or create conversation document
        await convRef.set({
            phone,
            customerName: customerName || 'Bilinmeyen',
            lastMessage: FieldValue.serverTimestamp(),
            status: 'active',
            channel,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Increment message count
        await convRef.update({
            messageCount: FieldValue.increment(1)
        });

        // Add message
        const messageData = {
            role,
            content,
            channel,
            timestamp: FieldValue.serverTimestamp()
        };

        if (actionData) {
            messageData.action = actionData.type;
            messageData.actionData = actionData;
        }

        await convRef.collection('messages').add(messageData);
    } catch (err) {
        console.error('[bot-core] saveConversation error:', err.message);
    }
}

/**
 * Check daily rate limit for a studio
 * @param {string} studioId
 * @param {string} organizationId
 * @param {number} limit - daily message limit
 * @returns {boolean} true if within limit
 */
async function checkRateLimit(studioId, organizationId, limit = 200) {
    try {
        const basePath = organizationId
            ? `organizations/${organizationId}/studios/${studioId}`
            : `studios/${studioId}`;

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const counterRef = db.doc(`${basePath}/botConfig/dailyCounters`);
        const counterDoc = await counterRef.get();

        if (!counterDoc.exists) {
            await counterRef.set({ [today]: 1 });
            return true;
        }

        const data = counterDoc.data();
        const todayCount = data[today] || 0;

        if (todayCount >= limit) return false;

        await counterRef.update({ [today]: FieldValue.increment(1) });
        return true;
    } catch (err) {
        console.error('[bot-core] checkRateLimit error:', err.message);
        return true; // Allow on error
    }
}

/**
 * Build system prompt with studio context
 * @param {Object} settings - bot settings
 * @param {Object} studioData - studio lookup data
 * @returns {string} system prompt
 */
function buildSystemPrompt(settings, studioData, studioInfo) {
    const services = (settings.services || [])
        .map(s => `- ${s.name}: ${s.price}${s.duration ? ` (${s.duration})` : ''}`)
        .join('\n');

    const locations = (studioData.locations || [])
        .map(l => `- ${l.name}`)
        .join('\n');

    const photographers = (studioData.photographers || [])
        .map(p => `- ${p.name}`)
        .join('\n');

    const customPrompt = settings.systemPrompt || '';

    // Build studio info sections from studioInfo config
    let studioInfoBlock = '';
    if (studioInfo) {
        const parts = [];

        if (studioInfo.address) parts.push(`ADRES: ${studioInfo.address}`);
        if (studioInfo.directions) parts.push(`YOL TARİFİ: ${studioInfo.directions}`);
        if (studioInfo.mapsUrl) parts.push(`HARİTA: ${studioInfo.mapsUrl}`);
        if (studioInfo.phone) parts.push(`TELEFON: ${studioInfo.phone}`);
        if (studioInfo.email) parts.push(`E-POSTA: ${studioInfo.email}`);
        if (studioInfo.instagram) parts.push(`INSTAGRAM: ${studioInfo.instagram}`);
        if (studioInfo.website) parts.push(`WEB: ${studioInfo.website}`);
        if (studioInfo.about) parts.push(`STÜDYO HAKKINDA:\n${studioInfo.about}`);
        if (studioInfo.specialties) parts.push(`UZMANLIK ALANLARI: ${studioInfo.specialties}`);

        // Appointment settings
        if (studioInfo.appointmentDuration || studioInfo.breakBetween || studioInfo.maxDailyAppointments) {
            const appts = [];
            if (studioInfo.appointmentDuration) appts.push(`Seans süresi: ${studioInfo.appointmentDuration} dk`);
            if (studioInfo.breakBetween) appts.push(`Seanslar arası mola: ${studioInfo.breakBetween} dk`);
            if (studioInfo.maxDailyAppointments) appts.push(`Günlük max randevu: ${studioInfo.maxDailyAppointments}`);
            parts.push(`RANDEVU AYARLARI:\n${appts.join('\n')}`);
        }

        // Payment info
        if (studioInfo.iban || studioInfo.bankName || studioInfo.depositAmount) {
            const pay = [];
            if (studioInfo.bankName) pay.push(`Banka: ${studioInfo.bankName}`);
            if (studioInfo.iban) pay.push(`IBAN: ${studioInfo.iban}`);
            if (studioInfo.accountHolder) pay.push(`Hesap Sahibi: ${studioInfo.accountHolder}`);
            if (studioInfo.depositAmount) pay.push(`Kapora: ${studioInfo.depositAmount}`);
            if (studioInfo.paymentNotes) pay.push(`Not: ${studioInfo.paymentNotes}`);
            parts.push(`ÖDEME BİLGİLERİ:\n${pay.join('\n')}`);
        }

        // FAQ
        if (studioInfo.faq && studioInfo.faq.length > 0) {
            const faqText = studioInfo.faq.map(f => `S: ${f.question}\nC: ${f.answer}`).join('\n\n');
            parts.push(`SIK SORULAN SORULAR:\n${faqText}`);
        }

        // Campaigns
        if (studioInfo.campaigns && studioInfo.campaigns.length > 0) {
            const activeCampaigns = studioInfo.campaigns
                .filter(c => c.active !== false)
                .map(c => `- ${c.name}${c.details ? ': ' + c.details : ''}`)
                .join('\n');
            if (activeCampaigns) parts.push(`AKTİF KAMPANYALAR:\n${activeCampaigns}`);
        }

        // Restrictions
        if (studioInfo.restrictions) parts.push(`KISITLAMALAR (bunları ASLA yapma):\n${studioInfo.restrictions}`);

        if (parts.length > 0) {
            studioInfoBlock = '\n\n' + parts.join('\n\n');
        }
    }

    return `Sen bir fotoğraf stüdyosunun WhatsApp ve telefon asistanısın.

STÜDYO BİLGİLERİ:
- Stüdyo Adı: ${studioData.name || 'Fotoğraf Stüdyosu'}
- Sahibi: ${studioData.owner || ''}
- Çalışma Saatleri: ${settings.workingHours?.start || '09:00'} - ${settings.workingHours?.end || '19:00'}
${studioInfoBlock}

HİZMETLER VE FİYATLAR:
${services || '- Bilgi mevcut değil'}

MEKANLAR:
${locations || '- Stüdyo'}

FOTOĞRAFÇILAR:
${photographers || '- Bilgi mevcut değil'}

${customPrompt ? `EK TALİMATLAR:\n${customPrompt}` : ''}

KURALLAR:
1. Her zaman Türkçe yanıt ver, nazik ve profesyonel ol.
2. Randevu oluşturmak için şu bilgiler gerekli: ad soyad, telefon, tarih, saat ve çekim türü. Eksik bilgi varsa tek tek sor.
3. Fiyat sorulduğunda net bilgi ver.
4. Şikayet varsa konuyu ve detayı kaydet, empati göster.
5. Bilmediğin konularda "Stüdyo yetkilimiz en kısa sürede size dönecektir" de.
6. Kısa ve öz cevaplar ver, gereksiz uzatma.
7. Emoji kullanabilirsin ama abartma.`;
}

/**
 * Gemini function calling tool definitions
 */
const GEMINI_TOOLS = [{
    functionDeclarations: [
        {
            name: 'randevu_olustur',
            description: 'Müşteri için yeni randevu oluşturur. Tüm gerekli bilgiler toplandıktan sonra çağır.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    fullName: { type: 'STRING', description: 'Müşterinin tam adı' },
                    phone: { type: 'STRING', description: 'Telefon numarası' },
                    date: { type: 'STRING', description: 'Randevu tarihi (YYYY-MM-DD formatında)' },
                    time: { type: 'STRING', description: 'Randevu saati (HH:MM formatında)' },
                    shootType: { type: 'STRING', description: 'Çekim türü (vesikalık, düğün, vs.)' },
                    description: { type: 'STRING', description: 'Ek not veya açıklama' }
                },
                required: ['fullName', 'phone', 'date', 'time', 'shootType']
            }
        },
        {
            name: 'sikayet_kaydet',
            description: 'Müşteri şikayetini sisteme kaydeder.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    subject: { type: 'STRING', description: 'Şikayet konusu (kısa başlık)' },
                    description: { type: 'STRING', description: 'Şikayet detayı' }
                },
                required: ['subject', 'description']
            }
        },
        {
            name: 'musteri_gecmisi',
            description: 'Müşterinin geçmiş çekim kayıtlarını getirir. Müşteri geçmişini sorduğunda çağır.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    phone: { type: 'STRING', description: 'Müşteri telefon numarası' }
                },
                required: ['phone']
            }
        },
        {
            name: 'randevu_musaitlik',
            description: 'Belirli bir tarihteki randevu müsaitliğini kontrol eder.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    date: { type: 'STRING', description: 'Kontrol edilecek tarih (YYYY-MM-DD)' }
                },
                required: ['date']
            }
        }
    ]
}];

/**
 * Execute a function call from Gemini
 * @param {DatabaseHandler} dbHandler
 * @param {string} functionName
 * @param {Object} args
 * @param {string} phone - caller's phone
 * @param {string} channel
 * @returns {Object} result
 */
async function executeAction(dbHandler, functionName, args, phone, channel) {
    switch (functionName) {
        case 'randevu_olustur': {
            const appointmentData = {
                studioId: dbHandler.studioId,
                fullName: args.fullName,
                phone: args.phone || phone,
                shootTypeId: null, // Will be resolved by name
                shootTypeName: args.shootType,
                description1: args.description || null,
                description2: null,
                appointmentDate: new Date(args.date),
                timeSlot: args.time,
                status: 'pending',
                source: channel === 'whatsapp' ? 'whatsapp-bot' : 'voice-bot',
                createdAt: FieldValue.serverTimestamp(),
                createdBy: `bot-${channel}`
            };

            // Try to resolve shootType name to ID
            try {
                const typesSnap = await dbHandler.collection('shootTypes').get();
                for (const doc of typesSnap.docs) {
                    const name = (doc.data().name || '').toLowerCase();
                    if (name.includes(args.shootType.toLowerCase()) ||
                        args.shootType.toLowerCase().includes(name)) {
                        appointmentData.shootTypeId = doc.id;
                        appointmentData.shootTypeName = doc.data().name;
                        break;
                    }
                }
            } catch (_) { /* fallback: keep name only */ }

            const docRef = await dbHandler.collection('appointments').add(appointmentData);

            // Auto-create customer if not exists
            const customer = await lookupCustomer(dbHandler, args.phone || phone);
            if (!customer) {
                try {
                    await dbHandler.collection('customers').add({
                        fullName: args.fullName,
                        phone: args.phone || phone,
                        source: `bot-${channel}`,
                        createdAt: FieldValue.serverTimestamp()
                    });
                } catch (_) { /* best effort */ }
            }

            return {
                type: 'appointment_created',
                success: true,
                appointmentId: docRef.id,
                message: `✅ Randevunuz oluşturuldu!\n📅 Tarih: ${args.date}\n⏰ Saat: ${args.time}\n📸 Tür: ${args.shootType}`
            };
        }

        case 'sikayet_kaydet': {
            const complaintData = {
                studioId: dbHandler.studioId,
                phone,
                customerName: args.customerName || null,
                subject: args.subject,
                description: args.description,
                status: 'open',
                source: channel,
                createdAt: FieldValue.serverTimestamp()
            };

            // Try to find customer name
            const customer = await lookupCustomer(dbHandler, phone);
            if (customer) {
                complaintData.customerName = customer.fullName;
                complaintData.customerId = customer.id;
            }

            const docRef = await dbHandler.collection('complaints').add(complaintData);

            return {
                type: 'complaint_created',
                success: true,
                complaintId: docRef.id,
                message: `📝 Şikayetiniz kaydedildi. En kısa sürede ilgilenilecektir.\nKonu: ${args.subject}`
            };
        }

        case 'musteri_gecmisi': {
            const history = await getCustomerHistory(dbHandler, args.phone || phone);

            if (history.length === 0) {
                return {
                    type: 'customer_history',
                    success: true,
                    data: [],
                    message: 'Bu numaraya ait geçmiş kayıt bulunamadı.'
                };
            }

            const historyText = history.map((h, i) =>
                `${i + 1}. ${h.shootTypeName || 'Çekim'} — ${h.shootDate ? new Date(h.shootDate).toLocaleDateString('tr-TR') : '?'} — ${h.totalAmount || 0}₺`
            ).join('\n');

            return {
                type: 'customer_history',
                success: true,
                data: history,
                message: `📋 Geçmiş kayıtlarınız:\n${historyText}`
            };
        }

        case 'randevu_musaitlik': {
            try {
                const targetDate = new Date(args.date);
                const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0));
                const endOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59));

                const snapshot = await dbHandler.collection('appointments')
                    .where('appointmentDate', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
                    .where('appointmentDate', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
                    .get();

                const filled = snapshot.docs.map(doc => doc.data().timeSlot).filter(Boolean);
                const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
                    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];
                const available = allSlots.filter(s => !filled.includes(s));

                return {
                    type: 'availability_check',
                    success: true,
                    data: { date: args.date, available, filled: filled.length },
                    message: available.length > 0
                        ? `📅 ${args.date} tarihinde ${available.length} müsait saat var: ${available.slice(0, 6).join(', ')}${available.length > 6 ? '...' : ''}`
                        : `❌ ${args.date} tarihinde müsait saat bulunmuyor.`
                };
            } catch (err) {
                return {
                    type: 'availability_check',
                    success: false,
                    message: 'Müsaitlik kontrolünde bir hata oluştu.'
                };
            }
        }

        default:
            return { type: 'unknown', success: false, message: 'Bilinmeyen işlem.' };
    }
}

/**
 * Main message processing pipeline
 * Shared by both WhatsApp and Voice channels
 * 
 * @param {string} studioId
 * @param {string} organizationId
 * @param {string} phone - sender's phone
 * @param {string} text - message text
 * @param {string} channel - 'whatsapp' | 'voice'
 * @returns {Object} { reply, action }
 */
async function processMessage(studioId, organizationId, phone, text, channel) {
    console.log(`[bot-core] processMessage: studio=${studioId} phone=${phone} channel=${channel}`);

    // 1. Load bot config
    const config = await getBotConfig(studioId, organizationId);
    const settings = config.settings;

    if (!settings) {
        return { reply: 'Bot ayarları henüz yapılandırılmamış.', action: null };
    }

    // 2. Check channel enabled
    const channelConfig = channel === 'whatsapp' ? config.whatsapp : config.voice;
    if (!channelConfig?.enabled) {
        return { reply: null, action: null }; // Silently ignore
    }

    // 3. Check working hours
    const now = new Date();
    const currentHour = now.getUTCHours() + 3; // Turkey UTC+3
    const currentMinute = now.getUTCMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    if (settings.workingHours) {
        const { start, end, days } = settings.workingHours;
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = dayNames[now.getUTCDay()];

        if (days && !days.includes(today)) {
            return { reply: settings.outOfHoursMessage || 'Şu an çalışma saatleri dışındayız. Lütfen mesai saatlerinde tekrar deneyin.', action: null };
        }

        if (start && end && (currentTime < start || currentTime > end)) {
            return { reply: settings.outOfHoursMessage || 'Şu an çalışma saatleri dışındayız. Lütfen mesai saatlerinde tekrar deneyin.', action: null };
        }
    }

    // 4. Check rate limit
    const withinLimit = await checkRateLimit(studioId, organizationId, settings.dailyMessageLimit || 200);
    if (!withinLimit) {
        return { reply: 'Günlük mesaj limitine ulaşıldı. Lütfen yarın tekrar deneyin veya bizi arayın.', action: null };
    }

    // 5. Create DatabaseHandler for this studio
    const dbHandler = new DatabaseHandler(studioId, organizationId);

    // 6. Lookup customer by phone
    const customer = await lookupCustomer(dbHandler, phone);

    // 7. Get customer history (if customer exists)
    let historyContext = '';
    if (customer) {
        const archives = await getCustomerHistory(dbHandler, phone, 3);
        if (archives.length > 0) {
            historyContext = `\n\nMÜŞTERİ BİLGİSİ:\n- Ad: ${customer.fullName}\n- Geçmiş çekimler:\n` +
                archives.map(a => `  • ${a.shootTypeName || 'Çekim'} (${a.shootDate ? new Date(a.shootDate).toLocaleDateString('tr-TR') : '?'}) — ${a.totalAmount || 0}₺`).join('\n');
        } else {
            historyContext = `\n\nMÜŞTERİ BİLGİSİ:\n- Ad: ${customer.fullName}\n- Geçmiş kayıt yok.`;
        }
    }

    // 8. Load studio data for context
    let studioData = { name: '', owner: '', locations: [], photographers: [] };
    try {
        const studioDoc = await dbHandler.studioDoc().get();
        if (studioDoc.exists) {
            const sd = studioDoc.data();
            studioData.name = sd.name || '';
            studioData.owner = sd.owner || '';
        }

        // Load active locations
        const locSnap = await dbHandler.collection('locations').where('isActive', '==', true).limit(20).get();
        studioData.locations = locSnap.docs.map(d => ({ name: d.data().name }));

        // Load active photographers
        const photSnap = await dbHandler.collection('photographers').where('isActive', '==', true).limit(15).get();
        studioData.photographers = photSnap.docs.map(d => ({ name: d.data().name }));
    } catch (_) { /* best effort */ }

    // 9. Build system prompt
    const systemPrompt = buildSystemPrompt(settings, studioData, config.studioInfo) + historyContext;

    // 10. Load conversation history
    const conversationHistory = await loadConversationHistory(dbHandler, phone);

    // 11. Save user message
    await saveConversation(dbHandler, phone, customer?.fullName, 'user', text, channel);

    // 12. Call Gemini
    try {
        if (!GEMINI_API_KEY) {
            console.error('[bot-core] GEMINI_API_KEY not set!');
            return { reply: 'Sistem yapılandırma hatası. Lütfen daha sonra tekrar deneyin.', action: null };
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: GEMINI_TOOLS
        });

        // Build message history for Gemini
        const geminiHistory = conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: geminiHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] }
        });

        const result = await chat.sendMessage(text);
        const response = result.response;

        // Check for function calls
        const functionCalls = response.functionCalls();
        let actionResult = null;

        if (functionCalls && functionCalls.length > 0) {
            const fc = functionCalls[0];
            console.log(`[bot-core] Gemini function call: ${fc.name}`, JSON.stringify(fc.args));

            actionResult = await executeAction(dbHandler, fc.name, fc.args, phone, channel);

            // Send function result back to Gemini for natural response
            const fcResult = await chat.sendMessage([{
                functionResponse: {
                    name: fc.name,
                    response: actionResult
                }
            }]);

            const finalText = fcResult.response.text();

            // Save assistant response
            await saveConversation(dbHandler, phone, customer?.fullName, 'assistant', finalText, channel, actionResult);

            // Update conversation stats
            if (actionResult.type === 'appointment_created') {
                const convRef = dbHandler.collection('conversations').doc(phone);
                await convRef.update({ appointmentsCreated: FieldValue.increment(1) }).catch(() => { });
            }

            return { reply: finalText, action: actionResult };
        }

        // No function call — plain text response
        const replyText = response.text();

        // Save assistant response
        await saveConversation(dbHandler, phone, customer?.fullName, 'assistant', replyText, channel);

        return { reply: replyText, action: null };

    } catch (err) {
        console.error('[bot-core] Gemini call failed:', err.message);
        return {
            reply: 'Şu an yanıt veremiyorum. Lütfen biraz sonra tekrar deneyin veya bizi arayın. 📞',
            action: null
        };
    }
}

/**
 * Find studio by phone number from global bot registry
 * Used to route incoming messages/calls to the correct studio
 * @param {string} phoneNumber
 * @param {string} channel - 'whatsapp' | 'voice'
 * @returns {Object|null} { studioId, organizationId }
 */
async function findStudioByPhone(phoneNumber, channel) {
    try {
        const snapshot = await db.collection('botRegistry')
            .where('phoneNumber', '==', phoneNumber)
            .where('channel', '==', channel)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) return null;

        const data = snapshot.docs[0].data();
        return {
            studioId: data.studioId,
            organizationId: data.organizationId || null
        };
    } catch (err) {
        console.error('[bot-core] findStudioByPhone error:', err.message);
        return null;
    }
}

module.exports = {
    processMessage,
    getBotConfig,
    lookupCustomer,
    getCustomerHistory,
    loadConversationHistory,
    saveConversation,
    checkRateLimit,
    findStudioByPhone,
    executeAction,
    buildSystemPrompt,
    GEMINI_TOOLS
};
