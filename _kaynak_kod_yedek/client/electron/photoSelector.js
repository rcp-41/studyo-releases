const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let photoSelectorWindow = null;

function createPhotoSelectorWindow(mainWindow, config, isDev) {
    if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
        photoSelectorWindow.focus();
        return photoSelectorWindow;
    }

    const displays = screen.getAllDisplays();
    const targetDisplay = config.preferredMonitor
        ? (displays[config.preferredMonitor] || displays[0])
        : screen.getPrimaryDisplay();

    const { x, y, width: sw, height: sh } = targetDisplay.workArea;

    const windowOptions = {
        width: Math.min(1600, sw),
        height: Math.min(1000, sh),
        minWidth: 1024,
        minHeight: 700,
        x: x + Math.floor((sw - Math.min(1600, sw)) / 2),
        y: y + Math.floor((sh - Math.min(1000, sh)) / 2),
        modal: false,
        frame: true,
        autoHideMenuBar: true,
        title: `Fotoğraf Seçim — ${config.archiveNo || 'Bağımsız'}`,
        icon: path.join(__dirname, '../public/icon.png'),
        backgroundColor: '#171717',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Allow file:// protocol for local thumbnails/images
        },
        show: false
    };

    // Only set parent if mainWindow is provided (not standalone mode)
    if (mainWindow && !mainWindow.isDestroyed()) {
        windowOptions.parent = mainWindow;
    }

    photoSelectorWindow = new BrowserWindow(windowOptions);

    const params = new URLSearchParams();
    if (config.archiveId) params.set('archiveId', config.archiveId);
    if (config.archiveNo) params.set('archiveNo', config.archiveNo);
    if (config.folderPath) params.set('folderPath', config.folderPath);
    if (config.shootType) params.set('shootType', config.shootType);
    if (config.shootCategory) params.set('shootCategory', config.shootCategory);
    if (config.customerName) params.set('customerName', config.customerName);

    const query = params.toString() ? `?${params.toString()}` : '';

    if (isDev) {
        photoSelectorWindow.loadURL(`http://localhost:5173/photo-selector.html${query}`);
    } else {
        photoSelectorWindow.loadFile(
            path.join(__dirname, '../dist/photo-selector.html'),
            { search: query }
        );
    }

    photoSelectorWindow.once('ready-to-show', () => photoSelectorWindow.show());

    photoSelectorWindow.on('closed', () => {
        photoSelectorWindow = null;
        // In standalone mode, quit the app when the window is closed
        if (!mainWindow || mainWindow.isDestroyed()) {
            app.quit();
        }
    });

    return photoSelectorWindow;
}

