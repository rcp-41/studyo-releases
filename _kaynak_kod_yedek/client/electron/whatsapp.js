const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');

let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, Boom;

let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected'; // disconnected | qr_ready | connected

// SECURITY NOTE: WhatsApp session credentials are stored by Baileys library
// in the auth directory below. These files contain sensitive authentication data.
// The directory is within the app's userData folder which has OS-level user permissions.
// Full encryption of these files would require Baileys library modifications.
const AUTH_DIR = path.join(app.getPath('userData'), 'whatsapp-auth');

async function loadDependencies() {
    if (makeWASocket) return;
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    Browsers = baileys.Browsers;

    const boomMod = await import('@hapi/boom');
    Boom = boomMod.Boom;
}

async function initWhatsApp(mainWindow) {
    try {
        await loadDependencies();
        // Ensure auth directory exists
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.windows('Desktop'),
            generateHighQualityLinkPreview: false,
        });

        // Connection update handler
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCode = qr;
                connectionStatus = 'qr_ready';
                mainWindow?.webContents?.send('whatsapp:qr', qr);
                mainWindow?.webContents?.send('whatsapp:status', 'qr_ready');
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                connectionStatus = 'disconnected';
                qrCode = null;
                mainWindow?.webContents?.send('whatsapp:status', 'disconnected');

                // Reconnect unless logged out
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(() => initWhatsApp(mainWindow), 3000);
                }
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                qrCode = null;
                mainWindow?.webContents?.send('whatsapp:status', 'connected');
                console.log('WhatsApp connected!');
            }
        });

        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('WhatsApp init error:', error);
        connectionStatus = 'disconnected';
    }
}

async function sendMessage(phone, text) {
    if (!sock || connectionStatus !== 'connected') {
        throw new Error('WhatsApp bağlı değil');
    }

    // Normalize phone: 05XX -> 905XX
    let jid = phone.replace(/\D/g, '');
    if (jid.startsWith('0')) {
        jid = '90' + jid.substring(1);
    }
    if (!jid.includes('@')) {
        jid = jid + '@s.whatsapp.net';
    }

    await sock.sendMessage(jid, { text });
    return { success: true };
}

function getStatus() {
    return { status: connectionStatus };
}

function getQr() {
    return { qr: qrCode };
}

async function logout() {
    try {
        if (sock) {
            await sock.logout();
            sock = null;
        }
        // Remove auth files
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        connectionStatus = 'disconnected';
        qrCode = null;
        return { success: true };
    } catch (error) {
        console.error('WhatsApp logout error:', error);
        return { success: false, error: error.message };
    }
}

function openWhatsAppChat(phoneNumber) {
    const { shell } = require('electron');
    let intlPhone = phoneNumber.replace(/\D/g, '');
    if (intlPhone.startsWith('0')) {
        intlPhone = '90' + intlPhone.substring(1);
    }
    shell.openExternal(`whatsapp://send?phone=${intlPhone}`);
}

// Register IPC handlers
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
