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
        confirmClose: () => ipcRenderer.invoke('photo-selector:confirm-close'),
        sendResult: (result) => ipcRenderer.invoke('photo-selector:sendResult', result),
        onResult: (callback) => {
            ipcRenderer.on('photo-selector:result', (_event, data) => callback(data));
        },
        onBeforeClose: (callback) => {
            ipcRenderer.on('photo-selector:before-close', () => callback());
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
        getImageAsBase64: (params) => ipcRenderer.invoke('photos:getImageAsBase64', params),
        getDisplays: () => ipcRenderer.invoke('screen:getDisplays'),
        selectFolder: () => ipcRenderer.invoke('photos:selectFolder'),
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
        onQr: (callback) => {
            ipcRenderer.on('whatsapp:qr', (_event, qr) => callback(qr));
        },
        onStatus: (callback) => {
            ipcRenderer.on('whatsapp:status', (_event, status) => callback(status));
        }
    }

});

// Expose node version for debugging
contextBridge.exposeInMainWorld('versions', {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
});
