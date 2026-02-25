import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

let cachedComputerName = null;
let cachedIpAddress = null;

async function getDeviceInfo() {
    if (!cachedComputerName) {
        cachedComputerName = window.electron?.getComputerName?.() || navigator.userAgent.substring(0, 50);
    }
    if (!cachedIpAddress) {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            cachedIpAddress = data.ip;
        } catch {
            cachedIpAddress = 'unknown';
        }
    }
    return { computerName: cachedComputerName, ipAddress: cachedIpAddress };
}

export async function logActivity(action, details = {}) {
    try {
        const { computerName, ipAddress } = await getDeviceInfo();
        const func = httpsCallable(functions, 'logs-createActivityLog');
        await func({
            action,
            details: typeof details === 'string' ? details : JSON.stringify(details),
            computerName,
            ipAddress,
            sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.warn('[AuditLog] Failed:', err.message);
    }
}

export async function logError(errorData) {
    try {
        const { computerName, ipAddress } = await getDeviceInfo();
        const func = httpsCallable(functions, 'logs-createErrorLog');
        await func({
            ...errorData,
            computerName,
            ipAddress,
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            timestamp: new Date().toISOString()
        });
    } catch {
        // Silent - prevent infinite error loops
    }
}

export default {
    log: logActivity,
    getLocalLogs: () => [],
    clearLocalLogs: () => { },
    ACTIONS: {
        BACKUP_CREATE: 'BACKUP_CREATE'
    }
};
