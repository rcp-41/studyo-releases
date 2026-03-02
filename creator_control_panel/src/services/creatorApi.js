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
    }
};
