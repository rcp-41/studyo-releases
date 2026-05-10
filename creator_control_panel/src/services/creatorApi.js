import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import toast from 'react-hot-toast';

const handleApiError = (error, context) => {
    console.error(`Creator API Error (${context}):`, error);
    toast.error(error.message || 'Bir hata oluştu');
    throw error;
};

export const creatorApi = {
    // ============================================
    // ORGANIZATIONS
    // ============================================

    // List all organizations
    listOrganizations: async () => {
        try {
            const func = httpsCallable(functions, 'setup-listOrganizations');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'List Organizations');
        }
    },

    // Create new organization
    createOrganization: async (data) => {
        try {
            const func = httpsCallable(functions, 'setup-createOrganization');
            const result = await func(data);
            return result.data;
        } catch (error) {
            handleApiError(error, 'Create Organization');
        }
    },

    // Update organization
    updateOrganization: async (organizationId, data) => {
        try {
            const func = httpsCallable(functions, 'setup-updateOrganization');
            const result = await func({ organizationId, data });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Organization');
        }
    },

    // Delete organization
    deleteOrganization: async (organizationId) => {
        try {
            const func = httpsCallable(functions, 'setup-deleteOrganization');
            const result = await func({ organizationId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Delete Organization');
        }
    },

    // ============================================
    // STUDIOS
    // ============================================

    // Get studios with stats (across all organizations)
    getStudiosWithStats: async () => {
        try {
            const func = httpsCallable(functions, 'setup-getStudiosWithStats');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Studios With Stats');
        }
    },

    // Create new studio (requires organizationId)
    createStudio: async (data) => {
        try {
            const func = httpsCallable(functions, 'setup-createStudio');
            const result = await func(data);
            return result.data;
        } catch (error) {
            handleApiError(error, 'Create Studio');
        }
    },

    // Update studio settings
    updateStudioSettings: async (organizationId, studioId, settings) => {
        try {
            const func = httpsCallable(functions, 'setup-updateStudio');
            const result = await func({ organizationId, studioId, data: settings });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Studio Settings');
        }
    },

    // Trigger Build for a studio
    triggerBuild: async (studioId, studioName) => {
        try {
            const func = httpsCallable(functions, 'setup-triggerBuild');
            const result = await func({ studioId, studioName });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Trigger Build');
        }
    },

    // Delete studio (cascade)
    deleteStudio: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-deleteStudio');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Delete Studio');
        }
    },

    // Reset studio data (archive/customers or all data)
    resetStudioData: async (organizationId, studioId, resetOption) => {
        try {
            const func = httpsCallable(functions, 'dataManagement-resetStudioData');
            const result = await func({ organizationId, studioId, resetOption });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Reset Studio Data');
        }
    },

    // Get WhatsApp status
    getWhatsappStatus: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-getWhatsappStatus');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get WhatsApp Status');
        }
    },

    // Update studio info
    updateStudio: async (organizationId, studioId, data) => {
        try {
            const func = httpsCallable(functions, 'setup-updateStudio');
            const result = await func({ organizationId, studioId, data });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Studio');
        }
    },

    // Update integration config
    updateIntegration: async (organizationId, studioId, type, config) => {
        try {
            const func = httpsCallable(functions, 'setup-updateIntegration');
            const result = await func({ organizationId, studioId, type, config });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Integration');
        }
    },

    // ============================================
    // HWID & LICENSE MANAGEMENT
    // ============================================

    // Reset HWID
    resetHwid: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-resetHwid');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Reset HWID');
        }
    },

    // Regenerate license key
    regenerateLicenseKey: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-regenerateLicenseKey');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Regenerate License Key');
        }
    },

    // Suspend studio
    suspendStudio: async (organizationId, studioId, reason) => {
        try {
            const func = httpsCallable(functions, 'setup-suspendStudio');
            const result = await func({ organizationId, studioId, reason });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Suspend Studio');
        }
    },

    // Activate studio
    activateStudio: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-activateStudio');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Activate Studio');
        }
    },

    // Get audit logs
    getAuditLogs: async (organizationId, studioId, limit = 50) => {
        try {
            const func = httpsCallable(functions, 'setup-getAuditLogs');
            const result = await func({ organizationId, studioId, limit });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Audit Logs');
        }
    },

    // ============================================
    // DEVICE MANAGEMENT
    // ============================================

    // Get all devices for a studio
    getStudioDevices: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-getStudioDevices');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Studio Devices');
        }
    },

    // Approve a device
    approveDevice: async (organizationId, studioId, deviceId) => {
        try {
            const func = httpsCallable(functions, 'setup-approveDevice');
            const result = await func({ organizationId, studioId, deviceId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Approve Device');
        }
    },

    // Reject a device
    rejectDevice: async (organizationId, studioId, deviceId) => {
        try {
            const func = httpsCallable(functions, 'setup-rejectDevice');
            const result = await func({ organizationId, studioId, deviceId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Reject Device');
        }
    },

    // ============================================
    // BOT MANAGEMENT
    // ============================================

    // Get bot configuration
    getBotConfig: async (studioId, organizationId) => {
        try {
            const func = httpsCallable(functions, 'botConfig-getConfig');
            const result = await func({ studioId, organizationId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Bot Config');
        }
    },

    // Update bot general settings
    updateBotSettings: async (studioId, organizationId, settings) => {
        try {
            const func = httpsCallable(functions, 'botConfig-updateSettings');
            const result = await func({ studioId, organizationId, settings });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Bot Settings');
        }
    },

    // Update studio info for bot (address, contact, FAQ, campaigns, etc.)
    updateBotStudioInfo: async (studioId, organizationId, studioInfo) => {
        try {
            const func = httpsCallable(functions, 'botConfig-updateStudioInfo');
            const result = await func({ studioId, organizationId, studioInfo });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Bot Studio Info');
        }
    },

    // Update WhatsApp bot config
    updateBotWhatsApp: async (studioId, organizationId, config) => {
        try {
            const func = httpsCallable(functions, 'botConfig-updateWhatsApp');
            const result = await func({ studioId, organizationId, config });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Bot WhatsApp');
        }
    },

    // Update Voice bot config
    updateBotVoice: async (studioId, organizationId, config) => {
        try {
            const func = httpsCallable(functions, 'botConfig-updateVoice');
            const result = await func({ studioId, organizationId, config });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Bot Voice');
        }
    },

    // Toggle bot channel
    toggleBot: async (studioId, organizationId, channel, enabled) => {
        try {
            const func = httpsCallable(functions, 'botConfig-toggle');
            const result = await func({ studioId, organizationId, channel, enabled });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Toggle Bot');
        }
    },

    // Get bot status
    getBotStatus: async (studioId, organizationId) => {
        try {
            const func = httpsCallable(functions, 'botConfig-getBotStatus');
            const result = await func({ studioId, organizationId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Bot Status');
        }
    },

    // Get bot conversations
    getBotConversations: async (studioId, organizationId, channel, limit) => {
        try {
            const func = httpsCallable(functions, 'botConfig-getConversations');
            const result = await func({ studioId, organizationId, channel, limit });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Bot Conversations');
        }
    },

    // Get conversation messages
    getBotMessages: async (studioId, organizationId, phone, limit) => {
        try {
            const func = httpsCallable(functions, 'botConfig-getMessages');
            const result = await func({ studioId, organizationId, phone, limit });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Bot Messages');
        }
    },

    // Get bot statistics  
    getBotStats: async (studioId, organizationId) => {
        try {
            const func = httpsCallable(functions, 'botConfig-getStats');
            const result = await func({ studioId, organizationId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Bot Stats');
        }
    },

    // Remove bot from studio
    removeBot: async (studioId, organizationId, channel) => {
        try {
            const func = httpsCallable(functions, 'botConfig-remove');
            const result = await func({ studioId, organizationId, channel });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Remove Bot');
        }
    },

    // ============================================
    // D4 — CREATOR AUDIT LOGS
    // ============================================

    getCreatorAuditLogs: async ({ organizationId, studioId, action, dateFrom, dateTo, limit } = {}) => {
        try {
            const func = httpsCallable(functions, 'setup-getCreatorAuditLogs');
            const result = await func({ organizationId, studioId, action, dateFrom, dateTo, limit });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Creator Audit Logs');
        }
    },

    // ============================================
    // E1 — RECORD LOGIN
    // ============================================

    recordLogin: async ({ organizationId, studioId, appVersion } = {}) => {
        try {
            const func = httpsCallable(functions, 'setup-recordLogin');
            const result = await func({ organizationId, studioId, appVersion });
            return result.data;
        } catch (error) {
            // Non-fatal
            console.warn('recordLogin error:', error);
        }
    },

    getActivityTimeline: async (organizationId, studioId, limitCount = 30) => {
        try {
            const func = httpsCallable(functions, 'setup-getActivityTimeline');
            const result = await func({ organizationId, studioId, limit: limitCount });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Activity Timeline');
        }
    },

    // ============================================
    // G5 — 2FA / TOTP
    // ============================================

    enable2FA: async () => {
        try {
            const func = httpsCallable(functions, 'setup-enable2FA');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'Enable 2FA');
        }
    },

    verifyTotp: async (code) => {
        try {
            const func = httpsCallable(functions, 'setup-verifyTotp');
            const result = await func({ code });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Verify TOTP');
        }
    },

    disableTotp: async (code) => {
        try {
            const func = httpsCallable(functions, 'setup-disableTotp');
            const result = await func({ code });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Disable TOTP');
        }
    },

    // ============================================
    // A1 — Plan Değişikliği
    // ============================================

    changeStudioPlan: async (organizationId, studioId, newTier) => {
        try {
            const func = httpsCallable(functions, 'setup-changeStudioPlan');
            const result = await func({ organizationId, studioId, newTier });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Change Studio Plan');
        }
    },

    // ============================================
    // A2 — Suspend with reason + auto-reactivate
    // ============================================

    suspendStudioWithReason: async (organizationId, studioId, reason, reactivateAfterDays) => {
        try {
            const func = httpsCallable(functions, 'setup-suspendStudioWithReason');
            const result = await func({ organizationId, studioId, reason, reactivateAfterDays });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Suspend Studio With Reason');
        }
    },

    // ============================================
    // B1 — Subscription management
    // ============================================

    updateSubscription: async (organizationId, studioId, expiresAt) => {
        try {
            const func = httpsCallable(functions, 'setup-updateSubscription');
            const result = await func({ organizationId, studioId, expiresAt });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Subscription');
        }
    },

    // ============================================
    // B3 — Trial
    // ============================================

    setTrialSubscription: async (organizationId, studioId, trialDays) => {
        try {
            const func = httpsCallable(functions, 'setup-setTrialSubscription');
            const result = await func({ organizationId, studioId, trialDays });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Set Trial Subscription');
        }
    },

    // ============================================
    // B4 — Coupons
    // ============================================

    createCoupon: async ({ code, type, value, expiresAt, usageLimit, allowedOrgs }) => {
        try {
            const func = httpsCallable(functions, 'setup-createCoupon');
            const result = await func({ code, type, value, expiresAt, usageLimit, allowedOrgs });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Create Coupon');
        }
    },

    listCoupons: async () => {
        try {
            const func = httpsCallable(functions, 'setup-listCoupons');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'List Coupons');
        }
    },

    redeemCoupon: async (organizationId, studioId, code) => {
        try {
            const func = httpsCallable(functions, 'setup-redeemCoupon');
            const result = await func({ organizationId, studioId, code });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Redeem Coupon');
        }
    },

    // ============================================
    // F4 — Versioning
    // ============================================

    getVersioning: async () => {
        try {
            const func = httpsCallable(functions, 'setup-getVersioning');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Versioning');
        }
    },

    updateVersioning: async (config) => {
        try {
            const func = httpsCallable(functions, 'setup-updateVersioning');
            const result = await func(config);
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Versioning');
        }
    },

    // ============================================
    // A3 — Stüdyo Klonlama
    // ============================================

    cloneStudio: async (sourceOrgId, sourceStudioId, newName, targetOrgId, options = {}) => {
        try {
            const func = httpsCallable(functions, 'setup-cloneStudio');
            const result = await func({ sourceOrgId, sourceStudioId, newName, targetOrgId, options });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Clone Studio');
        }
    },

    // ============================================
    // A4 — Stüdyo Taşıma
    // ============================================

    moveStudio: async (studioId, fromOrgId, toOrgId) => {
        try {
            const func = httpsCallable(functions, 'setup-moveStudio');
            const result = await func({ studioId, fromOrgId, toOrgId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Move Studio');
        }
    },

    // ============================================
    // D1 — Stüdyo Veri Export
    // ============================================

    exportStudioData: async (organizationId, studioId, collections, format = 'json') => {
        try {
            const func = httpsCallable(functions, 'setup-exportStudioData');
            const result = await func({ organizationId, studioId, collections, format });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Export Studio Data');
        }
    },

    // ============================================
    // D2 — Backup
    // ============================================

    createBackup: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-createBackup');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Create Backup');
        }
    },

    listBackups: async (studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-listBackups');
            const result = await func({ studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'List Backups');
        }
    },

    // ============================================
    // D5 — Veri Sıfırlama 2FA Korumalı
    // ============================================

    resetStudioDataSecure: async (organizationId, studioId, resetOption, totpCode) => {
        try {
            const func = httpsCallable(functions, 'setup-resetStudioDataSecure');
            const result = await func({ organizationId, studioId, resetOption, totpCode });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Reset Studio Data Secure');
        }
    },

    // ============================================
    // E2 — Depolama Kullanımı
    // ============================================

    getStudioStorageUsage: async (organizationId, studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-getStudioStorageUsage');
            const result = await func({ organizationId, studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Studio Storage Usage');
        }
    },

    // ============================================
    // E3 — AppCheck İstatistikleri
    // ============================================

    getAppCheckStats: async (studioId, daysBack = 30) => {
        try {
            const func = httpsCallable(functions, 'setup-getAppCheckStats');
            const result = await func({ studioId, daysBack });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get AppCheck Stats');
        }
    },

    // ============================================
    // E4 — Error Logs Geliştirilmiş
    // ============================================

    getErrorLogsAdvanced: async ({ studioId, severity, dateFrom, dateTo, limit, searchText } = {}) => {
        try {
            const func = httpsCallable(functions, 'setup-getErrorLogsAdvanced');
            const result = await func({ studioId, severity, dateFrom, dateTo, limit, searchText });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Error Logs Advanced');
        }
    }
};
