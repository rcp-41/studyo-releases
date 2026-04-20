import { generateCode39SVG } from './barcode';

const fmtDate = (d) => {
    if (!d) return '';
    try {
        const date = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '';
    }
};

const fmtMoney = (amt) => {
    const n = Number(amt) || 0;
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const escape = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function normalizeArchive(raw = {}) {
    const total = Number(raw.totalAmount ?? raw.amount ?? raw.tutar ?? 0);
    const paid = Number(raw.paidAmount ?? raw.alinan ?? 0);
    const balance = raw.remainingAmount != null ? Number(raw.remainingAmount) : Math.max(0, total - paid);

    let size = raw.size || raw.ebat || '';
    if (!size && Array.isArray(raw.packageItems)) {
        size = raw.packageItems.map(p => p?.name || p?.description || p?.label).filter(Boolean).join(' + ');
    }

    return {
        archiveNumber: String(raw.archiveNumber || raw.archiveId || raw.shootCode || ''),
        fullName: raw.fullName || raw.customer?.fullName || raw.name || '',
        phone: raw.phone || raw.customer?.phone || '',
        email: raw.email || raw.customer?.email || '',
        shootDate: raw.shootDate || raw.date || raw.tarih || null,
        deliveryDate: raw.deliveryDate || raw.teslim || raw.teslimDate || null,
        size,
        photographer: raw.photographer?.fullName || raw.photographerName || raw.cekimci || '',
        shootLocation: raw.location?.name || raw.locationName || raw.cekimYeri || '',
        shootType: raw.shootType?.name || raw.shootTypeName || raw.cekimTuru || '',
        amount: total,
        paid,
        balance,
        notes: raw.notes || raw.aciklama || raw.description1 || '',
        webPassword: raw.webPassword || raw.sifre || ''
    };
}

const baseCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Tahoma', 'Arial', sans-serif; color: #000; background: #fff; font-size: 9pt; }
@page { margin: 0; }
.template { position: relative; overflow: hidden; padding: 5mm; }
.template.receipt, .template.smallEnv { width: 200mm; height: 65mm; }
.template.bigEnv { width: 200mm; height: 205mm; }
.row { display: flex; gap: 4mm; align-items: baseline; margin-bottom: 1.2mm; }
.row.big { font-size: 11pt; margin-bottom: 2.4mm; }
.label { color: #444; min-width: 22mm; font-size: 8.5pt; }
.label.big { min-width: 28mm; font-size: 10pt; }
.value { flex: 1; font-weight: 500; }
.money { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.barcode { position: absolute; top: 3mm; right: 5mm; }
.amounts { display: grid; grid-template-columns: 1fr auto; gap: 1mm 4mm; margin-top: 2mm; }
.amounts.big { font-size: 11pt; }
.section { margin-top: 3mm; }
.footer { position: absolute; bottom: 4mm; left: 5mm; right: 5mm; font-size: 7.5pt; color: #666; display: flex; justify-content: space-between; }
`;

export function buildReceiptHtml(rawArchive) {
    const a = normalizeArchive(rawArchive);
    const barcode = a.archiveNumber ? generateCode39SVG(a.archiveNumber, { height: 30, fontSize: 8, narrowWidth: 1.2, wideWidth: 3 }) : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kayıt Fişi</title><style>${baseCss}</style></head><body>
<div class="template receipt">
    <div class="barcode">${barcode}</div>
    <div class="row"><span class="label">Ad Soyad:</span><span class="value">${escape(a.fullName)}</span></div>
    <div class="row"><span class="label">Tarih:</span><span class="value">${escape(fmtDate(a.shootDate))}</span></div>
    <div class="row"><span class="label">Teslim:</span><span class="value">${escape(fmtDate(a.deliveryDate))}</span></div>
    <div class="row"><span class="label">Ebat:</span><span class="value">${escape(a.size)}</span></div>
    <div class="amounts">
        <span class="label">Tutar:</span><span class="money">₺ ${fmtMoney(a.amount)}</span>
        <span class="label">Alınan:</span><span class="money">₺ ${fmtMoney(a.paid)}</span>
        <span class="label">Kalan:</span><span class="money">₺ ${fmtMoney(a.balance)}</span>
    </div>
</div>
</body></html>`;
}

export function buildSmallEnvelopeHtml(rawArchive) {
    const a = normalizeArchive(rawArchive);
    const barcode = a.archiveNumber ? generateCode39SVG(a.archiveNumber, { height: 32, fontSize: 8, narrowWidth: 1.2, wideWidth: 3 }) : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Küçük Zarf</title><style>${baseCss}</style></head><body>
<div class="template smallEnv">
    <div class="barcode">${barcode}</div>
    <div class="row"><span class="label">Telefon:</span><span class="value">${escape(a.phone)}</span></div>
    <div class="row"><span class="label">E-posta:</span><span class="value">${escape(a.email)}</span></div>
    <div class="row"><span class="label">Ad Soyad:</span><span class="value">${escape(a.fullName)}</span></div>
    <div class="row"><span class="label">Tarih:</span><span class="value">${escape(fmtDate(a.shootDate))}</span></div>
    <div class="row"><span class="label">Teslim:</span><span class="value">${escape(fmtDate(a.deliveryDate))}</span></div>
    <div class="row"><span class="label">Ebat:</span><span class="value">${escape(a.size)}</span></div>
    <div class="amounts" style="grid-template-columns: auto auto; justify-content: flex-end; gap: 0 4mm;">
        <span class="label" style="min-width: auto;">Tutar / Alınan / Kalan:</span>
        <span class="money">₺ ${fmtMoney(a.amount)} / ${fmtMoney(a.paid)} / ${fmtMoney(a.balance)}</span>
    </div>
</div>
</body></html>`;
}

export function buildBigEnvelopeHtml(rawArchive) {
    const a = normalizeArchive(rawArchive);
    const barcode = a.archiveNumber ? generateCode39SVG(a.archiveNumber, { height: 50, fontSize: 11, narrowWidth: 2, wideWidth: 5 }) : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Büyük Zarf</title><style>${baseCss}</style></head><body>
<div class="template bigEnv">
    <div class="barcode">${barcode}</div>
    <div class="section" style="margin-top:20mm">
        <div class="row big"><span class="label big">Ad Soyad:</span><span class="value">${escape(a.fullName)}</span></div>
        <div class="row big"><span class="label big">Telefon:</span><span class="value">${escape(a.phone)}</span></div>
        <div class="row big"><span class="label big">E-posta:</span><span class="value">${escape(a.email)}</span></div>
        <div class="row big"><span class="label big">Tarih:</span><span class="value">${escape(fmtDate(a.shootDate))}</span></div>
        <div class="row big"><span class="label big">Teslim:</span><span class="value">${escape(fmtDate(a.deliveryDate))}</span></div>
    </div>
    <div class="section" style="margin-top:30mm">
        <div class="row big"><span class="label big">Ebat:</span><span class="value">${escape(a.size)}</span></div>
        <div class="row big"><span class="label big">Çekimci:</span><span class="value">${escape(a.photographer)}</span></div>
        <div class="row big"><span class="label big">Çekim Yeri:</span><span class="value">${escape(a.shootLocation)}</span></div>
        <div class="row big"><span class="label big">Çekim Türü:</span><span class="value">${escape(a.shootType)}</span></div>
        ${a.notes ? `<div class="row big"><span class="label big">Notlar:</span><span class="value">${escape(a.notes)}</span></div>` : ''}
    </div>
    <div class="amounts big" style="position:absolute;bottom:15mm;left:5mm;right:5mm">
        <span class="label big">Tutar:</span><span class="money">₺ ${fmtMoney(a.amount)}</span>
        <span class="label big">Alınan:</span><span class="money">₺ ${fmtMoney(a.paid)}</span>
        <span class="label big">Kalan:</span><span class="money">₺ ${fmtMoney(a.balance)}</span>
    </div>
    <div class="footer">
        <span>${escape(a.archiveNumber ? '#' + a.archiveNumber : '')}</span>
        <span>${a.webPassword ? 'Şifre: ' + escape(a.webPassword) : ''}</span>
    </div>
</div>
</body></html>`;
}

export function buildTemplateHtml(templateType, archive) {
    switch (templateType) {
        case 'receipt': return buildReceiptHtml(archive);
        case 'smallEnvelope': return buildSmallEnvelopeHtml(archive);
        case 'bigEnvelope': return buildBigEnvelopeHtml(archive);
        default: throw new Error(`Unknown template type: ${templateType}`);
    }
}

export const PAGE_SIZES = {
    receipt: { width: 200000, height: 65000 },
    smallEnvelope: { width: 200000, height: 65000 },
    bigEnvelope: { width: 200000, height: 205000 }
};

export const TEMPLATE_TYPES = ['receipt', 'smallEnvelope', 'bigEnvelope'];
