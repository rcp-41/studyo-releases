const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electron', {
    // App info
    getVersion: () => ipcRenderer.invoke('app:version'),
    getPlatform: () => ipcRenderer.invoke('app:platform'),

    // Window controls
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),

    // Notifications
    showNotification: (title, body) => {
        new Notification(title, { body });
    },

    // Folder operations
    selectFolder: () => ipcRenderer.invoke('folder:select'),
    createFolder: (path) => ipcRenderer.invoke('folder:create', path),
    openFolder: (path) => ipcRenderer.invoke('folder:open', path),
    addAllowedPath: (path) => ipcRenderer.invoke('folder:addAllowedPath', path),

    // File/Folder dialog
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),

    // File operations for Firebase Storage upload
    readFileAsBuffer: (filePath) => ipcRenderer.invoke('file:readBuffer', filePath),
    getFilesInFolder: (folderPath, extensions) => ipcRenderer.invoke('folder:getFiles', folderPath, extensions),

    // License/Studio Config
    getLicenseConfig: () => ipcRenderer.invoke('security:getLicenseConfig'),
    saveLicenseConfig: (config) => ipcRenderer.invoke('security:saveLicenseConfig', config),
    clearLicenseConfig: () => ipcRenderer.invoke('security:clearLicenseConfig'),
    validateLicense: (hwid) => ipcRenderer.invoke('security:validateLicense', hwid),
    getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),

    // External links (Gmail, WhatsApp deep links)
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

    // Google Drive
    googleDrive: {
        authenticate: (options) => ipcRenderer.invoke('gdrive:authenticate', options),
        getStatus: () => ipcRenderer.invoke('gdrive:getStatus'),
        createFolder: (options) => ipcRenderer.invoke('gdrive:createFolder', options),
        disconnect: () => ipcRenderer.invoke('gdrive:disconnect'),
    },

    // Photo Selector
    photoSelector: {
        open: (config) => ipcRenderer.invoke('photo-selector:open', config),
        close: () => ipcRenderer.invoke('photo-selector:confirm-close'),
        confirmClose: () => ipcRenderer.invoke('photo-selector:confirm-close'),
        sendResult: (result) => ipcRenderer.invoke('photo-selector:sendResult', result),
        onResult: (callback) => {
            ipcRenderer.on('photo-selector:result', (_event, data) => callback(data));
        },
        onBeforeClose: (callback) => {
            ipcRenderer.on('photo-selector:before-close', () => callback());
        },
        removeBeforeClose: () => {
            ipcRenderer.removeAllListeners('photo-selector:before-close');
        },
        generateThumbnails: (params) => ipcRenderer.invoke('photos:generateThumbnails', params),
        onThumbnailProgress: (callback) => {
            ipcRenderer.on('photos:thumbnail-progress', (_event, data) => callback(data));
        },
        readExif: (params) => ipcRenderer.invoke('photos:readExif', params),
        renameFile: (params) => ipcRenderer.invoke('photos:renameFile', params),
        batchRename: (params) => ipcRenderer.invoke('photos:batchRename', params),
        readIni: (params) => ipcRenderer.invoke('photos:readIniFile', params),
        writeIni: (params) => ipcRenderer.invoke('photos:writeIniFile', params),
        createNotes: (params) => ipcRenderer.invoke('photos:createNotesFile', params),
        writeFile: (params) => ipcRenderer.invoke('photos:writeFile', params),
        getImageAsBase64: (params) => ipcRenderer.invoke('photos:getImageAsBase64', params),
        getDisplays: () => ipcRenderer.invoke('screen:getDisplays'),
        selectFolder: () => ipcRenderer.invoke('photos:selectFolder'),
        copyFiles: (params) => ipcRenderer.invoke('photos:copyFiles', params),
        onCopyProgress: (callback) => {
            ipcRenderer.on('photos:copy-progress', (_event, data) => callback(data));
        },
    },

    // Face Recognition
    faceRecognition: {
        loadModels: (params) => ipcRenderer.invoke('faceRecognition:loadModels', params),
        getDescriptor: (params) => ipcRenderer.invoke('faceRecognition:getDescriptor', params),
        findMatches: (params) => ipcRenderer.invoke('faceRecognition:findMatches', params),
    },

    // WhatsApp Baileys
    whatsapp: {
        init: () => ipcRenderer.invoke('whatsapp:init'),
        getStatus: () => ipcRenderer.invoke('whatsapp:getStatus'),
        getQr: () => ipcRenderer.invoke('whatsapp:getQr'),
        send: (phone, text) => ipcRenderer.invoke('whatsapp:send', phone, text),
        logout: () => ipcRenderer.invoke('whatsapp:logout'),
        openChat: (phone) => ipcRenderer.invoke('whatsapp:openChat', phone),
        showWindow: () => ipcRenderer.invoke('whatsapp:showWindow'),
        onQr: (callback) => {
            ipcRenderer.on('whatsapp:qr', (_event, qr) => callback(qr));
        },
        onStatus: (callback) => {
            ipcRenderer.on('whatsapp:status', (_event, status) => callback(status));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('whatsapp:qr');
            ipcRenderer.removeAllListeners('whatsapp:status');
        }
    },

    // Print service (F2 auto-print)
    print: {
        getPrinters: () => ipcRenderer.invoke('print:getPrinters'),
        printHtml: (params) => ipcRenderer.invoke('print:html', params),
        pdfPreview: (params) => ipcRenderer.invoke('print:pdfPreview', params),
    },

    // Security — safeStorage encryption status
    security: {
        // Calls main to check if OS-level encryption is available
        getEncryptionStatus: () => ipcRenderer.invoke('app:getEncryptionStatus'),
        // Register a one-time callback for the encryption-unavailable event
        onEncryptionUnavailable: (cb) => {
            ipcRenderer.once('security:encryptionUnavailable', () => cb());
        },
    },

    // Auto-Update
    update: {
        onStatus: (callback) => {
            const handler = (_event, status, data) => callback(status, data);
            ipcRenderer.on('update:status', handler);
            return () => ipcRenderer.removeListener('update:status', handler);
        },
        onProgress: (callback) => {
            const handler = (_event, percent) => callback(percent);
            ipcRenderer.on('update:progress', handler);
            return () => ipcRenderer.removeListener('update:progress', handler);
        },
        download: () => ipcRenderer.invoke('update:download'),
        install: () => ipcRenderer.invoke('update:install'),
        check: () => ipcRenderer.invoke('update:check'),
        removeListeners: () => {
            ipcRenderer.removeAllListeners('update:status');
            ipcRenderer.removeAllListeners('update:progress');
        }
    },

    // ===== H3: Feature flags =====
    // flags.get(key, defaultValue) — localStorage'dan senkron okur
    // flags.refresh()             — async, main'e renderer:flagsRefresh göndererek tetikler
    flags: {
        // Sync read from localStorage key 'studyo:flags'
        get: (key, defaultValue = null) => {
            try {
                const raw = localStorage.getItem('studyo:flags');
                if (!raw) return defaultValue;
                const obj = JSON.parse(raw);
                return key in obj ? obj[key] : defaultValue;
            } catch { return defaultValue; }
        },
        // Renderer bu metodu çağırınca kendi Firebase callable'ını yeniden tetikler;
        // sonuç localStorage'a yazılır (renderer'daki useFlags hook tarafından).
        // main sadece tetikleyici event alır — renderer agent implementasyonu yapacak.
        refresh: () => ipcRenderer.invoke('flags:refresh'),
    },

    // ===== E5: Heartbeat / H4: Update config / H2: Logs / C4: Force logout — renderer → main =====
    // Renderer bu kanalları kullanarak main'i bilgilendirir.
    backend: {
        // E5: Auth state değişince session bilgisini main'e gönder
        reportUserSession: (session) => ipcRenderer.send('renderer:userSession', session),

        // H4: Callable'dan dönen update config'i main'e ilet
        reportUpdateConfig: (config) => ipcRenderer.send('renderer:updateConfig', config),

        // H2: log upload isteği gelince main'e dosyayı okutur ve PUT eder
        uploadLogs: (params) => ipcRenderer.invoke('renderer:uploadLogs', params),

        // C4: Firestore force logout tetiklenince main'e bildir
        reportForceLogout: () => ipcRenderer.send('renderer:forceLogout'),

        // Renderer yüklenince pending impersonation token olup olmadığını sorgular
        notifyReady: () => ipcRenderer.invoke('renderer:ready'),

        // H3: Flag refresh tetikleyici (main ipcMain.handle('flags:refresh') opsiyonel)
        notifyFlagsRefresh: () => ipcRenderer.invoke('flags:refresh'),
    },

    // ===== C3: Impersonation — main → renderer events =====
    impersonation: {
        // main:impersonationActive — { token } ile gelir; renderer signInWithCustomToken çağırır
        onActive: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('main:impersonationActive', handler);
            return () => ipcRenderer.removeListener('main:impersonationActive', handler);
        },
        // main:impersonationExpired — 15 dakika sonra otomatik signOut
        onExpired: (callback) => {
            ipcRenderer.once('main:impersonationExpired', () => callback());
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('main:impersonationActive');
            ipcRenderer.removeAllListeners('main:impersonationExpired');
        },
    },

    // ===== C4 / H4: Main → renderer events =====
    mainEvents: {
        // C4: main login ekranına yönlendirme emri verir
        onNavigateToLogin: (callback) => {
            ipcRenderer.on('main:navigateToLogin', () => callback());
        },
        // H4: Zorunlu güncelleme — modal göster, app kullanılamaz
        onForceUpdateRequired: (callback) => {
            ipcRenderer.on('main:forceUpdateRequired', (_event, data) => callback(data));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('main:navigateToLogin');
            ipcRenderer.removeAllListeners('main:forceUpdateRequired');
        },
    },

});

// Expose versions for debugging and display
contextBridge.exposeInMainWorld('versions', {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: ipcRenderer.sendSync('app:getVersion') || ''
});
