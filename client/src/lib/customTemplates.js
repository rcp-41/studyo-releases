/**
 * customTemplates.js — Device-local persistence for user-edited print templates.
 *
 * A custom template is a JSON document describing a page layout with absolute
 * mm-positioned elements (text + barcode). When present, `buildTemplateHtml`
 * uses the custom version instead of the built-in builder for that type.
 *
 * Storage: localStorage (no Firestore sync in v1).
 * Shape: { receipt: Template | null, smallEnvelope: Template | null, bigEnvelope: Template | null }
 */

const STORAGE_KEY = 'studyo:customTemplates:v1';

const VALID_TYPES = ['receipt', 'smallEnvelope', 'bigEnvelope'];

const emptyStore = () => ({
    receipt: null,
    smallEnvelope: null,
    bigEnvelope: null
});

/**
 * Placeholder fields — everything `normalizeArchive` produces, exposed to the
 * editor palette so users can drag them into text elements.
 */
export const PLACEHOLDER_FIELDS = [
    { key: 'fullName', label: 'Ad Soyad', example: 'AHMET YILMAZ' },
    { key: 'archiveNumber', label: 'Arşiv No', example: '12345' },
    { key: 'phone', label: 'Telefon', example: '05551234567' },
    { key: 'email', label: 'E-posta', example: 'ornek@mail.com' },
    { key: 'shootDate', label: 'Çekim Tarihi', example: '20.04.2026' },
    { key: 'deliveryDate', label: 'Teslim Tarihi', example: '27.04.2026' },
    { key: 'size', label: 'Ebat / Paket', example: '6 VS + 1 Albüm' },
    { key: 'photographer', label: 'Çekimci', example: 'Mehmet Demir' },
    { key: 'shootLocation', label: 'Çekim Yeri', example: 'Stüdyo' },
    { key: 'shootType', label: 'Çekim Türü', example: 'Aile' },
    { key: 'amount', label: 'Tutar', example: '1500,00' },
    { key: 'paid', label: 'Alınan', example: '500,00' },
    { key: 'balance', label: 'Kalan', example: '1000,00' },
    { key: 'notes', label: 'Notlar', example: 'Örnek not' },
    { key: 'webPassword', label: 'Web Şifre', example: 'ab12x' }
];

/**
 * Page defaults (mm) matching PAGE_SIZES in printTemplates.js.
 */
export const DEFAULT_PAGE_SIZES = {
    receipt: { width: 200, height: 65 },
    smallEnvelope: { width: 200, height: 65 },
    bigEnvelope: { width: 200, height: 205 }
};

/**
 * Minimal blank template — used when user starts a new custom template.
 */
export function blankTemplate(type) {
    const page = DEFAULT_PAGE_SIZES[type] || { width: 200, height: 65 };
    return {
        type,
        name: 'Özel Şablon',
        pageWidth: page.width,
        pageHeight: page.height,
        elements: []
    };
}

function readStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyStore();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return emptyStore();
        return {
            receipt: validateTemplate(parsed.receipt, 'receipt'),
            smallEnvelope: validateTemplate(parsed.smallEnvelope, 'smallEnvelope'),
            bigEnvelope: validateTemplate(parsed.bigEnvelope, 'bigEnvelope')
        };
    } catch (e) {
        console.error('[customTemplates] parse failed:', e);
        return emptyStore();
    }
}

function writeStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        return true;
    } catch (e) {
        console.error('[customTemplates] save failed:', e);
        return false;
    }
}

/**
 * validateTemplate — structural sanity check; returns null if malformed
 * so callers fall back to built-in builders.
 */
function validateTemplate(tpl, type) {
    if (!tpl || typeof tpl !== 'object') return null;
    if (!VALID_TYPES.includes(tpl.type)) return null;
    if (type && tpl.type !== type) return null;
    if (!Array.isArray(tpl.elements)) return null;

    const pageWidth = Number(tpl.pageWidth);
    const pageHeight = Number(tpl.pageHeight);
    if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) return null;

    const elements = tpl.elements
        .map(el => validateElement(el, pageWidth, pageHeight))
        .filter(Boolean);

    return {
        type: tpl.type,
        name: String(tpl.name || 'Özel Şablon'),
        pageWidth,
        pageHeight,
        elements
    };
}

function validateElement(el, pageWidth, pageHeight) {
    if (!el || typeof el !== 'object') return null;
    if (el.type !== 'text' && el.type !== 'barcode') return null;

    const x = clamp(Number(el.x) || 0, 0, pageWidth);
    const y = clamp(Number(el.y) || 0, 0, pageHeight);
    const width = clamp(Number(el.width) || 20, 1, pageWidth);
    const height = clamp(Number(el.height) || 8, 1, pageHeight);

    const base = {
        id: String(el.id || (Date.now() + Math.random().toString(36).slice(2, 8))),
        type: el.type,
        x,
        y,
        width,
        height
    };

    if (el.type === 'text') {
        return {
            ...base,
            content: String(el.content ?? ''),
            fontSize: clamp(Number(el.fontSize) || 10, 4, 72),
            bold: !!el.bold,
            align: ['left', 'center', 'right'].includes(el.align) ? el.align : 'left'
        };
    }
    // barcode
    return {
        ...base,
        field: String(el.field || 'archiveNumber')
    };
}

function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

export function getCustomTemplate(type) {
    if (!VALID_TYPES.includes(type)) return null;
    const store = readStore();
    return store[type] || null;
}

export function saveCustomTemplate(type, template) {
    if (!VALID_TYPES.includes(type)) return false;
    const validated = validateTemplate({ ...template, type }, type);
    if (!validated) {
        console.error('[customTemplates] save rejected — malformed template');
        return false;
    }
    const store = readStore();
    store[type] = validated;
    return writeStore(store);
}

export function deleteCustomTemplate(type) {
    if (!VALID_TYPES.includes(type)) return false;
    const store = readStore();
    store[type] = null;
    return writeStore(store);
}

export function exportTemplates() {
    const store = readStore();
    return JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), templates: store },
        null,
        2
    );
}

/**
 * importTemplates — accepts either a JSON string or parsed object.
 * Supports both full-store exports (v1 schema) and single-template shapes.
 * Returns { success, imported: string[], errors: string[] }.
 */
export function importTemplates(json) {
    const result = { success: false, imported: [], errors: [] };
    let data;
    try {
        data = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
        result.errors.push('Geçersiz JSON: ' + (e?.message || e));
        return result;
    }
    if (!data || typeof data !== 'object') {
        result.errors.push('Boş veya beklenmeyen içerik');
        return result;
    }

    const store = readStore();

    // Full-store export { templates: { receipt, smallEnvelope, bigEnvelope } }
    if (data.templates && typeof data.templates === 'object') {
        for (const type of VALID_TYPES) {
            const tpl = data.templates[type];
            if (tpl == null) continue;
            const validated = validateTemplate(tpl, type);
            if (validated) {
                store[type] = validated;
                result.imported.push(type);
            } else {
                result.errors.push(`${type}: geçersiz`);
            }
        }
    } else if (data.type && VALID_TYPES.includes(data.type)) {
        // Single-template import
        const validated = validateTemplate(data, data.type);
        if (validated) {
            store[data.type] = validated;
            result.imported.push(data.type);
        } else {
            result.errors.push(`${data.type}: geçersiz`);
        }
    } else {
        result.errors.push('Tanınmayan format');
    }

    if (result.imported.length) {
        writeStore(store);
        result.success = true;
    }
    return result;
}
