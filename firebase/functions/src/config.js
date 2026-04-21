/**
 * Shared Cloud Functions Configuration
 *
 * Centralizes feature flags and runtime config that multiple modules need.
 * IMPORTANT: Modules should require('./config') rather than require('./index')
 * to avoid circular imports (index.js already requires every module).
 */

module.exports = {
    // Feature flag — when true, onCall functions enforce AppCheck tokens.
    // Flip via: firebase functions:config:set appcheck.enabled=true  (or APPCHECK_ENABLED=true env)
    APPCHECK_ENABLED: process.env.APPCHECK_ENABLED === 'true',

    // Default region for all Cloud Functions
    REGION: process.env.FUNCTIONS_REGION || 'us-central1',
};
