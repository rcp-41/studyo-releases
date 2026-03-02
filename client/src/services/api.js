import {
    collection,
    getDocs,
    query,
    orderBy,
    doc
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'firebase/storage';
import { db, storage, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { getUserFriendlyError } from '../lib/utils';

// Helper for consistent error handling
const handleApiError = (error, context) => {
    console.error(`API Error (${context}):`, error);
    toast.error(getUserFriendlyError(error));
    throw error;
};

// Helper for calling Cloud Functions
const callFunction = async (name, data = {}) => {
    try {
        const func = httpsCallable(functions, name);
        const result = await func(data);
        return result.data;
    } catch (error) {
        handleApiError(error, `Function: ${name}`);
    }
};

// Generic Fetch Collection Helper
const fetchCollection = async (colName) => {
    try {
        const q = query(collection(db, colName));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        handleApiError(error, `Fetch ${colName}`);
    }
};

// Upload Service
export const uploadApi = {
    uploadFile: async (file, path) => {
        try {
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        } catch (error) {
            handleApiError(error, 'Upload');
        }
    }
};

// Archives Service (via Cloud Functions for studio-scoped access)
export const archivesApi = {
    list: async (params) => {
        const result = await callFunction('archives-list', params || {});
        return result;
    },

    create: async (data) => callFunction('archives-create', data),

    update: async (id, data) => callFunction('archives-update', { id, data }),

    delete: async (id) => callFunction('archives-delete', { id }),

    updateStatus: async (id, status) => callFunction('archives-updateStatus', { id, status }),

    deleteMultiple: async (ids) => callFunction('archives-deleteMultiple', { ids }),

    transferFromAppointment: async (appointmentId, archiveData) =>
        callFunction('archives-transferFromAppointment', { appointmentId, archiveData }),

    getArchiveFolderPath: async (archiveId) =>
        callFunction('archives-getArchiveFolderPath', { archiveId }),

    getNextNumber: async () => callFunction('archives-getNextNumber', {})
};

// Settings Service (Thin Client)
export const settingsApi = {
    getAll: async () => {
        const result = await callFunction('settings-getAll', {});
        return { data: result };
    },

    update: async (data) => callFunction('settings-update', { settings: data }),

    testConnection: async (service) => ({ success: false, message: 'Henüz yapılandırılmadı' }),
};

// Options Service (via Cloud Functions for studio-scoped access)
export const optionsApi = {
    getShootTypes: async () => callFunction('options-get', { type: 'shootTypes' }),
    getLocations: async () => callFunction('options-get', { type: 'locations' }),
    getPhotographers: async () => callFunction('options-get', { type: 'photographers' }),

    // Cloud Functions for writes
    saveShootType: (data) => callFunction('options-saveShootType', data),
    createShootType: (data) => callFunction('options-saveShootType', data),  // alias
    deleteShootType: (id) => callFunction('options-deleteShootType', { id }),

    saveLocation: (data) => callFunction('options-saveLocation', data),
    createLocation: (data) => callFunction('options-saveLocation', data),  // alias
    deleteLocation: (id) => callFunction('options-deleteLocation', { id }),

    savePhotographer: (data) => callFunction('options-savePhotographer', data),
    createPhotographer: (data) => callFunction('options-savePhotographer', data),  // alias
    deletePhotographer: (id) => callFunction('options-deletePhotographer', { id }),

    // Packages
    getPackages: () => callFunction('options-get', { type: 'packages' }),
    createPackage: (data) => callFunction('options-savePackage', data),
    deletePackage: (id) => callFunction('options-deletePackage', { id }),
};

// Stats / Reports Service
export const statsApi = {
    getDashboardStats: (params) => callFunction('reports-generateReport', params || {}),
    generateReport: (params) => callFunction('reports-generateReport', params || {})
};

// Appointments Service
export const appointmentsApi = {
    getDay: (date) => callFunction('appointments-getDay', { date }),
    create: (data) => callFunction('appointments-create', data),
    update: (id, data) => callFunction('appointments-update', { id, data }),
    updateStatus: (id, status) => callFunction('appointments-updateStatus', { id, status }),
    delete: (id) => callFunction('appointments-delete', { id }),
    calendar: (startDate, endDate) => callFunction('dashboard-getCalendarView', { startDate, endDate })
};

// Customers Service
export const customersApi = {
    list: (params) => callFunction('customers-listCustomers', params || {}),
    get: (id) => callFunction('customers-getCustomer', { customerId: id }),
    getShoots: (id) => callFunction('customers-getCustomerShoots', { customerId: id }),
    search: (query) => callFunction('customers-searchCustomers', { query }),
    lookupByPhone: (phone) => callFunction('customers-lookupByPhone', { phone }),
    create: (data) => callFunction('customers-create', data),
    update: (id, data) => callFunction('customers-updateCustomer', { customerId: id, updates: data }),
    delete: (id) => callFunction('customers-delete', { id })
};

// Users Service
export const usersApi = {
    getAll: () => callFunction('users-getAll'),
    list: () => callFunction('users-getAll'),  // alias for getAll
    create: (data) => callFunction('users-create', data),
    update: (id, data) => callFunction('users-update', { id, data }),
    delete: (id) => callFunction('users-delete', { id }),
    toggleStatus: (id) => callFunction('users-toggleStatus', { id }),

    // Password Reset (admin only)
    resetPassword: (data) => callFunction('users-resetPassword', data),

    // Staff Leaves
    getLeaves: () => callFunction('users-getLeaves'),
    addLeave: (data) => callFunction('users-addLeave', data),
    deleteLeave: (id) => callFunction('users-deleteLeave', { id }),
};

// Dashboard Service
export const dashboardApi = {
    summary: (data) => callFunction('dashboard-getDashboardSummary', data || {}),
    filteredStats: (dateRange) => callFunction('dashboard-getFilteredStats', { dateRange }),
    todayAppointments: () => callFunction('dashboard-getTodayAppointments'),
    recentArchives: (limit) => callFunction('dashboard-getRecentArchives', { limit }),
    pendingPayments: () => callFunction('dashboard-getDashboardSummary'),
    revenueChart: (period) => callFunction('dashboard-getMonthlyStats', { period }),
    shootTypes: () => callFunction('dashboard-getDashboardSummary'),
    monthlyStats: (data) => callFunction('dashboard-getMonthlyStats', data || {}),
    calendarView: (data) => callFunction('dashboard-getCalendarView', data),
    availableSlots: (data) => callFunction('dashboard-getAvailableSlots', data)
};

// Shoots Service
export const shootsApi = {
    list: (params) => callFunction('shoots-listShoots', params || {}),
    get: (id) => callFunction('shoots-getShoot', { shootId: id }),
    create: (data) => callFunction('shoots-create', data),
    update: (id, data) => callFunction('shoots-updateShoot', { shootId: id, ...data }),
    updateStatus: (id, status, workflowStage) => callFunction('shoots-updateShootStatus', { shootId: id, status, workflowStage }),
    addPayment: (shootId, data) => callFunction('shoots-addPayment', { shootId, ...data }),
    assignPhotographer: (shootId, photographerId) => callFunction('shoots-assignPhotographer', { shootId, photographerId }),
    getByDateRange: (startDate, endDate) => callFunction('shoots-getShootsByDateRange', { startDate, endDate })
};

// Packages Service
export const packagesApi = {
    list: (params) => callFunction('packages-list', params || {})
};

// WooCommerce Service
export const woocommerceApi = {
    testConnection: () => callFunction('woocommerce-testConnection'),
    getStats: (archiveId) => callFunction('woocommerce-getStats', { archiveId }),
    uploadSingle: (data) => callFunction('woocommerce-uploadSingle', data),
    getClients: () => callFunction('woocommerce-getClients'),
    reset: (archiveId) => callFunction('woocommerce-reset', { archiveId }),
    copyPhotos: (data) => callFunction('woocommerce-copyPhotos', data)
};

// Finance Service
export const financeApi = {
    getPayments: (params) => callFunction('finance-getPayments', params || {}),
    getDailyCash: (params) => callFunction('finance-getDailyCash', params || {}),
    setOpeningBalance: (data) => callFunction('finance-setOpeningBalance', data),
    getExpenses: (params) => callFunction('finance-getExpenses', params || {}),
    addExpense: (data) => callFunction('finance-addExpense', data),
    getOverduePayments: () => callFunction('finance-getOverduePayments'),
    getCashRegisterEntries: (date) => callFunction('finance-getCashRegisterEntries', { date }),
    createCashEntry: (data) => callFunction('finance-createCashEntry', data),
    updateCashEntry: (data) => callFunction('finance-updateCashEntry', data),
    deleteCashEntry: (data) => callFunction('finance-deleteCashEntry', data)
};

// Reports Service
export const reportsApi = {
    generate: (data) => callFunction('reports-generateReport', data)
};

// Schools Service (Photo Selector)
export const schoolsApi = {
    list: () => callFunction('schools-list'),
    create: (data) => callFunction('schools-create', data),
    update: (id, data) => callFunction('schools-update', { id, data }),
    delete: (id) => callFunction('schools-delete', { id }),
};

// Price Lists Service (Photo Selector)
export const priceListsApi = {
    list: () => callFunction('priceLists-list'),
    getActive: () => callFunction('priceLists-getActive'),
    create: (data) => callFunction('priceLists-create', data),
    update: (id, data) => callFunction('priceLists-update', { id, data }),
    delete: (id) => callFunction('priceLists-delete', { id }),
};

// WhatsApp Service (Electron IPC → WhatsApp Web hidden window)
export const whatsappApi = {
    getStatus: () => window.electron?.whatsapp?.getStatus() || Promise.resolve({ status: 'disconnected' }),
    getQr: () => window.electron?.whatsapp?.getQr() || Promise.resolve({ qr: null }),
    send: async ({ phone, message }) => {
        if (!window.electron?.whatsapp?.send) {
            throw new Error('WhatsApp bağlantısı mevcut değil. Masaüstü uygulamasından çalıştırın.');
        }
        return await window.electron.whatsapp.send(phone, message);
    },
    init: () => window.electron?.whatsapp?.init() || Promise.resolve(),
    logout: () => window.electron?.whatsapp?.logout() || Promise.resolve(),
    openChat: (phone) => {
        if (window.electron?.whatsapp?.openChat) {
            return window.electron.whatsapp.openChat(phone);
        }
    }
};

// Pixonai Config Service
export const pixonaiApi = {
    getConfigs: () => callFunction('pixonai-getConfigs'),
    getConfig: (shootCategoryId) => callFunction('pixonai-getConfig', { shootCategoryId }),
    saveConfig: (data) => callFunction('pixonai-saveConfig', data),
    deleteConfig: (id) => callFunction('pixonai-deleteConfig', { id }),
};

// Bot Service (read-only for studio admins)
export const botApi = {
    getStatus: () => callFunction('botConfig-getBotStatus', {}),
    getConversations: (channel, limit) => callFunction('botConfig-getConversations', { channel, limit }),
    getMessages: (phone, limit) => callFunction('botConfig-getMessages', { phone, limit }),
};
