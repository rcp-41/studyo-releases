module.exports = {
    ...require('./admin/organizations'),
    ...require('./admin/studios'),
    ...require('./admin/studios-ops'),
    ...require('./admin/devices'),
    ...require('./admin/license'),
    ...require('./admin/twofactor'),
    ...require('./admin/integrations'),
    ...require('./admin/user-management'),
    // Faz 5
    ...require('./admin/bulkOperations'),
    ...require('./admin/onlineUsers'),
    ...require('./admin/revenue'),
    ...require('./admin/supportTickets'),
    ...require('./admin/remoteLogs'),
    ...require('./admin/featureFlags'),
    ...require('./admin/updateChannel'),
};
