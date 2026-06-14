import { useState, useEffect } from 'react';
import { whatsappApi } from '../../services/api';
import { cn } from '../../lib/utils';
import { MessageSquare, CheckCircle, Loader2, LogOut } from 'lucide-react';
import notify from '../../lib/notify';
import { useTranslation } from 'react-i18next';

export default function WhatsAppSettings({ enabled, onToggle }) {
    const [status, setStatus] = useState('DISCONNECTED');
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);
    const hasElectronWhatsApp = !!window.electron?.whatsapp;
    const { t } = useTranslation();

    useEffect(() => {
        if (!enabled || !hasElectronWhatsApp) return;

        const whatsapp = window.electron.whatsapp;
        whatsapp.onStatus((s) => setStatus(s.toUpperCase()));
        whatsapp.onQr((qrData) => setQr(qrData));

        whatsappApi.init().catch(console.error);

        const interval = setInterval(async () => {
            try {
                const r = await whatsappApi.getStatus();
                const s = r?.status || 'disconnected';
                setStatus(s.toUpperCase());
                if (s === 'qr_ready') {
                    const qrR = await whatsappApi.getQr();
                    setQr(qrR?.qr || null);
                } else if (s === 'connected') setQr(null);
            } catch (_) { /* polling error — retry next tick */ }
        }, 3000);

        return () => { clearInterval(interval); whatsapp.removeListeners?.(); };
    }, [enabled, hasElectronWhatsApp]);

    const handleLogout = async () => {
        setLoading(true);
        try { await whatsappApi.logout(); notify.success(t('whatsapp.logoutSuccess')); setStatus('DISCONNECTED'); setQr(null); }
        catch (_) { notify.error(t('whatsapp.logoutError')); }
        setLoading(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10"><MessageSquare className="w-5 h-5 text-green-600" /></div>
                    <div>
                        <h3 className="font-semibold">WhatsApp Web</h3>
                        <p className="text-sm text-muted-foreground">{t('whatsapp.connect')}</p>
                    </div>
                </div>
                <button onClick={onToggle} className={cn('w-11 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0', enabled ? 'bg-green-600' : 'bg-input/50')}>
                    <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', enabled ? 'translate-x-5' : 'translate-x-0')} />
                </button>
            </div>

            {enabled && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex flex-col items-center justify-center text-center">
                        {!hasElectronWhatsApp ? (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-yellow-600" />
                                </div>
                                <h4 className="font-medium text-yellow-600">{t('whatsapp.desktopOnly')}</h4>
                                <p className="text-sm text-muted-foreground">{t('whatsapp.desktopDesc')}</p>
                            </div>
                        ) : status === 'CONNECTED' ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h4 className="font-medium text-green-600">{t('whatsapp.connected')}</h4>
                                <p className="text-sm text-muted-foreground">{t('whatsapp.connectedDesc')}</p>
                                <button onClick={handleLogout} disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm mt-2">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                    {t('whatsapp.logout')}
                                </button>
                            </div>
                        ) : qr && status === 'QR_READY' ? (
                            <div className="flex flex-col items-center gap-4 py-2">
                                <div className="bg-white p-4 rounded-xl shadow-sm border">
                                    <img src={qr} alt="WhatsApp QR" className="w-56 h-56" />
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <h4 className="font-medium">{t('whatsapp.devicePair')}</h4>
                                    <ol className="text-sm text-muted-foreground text-left list-decimal pl-4 space-y-1">
                                        <li>{t('whatsapp.step1')}</li>
                                        <li>{t('whatsapp.step2')}</li>
                                        <li>{t('whatsapp.step3')}</li>
                                    </ol>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                                <h4 className="font-medium">{t('whatsapp.qrLoading')}</h4>
                                <p className="text-sm text-muted-foreground">{t('whatsapp.qrLoadingDesc')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
