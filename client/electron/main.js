const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, dialog, safeStorage } = require('electron');
// BUILD_VERSION_FIX_404 - LOCAL LOADING ENABLED
const path = require('path');
const fs = require('fs');
const os = require('os');
const { machineIdSync } = require('node-machine-id');
const { autoUpdater } = require('electron-updater');
const { registerWhatsAppIPC } = require('./whatsapp');
const { registerPhotoSelectorIPC, createPhotoSelectorWindow } = require('./photoSelector');
const { registerPrinterIPC } = require('./printer');

let mainWindow;
let tray;

const isDev = process.env.NODE_ENV === 'development';

// ===== C3: Impersonation — pending token before mainWindow is ready =====
let _pendingImpersonationToken = null;

// ===== H4: Update config — resolved feed URL from backend =====
let _resolvedFeedUrl = null;

// Firebase Hosting URL for production (Stealth Mode)
const FIREBASE_HOSTING_URL = process.env.FIREBASE_HOSTING_URL || 'https://studyo-live-2026.web.app';

// SECURITY: Navigation/window-open origin whitelist
const ALLOWED_NAVIGATE_ORIGINS = [
    /^https:\/\/studyo-live-2026\.web\.app(\/|$)/,
    /^https:\/\/[a-z0-9-]+\.firebaseapp\.com(\/|$)/,
    /^https:\/\/[a-z0-9-]+\.firebaseio\.com(\/|$)/,
    /^https:\/\/[a-z0-9.-]+\.googleapis\.com(\/|$)/,
    /^https:\/\/accounts\.google\.com(\/|$)/,
    ...(process.env.NODE_ENV === 'development' ? [/^http:\/\/localhost:\d+(\/|$)/] : []),
];

function isAllowedUrl(url) {
    try {
        return ALLOWED_NAVIGATE_ORIGINS.some(re => re.test(url));
    } catch {
        return false;
    }
}

// Single-fire flag for encryption unavailability warning
let _encryptionWarnSent = false;

// Public IP cache (5 min TTL) — avoids hitting ipify on every getSystemInfo call
let _publicIpCache = { ip: null, ts: 0 };
const PUBLIC_IP_TTL_MS = 5 * 60 * 1000;

// SECURITY: Allowed base paths for file operations (populated after app.ready)
const ALLOWED_BASE_PATHS = [];

// G5: License config encryption using safeStorage
const LICENSE_ENC_FILE = 'license.enc';
const LICENSE_LEGACY_FILE = 'license.json';

function saveLicenseEncrypted(config) {
    if (!safeStorage.isEncryptionAvailable()) {
        // SECURITY: Refuse plaintext fallback — license must be encrypted at rest
        throw new Error('OS encryption unavailable — license cannot be saved securely on this machine.');
    }
    const jsonStr = JSON.stringify(config, null, 2);
    const encPath = path.join(app.getPath('userData'), LICENSE_ENC_FILE);
    const encrypted = safeStorage.encryptString(jsonStr);
    fs.writeFileSync(encPath, encrypted);
}

function loadLicenseConfig() {
    const encPath = path.join(app.getPath('userData'), LICENSE_ENC_FILE);
    const legacyPath = path.join(app.getPath('userData'), LICENSE_LEGACY_FILE);

    // Try encrypted file first
    if (fs.existsSync(encPath) && safeStorage.isEncryptionAvailable()) {
        try {
            const encrypted = fs.readFileSync(encPath);
            return JSON.parse(safeStorage.decryptString(encrypted));
        } catch { /* fall through to legacy */ }
    }
    // One-time migration from legacy plaintext (only if encryption is now available)
    if (fs.existsSync(legacyPath) && safeStorage.isEncryptionAvailable()) {
        try {
            const config = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
            saveLicenseEncrypted(config);
            try { fs.unlinkSync(legacyPath); } catch { /* best effort */ }
            return config;
        } catch { return null; }
    }
    return null;
}

function isPathAllowed(targetPath) {
    const resolved = path.resolve(targetPath);
    return ALLOWED_BASE_PATHS.some(base => resolved.startsWith(base));
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: 'BaseOS — Stüdyo Yönetim',
        icon: path.join(__dirname, '../public/baseos-icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        },
        frame: true,
        autoHideMenuBar: true,
        backgroundColor: '#0f172a',
        show: false, // Hidden initially — splash shows first
    });

    // Load URL based on environment
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // Load from Firebase Hosting (always up-to-date, Stealth Mode)
        console.log('[Electron] Loading from Firebase Hosting:', FIREBASE_HOSTING_URL);
        mainWindow.loadURL(FIREBASE_HOSTING_URL);
        // Hide menu bar in production
        mainWindow.setMenuBarVisibility(false);
    }

    // SECURITY: Block or redirect new-window requests
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedUrl(url)) return { action: 'allow' };
        // Open external https links in the OS browser (http rejected for security)
        if (/^https:\/\//.test(url)) shell.openExternal(url).catch(() => {});
        return { action: 'deny' };
    });

    // SECURITY: Block navigation outside allowed origins
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            console.warn('[Security] Blocked navigation to:', url);
        }
    });

    // SECURITY: safeStorage availability check — warn renderer once
    if (!safeStorage.isEncryptionAvailable() && !_encryptionWarnSent) {
        _encryptionWarnSent = true;
        console.warn('[Security] safeStorage encryption unavailable on this machine.');
        mainWindow.webContents.once('did-finish-load', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('security:encryptionUnavailable');
            }
        });
    }

    // Handle window close
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '../public/icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Aç',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Çıkış',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('BaseOS — Stüdyo Yönetim');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// App lifecycle
const isPhotoSelectorMode = process.argv.includes('--photo-selector');

