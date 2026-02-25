/**
 * WhatsApp Web Integration via Hidden BrowserWindow
 * 
 * Uses a persistent Electron BrowserWindow to run web.whatsapp.com.
 * Captures QR code from the page and sends it to the frontend for inline display.
 * No Baileys dependency — uses official WhatsApp Web client.
 * 
 * States: disconnected → qr_ready → connected
 */

const { BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');

let waWindow = null;
let connectionStatus = 'disconnected'; // disconnected | qr_ready | connected
let qrDataUrl = null;
let mainWindowRef = null;
let statusCheckInterval = null;

const WA_PARTITION = 'persist:whatsapp';
const WA_URL = 'https://web.whatsapp.com';

// Modern Chrome user agent — prevents "Update Chrome" warning
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Initialize the hidden WhatsApp Web window
 */
function initWhatsApp(mainWindow) {
    mainWindowRef = mainWindow;

    if (waWindow && !waWindow.isDestroyed()) {
        console.log('[WhatsApp] Window already exists, status:', connectionStatus);
        checkConnectionStatus();
        return { status: connectionStatus };
    }

    console.log('[WhatsApp] Creating hidden WhatsApp Web window...');

    // Set user agent on the session level to prevent "update Chrome" warning
    const ses = session.fromPartition(WA_PARTITION);
    ses.setUserAgent(CHROME_UA);

    waWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,  // Always hidden — QR is shown inline in Settings
        title: 'WhatsApp Web',
        webPreferences: {
            partition: WA_PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    // Prevent window from being closed — just hide
    waWindow.on('close', (e) => {
        if (waWindow && !waWindow.isDestroyed()) {
            e.preventDefault();
            waWindow.hide();
        }
    });

    waWindow.on('closed', () => {
        waWindow = null;
        connectionStatus = 'disconnected';
        qrDataUrl = null;
        if (statusCheckInterval) clearInterval(statusCheckInterval);
    });

    // Override user agent for all requests from this window
    waWindow.webContents.setUserAgent(CHROME_UA);

    waWindow.loadURL(WA_URL);

    waWindow.webContents.on('did-finish-load', () => {
        console.log('[WhatsApp] Page loaded, starting status monitoring...');
        // Inject user agent override into page context
        waWindow.webContents.executeJavaScript(`
            Object.defineProperty(navigator, 'userAgent', {
                get: () => '${CHROME_UA}'
            });
        `).catch(() => { });
        startStatusMonitoring();
    });

    waWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[WhatsApp] Page load failed:', errorCode, errorDescription);
        connectionStatus = 'disconnected';
        notifyRenderer();
    });

    return { status: 'initializing' };
}

/**
 * Start periodic status monitoring
 */
function startStatusMonitoring() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);

    // Check every 1.5s for faster QR capture
    statusCheckInterval = setInterval(() => {
        checkConnectionStatus();
    }, 1500);

    // Check immediately
    setTimeout(() => checkConnectionStatus(), 500);
}

/**
 * Check WhatsApp Web state via DOM injection
 */
