import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * AutoUpdater component for Electron app
 * Checks for updates via electron-updater and shows update status/progress.
 * Only renders in Electron environment.
 */
export default function AutoUpdater() {
    const [status, setStatus] = useState('idle'); // idle | checking | available | downloading | ready | error
    const [progress, setProgress] = useState(0);
    const [version, setVersion] = useState('');
    const [error, setError] = useState('');
    const [dismissed, setDismissed] = useState(false);

    const isElectron = !!window.electron;

    useEffect(() => {
        if (!isElectron) return;

        // Listen for update events from main process
        const removeListeners = [];

        if (window.electron.onUpdateAvailable) {
            const unsub1 = window.electron.onUpdateAvailable((info) => {
                setStatus('available');
                setVersion(info?.version || 'Yeni');
                setDismissed(false);
            });
            if (unsub1) removeListeners.push(unsub1);
        }

        if (window.electron.onUpdateProgress) {
            const unsub2 = window.electron.onUpdateProgress((prog) => {
                setStatus('downloading');
                setProgress(Math.round(prog?.percent || 0));
            });
            if (unsub2) removeListeners.push(unsub2);
        }

        if (window.electron.onUpdateReady) {
            const unsub3 = window.electron.onUpdateReady(() => {
                setStatus('ready');
            });
            if (unsub3) removeListeners.push(unsub3);
        }

        if (window.electron.onUpdateError) {
            const unsub4 = window.electron.onUpdateError((err) => {
                setStatus('error');
                setError(err?.message || 'Güncelleme hatası');
            });
            if (unsub4) removeListeners.push(unsub4);
        }

        // Auto-check on mount (with delay)
        const timer = setTimeout(() => {
            checkForUpdates();
        }, 10000); // 10s after app start

        return () => {
            clearTimeout(timer);
            removeListeners.forEach(fn => typeof fn === 'function' && fn());
        };
    }, [isElectron]);

    const checkForUpdates = () => {
        if (window.electron?.checkForUpdates) {
            setStatus('checking');
            window.electron.checkForUpdates();
        }
    };

    const downloadUpdate = () => {
        if (window.electron?.downloadUpdate) {
            setStatus('downloading');
            setProgress(0);
            window.electron.downloadUpdate();
        }
    };

    const installUpdate = () => {
        if (window.electron?.installUpdate) {
            window.electron.installUpdate();
        }
    };

    // Don't render in non-Electron or idle/dismissed states
    if (!isElectron || status === 'idle' || status === 'checking' || dismissed) return null;

    return (
        <div className={cn(
            'fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border shadow-2xl p-4',
            status === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-card border-border'
        )}>
            <div className="flex items-start gap-3">
                {status === 'available' && (
                    <>
                        <Download className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold">Güncelleme Mevcut</p>
                            <p className="text-xs text-muted-foreground mt-0.5">v{version} indirilebilir</p>
                            <div className="flex gap-2 mt-3">
                                <button onClick={downloadUpdate}
                                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                    İndir
                                </button>
                                <button onClick={() => setDismissed(true)}
                                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                                    Sonra
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {status === 'downloading' && (
                    <>
                        <Loader2 className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-spin" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold">İndiriliyor... %{progress}</p>
                            <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </>
                )}

                {status === 'ready' && (
                    <>
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold">Güncelleme Hazır</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Uygulamayı yeniden başlatın</p>
                            <button onClick={installUpdate}
                                className="mt-3 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                                Yeniden Başlat
                            </button>
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-500">Güncelleme Hatası</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                            <button onClick={checkForUpdates}
                                className="mt-3 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> Tekrar Dene
                            </button>
                        </div>
                    </>
                )}

                <button onClick={() => setDismissed(true)} className="p-1 hover:bg-muted rounded shrink-0">
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
}
