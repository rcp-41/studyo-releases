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

// Firebase Hosting URL for production (Stealth Mode)
const FIREBASE_HOSTING_URL = process.env.FIREBASE_HOSTING_URL || 'https://studyo-live-2026.web.app';

// SECURITY: Allowed base paths for file operations (populated after app.ready)
const ALLOWED_BASE_PATHS = [];

// G5: License config encryption using safeStorage
const LICENSE_ENC_FILE = 'license.enc';
const LICENSE_LEGACY_FILE = 'license.json';

function saveLicenseEncrypted(config) {
    const jsonStr = JSON.stringify(config, null, 2);
    const encPath = path.join(app.getPath('userData'), LICENSE_ENC_FILE);
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(jsonStr);
        fs.writeFileSync(encPath, encrypted);
    } else {
        // Fallback to plain JSON if OS encryption unavailable
        const legacyPath = path.join(app.getPath('userData'), LICENSE_LEGACY_FILE);
        fs.writeFileSync(legacyPath, jsonStr);
    }
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
    // Fallback to legacy plaintext
    if (fs.existsSync(legacyPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
            // Migrate to encrypted storage
            saveLicenseEncrypted(config);
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

// SECURITY: Shell open external with protocol whitelist
ipcMain.handle('shell:openExternal', async (_event, url) => {
    try {
        const parsed = new URL(url);
        const allowedProtocols = ['https:', 'http:', 'mailto:', 'whatsapp:'];
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

        // Get public/network IP via external service
        let publicIp = null;
        try {
            const https = require('https');
            publicIp = await new Promise((resolve, reject) => {
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
        } catch {
            publicIp = null;
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
