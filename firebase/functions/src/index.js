/**
 * Studyo Cloud Functions - Entry Point
 * All business logic runs here (Stealth Mode)
 */

const admin = require('firebase-admin');
admin.initializeApp();

// --- Firebase AppCheck Configuration ---
// Set APPCHECK_ENABLED=true in environment/runtime config to enforce AppCheck.
// When enabled, all onCall functions with enforceAppCheck will reject requests
// without a valid AppCheck token. Enable this AFTER configuring AppCheck in:
//   1. Firebase Console > App Check (register your app attestation providers)
//   2. Client-side: initialize AppCheck with reCAPTCHA/DeviceCheck/etc.
//
// To enable: firebase functions:config:set appcheck.enabled="true"
// Or set environment variable: APPCHECK_ENABLED=true
//
// NOTE: This flag is read at deploy time. Functions already deployed with
// enforceAppCheck: false will NOT be affected until redeployed.
const APPCHECK_ENABLED = process.env.APPCHECK_ENABLED === 'true'
    || (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG || '{}')?.appcheck?.enabled === 'true');

// Export the flag so individual modules can import it if needed
// Usage in modules: const { APPCHECK_ENABLED } = require('./index') -- NOT recommended (circular).
// Instead, modules should use: process.env.APPCHECK_ENABLED === 'true'
// or import from a shared config. For now, we log the status at cold start.
if (APPCHECK_ENABLED) {
    console.log('[AppCheck] ENFORCED - requests without valid AppCheck tokens will be rejected');
} else {
    console.log('[AppCheck] DISABLED - set APPCHECK_ENABLED=true to enforce');
}

// Export all function modules
exports.auth = require('./auth');
exports.users = require('./users');
exports.finance = require('./finance');
exports.archives = require('./archives');
exports.appointments = require('./appointments');
exports.woocommerce = require('./woocommerce');
exports.options = require('./options');
exports.settings = require('./settings');
exports.setup = require('./admin-init');
exports.customers = require('./customers');
exports.shoots = require('./shoots');
exports.dashboard = require('./dashboard');
exports.packages = require('./packages');
exports.migration = require('./migration');
exports.legacyMigration = require('./legacy-migration');
exports.audit = require('./handlers/auditLogger');
exports.paymentsOnline = require('./payments-online');
exports.schools = require('./schools');
exports.priceLists = require('./priceLists');
exports.reports = require('./reports');
exports.scheduler = require('./scheduler');
exports.pixonai = require('./pixonai');
exports.logs = require('./logs');
exports.whatsappBot = require('./whatsapp-bot');
exports.voiceBot = require('./voice-bot');
exports.botConfig = require('./bot-config');

// Export AppCheck flag for modules that need it
exports.APPCHECK_ENABLED = APPCHECK_ENABLED;
