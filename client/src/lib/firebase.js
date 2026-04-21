/**
 * Firebase Configuration
 * This file initializes Firebase SDK for the client
 * Connects directly to Firebase Production — no emulators.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check';

// Firebase configuration - These are safe to expose (they identify the project)
// Security is enforced by Firestore Rules and Cloud Functions
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- Firebase AppCheck (reCAPTCHA v3) ---
// Only initializes when VITE_APPCHECK_SITE_KEY is provided. This keeps the whole
// feature behind a deploy-time flag: builds without a site key are unaffected.
// Failures are swallowed so the rest of the app keeps working if reCAPTCHA is
// blocked or slow.
export let appCheck = null;
try {
    const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
    if (siteKey) {
        if (import.meta.env.DEV) {
            // Debug token lets a local build pass AppCheck without solving reCAPTCHA.
            // Must be set BEFORE initializeAppCheck. Console prints a token on first
            // load; paste it into Firebase Console -> App Check -> Debug tokens.
            // eslint-disable-next-line no-undef
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
        });
        // CustomProvider is imported for future use (e.g. Electron attestation)
        // — referencing it here prevents the tree-shaker from dropping the import.
        void CustomProvider;
    }
} catch (err) {
    // Never let AppCheck take down the app. If init fails, callables just miss
    // the token header — AppCheck enforcement mode on the backend will reject
    // those requests, but unprotected builds/endpoints continue to work.
    console.warn('[AppCheck] init failed, continuing without token:', err);
}

// Initialize services
// Session persistence: Changed to local persistence so child windows (Photo Selector) can share the auth state.
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

export default app;
