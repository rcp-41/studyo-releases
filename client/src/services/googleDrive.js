/**
 * Google Drive API Service
 * Provides Google Drive integration for archiving photos.
 *
 * SETUP: Requires Google Cloud Console OAuth credentials.
 * 1. Create OAuth 2.0 Client ID in Google Cloud Console
 * 2. Add credentials in Settings > API Integrations
 * 3. Electron app handles OAuth flow via IPC
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

class GoogleDriveService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Check if Google Drive is configured and available
     */
    isAvailable() {
        return !!window.electron?.googleDrive;
    }

    /**
     * Authenticate with Google OAuth (via Electron IPC)
     * @param {string} clientId - Google OAuth Client ID
     * @param {string} clientSecret - Google OAuth Client Secret
     * @returns {Promise<{success: boolean, token?: string}>}
     */
    async authenticate(clientId, clientSecret) {
        if (!this.isAvailable()) {
            throw new Error('Google Drive entegrasyonu sadece masaüstü uygulamasında kullanılabilir');
        }

        try {
            const result = await window.electron.googleDrive.authenticate({
                clientId,
                clientSecret,
                scopes: SCOPES
            });

            if (result.success) {
                this.accessToken = result.token;
                this.tokenExpiry = result.expiry;
            }

            return result;
        } catch (error) {
            console.error('Google Drive auth error:', error);
            throw error;
        }
    }

    /**
     * Check authentication status
     */
    async getStatus() {
        if (!this.isAvailable()) {
            return { connected: false, reason: 'electron_not_available' };
        }

        try {
            const result = await window.electron.googleDrive.getStatus();
            return result;
        } catch {
            return { connected: false };
        }
    }

    /**
     * Create a folder in Google Drive
     * @param {string} folderName - Name of the folder
     * @param {string} [parentId] - Parent folder ID (optional)
     * @returns {Promise<{id: string, name: string, webViewLink: string}>}
     */
    async createFolder(folderName, parentId = null) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.createFolder({
            name: folderName,
            parentId
        });
    }

    /**
     * Upload a file to Google Drive
     * @param {string} filePath - Local file path
     * @param {string} folderId - Target folder ID in Drive
     * @param {Function} [onProgress] - Progress callback (0-100)
     * @returns {Promise<{id: string, name: string, webViewLink: string}>}
     */
    async uploadFile(filePath, folderId, onProgress) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.uploadFile({
            filePath,
            folderId,
            onProgress
        });
    }

    /**
     * Upload multiple files to a folder
     * @param {string[]} filePaths - Array of local file paths
     * @param {string} folderId - Target folder ID
     * @param {Function} [onProgress] - Progress callback ({current, total, percent})
     * @returns {Promise<{uploaded: number, failed: number, files: Array}>}
     */
    async uploadBatch(filePaths, folderId, onProgress) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.uploadBatch({
            filePaths,
            folderId,
            onProgress
        });
    }

    /**
     * Share a Drive folder/file with a user
     * @param {string} fileId - File or folder ID
     * @param {string} email - Email to share with
     * @param {string} role - 'reader', 'writer', or 'commenter'
     * @returns {Promise<{success: boolean, link: string}>}
     */
    async share(fileId, email, role = 'reader') {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.share({
            fileId,
            email,
            role
        });
    }

    /**
     * Get shareable link for a file/folder
     * @param {string} fileId - File or folder ID
     * @returns {Promise<{link: string}>}
     */
    async getShareLink(fileId) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.getShareLink({ fileId });
    }

    /**
     * List files in a Drive folder
     * @param {string} folderId - Folder ID
     * @returns {Promise<Array<{id: string, name: string, mimeType: string, size: number}>>}
     */
    async listFiles(folderId) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.listFiles({ folderId });
    }

    /**
     * Delete a file/folder from Drive
     * @param {string} fileId - File or folder ID
     */
    async deleteFile(fileId) {
        if (!this.isAvailable()) throw new Error('Google Drive kullanılamıyor');

        return window.electron.googleDrive.deleteFile({ fileId });
    }

    /**
     * Disconnect/revoke Google Drive access
     */
    async disconnect() {
        if (!this.isAvailable()) return;

        try {
            await window.electron.googleDrive.disconnect();
            this.accessToken = null;
            this.tokenExpiry = null;
        } catch (error) {
            console.error('Google Drive disconnect error:', error);
        }
    }
}

// Singleton instance
export const googleDrive = new GoogleDriveService();
export default googleDrive;
