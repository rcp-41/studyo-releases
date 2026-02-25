/**
 * Audit Log Service
 * Tracks user actions across the application for security and compliance.
 * Logs are stored locally and synced to Firestore via Cloud Functions.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const ACTIONS = {
    // Auth
    LOGIN: 'auth.login',
    LOGOUT: 'auth.logout',
    PASSWORD_RESET: 'auth.password_reset',

    // Archive
    ARCHIVE_CREATE: 'archive.create',
    ARCHIVE_UPDATE: 'archive.update',
    ARCHIVE_DELETE: 'archive.delete',
    ARCHIVE_WORKFLOW: 'archive.workflow_change',

    // Appointment
    APPOINTMENT_CREATE: 'appointment.create',
    APPOINTMENT_UPDATE: 'appointment.update',
    APPOINTMENT_DELETE: 'appointment.delete',
    APPOINTMENT_MOVE: 'appointment.move',

    // Customer
    CUSTOMER_CREATE: 'customer.create',
    CUSTOMER_UPDATE: 'customer.update',
    CUSTOMER_DELETE: 'customer.delete',

    // Shoot
    SHOOT_CREATE: 'shoot.create',
    SHOOT_UPDATE: 'shoot.update',
    SHOOT_DELETE: 'shoot.delete',
    SHOOT_PAYMENT: 'shoot.payment',

    // Finance
    EXPENSE_CREATE: 'finance.expense_create',
    PAYMENT_CREATE: 'finance.payment_create',

    // Settings
    SETTINGS_UPDATE: 'settings.update',
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',
    LEAVE_CREATE: 'leave.create',
    LEAVE_DELETE: 'leave.delete',

    // System
    BACKUP_CREATE: 'system.backup',
    APP_UPDATE: 'system.update'
};

/**
 * Log an audit event
 * @param {string} action - Action type from ACTIONS
 * @param {object} details - Additional details about the action
 * @param {string} [targetId] - ID of the affected entity
 */
function log(action, details = {}, targetId = null) {
    try {
        const userStr = localStorage.getItem('studyo-user');
        const user = userStr ? JSON.parse(userStr) : {};

        const entry = {
            action,
            userId: user.uid || 'unknown',
            userName: user.fullName || user.email || 'unknown',
            targetId,
            details: typeof details === 'string' ? { message: details } : details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Store locally (ring buffer of last 200 entries)
        const localLogs = JSON.parse(localStorage.getItem('studyo-audit-log') || '[]');
        localLogs.unshift(entry);
        if (localLogs.length > 200) localLogs.length = 200;
        localStorage.setItem('studyo-audit-log', JSON.stringify(localLogs));

        // Fire and forget to backend
        const fn = httpsCallable(functions, 'audit-log');
        fn(entry).catch(() => {
            // Try new audit handler path
            const fn2 = httpsCallable(functions, 'audit-log');
            fn2(entry).catch(() => { /* Silently fail — local log is the fallback */ });
        });
    } catch (e) {
        console.warn('[AuditLog] Failed to log:', e);
    }
}

/**
 * Get local audit logs
 */
function getLocalLogs() {
    try {
        return JSON.parse(localStorage.getItem('studyo-audit-log') || '[]');
    } catch {
        return [];
    }
}

/**
 * Clear local audit logs
 */
function clearLocalLogs() {
    localStorage.removeItem('studyo-audit-log');
}

export const auditLog = { log, getLocalLogs, clearLocalLogs, ACTIONS };
export default auditLog;