// ===== C3: Single instance lock — second-instance eventi için zorunlu =====
// Photo-selector mode'da single-instance kontrolü atlanır (ayrı süreç olarak çalışır)
if (!isPhotoSelectorMode) {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        // Başka bir örnek zaten çalışıyor; bu örneği kapat
        app.quit();
    }
}

// ===== C3: macOS protokol handler kaydı (studyo://) =====
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('studyo', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('studyo');
}

app.whenReady().then(() => {
    // SECURITY: Populate allowed base paths for file operations
    ALLOWED_BASE_PATHS.push(
        path.resolve(app.getPath('userData')),
        path.resolve(app.getPath('documents')),
        path.resolve(app.getPath('pictures')),
        path.resolve(app.getPath('desktop')),
        path.resolve(app.getPath('downloads'))
    );

    // MIGRATION: Check and migrate license config to multi-studio structure
    migrateLicenseConfig();

    // Add archive base paths from license config (supports both legacy and new structure)
    try {
        const licenseConfig = loadLicenseConfig();
        if (licenseConfig) {

            // Support legacy archiveBasePath
            if (licenseConfig?.archiveBasePath) {
                const resolved = path.resolve(licenseConfig.archiveBasePath);
                if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                    ALLOWED_BASE_PATHS.push(resolved);
                }
            }

            // Support new studios array
            if (Array.isArray(licenseConfig?.studios)) {
                licenseConfig.studios.forEach(studio => {
                    if (studio.path) {
                        const resolved = path.resolve(studio.path);
                        if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                            ALLOWED_BASE_PATHS.push(resolved);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading license config paths:', error);
    }

    // Expose app version to renderer via sync IPC
    ipcMain.on('app:getVersion', (event) => {
        event.returnValue = app.getVersion();
    });

    if (isPhotoSelectorMode) {
        // Standalone Photo Selector mode
        console.log('[Standalone] Starting Photo Selector in standalone mode...');

        // Register Photo Selector IPC for standalone mode (no mainWindow)
        registerPhotoSelectorIPC(null, isPathAllowed, isDev, ALLOWED_BASE_PATHS);

        // Extract optional folderPath from CLI args (--folder=R:\Arsiv\4)
        const folderArg = process.argv.find(a => a.startsWith('--folder='));
        const folderPath = folderArg ? folderArg.split('=').slice(1).join('=') : null;

        // Add folder to allowed paths if specified
        if (folderPath) {
            const resolved = path.resolve(folderPath);
            if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                ALLOWED_BASE_PATHS.push(resolved);
            }
        }

        const config = {
            folderPath: folderPath || null,
            archiveNo: null,
            customerName: null,
            shootCategory: null,
        };

        createPhotoSelectorWindow(null, config, isDev);
    } else {
        // Normal Studyo app mode
        createWindow();
        createTray();

        // Register WhatsApp IPC handlers
        registerWhatsAppIPC(mainWindow);

        // Update Photo Selector IPC with actual mainWindow reference
        registerPhotoSelectorIPC(mainWindow, isPathAllowed, isDev, ALLOWED_BASE_PATHS);

        // Register Printer IPC handlers
        registerPrinterIPC();

        // ===== FRAMELESS SPLASH WINDOW (plays intro video like Photoshop) =====
        let splashWindow = null;
        let updateSplash = null;
        let pendingVersion = '';
        let videoEnded = false;
        let updatePending = false;
        let splashDismissed = false; // splash→main transition runs only once

        // Create the frameless splash window
        splashWindow = new BrowserWindow({
            width: 500,
            height: 500,
            frame: false,
            transparent: true,
            resizable: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            center: true,
            hasShadow: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
            }
        });
        splashWindow.loadFile(path.join(__dirname, 'splash.html'));
        splashWindow.on('closed', () => { splashWindow = null; });

        // Once splash HTML loads, set the video source
        splashWindow.webContents.once('did-finish-load', () => {
            const videoPath = 'file:///' + path.join(__dirname, 'splash-intro.mp4').replace(/\\/g, '/');
            splashWindow.webContents.executeJavaScript(
                `window.postMessage(${JSON.stringify({ type: 'videoSrc', data: videoPath })}, '*')`
            ).catch(() => { });
        });

        // Poll for video-ended event from splash
        const splashPollInterval = setInterval(() => {
            if (!splashWindow || splashWindow.isDestroyed()) {
                clearInterval(splashPollInterval);
                return;
            }
            splashWindow.webContents.executeJavaScript(
                `document.getElementById('introVideo')?.ended`
            ).then(ended => {
                if (ended && !videoEnded) {
                    videoEnded = true;
                    clearInterval(splashPollInterval);
                    // If no update is being downloaded, close splash and show main
                    if (!updatePending) {
                        closeSplashShowMain();
                    }
                }
            }).catch(() => { });
        }, 300);

        // Fallback: if video somehow doesn't end, close splash after 15s
        setTimeout(() => {
            if (!videoEnded && !updatePending) {
                videoEnded = true;
                clearInterval(splashPollInterval);
                closeSplashShowMain();
            }
        }, 15000);

        function closeSplashShowMain() {
            // One-shot: only the initial splash→main transition may force the main
            // window to the foreground. Periodic update checks (update-not-available
            // / error every 5 min) must NOT re-show or focus a minimized window.
            if (splashDismissed) return;
            splashDismissed = true;
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        }

        function sendToSplashWindow(type, data) {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.webContents.executeJavaScript(
                    `window.postMessage(${JSON.stringify({ type, data })}, '*')`
                ).catch(() => { });
            }
        }

        // ===== AUTO-UPDATE =====
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.logger = {
            info: (...args) => console.log('[AutoUpdater]', ...args),
            warn: (...args) => console.warn('[AutoUpdater]', ...args),
            error: (...args) => console.error('[AutoUpdater]', ...args),
            debug: () => { },
        };

        function createUpdateSplash() {
            if (updateSplash && !updateSplash.isDestroyed()) return updateSplash;
            updateSplash = new BrowserWindow({
                width: 420,
                height: 360,
                frame: false,
                transparent: true,
                resizable: false,
                alwaysOnTop: true,
                skipTaskbar: false,
                center: true,
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false,
                }
            });
            updateSplash.loadFile(path.join(__dirname, 'update-splash.html'));
            updateSplash.on('closed', () => { updateSplash = null; });
            return updateSplash;
        }

        function sendToUpdateSplash(type, data) {
            if (updateSplash && !updateSplash.isDestroyed()) {
                updateSplash.webContents.executeJavaScript(
                    `window.postMessage(${JSON.stringify({ type, data })}, '*')`
                ).catch(() => { });
            }
        }

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Checking...');
            if (mainWindow) mainWindow.webContents.send('update:status', 'checking');
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[AutoUpdater] Update available:', info.version);
            pendingVersion = info.version;
            updatePending = true;
            if (mainWindow) mainWindow.webContents.send('update:status', 'available', { version: info.version });
            // Show progress in splash window
            sendToSplashWindow('update-available', info.version);
        });

        autoUpdater.on('update-not-available', () => {
            console.log('[AutoUpdater] Up to date.');
            if (mainWindow) mainWindow.webContents.send('update:status', 'up-to-date');
            // If video already ended, show main window
            if (videoEnded && !updatePending) {
                closeSplashShowMain();
            }
        });

        autoUpdater.on('download-progress', (progress) => {
            const pct = Math.round(progress.percent);
            if (mainWindow) mainWindow.webContents.send('update:progress', pct);
            sendToSplashWindow('progress', pct);
            sendToUpdateSplash('progress', pct);
        });

        let isInstallingUpdate = false; // Guard against multiple quitAndInstall calls

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] Downloaded:', info.version);
            pendingVersion = info.version;
            if (mainWindow) mainWindow.webContents.send('update:status', 'downloaded', { version: info.version });
            sendToSplashWindow('downloaded');
            sendToUpdateSplash('downloaded');
            // Auto-install during splash only (first launch), not when app is already running
            if (!isInstallingUpdate) {
                isInstallingUpdate = true;
                setTimeout(() => {
                    app.isQuitting = true;
                    autoUpdater.quitAndInstall(true, true);
                }, 2000);
            }
        });

        autoUpdater.on('error', (err) => {
            console.error('[AutoUpdater] Error:', err.message);
            if (mainWindow) mainWindow.webContents.send('update:status', 'error', { message: err.message });
            updatePending = false;
            // If video ended, show main window
            if (videoEnded) closeSplashShowMain();
            if (updateSplash && !updateSplash.isDestroyed()) updateSplash.close();
        });

        // Start update check during splash (single initial check)
        autoUpdater.checkForUpdates().catch(err => {
            console.error('[AutoUpdater] Check failed:', err.message);
        });

        // IPC: frontend requests download
        ipcMain.handle('update:download', () => {
            return autoUpdater.downloadUpdate();
        });

        // IPC: frontend requests install & restart with splash
        ipcMain.handle('update:install', () => {
            if (isInstallingUpdate) return; // Prevent duplicate install
            isInstallingUpdate = true;
            // Show splash, hide main window
            const splash = createUpdateSplash();
            splash.webContents.once('did-finish-load', () => {
                sendToUpdateSplash('version', pendingVersion);
                sendToUpdateSplash('downloaded');

                // Hide main window
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();

                // Wait for checkmark animation, then install
                setTimeout(() => {
                    app.isQuitting = true;
                    autoUpdater.quitAndInstall(true, true);
                }, 2500);
            });
        });

        // IPC: frontend requests manual check
        ipcMain.handle('update:check', () => {
            return autoUpdater.checkForUpdates();
        });

        // Check every 5 minutes (no duplicate 5-second check needed — splash already triggers one)
        setInterval(() => {
            if (!isInstallingUpdate) {
                autoUpdater.checkForUpdates().catch(err => {
                    console.error('[AutoUpdater] Periodic check failed:', err.message);
                });
            }
        }, 5 * 60 * 1000);
        // ===== END AUTO-UPDATE =====

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else if (mainWindow) {
                mainWindow.show();
            }
        });

        // ===== C3: Impersonation — Windows second-instance handler =====
        // Checks argv for --impersonation-token=<token> on second-instance launch
        app.on('second-instance', (_event, argv) => {
            const tokenArg = argv.find(a => a.startsWith('--impersonation-token='));
            if (tokenArg) {
                const token = tokenArg.split('=').slice(1).join('=');
                _handleImpersonationToken(token);
            }
            // Focus the existing window
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });

        // ===== C3: Impersonation — macOS open-url / studyo:// deep link =====
        app.on('open-url', (_event, url) => {
            try {
                const parsed = new URL(url);
                if (parsed.protocol === 'studyo:' && parsed.hostname === 'impersonate') {
                    const token = parsed.searchParams.get('token');
                    if (token) _handleImpersonationToken(token);
                }
            } catch (e) {
                console.error('[C3] open-url parse error:', e.message);
            }
        });
    }
});

