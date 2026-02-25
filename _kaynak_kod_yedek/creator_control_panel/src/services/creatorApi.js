import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import toast from 'react-hot-toast';

const handleApiError = (error, context) => {
    console.error(`Creator API Error (${context}):`, error);
    toast.error(error.message || 'Bir hata oluştu');
    throw error;
};

export const creatorApi = {
    // Get all studios
    getStudios: async () => {
        try {
            const q = query(collection(db, 'studios'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            handleApiError(error, 'Get Studios');
        }
    },

    // Create new studio
    createStudio: async (data) => {
        try {
            // Function name format: exported_group-function_name
            // 'setup' comes from index.js exports.setup
            const createStudioFunc = httpsCallable(functions, 'setup-createStudio');
            const result = await createStudioFunc(data);
            return result.data;
        } catch (error) {
            handleApiError(error, 'Create Studio');
        }
    },

    // Update Studio Settings — delegates to updateStudio Cloud Function
    updateStudioSettings: async (studioId, settings) => {
        try {
            const func = httpsCallable(functions, 'setup-updateStudio');
            const result = await func({ studioId, data: settings });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Studio Settings');
        }
    },

    // Trigger Build for a studio
    triggerBuild: async (studioId, studioName) => {
        try {
            const buildFunc = httpsCallable(functions, 'setup-triggerBuild');
            const result = await buildFunc({ studioId, studioName });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Trigger Build');
        }
    },

    // SECURITY: Delete studio via Cloud Function (cascade delete: subcollections + Auth users)
    deleteStudio: async (studioId) => {
        try {
            const deleteFunc = httpsCallable(functions, 'setup-deleteStudio');
            const result = await deleteFunc({ studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Delete Studio');
        }
    },

    // Get studios with archive + appointment stats
    getStudiosWithStats: async () => {
        try {
            const func = httpsCallable(functions, 'setup-getStudiosWithStats');
            const result = await func({});
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get Studios With Stats');
        }
    },

    // Get WhatsApp connection status for a studio
    getWhatsappStatus: async (studioId) => {
        try {
            const func = httpsCallable(functions, 'setup-getWhatsappStatus');
            const result = await func({ studioId });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Get WhatsApp Status');
        }
    },

    // Update studio info (name, plan, isActive, etc.)
    updateStudio: async (studioId, data) => {
        try {
            const func = httpsCallable(functions, 'setup-updateStudio');
            const result = await func({ studioId, data });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Studio');
        }
    },

    // Update integration config (WooCommerce, Iyzico, etc.)
    // type: 'woocommerce' | 'iyzico' | 'stripe' | 'whatsapp'
    updateIntegration: async (studioId, type, config) => {
        try {
            const func = httpsCallable(functions, 'setup-updateIntegration');
            const result = await func({ studioId, type, config });
            return result.data;
        } catch (error) {
            handleApiError(error, 'Update Integration');
        }
    }
};
