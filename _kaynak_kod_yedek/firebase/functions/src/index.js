/**
 * Studyo Cloud Functions - Entry Point
 * All business logic runs here (Stealth Mode)
 */

const admin = require('firebase-admin');
admin.initializeApp();

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
