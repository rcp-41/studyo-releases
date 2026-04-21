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
// Shared flag lives in ./config so individual modules can require it
// without creating a circular dependency on index.js.
const { APPCHECK_ENABLED } = require('./config');

/**
 * Build shared onCall options with the AppCheck flag applied.
 * Usage: onCall(getCallableOptions({ region: 'us-central1', memory: '512MiB' }), handler)
 * Modules are free to call this or inline the flag directly from ./config.
 */
const getCallableOptions = (baseOpts = {}) => ({
    ...baseOpts,
    enforceAppCheck: APPCHECK_ENABLED
});

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
exports.dataManagement = require('./data-management');

// Export AppCheck flag + helper for any external tooling that reads from index.
// Modules inside functions/src should prefer `require('./config')` to avoid cycles.
exports.APPCHECK_ENABLED = APPCHECK_ENABLED;
exports.getCallableOptions = getCallableOptions;
