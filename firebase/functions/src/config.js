/**
 * Shared Cloud Functions Configuration
 *
 * Centralizes feature flags and runtime config that multiple modules need.
 * IMPORTANT: Modules should require('./config') rather than require('./index')
 * to avoid circular imports (index.js already requires every module).
 */

module.exports = {
    // Feature flag — when true, onCall functions enforce AppCheck tokens.
    // In emulator mode (FUNCTIONS_EMULATOR=true) AppCheck is opt-in (default off).
    // In prod AppCheck is ALWAYS on unless APPCHECK_ENABLED=false is set explicitly.
    // Override via env: APPCHECK_ENABLED=false  (only honoured in emulator)
    APPCHECK_ENABLED: process.env.FUNCTIONS_EMULATOR === 'true'
        ? process.env.APPCHECK_ENABLED === 'true'   // emulator: opt-in
        : process.env.APPCHECK_ENABLED !== 'false', // prod: default ON

    // Default region for all Cloud Functions
    REGION: process.env.FUNCTIONS_REGION || 'us-central1',
};
