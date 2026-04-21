/**
 * Firebase Configuration for Creator Control Panel
 * Uses the same Firebase project as the main app
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- Firebase AppCheck (reCAPTCHA v3) ---
// Only initializes when VITE_APPCHECK_SITE_KEY is provided. Without a site key
// the control panel still boots — AppCheck is purely additive and gated by env.
export let appCheck = null;
try {
    const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
    if (siteKey) {
        if (import.meta.env.DEV) {
            // Debug token must be set BEFORE initializeAppCheck. Watch the devtools
            // console for the printed token and register it in Firebase Console.
            // eslint-disable-next-line no-undef
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
        });
        // CustomProvider retained for potential Electron / native attestation flows.
        void CustomProvider;
    }
} catch (err) {
    // Never let AppCheck crash the panel — log and continue.
    console.warn('[AppCheck] init failed, continuing without token:', err);
}

// Initialize services
export const auth = getAuth(app);

// SECURITY: Use modern persistence API (replaces deprecated enableMultiTabIndexedDbPersistence)
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const functions = getFunctions(app, 'us-central1');

// Connect to emulators in development
if (import.meta.env.VITE_USE_EMULATORS === 'true' || import.meta.env.DEV) {
    console.log('🔧 Connecting to Firebase Emulators...');
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;