/**
 * Migration helper: Transform single archiveBasePath to studios array
 */
function migrateLicenseConfig() {
    try {
        const config = loadLicenseConfig();
        if (!config) return;
        let changed = false;

        // Migration: archiveBasePath -> studios array
        if (config.archiveBasePath && !config.studios) {
            config.studios = [{
                id: 'default',
                name: 'Varsayılan Stüdyo',
                path: config.archiveBasePath
            }];
            delete config.archiveBasePath;
            changed = true;
        }

        if (changed) {
            saveLicenseEncrypted(config);
        }
    } catch (error) {
        console.error('[Migration] Failed to migrate license config:', error);
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
});

// IPC handlers
ipcMain.handle('app:version', () => {
    return app.getVersion();
});

// SECURITY: Report safeStorage encryption status to renderer on demand
ipcMain.handle('app:getEncryptionStatus', () => {
    return { available: safeStorage.isEncryptionAvailable() };
});

// SECURITY: Shell open external with protocol whitelist
ipcMain.handle('shell:openExternal', async (_event, url) => {
    try {
        const parsed = new URL(url);
        const allowedProtocols = ['https:', 'mailto:', 'whatsapp:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
            throw new Error('Disallowed protocol: ' + parsed.protocol);
        }
        await shell.openExternal(url);
    } catch (error) {
        console.error('shell:openExternal blocked:', error.message);
        throw error;
    }
});

