const STORAGE_KEY = 'studyo:printSettings:v1';

const defaults = {
    autoPrintOnSave: false,
    printers: {
        receipt: '',
        smallEnvelope: '',
        bigEnvelope: ''
    },
    enabled: {
        receipt: true,
        smallEnvelope: true,
        bigEnvelope: false
    },
    copies: {
        receipt: 1,
        smallEnvelope: 1,
        bigEnvelope: 1
    }
};

export function getPrintSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(defaults);
        const parsed = JSON.parse(raw);
        return {
            ...defaults,
            ...parsed,
            printers: { ...defaults.printers, ...(parsed.printers || {}) },
            enabled: { ...defaults.enabled, ...(parsed.enabled || {}) },
            copies: { ...defaults.copies, ...(parsed.copies || {}) }
        };
    } catch (e) {
        console.error('[PrintSettings] parse failed:', e);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        return structuredClone(defaults);
    }
}

export function savePrintSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return true;
    } catch (e) {
        console.error('[PrintSettings] save failed:', e);
        return false;
    }
}

export function updatePrintSetting(partial) {
    const current = getPrintSettings();
    const next = {
        ...current,
        ...partial,
        printers: { ...current.printers, ...(partial.printers || {}) },
        enabled: { ...current.enabled, ...(partial.enabled || {}) },
        copies: { ...current.copies, ...(partial.copies || {}) }
    };
    savePrintSettings(next);
    return next;
}

export const PRINT_SETTINGS_DEFAULTS = defaults;
