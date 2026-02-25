/**
 * Email Service - Gmail Compose Helper
 * Opens Gmail compose window via deep link
 */

const emailTemplates = {
    appointment_confirm: {
        label: 'Randevu Onayı',
        subject: 'Randevunuz Onaylandı - {{studioName}}',
        body: `Merhaba {{customerName}},

{{date}} tarihli randevunuz onaylanmıştır.

Çekim Türü: {{shootType}}
Saat: {{time}}
Lokasyon: {{location}}

Herhangi bir sorunuz varsa lütfen bize ulaşın.

Saygılarımızla,
{{studioName}}`
    },
    photos_ready: {
        label: 'Fotoğraflar Hazır',
        subject: 'Fotoğraflarınız Hazır - {{studioName}}',
        body: `Merhaba {{customerName}},

{{archiveNumber}} numaralı arşivinizdeki fotoğraflarınız hazırlanmıştır.

Fotoğraflarınızı görmek için stüdyomuza gelebilir veya online galerimizi ziyaret edebilirsiniz.

Web Şifreniz: {{webPassword}}

Saygılarımızla,
{{studioName}}`
    },
    payment_reminder: {
        label: 'Ödeme Hatırlatma',
        subject: 'Ödeme Hatırlatması - {{studioName}}',
        body: `Merhaba {{customerName}},

{{archiveNumber}} numaralı arşivinize ait {{remainingAmount}} tutarında ödemeniz bulunmaktadır.

Ödemenizi en kısa sürede gerçekleştirmenizi rica ederiz.

Saygılarımızla,
{{studioName}}`
    }
};

/**
 * Replace template variables with actual values
 */
function renderTemplate(template, variables = {}) {
    let text = template;
    Object.entries(variables).forEach(([key, value]) => {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    });
    return text;
}

/**
 * Open Gmail compose window
 */
function openGmailCompose({ to, subject, body }) {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (window.electron?.openExternal) {
        window.electron.openExternal(gmailUrl);
    } else {
        window.open(gmailUrl, '_blank');
    }
}

/**
 * Open Gmail with a pre-filled template
 */
function sendTemplateEmail(templateKey, to, variables = {}) {
    const template = emailTemplates[templateKey];
    if (!template) return;

    openGmailCompose({
        to,
        subject: renderTemplate(template.subject, variables),
        body: renderTemplate(template.body, variables)
    });
}

/**
 * Open WhatsApp chat on Windows
 */
function openWhatsAppChat(phoneNumber) {
    let intlPhone = phoneNumber.replace(/\D/g, '');
    if (intlPhone.startsWith('0')) {
        intlPhone = '90' + intlPhone.substring(1);
    }

    const url = `whatsapp://send?phone=${intlPhone}`;
    if (window.electron?.openExternal) {
        window.electron.openExternal(url);
    } else {
        window.open(`https://wa.me/${intlPhone}`, '_blank');
    }
}

export { emailTemplates, openGmailCompose, sendTemplateEmail, openWhatsAppChat, renderTemplate };