ipcMain.handle('app:platform', () => {
    return process.platform;
});

// Folder operations
ipcMain.handle('folder:select', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        properties: ['openDirectory'],
        title: 'Arşiv Klasör Konumu Seç'
    });
    return result.filePaths[0] || null;
});

// Register archive base path as allowed (called from renderer when settings load)
ipcMain.handle('folder:addAllowedPath', async (event, basePath) => {
    try {
        if (!basePath || typeof basePath !== 'string') {
            return { success: false, error: 'Invalid path' };
        }
        // Reject raw path traversal segments before normalization
        if (/(^|[\\/])\.\.($|[\\/])/.test(basePath)) {
            return { success: false, error: 'Path traversal not allowed' };
        }
        const normalized = path.normalize(basePath);
        if (normalized.split(/[\\/]/).includes('..')) {
            return { success: false, error: 'Path traversal not allowed' };
        }
        const resolved = path.resolve(normalized);
        if (!ALLOWED_BASE_PATHS.includes(resolved)) {
            ALLOWED_BASE_PATHS.push(resolved);
            console.log('[folder:addAllowedPath] Added:', resolved);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// SECURITY: Path validation on folder:create
ipcMain.handle('folder:create', async (event, folderPath) => {
    try {
        // First check against current allowed paths
        if (!isPathAllowed(folderPath)) {
            // Re-read license config in case studio paths were added/changed after startup
            try {
                const licenseConfig = loadLicenseConfig();
                if (licenseConfig) {
                    // Add any missing studio paths
                    if (Array.isArray(licenseConfig?.studios)) {
                        licenseConfig.studios.forEach(studio => {
                            if (studio.path) {
                                const resolved = path.resolve(studio.path);
                                if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                                    ALLOWED_BASE_PATHS.push(resolved);
                                    console.log('[folder:create] Dynamically added studio path:', resolved);
                                }
                            }
                        });
                    }
                    if (licenseConfig?.archiveBasePath) {
                        const resolved = path.resolve(licenseConfig.archiveBasePath);
                        if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                            ALLOWED_BASE_PATHS.push(resolved);
                            console.log('[folder:create] Dynamically added archiveBasePath:', resolved);
                        }
                    }
                }
            } catch (configErr) {
                console.error('[folder:create] License config re-read error:', configErr);
            }

            // Check again after dynamic update
            if (!isPathAllowed(folderPath)) {
                console.error('[folder:create] Path not allowed:', folderPath, 'Allowed:', ALLOWED_BASE_PATHS);
                return { success: false, error: 'Path not allowed' };
            }
        }
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        return { success: true, path: folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// SECURITY: Path validation on folder:open (with dynamic config re-read)
ipcMain.handle('folder:open', async (event, folderPath) => {
    try {
        if (!isPathAllowed(folderPath)) {
            // Re-read license config in case studio paths were added/changed after startup
            try {
                const licenseConfig = loadLicenseConfig();
                if (licenseConfig) {
                    if (Array.isArray(licenseConfig?.studios)) {
                        licenseConfig.studios.forEach(studio => {
                            if (studio.path) {
                                const resolved = path.resolve(studio.path);
                                if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                                    ALLOWED_BASE_PATHS.push(resolved);
                                    console.log('[folder:open] Dynamically added studio path:', resolved);
                                }
                            }
                        });
                    }
                    if (licenseConfig?.archiveBasePath) {
                        const resolved = path.resolve(licenseConfig.archiveBasePath);
                        if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                            ALLOWED_BASE_PATHS.push(resolved);
                            console.log('[folder:open] Dynamically added archiveBasePath:', resolved);
                        }
                    }
                }
            } catch (configErr) {
                console.error('[folder:open] License config re-read error:', configErr);
            }

            // Check again after dynamic update
            if (!isPathAllowed(folderPath)) {
                console.error('[folder:open] Path not allowed:', folderPath, 'Allowed:', ALLOWED_BASE_PATHS);
                return { success: false, error: 'Path not allowed' };
            }
        }
        if (fs.existsSync(folderPath)) {
            await shell.openPath(folderPath);
            return { success: true };
        }
        return { success: false, error: 'Klasör bulunamadı' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Generic dialog for file/folder selection
ipcMain.handle('dialog:open', async (event, options) => {
    try {
        const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
            properties: options.properties || ['openFile'],
            title: options.title || 'Dosya Seç',
            filters: options.filters || [{ name: 'Resimler', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
            defaultPath: options.defaultPath || undefined
        });

        if (result.canceled) {
            return [];
        }
        // Dynamically add selected paths to ALLOWED_BASE_PATHS
        for (const filePath of result.filePaths) {
            const resolved = path.resolve(filePath);
            if (!ALLOWED_BASE_PATHS.includes(resolved)) {
                ALLOWED_BASE_PATHS.push(resolved);
                console.log('[dialog:open] Added to ALLOWED_BASE_PATHS:', resolved);
            }
        }
        return result.filePaths;
    } catch (error) {
        console.error('Dialog error:', error);
        return [];
    }
});

// SECURITY: Path validation on file:readBuffer
ipcMain.handle('file:readBuffer', async (event, filePath) => {
    try {
        if (!isPathAllowed(filePath)) {
            throw new Error('Path not allowed');
        }
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    } catch (error) {
        console.error('File read error:', error);
        throw error;
    }
});

// SECURITY: Path validation on folder:getFiles
ipcMain.handle('folder:getFiles', async (event, folderPath, extensions = ['jpg', 'jpeg', 'png', 'webp']) => {
    try {
        console.log('[folder:getFiles] folderPath:', folderPath);
        console.log('[folder:getFiles] extensions:', extensions);
        console.log('[folder:getFiles] ALLOWED_BASE_PATHS:', ALLOWED_BASE_PATHS);
        console.log('[folder:getFiles] resolved:', path.resolve(folderPath));
        console.log('[folder:getFiles] isPathAllowed:', isPathAllowed(folderPath));
        if (!isPathAllowed(folderPath)) {
            console.log('[folder:getFiles] PATH NOT ALLOWED - returning empty');
            return [];
        }
        const files = await fs.promises.readdir(folderPath);
        const imageFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase().slice(1);
                return extensions.includes(ext);
            })
            .map(file => path.join(folderPath, file));
        return imageFiles;
    } catch (error) {
        console.error('Folder read error:', error);
        return [];
    }
});

// ============================================
// HWID/License System for Multi-Tenant SaaS
// ============================================

const { spawn } = require('child_process');

/**
 * Get HWID from Python script
 * Returns hardware identification info for license validation
 */
ipcMain.handle('security:getHwid', async () => {
    return new Promise((resolve, reject) => {
        let pythonScript;
        try {
            const rawScript = path.join(__dirname, '../security/hwid_generator.py');
            const resolvedScript = fs.realpathSync(rawScript);
            const allowedBase = fs.realpathSync(path.join(__dirname, '../security'));
            if (!resolvedScript.startsWith(allowedBase + path.sep) && resolvedScript !== allowedBase) {
                return reject({ error: 'Invalid script path' });
            }
            pythonScript = resolvedScript;
        } catch (pathErr) {
            return reject({ error: 'HWID script not found', details: pathErr.message });
        }

        // Try python3 first, then python
        let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        const python = spawn(pythonCmd, [pythonScript], { timeout: 30000 });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const killTimer = setTimeout(() => {
            timedOut = true;
            try { python.kill('SIGKILL'); } catch { }
        }, 30000);

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', (code) => {
            clearTimeout(killTimer);
            if (timedOut) return reject({ error: 'HWID generation timed out' });
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    reject({ error: 'Failed to parse HWID response', details: stdout });
                }
            } else {
                reject({ error: 'HWID generation failed', code, stderr });
            }
        });

        python.on('error', (err) => {
            clearTimeout(killTimer);
            reject({ error: 'Failed to spawn Python process', details: err.message });
        });
    });
});

/**
 * SECURITY: Real HWID validation - compares local HWID with registered HWID
 */
ipcMain.handle('security:validateLicense', async (event, registeredHwid) => {
    try {
        if (!registeredHwid) {
            return { valid: false, error: 'No registered HWID provided' };
        }
        // Get local HWID by invoking the Python script
        const rawScript = path.join(__dirname, '../security/hwid_generator.py');
        const resolvedScript = fs.realpathSync(rawScript);
        const allowedBase = fs.realpathSync(path.join(__dirname, '../security'));
        if (!resolvedScript.startsWith(allowedBase + path.sep) && resolvedScript !== allowedBase) {
            return { valid: false, error: 'Invalid script path' };
        }
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        const localHwidResult = await new Promise((resolve, reject) => {
            const python = spawn(pythonCmd, [resolvedScript], { timeout: 30000 });
            let stdout = '';
            let timedOut = false;
            const killTimer = setTimeout(() => {
                timedOut = true;
                try { python.kill('SIGKILL'); } catch { }
            }, 30000);
            python.stdout.on('data', (data) => { stdout += data.toString(); });
            python.on('close', (code) => {
                clearTimeout(killTimer);
                if (timedOut) return reject(new Error('HWID generation timed out'));
                if (code === 0) {
                    try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
                } else { reject(new Error('HWID generation failed')); }
            });
            python.on('error', (err) => {
                clearTimeout(killTimer);
                reject(err);
            });
        });

        const isValid = localHwidResult.hwid &&
            localHwidResult.hwid.toUpperCase() === registeredHwid.toUpperCase();
        return { valid: isValid, localHwid: localHwidResult.hwid };
    } catch (error) {
        return { valid: false, error: error.message };
    }
});

/**
 * Get license configuration from local file
 */
ipcMain.handle('security:getLicenseConfig', async () => {
    try {
        return loadLicenseConfig();
    } catch (error) {
        return null;
    }
});

/**
 * Clear license configuration (delete local file)
 */
ipcMain.handle('security:clearLicenseConfig', async () => {
    try {
        const encPath = path.join(app.getPath('userData'), LICENSE_ENC_FILE);
        const legacyPath = path.join(app.getPath('userData'), LICENSE_LEGACY_FILE);
        if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
        if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Save license configuration to local file
 */
ipcMain.handle('security:saveLicenseConfig', async (event, config) => {
    try {
        saveLicenseEncrypted(config);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get system info for HWID device management
 * Returns machine ID, hostname, MAC, IP, and platform info
 */
ipcMain.handle('app:getSystemInfo', async () => {
    try {
        // Get unique machine ID (uses Windows Registry / Linux machine-id)
        const hwid = machineIdSync({ original: true });

        // Get hostname
        const hostname = os.hostname();

        // Get primary network interface MAC and local IP
        let macAddress = null;
        let localIp = null;
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            // Skip loopback and virtual interfaces
            if (name.toLowerCase().includes('loopback') || name === 'lo') continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    if (!localIp) localIp = addr.address;
                    if (!macAddress && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                        macAddress = addr.mac;
                    }
                }
            }
        }

        // Get public/network IP via external service (cached 5 min)
        let publicIp = null;
        if (_publicIpCache.ip && Date.now() - _publicIpCache.ts < PUBLIC_IP_TTL_MS) {
            publicIp = _publicIpCache.ip;
        } else {
            try {
                const https = require('https');
                publicIp = await new Promise((resolve) => {
                    const req = https.get('https://api.ipify.org?format=json', { timeout: 5000 }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(data).ip);
                            } catch { resolve(null); }
                        });
                    });
                    req.on('error', () => resolve(null));
                    req.on('timeout', () => { req.destroy(); resolve(null); });
                });
                if (publicIp) _publicIpCache = { ip: publicIp, ts: Date.now() };
            } catch {
                publicIp = null;
            }
        }

        return {
            hwid,
            hostname,
            macAddress,
            ipAddress: publicIp || localIp, // Primary: public IP for display
            localIp,
            publicIp,
            deviceInfo: {
                platform: os.platform(),
                arch: os.arch(),
                osVersion: os.release()
            }
        };
    } catch (error) {
        console.error('getSystemInfo error:', error);
        return {
            hwid: null,
            hostname: os.hostname(),
            macAddress: null,
            ipAddress: null,
            localIp: null,
            publicIp: null,
            deviceInfo: { platform: os.platform(), arch: os.arch(), osVersion: os.release() },
            error: error.message
        };
    }
});

