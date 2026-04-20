import { buildTemplateHtml, PAGE_SIZES, TEMPLATE_TYPES } from './printTemplates';
import { getPrintSettings } from './printSettings';

const printApi = () => window.electron?.print;

export function isPrintAvailable() {
    return Boolean(printApi());
}

export async function listPrinters() {
    const api = printApi();
    if (!api) return [];
    const res = await api.getPrinters();
    return res?.printers || [];
}

export async function printTemplate(templateType, archive, options = {}) {
    const api = printApi();
    if (!api) {
        return { success: false, failureReason: 'Print servisi yalnızca masaüstü uygulamasında kullanılabilir.' };
    }
    const settings = getPrintSettings();
    const deviceName = options.deviceName !== undefined ? options.deviceName : settings.printers?.[templateType];
    const copies = options.copies ?? settings.copies?.[templateType] ?? 1;
    const silent = options.silent ?? true;
    const html = buildTemplateHtml(templateType, archive);
    return api.printHtml({
        html,
        deviceName: deviceName || undefined,
        pageSize: PAGE_SIZES[templateType],
        copies,
        silent
    });
}

export async function autoPrintArchive(archive) {
    const api = printApi();
    if (!api) return { skipped: true, reason: 'print service unavailable' };
    const settings = getPrintSettings();
    if (!settings.autoPrintOnSave) return { skipped: true, reason: 'auto-print disabled' };
    const results = [];
    for (const type of TEMPLATE_TYPES) {
        if (!settings.enabled?.[type]) continue;
        try {
            const r = await printTemplate(type, archive);
            results.push({ type, ...r });
        } catch (e) {
            results.push({ type, success: false, failureReason: e.message });
        }
    }
    return { skipped: false, results };
}

export async function previewTemplatePdf(templateType, archive) {
    const api = printApi();
    if (!api) return { success: false, error: 'print service unavailable' };
    const html = buildTemplateHtml(templateType, archive);
    return api.pdfPreview({ html, pageSize: PAGE_SIZES[templateType] });
}