function sanitizeFileName(name) {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        .replace(/\.+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
}

function registerPhotoSelectorIPC(mainWindow, isPathAllowed, isDev, allowedBasePaths) {
    // Open photo selector window
    ipcMain.handle('photo-selector:open', async (_event, config) => {
        if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
            photoSelectorWindow.focus();
            return { success: true, alreadyOpen: true };
        }
        try {
            // Dynamically add folderPath to allowed base paths for file operations
            if (config.folderPath && allowedBasePaths) {
                const resolved = path.resolve(config.folderPath);
                if (!allowedBasePaths.includes(resolved)) {
                    allowedBasePaths.push(resolved);
                    console.log('[PhotoSelector] Added to ALLOWED_BASE_PATHS:', resolved);
                }
            }
            createPhotoSelectorWindow(mainWindow, config, isDev);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Confirm close from renderer
    ipcMain.handle('photo-selector:confirm-close', async () => {
        if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
            photoSelectorWindow.destroy();
            photoSelectorWindow = null;
        }
        return { success: true };
    });

    // Send result back to main window
    ipcMain.handle('photo-selector:sendResult', async (_event, result) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('photo-selector:result', result);
        }
        return { success: true };
    });

    // Get display list for multi-monitor
    ipcMain.handle('screen:getDisplays', async () => {
        return screen.getAllDisplays().map((d, i) => ({
            index: i,
            label: `Monitör ${i + 1} (${d.size.width}x${d.size.height})`,
            isPrimary: d.id === screen.getPrimaryDisplay().id,
            bounds: d.workArea,
        }));
    });

    // Thumbnail generation
    ipcMain.handle('photos:generateThumbnails', async (event, { folderPath, size = 300 }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };

        let sharp;
        try {
            sharp = require('sharp');
        } catch {
            return { success: false, error: 'Sharp modülü yüklenemedi' };
        }

        const thumbDir = path.join(folderPath, '.thumbnails');
        if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

        // Hide .thumbnails on Windows
        if (process.platform === 'win32') {
            try {
                require('child_process').execSync(`attrib +h "${thumbDir}"`, { stdio: 'ignore' });
            } catch { }
        }

        const extensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp',
            '.cr2', '.nef', '.arw', '.dng'];
        let files;
        try {
            files = fs.readdirSync(folderPath).filter(f => {
                const ext = path.extname(f).toLowerCase();
                return extensions.includes(ext) && !f.startsWith('.');
            });
        } catch (error) {
            return { success: false, error: error.message };
        }

        let generated = 0, skipped = 0;
        const failed = [];
        const sender = event.sender;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const inputPath = path.join(folderPath, file);
            const thumbName = path.parse(file).name + '.jpg';
            const outputPath = path.join(thumbDir, thumbName);

            // Skip if thumbnail exists and source hasn't changed
            if (fs.existsSync(outputPath)) {
                try {
                    const srcStat = fs.statSync(inputPath);
                    const thumbStat = fs.statSync(outputPath);
                    if (thumbStat.mtimeMs > srcStat.mtimeMs) {
                        skipped++;
                        if (!sender.isDestroyed()) {
                            sender.send('photos:thumbnail-progress',
                                { done: i + 1, total: files.length, current: file });
                        }
                        continue;
                    }
                } catch { }
            }

            try {
                await sharp(inputPath)
                    .rotate()
                    .resize(size, null, { withoutEnlargement: true })
                    .jpeg({ quality: 80, progressive: true })
                    .toFile(outputPath);
                generated++;
            } catch (err) {
                failed.push(file);
                console.error(`Thumbnail failed for ${file}:`, err.message);
            }

            if (!sender.isDestroyed()) {
                sender.send('photos:thumbnail-progress',
                    { done: i + 1, total: files.length, current: file });
            }
        }

        return { success: true, data: { generated, skipped, failed, thumbnailDir: thumbDir } };
    });

    // Read EXIF
    ipcMain.handle('photos:readExif', async (_event, { filePath }) => {
        if (!isPathAllowed(filePath)) return { success: false, error: 'Path not allowed' };

        let sharp;
        try {
            sharp = require('sharp');
        } catch {
            return { success: false, error: 'Sharp modülü yüklenemedi' };
        }

        try {
            const metadata = await sharp(filePath).metadata();
            return {
                success: true,
                data: {
                    width: metadata.width,
                    height: metadata.height,
                    orientation: metadata.orientation,
                    format: metadata.format,
                    space: metadata.space,
                    density: metadata.density,
                    size: metadata.size,
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Rename file
    ipcMain.handle('photos:renameFile', async (_event, { oldPath, newPath }) => {
        try {
            if (!isPathAllowed(oldPath) || !isPathAllowed(newPath)) {
                return { success: false, error: 'Path not allowed' };
            }
            if (path.dirname(path.resolve(oldPath)) !== path.dirname(path.resolve(newPath))) {
                return { success: false, error: 'Cross-directory rename not allowed' };
            }
            const baseName = path.basename(newPath);
            const ext = path.extname(newPath);
            const nameWithoutExt = baseName.slice(0, -ext.length);
            if (nameWithoutExt !== sanitizeFileName(nameWithoutExt)) {
                return { success: false, error: 'Invalid characters in file name' };
            }
            await fs.promises.rename(oldPath, newPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Batch rename
    ipcMain.handle('photos:batchRename', async (_event, { operations }) => {
        const results = [];
        const completed = [];

        for (const op of operations) {
            try {
                if (!isPathAllowed(op.oldPath) || !isPathAllowed(op.newPath)) {
                    results.push({ ...op, success: false, error: 'Path not allowed' });
                    continue;
                }
                if (path.dirname(path.resolve(op.oldPath)) !== path.dirname(path.resolve(op.newPath))) {
                    results.push({ ...op, success: false, error: 'Cross-directory rename not allowed' });
                    continue;
                }
                await fs.promises.rename(op.oldPath, op.newPath);
                completed.push(op);
                results.push({ ...op, success: true });
            } catch (error) {
                // Rollback completed renames
                for (const done of completed.reverse()) {
                    try {
                        await fs.promises.rename(done.newPath, done.oldPath);
                    } catch { }
                }
                return {
                    success: false,
                    error: `Rename failed at ${op.oldPath}: ${error.message}`,
                    results
                };
            }
        }

        return { success: true, results };
    });

    // Read .ini file
    ipcMain.handle('photos:readIniFile', async (_event, { folderPath }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };

        const iniPath = path.join(folderPath, '.studyo_meta.ini');
        if (!fs.existsSync(iniPath)) return { success: true, data: null };

        try {
            const content = fs.readFileSync(iniPath, 'utf-8');
            // Simple INI parser
            const data = parseIni(content);
            return { success: true, data };
        } catch (error) {
            // Backup corrupt file
            try {
                const bakPath = iniPath + '.bak';
                fs.copyFileSync(iniPath, bakPath);
            } catch { }
            return { success: false, error: error.message };
        }
    });

    // Write .ini file
    ipcMain.handle('photos:writeIniFile', async (_event, { folderPath, data }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };

        const iniPath = path.join(folderPath, '.studyo_meta.ini');
        try {
            const content = stringifyIni(data);
            fs.writeFileSync(iniPath, content, 'utf-8');

            // Hide .ini on Windows
            if (process.platform === 'win32') {
                try {
                    require('child_process').execSync(`attrib +h "${iniPath}"`, { stdio: 'ignore' });
                } catch { }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Create notes file
    ipcMain.handle('photos:createNotesFile', async (_event, { folderPath, archiveNo, notes }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };

        try {
            const fileName = `${archiveNo} not.txt`;
            const filePath = path.join(folderPath, fileName);
            const content = notes.map(n => `${n.orderNumber}: ${n.text}`).join('\n');
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Select folder dialog (for Photo Selector standalone)
    ipcMain.handle('photos:selectFolder', async () => {
        const result = await dialog.showOpenDialog(
            BrowserWindow.getFocusedWindow() || photoSelectorWindow,
            {
                properties: ['openDirectory'],
                title: 'Fotoğraf Klasörü Seçin',
            }
        );
        if (result.canceled || result.filePaths.length === 0) return null;
        const selected = result.filePaths[0];
        // Ensure the folder is allowed for file operations
        if (allowedBasePaths && !allowedBasePaths.includes(path.resolve(selected))) {
            allowedBasePaths.push(path.resolve(selected));
        }
        return selected;
    });

    // ==================== FACE RECOGNITION IPC ====================
    // All face-api / canvas work happens in the main process (Node environment).

    let faceApiLoaded = false;
    let faceapi = null;
    let canvas = null;

    async function ensureFaceApi() {
        if (faceApiLoaded) return true;
        try {
            const faceApiModule = require('@vladmandic/face-api');
            faceapi = faceApiModule.default || faceApiModule;
            const canvasModule = require('canvas');
            canvas = canvasModule;
            // Patch face-api to use node-canvas
            const { Canvas, Image, ImageData } = canvasModule;
            faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
            faceApiLoaded = true;
            return true;
        } catch (err) {
            console.error('[FaceAPI] Could not load face-api or canvas:', err.message);
            return false;
        }
    }

    // Load face-api models from the given directory
    ipcMain.handle('faceRecognition:loadModels', async (_event, { modelsPath }) => {
        try {
            const ok = await ensureFaceApi();
            if (!ok) return { success: false, error: 'face-api or canvas not available' };

            const resolvedModels = path.resolve(modelsPath || path.join(__dirname, '../models'));
            if (!fs.existsSync(resolvedModels)) {
                return { success: false, error: `Models directory not found: ${resolvedModels}` };
            }

            await faceapi.nets.ssdMobilenetv1.loadFromDisk(resolvedModels);
            await faceapi.nets.faceLandmark68Net.loadFromDisk(resolvedModels);
            await faceapi.nets.faceRecognitionNet.loadFromDisk(resolvedModels);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Get face descriptor from an image file
    ipcMain.handle('faceRecognition:getDescriptor', async (_event, { filePath }) => {
        try {
            if (!isPathAllowed(filePath)) return { success: false, error: 'Path not allowed' };
            const ok = await ensureFaceApi();
            if (!ok) return { success: false, error: 'face-api not available' };
            if (!faceApiLoaded) return { success: false, error: 'Models not loaded. Call loadModels first.' };

            const img = await canvas.loadImage(filePath);
            const detection = await faceapi
                .detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) return { success: true, descriptor: null };
            return { success: true, descriptor: Array.from(detection.descriptor) };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Find matching photos from a list by comparing descriptors to a reference descriptor
    ipcMain.handle('faceRecognition:findMatches', async (_event, { referenceDescriptor, filePaths, threshold = 0.5 }) => {
        try {
            const ok = await ensureFaceApi();
            if (!ok) return { success: false, error: 'face-api not available' };

            const refDesc = new Float32Array(referenceDescriptor);
            const matches = [];

            for (const filePath of filePaths) {
                if (!isPathAllowed(filePath)) continue;
                try {
                    const img = await canvas.loadImage(filePath);
                    const detection = await faceapi
                        .detectSingleFace(img)
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (!detection) continue;

                    const distance = faceapi.euclideanDistance(refDesc, detection.descriptor);
                    if (distance <= threshold) {
                        matches.push({ filePath, distance });
                    }
                } catch {
                    // Skip unreadable files
                }
            }

            matches.sort((a, b) => a.distance - b.distance);
            return { success: true, matches };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Get image as base64 (for preview loading)
    ipcMain.handle('photos:getImageAsBase64', async (_event, { filePath, maxWidth }) => {
        if (!isPathAllowed(filePath)) return { success: false, error: 'Path not allowed' };

        let sharp;
        try {
            sharp = require('sharp');
        } catch {
            // Fallback: read raw file
            try {
                const buffer = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase().slice(1);
                const mime = ext === 'jpg' ? 'jpeg' : ext;
                return {
                    success: true,
                    data: {
                        base64: `data:image/${mime};base64,${buffer.toString('base64')}`,
                        format: ext,
                    }
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        try {
            let pipeline = sharp(filePath).rotate();
            if (maxWidth) {
                pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
            }
            const { data: buf, info } = await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
            return {
                success: true,
                data: {
                    base64: `data:image/jpeg;base64,${buf.toString('base64')}`,
                    width: info.width,
                    height: info.height,
                    format: 'jpeg',
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// Simple INI parser (no external dependency needed)
function parseIni(content) {
    const result = {};
    let currentSection = '';

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

        const sectionMatch = trimmed.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            if (!result[currentSection]) result[currentSection] = {};
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            if (currentSection) {
                result[currentSection][key] = value;
            } else {
                result[key] = value;
            }
        }
    }

    return result;
}

function stringifyIni(data) {
    const lines = [];

    for (const [section, values] of Object.entries(data)) {
        if (typeof values === 'object' && values !== null) {
            lines.push(`[${section}]`);
            for (const [key, value] of Object.entries(values)) {
                lines.push(`${key}=${value}`);
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}

module.exports = { registerPhotoSelectorIPC, createPhotoSelectorWindow };