// ==================== GOOGLE DRIVE IPC ====================

// Store Google Drive tokens
let googleDriveTokens = null;

// SECURITY: Helper to read/write encrypted GDrive tokens
const GDRIVE_TOKEN_FILE = 'gdrive-tokens.enc';
const GDRIVE_TOKEN_FILE_LEGACY = 'gdrive-tokens.json';

function saveGDriveTokens(tokens) {
    const tokenPath = path.join(app.getPath('userData'), GDRIVE_TOKEN_FILE);
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS encryption unavailable; refusing to persist Google Drive tokens in plain text.');
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(tokens));
    fs.writeFileSync(tokenPath, encrypted);
}

function loadGDriveTokens() {
    // Try encrypted file first
    const encPath = path.join(app.getPath('userData'), GDRIVE_TOKEN_FILE);
    const legacyPath = path.join(app.getPath('userData'), GDRIVE_TOKEN_FILE_LEGACY);

    if (fs.existsSync(encPath) && safeStorage.isEncryptionAvailable()) {
        try {
            const encrypted = fs.readFileSync(encPath);
            return JSON.parse(safeStorage.decryptString(encrypted));
        } catch { /* fall through */ }
    }
    // Fallback to legacy plaintext file
    if (fs.existsSync(legacyPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
            // Migrate to encrypted storage; skip migration if encryption unavailable
            try {
                saveGDriveTokens(tokens);
                fs.unlinkSync(legacyPath);
            } catch (migrateErr) {
                console.warn('[GDrive] Could not migrate legacy tokens to encrypted store:', migrateErr.message);
            }
            return tokens;
        } catch { /* fall through */ }
    }
    return null;
}

