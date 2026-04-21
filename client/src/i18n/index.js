import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import tr from './locales/tr.json';
import en from './locales/en.json';

const LANGUAGE_STORAGE_KEY = 'studyo:language';

const detection = {
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    caches: ['localStorage'],
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            tr: { translation: tr },
            en: { translation: en },
        },
        lng: undefined,
        fallbackLng: 'en',
        supportedLngs: ['tr', 'en'],
        nonExplicitSupportedLngs: true,
        load: 'languageOnly',
        detection,
        interpolation: {
            escapeValue: false,
        },
        returnEmptyString: false,
        keySeparator: '.',
        nsSeparator: false,
        react: {
            useSuspense: false,
        },
    });

if (!i18n.language) {
    i18n.changeLanguage('tr');
}

i18n.on('languageChanged', (lng) => {
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
        document.documentElement.setAttribute('lang', lng);
    } catch (_) {
        // localStorage may not be available; ignore.
    }
});

try {
    document.documentElement.setAttribute('lang', i18n.language || 'tr');
} catch (_) {
    // document may not be available (SSR); ignore.
}

export default i18n;
