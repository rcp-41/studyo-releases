/**
 * customTemplateRenderer.js — Turns a user-authored custom template JSON
 * into a complete HTML document ready for the Electron `print:html` IPC.
 *
 * Elements are absolutely positioned in mm and rendered over a <div class="page">
 * sized to the template's pageWidth/pageHeight (also in mm). Text content
 * supports [fieldKey] placeholders which are resolved against `normalizeArchive`.
 * Missing fields render as empty strings (never "undefined").
 *
 * Barcode elements scale the SVG to fit the declared box so users can freely
 * resize them in the editor.
 */

import { normalizeArchive } from './printTemplates';
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

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Build the resolver map — every placeholder key maps to a pre-formatted string.
 * Dates formatted as tr-TR, money via Intl with 2 fraction digits.
 */
function buildFieldMap(archive) {
    const a = normalizeArchive(archive);
    return {
        fullName: a.fullName || '',
        archiveNumber: a.archiveNumber || '',
        phone: a.phone || '',
        email: a.email || '',
        shootDate: fmtDate(a.shootDate),
        deliveryDate: fmtDate(a.deliveryDate),
        size: a.size || '',
        photographer: a.photographer || '',
        shootLocation: a.shootLocation || '',
        shootType: a.shootType || '',
        amount: fmtMoney(a.amount),
        paid: fmtMoney(a.paid),
        balance: fmtMoney(a.balance),
        notes: a.notes || '',
        webPassword: a.webPassword || ''
    };
}

/**
 * resolvePlaceholders — replace [fieldKey] tokens with values from the map.
 * Unknown/missing keys resolve to '' (never render "undefined" / "[foo]" stays).
 * Known-but-empty keys also resolve to ''.
 */
export function resolvePlaceholders(content, fieldMap) {
    if (content == null) return '';
    return String(content).replace(/\[([a-zA-Z0-9_]+)\]/g, (_m, key) => {
        if (Object.prototype.hasOwnProperty.call(fieldMap, key)) {
            return fieldMap[key] == null ? '' : String(fieldMap[key]);
        }
        return '';
    });
}

function renderTextElement(el, fieldMap) {
    const resolved = resolvePlaceholders(el.content, fieldMap);
    const safe = escapeHtml(resolved).replace(/\n/g, '<br>');
    const style = [
        `position:absolute`,
        `left:${el.x}mm`,
        `top:${el.y}mm`,
        `width:${el.width}mm`,
        `height:${el.height}mm`,
        `font-size:${el.fontSize || 10}pt`,
        `font-weight:${el.bold ? '700' : '400'}`,
        `text-align:${el.align || 'left'}`,
        `line-height:1.15`,
        `overflow:hidden`,
        `white-space:pre-wrap`,
        `word-break:break-word`,
        `display:flex`,
        `align-items:flex-start`,
        // flex justify mirrors text-align for single-line layouts
        `justify-content:${el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'}`
    ].join(';');
    return `<div class="el el-text" style="${style}">${safe}</div>`;
}

function renderBarcodeElement(el, fieldMap) {
    const value = fieldMap[el.field || 'archiveNumber'] || '';
    const svg = value
        ? generateCode39SVG(value, { height: 30, fontSize: 8, narrowWidth: 1.2, wideWidth: 3 })
        : '';
    const style = [
        `position:absolute`,
        `left:${el.x}mm`,
        `top:${el.y}mm`,
        `width:${el.width}mm`,
        `height:${el.height}mm`,
        `overflow:hidden`,
        `display:flex`,
        `align-items:center`,
        `justify-content:center`
    ].join(';');
    // Inline-scale the SVG to fit the element box.
    return `<div class="el el-barcode" style="${style}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${svg ? svg.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;"') : ''}</div></div>`;
}

function renderElement(el, fieldMap) {
    if (el.type === 'text') return renderTextElement(el, fieldMap);
    if (el.type === 'barcode') return renderBarcodeElement(el, fieldMap);
    return '';
}

/**
 * renderCustomTemplate — main entry. Returns a full HTML document string.
 * Throws only on total failure; malformed templates should be filtered out
 * by saveCustomTemplate/validateTemplate before reaching here.
 */
export function renderCustomTemplate(template, archive) {
    const fieldMap = buildFieldMap(archive || {});
    const pageWidth = Number(template.pageWidth) || 200;
    const pageHeight = Number(template.pageHeight) || 65;
    const elements = Array.isArray(template.elements) ? template.elements : [];

    const body = elements.map(el => renderElement(el, fieldMap)).join('');

    const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Tahoma', 'Arial', sans-serif; color: #000; background: #fff; }
@page { margin: 0; size: ${pageWidth}mm ${pageHeight}mm; }
.page { position: relative; width: ${pageWidth}mm; height: ${pageHeight}mm; overflow: hidden; }
.el { box-sizing: border-box; }
.el-text { color: #000; }
`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(template.name || 'Özel Şablon')}</title><style>${css}</style></head><body><div class="page">${body}</div></body></html>`;
}