ipcMain.handle('gdrive:authenticate', async (event, { clientId, clientSecret, scopes }) => {
    try {
        // Open OAuth window for Google authentication
        const authWindow = new BrowserWindow({
            width: 600,
            height: 700,
            parent: mainWindow,
            modal: true,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });

        // SECURITY: Use loopback address for OAuth redirect
        const redirectUri = 'http://127.0.0.1';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&access_type=offline&prompt=consent`;

        authWindow.loadURL(authUrl);

        return new Promise((resolve) => {
            authWindow.webContents.on('will-redirect', async (e, url) => {
                const urlObj = new URL(url);
                const code = urlObj.searchParams.get('code');
                if (code) {
                    authWindow.close();
                    try {
                        // Exchange code for tokens
                        const fetch = (await import('node-fetch')).default;
                        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                code,
                                client_id: clientId,
                                client_secret: clientSecret,
                                redirect_uri: redirectUri,
                                grant_type: 'authorization_code'
                            })
                        });
                        const tokens = await tokenResponse.json();

                        // SECURITY: Save tokens encrypted; refuse to store in plain text
                        try {
                            saveGDriveTokens(tokens);
                        } catch (saveErr) {
                            resolve({ success: false, error: saveErr.message });
                            return;
                        }
                        googleDriveTokens = tokens;

                        resolve({ success: true, token: tokens.access_token, expiry: tokens.expires_in });
                    } catch (err) {
                        resolve({ success: false, error: err.message });
                    }
                }
            });

            authWindow.on('closed', () => {
                resolve({ success: false, error: 'Auth window closed' });
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('gdrive:getStatus', async () => {
    try {
        const tokens = loadGDriveTokens();
        if (tokens) {
            googleDriveTokens = tokens;
            return { connected: !!tokens.access_token };
        }
        return { connected: false };
    } catch {
        return { connected: false };
    }
});

ipcMain.handle('gdrive:createFolder', async (event, { name, parentId }) => {
    if (!googleDriveTokens?.access_token) return { success: false, error: 'Not authenticated' };

    try {
        const fetch = (await import('node-fetch')).default;
        const metadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            ...(parentId && { parents: [parentId] })
        };

        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${googleDriveTokens.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        const data = await response.json();
        return { id: data.id, name: data.name, webViewLink: `https://drive.google.com/drive/folders/${data.id}` };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('gdrive:disconnect', async () => {
    googleDriveTokens = null;
    const encPath = path.join(app.getPath('userData'), GDRIVE_TOKEN_FILE);
    const legacyPath = path.join(app.getPath('userData'), GDRIVE_TOKEN_FILE_LEGACY);
    try { fs.unlinkSync(encPath); } catch { }
    try { fs.unlinkSync(legacyPath); } catch { }
    return { success: true };
});

// ============================================================
// FAZ 1-5 BACKEND ENTEGRASYONU (E5, H2, H3, H4, C3, C4)
// ============================================================

// ===== C3: Impersonation helper =====
// Renderer'a token göndererek signInWithCustomToken çağırmasını sağlar.
// 15 dakika sonra renderer'a auto-signout eventi gönderir.
let _impersonationTimer = null;
function _handleImpersonationToken(token) {
    if (_impersonationTimer) {
        clearTimeout(_impersonationTimer);
        _impersonationTimer = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        // main:impersonationActive — renderer signInWithCustomToken yapacak
        mainWindow.webContents.send('main:impersonationActive', { token });
        // 15 dakika sonra otomatik çıkış
        _impersonationTimer = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('main:impersonationExpired');
            }
            _impersonationTimer = null;
        }, 15 * 60 * 1000);
    } else {
        // mainWindow henüz hazır değil; hazır olunca gönder
        _pendingImpersonationToken = token;
    }
}

