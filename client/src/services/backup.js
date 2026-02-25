/**
 * Backup & Restore Utility
 * Exports Firestore collections to JSON and allows restoring from backup files.
 * Admin-only feature accessible from Settings.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const callFunction = (name, data) => {
    const fn = httpsCallable(functions, name);
    return fn(data || {});
};

/**
 * Request a full backup of all collections
 * @returns {Promise<{data: {url: string, size: number, collections: string[]}}>}
 */
export async function createBackup() {
    return callFunction('backup-create');
}

/**
 * List available backups
 * @returns {Promise<{data: Array<{id: string, createdAt: string, size: number, collections: string[]}>}>}
 */
export async function listBackups() {
    return callFunction('backup-list');
}

/**
 * Download a specific backup
 * @param {string} backupId
 * @returns {Promise<{data: {url: string}}>}
 */
export async function downloadBackup(backupId) {
    return callFunction('backup-download', { backupId });
}

/**
 * Delete a backup
 * @param {string} backupId
 */
export async function deleteBackup(backupId) {
    return callFunction('backup-delete', { backupId });
}

/**
 * Local JSON export — exports data as a downloadable JSON file
 * @param {object} data - Data to export
 * @param {string} filename - Filename without extension
 */
export function exportToJson(data, filename = 'studyo-backup') {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const backupApi = {
    create: createBackup,
    list: listBackups,
    download: downloadBackup,
    delete: deleteBackup,
    exportToJson
};

export default backupApi;