async function checkConnectionStatus() {
    if (!waWindow || waWindow.isDestroyed()) {
        connectionStatus = 'disconnected';
        return;
    }

    try {
        const result = await waWindow.webContents.executeJavaScript(`
            (function() {
                // Check if connected (chat list visible)
                const chatList = document.querySelector('#pane-side')
                    || document.querySelector('[data-testid="chat-list"]')
                    || document.querySelector('[aria-label="Sohbet listesi"]')
                    || document.querySelector('[aria-label="Chat list"]');
                
                if (chatList) {
                    return { state: 'connected' };
                }

                // Check for "Update Chrome" or error messages
                const pageText = document.body?.innerText || '';
                if ((pageText.includes('update') && pageText.includes('Chrome')) ||
                    pageText.includes('tarayıcınızı güncelleyin')) {
                    return { state: 'chrome_warning', text: pageText.substring(0, 200) };
                }

                // Try to capture QR code from canvas
                const canvases = document.querySelectorAll('canvas');
                for (const canvas of canvases) {
                    if (canvas.width > 100 && canvas.height > 100) {
                        try {
                            const dataUrl = canvas.toDataURL('image/png');
                            if (dataUrl && dataUrl.length > 100) {
                                return { state: 'qr_ready', qr: dataUrl };
                            }
                        } catch(e) {}
                    }
                }

                // Also check for QR via data-ref attribute (WhatsApp's QR container)
                const qrContainer = document.querySelector('[data-ref]');
                if (qrContainer) {
                    const innerCanvas = qrContainer.querySelector('canvas');
                    if (innerCanvas) {
                        try {
                            const dataUrl = innerCanvas.toDataURL('image/png');
                            if (dataUrl && dataUrl.length > 100) {
                                return { state: 'qr_ready', qr: dataUrl };
                            }
                        } catch(e) {}
                    }
                }

                // Check for loading spinners or splash
                const loading = document.querySelector('[data-testid="intro-md-beta-message"]')
                    || document.querySelector('.landing-main')
                    || document.querySelector('progress');

                if (loading) {
                    return { state: 'loading' };
                }

                return { state: 'unknown' };
            })();
        `);

        const prevStatus = connectionStatus;

        if (result.state === 'connected') {
            connectionStatus = 'connected';
            qrDataUrl = null;
            if (prevStatus !== 'connected') {
                console.log('[WhatsApp] Connected!');
            }
        } else if (result.state === 'qr_ready' && result.qr) {
            connectionStatus = 'qr_ready';
            qrDataUrl = result.qr;
            if (prevStatus !== 'qr_ready') {
                console.log('[WhatsApp] QR code captured');
            }
        } else if (result.state === 'chrome_warning') {
            console.log('[WhatsApp] Chrome warning detected, reloading with new UA...');
            // Force reload with correct user agent
            waWindow.webContents.setUserAgent(CHROME_UA);
            waWindow.loadURL(WA_URL);
            return;
        } else if (result.state === 'loading') {
            // Keep checking
        }

        notifyRenderer();

    } catch (err) {
        // Page navigating, ignore
    }
}

/**
 * Notify renderer process of status changes
 */
function notifyRenderer() {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp:status', connectionStatus);
        if (connectionStatus === 'qr_ready' && qrDataUrl) {
            mainWindowRef.webContents.send('whatsapp:qr', qrDataUrl);
        }
    }
}

/**
 * Get current status
 */
function getStatus() {
    return { status: connectionStatus };
}

/**
 * Get QR code as data URL
 */
function getQr() {
    return { qr: qrDataUrl };
}

/**
 * Send a WhatsApp message using a TEMPORARY window.
 * The main window is never disrupted — a fresh hidden window
 * opens with the same session, loads the /send URL, clicks send, then closes.
 */