// IPC: Renderer, mainWindow yüklenince bekleyen impersonation token'ı ister
// renderer:ready — renderer hazır olduğunda çağırır
ipcMain.handle('renderer:ready', () => {
    if (_pendingImpersonationToken) {
        const token = _pendingImpersonationToken;
        _pendingImpersonationToken = null;
        _handleImpersonationToken(token);
    }
});

// ===== C4: Force logout — renderer Firestore listener'ı kurarak main'e bildirir =====
// renderer:forceLogout — renderer bu kanalı tetikler, main pencereyi kapatır/login'e döner
ipcMain.on('renderer:forceLogout', () => {
    console.log('[C4] Force logout received from renderer.');
    if (mainWindow && !mainWindow.isDestroyed()) {
        // Renderer zaten Firebase signOut yapmış; login ekranına yönlendir
        mainWindow.webContents.send('main:navigateToLogin');
    }
});

// ===== H4: Update config — renderer callable sonucunu iletir =====
// renderer:updateConfig — { feedUrl, channel, minVersion, forceUpdate }
ipcMain.on('renderer:updateConfig', (_event, config) => {
    try {
        console.log('[H4] Update config received:', config);
        if (config.feedUrl && config.feedUrl !== _resolvedFeedUrl) {
            _resolvedFeedUrl = config.feedUrl;
            try {
                autoUpdater.setFeedURL({ url: config.feedUrl });
                if (config.channel) autoUpdater.channel = config.channel;
                console.log('[H4] autoUpdater feed updated:', config.feedUrl);
            } catch (e) {
                console.error('[H4] autoUpdater setFeedURL error:', e.message);
            }
        }
        // forceUpdate kontrolü: minVersion ile karşılaştır
        if (config.forceUpdate && config.minVersion) {
            const current = app.getVersion();
            if (_versionLessThan(current, config.minVersion)) {
                console.warn('[H4] Force update required. current:', current, 'min:', config.minVersion);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // main:forceUpdateRequired — renderer modal gösterecek
                    mainWindow.webContents.send('main:forceUpdateRequired', {
                        currentVersion: current,
                        minVersion: config.minVersion
                    });
                }
            }
        }
    } catch (e) {
        console.error('[H4] updateConfig handler error:', e.message);
    }
});

