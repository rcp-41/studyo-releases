import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, X, AlertCircle } from 'lucide-react';

/**
 * Premium Auto-Update Dialog
 * Shows as a floating overlay when updates are available.
 * States: available → downloading → downloaded → restart
 */
export default function UpdateDialog() {
    const [status, setStatus] = useState(null); // null | available | downloading | downloaded | error
    const [version, setVersion] = useState('');
    const [progress, setProgress] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const updateApi = window.electron?.update;
        if (!updateApi) return;

        updateApi.onStatus((st, data) => {
            if (st === 'available') {
                setStatus('available');
                setVersion(data?.version || '');
                setDismissed(false);
            } else if (st === 'downloaded') {
                setStatus('downloaded');
                setVersion(data?.version || version);
            } else if (st === 'error') {
                setStatus('error');
            } else if (st === 'up-to-date') {
                // Don't show anything
            }
        });

        updateApi.onProgress((pct) => {
            setStatus('downloading');
            setProgress(pct);
        });

        return () => updateApi.removeListeners?.();
    }, []);

    const handleDownload = async () => {
        setStatus('downloading');
        setProgress(0);
        try {
            await window.electron.update.download();
        } catch (_) {
            setStatus('error');
        }
    };

    const handleInstall = () => {
        window.electron.update.install();
    };

    // Don't show if no update or dismissed
    if (!status || status === 'error' || dismissed) return null;

    // Circular progress ring
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-[320px] relative overflow-hidden">
                {/* Subtle gradient top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

                {/* Close button */}
                {status === 'available' && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted text-muted-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {status === 'available' && (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Download className="w-7 h-7 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base">Güncelleme Mevcut</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Studyo <span className="font-medium text-foreground">v{version}</span> sürümü kullanıma hazır.
                            </p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
                        >
                            Güncellemeyi İndir
                        </button>
                    </div>
                )}

                {status === 'downloading' && (
                    <div className="flex flex-col items-center gap-4 text-center">
                        {/* Circular progress */}
                        <div className="relative w-20 h-20">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
                                <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="4"
                                    fill="none" className="text-muted/30" />
                                <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="4"
                                    fill="none" className="text-blue-500 transition-all duration-300"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-blue-500">{progress}%</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-base">İndiriliyor...</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                v{version} güncelleme indiriliyor
                            </p>
                        </div>
                    </div>
                )}

                {status === 'downloaded' && (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-7 h-7 text-green-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base">Güncelleme Hazır</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                v{version} indirildi. Uygulamak için yeniden başlatın.
                            </p>
                        </div>
                        <button
                            onClick={handleInstall}
                            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Yeniden Başlat
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