async function sendMessage(phone, text) {
    if (connectionStatus !== 'connected') {
        throw new Error('WhatsApp bağlı değil');
    }

    // Phone number formatting:
    // +905325323232 → 905325323232 (international, use as-is)
    // 05325323232   → 905325323232 (local with leading 0)
    // 5325323232    → 905325323232 (local without leading 0, 10 digits)
    // +1234567890   → 1234567890   (foreign number, use as-is)
    let intlPhone;
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
        // International format — strip + and non-digits, use as-is
        intlPhone = trimmed.substring(1).replace(/\D/g, '');
    } else {
        // Local format — strip non-digits and add Turkey code
        intlPhone = trimmed.replace(/\D/g, '');
        if (intlPhone.startsWith('0')) {
            intlPhone = '90' + intlPhone.substring(1);
        } else if (intlPhone.length === 10) {
            // 10-digit Turkish mobile (5XXXXXXXXX)
            intlPhone = '90' + intlPhone;
        }
    }

    const encodedText = encodeURIComponent(text);
    const sendUrl = `${WA_URL}/send?phone=${intlPhone}&text=${encodedText}`;

    console.log('[WhatsApp] Sending message to:', intlPhone);

    // Create a temporary hidden window with the same session
    const tempWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            partition: WA_PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    tempWindow.webContents.setUserAgent(CHROME_UA);

    try {
        // Load the send URL in the temp window
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(); // Don't reject — SPA might not fire did-finish-load
            }, 10000);
            tempWindow.webContents.once('did-finish-load', () => {
                clearTimeout(timeout);
                resolve();
            });
            tempWindow.loadURL(sendUrl);
        });

        // Extra wait for WhatsApp SPA to render the chat
        await new Promise(r => setTimeout(r, 4000));

        // Try to find and click the send button with retries
        let sent = false;
        const MAX_RETRIES = 20;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const result = await tempWindow.webContents.executeJavaScript(`
                (function() {
                    // Dismiss any popups
                    const popupOk = document.querySelector('[data-testid="popup-controls-ok"]');
                    if (popupOk) {
                        popupOk.click();
                        return { state: 'popup_dismissed' };
                    }

                    // Find send button
                    const sendBtn = document.querySelector('[data-testid="compose-btn-send"]')
                        || document.querySelector('button[aria-label="Send"]')
                        || document.querySelector('button[aria-label="Gönder"]')
                        || document.querySelector('span[data-icon="send"]')?.closest('button')
                        || document.querySelector('span[data-icon="send"]')?.parentElement;

                    if (sendBtn) {
                        sendBtn.click();
                        return { state: 'clicked' };
                    }

                    // If input exists, try Enter key
                    const input = document.querySelector('[data-testid="conversation-compose-box-input"]')
                        || document.querySelector('div[contenteditable="true"][data-tab="10"]')
                        || document.querySelector('footer div[contenteditable="true"]');

                    if (input && input.textContent.trim().length > 0) {
                        input.focus();
                        document.execCommand('selectAll', false, null);
                        // Fire Enter via the document level for better compatibility
                        const enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                            bubbles: true, cancelable: true
                        });
                        input.dispatchEvent(enterEvent);
                        return { state: 'enter' };
                    }

                    return { state: 'waiting' };
                })();
            `);

            console.log('[WhatsApp] Send attempt', attempt + 1, ':', result.state);

            if (result.state === 'clicked' || result.state === 'enter') {
                sent = true;
                // Wait for message to actually be sent before closing
                await new Promise(r => setTimeout(r, 2000));
                break;
            }

            await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(1.3, attempt), 4000)));
        }

        // Close temp window
        tempWindow.removeAllListeners('close');
        tempWindow.destroy();

        if (!sent) {
            throw new Error('Gönder butonu bulunamadı');
        }

        console.log('[WhatsApp] Message sent successfully');
        return { success: true };

    } catch (err) {
        console.error('[WhatsApp] Send failed:', err);
        try { tempWindow.removeAllListeners('close'); tempWindow.destroy(); } catch (_) { }
        throw err;
    }
}

/**
 * Open WhatsApp chat externally
 */
function openWhatsAppChat(phoneNumber) {
    let intlPhone = phoneNumber.replace(/\D/g, '');
    if (intlPhone.startsWith('0')) intlPhone = '90' + intlPhone.substring(1);
    shell.openExternal(`https://wa.me/${intlPhone}`);
}

/**
 * Logout — clear session
 */
async function logout() {
    try {
        if (waWindow && !waWindow.isDestroyed()) {
            const ses = session.fromPartition(WA_PARTITION);
            await ses.clearStorageData();
            await ses.clearCache();
            waWindow.loadURL(WA_URL);
        }
        connectionStatus = 'disconnected';
        qrDataUrl = null;
        return { success: true };
    } catch (error) {
        console.error('[WhatsApp] Logout error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Register all IPC handlers
 */
function registerWhatsAppIPC(mainWindow) {
    ipcMain.handle('whatsapp:init', () => initWhatsApp(mainWindow));
    ipcMain.handle('whatsapp:getStatus', () => getStatus());
    ipcMain.handle('whatsapp:getQr', () => getQr());
    ipcMain.handle('whatsapp:send', async (_event, phone, text) => sendMessage(phone, text));
    ipcMain.handle('whatsapp:logout', () => logout());
    ipcMain.handle('whatsapp:openChat', (_event, phone) => openWhatsAppChat(phone));
}

module.exports = {
    initWhatsApp,
    sendMessage,
    getStatus,
    getQr,
    logout,
    openWhatsAppChat,
    registerWhatsAppIPC
};