// Semver karşılaştırıcı: a < b ise true
function _versionLessThan(a, b) {
    try {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na < nb) return true;
            if (na > nb) return false;
        }
        return false;
    } catch { return false; }
}

// ===== H2: Remote log upload — renderer talep gelince log dosyasını PUT eder =====
// renderer:uploadLogs — { requestId, uploadUrl }
ipcMain.handle('renderer:uploadLogs', async (_event, { requestId, uploadUrl }) => {
    try {
        if (!requestId || !uploadUrl) throw new Error('Missing requestId or uploadUrl');

        // Log dosyasını bul (electron-log veya app userData)
        const logDir = app.getPath('userData');
        const logFile = path.join(logDir, 'logs', 'main.log');
        const fallbackLog = path.join(logDir, 'main.log');

        let logContent = '';
        const targetLog = fs.existsSync(logFile) ? logFile : (fs.existsSync(fallbackLog) ? fallbackLog : null);

        if (targetLog) {
            // Son ~1MB oku
            const stat = fs.statSync(targetLog);
            const readSize = Math.min(stat.size, 1024 * 1024);
            const fd = fs.openSync(targetLog, 'r');
            const buf = Buffer.alloc(readSize);
            fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
            fs.closeSync(fd);
            logContent = buf.toString('utf8');
        } else {
            logContent = '[H2] No log file found at userData/logs/main.log';
        }

        // PUT ile upload et
        const https = require('https');
        const http = require('http');
        await new Promise((resolve, reject) => {
            const urlObj = new URL(uploadUrl);
            const lib = urlObj.protocol === 'https:' ? https : http;
            const bodyBuf = Buffer.from(logContent, 'utf8');
            const req = lib.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'PUT',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': bodyBuf.length,
                },
            }, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve();
                else reject(new Error(`Upload HTTP ${res.statusCode}`));
                res.resume();
            });
            req.on('error', reject);
            req.write(bodyBuf);
            req.end();
        });

        console.log('[H2] Log upload success, requestId:', requestId);
        return { success: true };
    } catch (error) {
        console.error('[H2] Log upload failed:', error.message);
        return { success: false, error: error.message };
    }
});

// ===== E5: Heartbeat — renderer auth state'i main'e bildirir =====
// renderer:userSession — { uid, studioId } veya null (logout)
ipcMain.on('renderer:userSession', (_event, session) => {
    // Bilgi amaçlı; heartbeat renderer tarafında callable ile çağrılır.
    // main sadece session'ı loglar (gerekirse gelecekte tray menüsünde kullanılabilir).
    if (session && session.uid) {
        console.log('[E5] User session active, studioId:', session.studioId || '(none)');
    } else {
        console.log('[E5] User session cleared.');
    }
});

// ===== H3: Feature flags — renderer localStorage'a yazar =====
// flags:refresh çağrısı renderer'a dönük sinyal; asıl Firebase callable renderer yapar.
ipcMain.handle('flags:refresh', () => {
    // Renderer kendi callable'ını çağırır; burada sadece ACK döner.
    return { ack: true };
});

// ===== C3: Impersonation — CLI argümanından ilk başlatmada token oku =====
// app.whenReady() içinde değil, burada (isPhotoSelectorMode false iken) kontrol et
app.once('ready', () => {
    const tokenArg = process.argv.find(a => a.startsWith('--impersonation-token='));
    if (tokenArg && !isPhotoSelectorMode) {
        const token = tokenArg.split('=').slice(1).join('=');
        // mainWindow henüz oluşmamış olabilir, _pendingImpersonationToken ile sakla
        _pendingImpersonationToken = token;
        console.log('[C3] Impersonation token found in CLI args, will deliver after renderer:ready.');
    }
});
