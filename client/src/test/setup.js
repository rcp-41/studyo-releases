import '@testing-library/jest-dom';

// Firebase stub
vi.mock('@/lib/firebase', () => ({
    auth: { currentUser: null, onAuthStateChanged: vi.fn() },
    db: {},
    app: {},
}));

// Electron API stub
globalThis.electronAPI = {
    checkLicense: vi.fn().mockResolvedValue({ valid: true, expiresAt: null }),
    getAppVersion: vi.fn().mockReturnValue('1.0.0'),
    openExternal: vi.fn(),
    printWindow: vi.fn(),
};

// i18next stub — t(key) => key
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k) => k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
    Trans: ({ children }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
