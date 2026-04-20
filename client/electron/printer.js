const { BrowserWindow, ipcMain } = require('electron');

function registerPrinterIPC() {
    ipcMain.handle('print:getPrinters', async () => {
        try {
            const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents);
            if (!win) return { success: false, printers: [], error: 'no active window' };
            const printers = await win.webContents.getPrintersAsync();
            return { success: true, printers };
        } catch (err) {
            console.error('[Printer] getPrinters failed:', err);
            return { success: false, printers: [], error: err.message };
        }
    });

    ipcMain.handle('print:html', async (_event, params = {}) => {
        const { html, deviceName, pageSize, copies = 1, silent = true } = params;
        if (!html || typeof html !== 'string') {
            return { success: false, failureReason: 'html parameter is required' };
        }
        let printWindow = null;
        try {
            printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            });

            const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
            await printWindow.loadURL(dataUrl);
            await new Promise(resolve => setTimeout(resolve, 150));

            const options = {
                silent: Boolean(silent),
                printBackground: true,
                copies: Math.max(1, Number(copies) || 1),
                margins: { marginType: 'none' }
            };
            if (deviceName && typeof deviceName === 'string') options.deviceName = deviceName;
            if (pageSize) options.pageSize = pageSize;

            const result = await new Promise((resolve) => {
                printWindow.webContents.print(options, (success, failureReason) => {
                    resolve({ success: Boolean(success), failureReason: failureReason || null });
                });
            });

            return result;
        } catch (err) {
            console.error('[Printer] print failed:', err);
            return { success: false, failureReason: err.message };
        } finally {
            if (printWindow && !printWindow.isDestroyed()) {
                printWindow.destroy();
            }
        }
    });

    ipcMain.handle('print:pdfPreview', async (_event, params = {}) => {
        const { html, pageSize } = params;
        if (!html || typeof html !== 'string') {
            return { success: false, error: 'html parameter is required' };
        }
        let printWindow = null;
        try {
            printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            });
            const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
            await printWindow.loadURL(dataUrl);
            await new Promise(r => setTimeout(r, 150));
            const pdfBuffer = await printWindow.webContents.printToPDF({
                pageSize: pageSize || 'A4',
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                printBackground: true
            });
            return { success: true, pdfBase64: pdfBuffer.toString('base64') };
        } catch (err) {
            console.error('[Printer] pdfPreview failed:', err);
            return { success: false, error: err.message };
        } finally {
            if (printWindow && !printWindow.isDestroyed()) {
                printWindow.destroy();
            }
        }
    });
}

module.exports = { registerPrinterIPC };
