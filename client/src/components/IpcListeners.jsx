/**
 * IpcListeners
 * Electron IPC kanallarını dinler:
 *   - renderer:forceLogout  → toast + /login yönlendirme
 *   - main:impersonationActive → üst banner (15dk countdown)
 *
 * HashRouter dışında mount edildiği için navigate yerine window.location kullanır.
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import notify from '../lib/notify';
import useAuthStore from '../store/authStore';
import { Shield, X } from 'lucide-react';

const IMPERSONATION_DURATION_MS = 15 * 60 * 1000; // 15 dakika

function formatCountdown(ms) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function IpcListeners() {
    const { t } = useTranslation();
    const logout = useAuthStore((s) => s.logout);
    const [impersonation, setImpersonation] = useState(null);
    const [remaining, setRemaining] = useState(0);
    const timerRef = useRef(null);

    // Force logout listener
    useEffect(() => {
        if (!window?.electron?.ipcRenderer) return;

        const handleForceLogout = () => {
            notify.error(t('ipc.forceLogout'), { duration: 5000 });
            logout().then(() => {
                window.location.hash = '#/login';
            });
        };

        window.electron.ipcRenderer.on('renderer:forceLogout', handleForceLogout);
        return () => {
            window.electron.ipcRenderer.removeListener('renderer:forceLogout', handleForceLogout);
        };
    }, [logout, t]);

    // Impersonation listener
    useEffect(() => {
        if (!window?.electron?.ipcRenderer) return;

        const handleImpersonation = (_event, data) => {
            const expiresAt = Date.now() + IMPERSONATION_DURATION_MS;
            setImpersonation({ creator: data?.creator || 'Support', expiresAt });
            setRemaining(IMPERSONATION_DURATION_MS);
        };

        window.electron.ipcRenderer.on('main:impersonationActive', handleImpersonation);
        return () => {
            window.electron.ipcRenderer.removeListener('main:impersonationActive', handleImpersonation);
        };
    }, []);

    // Countdown timer for impersonation
    useEffect(() => {
        if (!impersonation) return;

        timerRef.current = setInterval(() => {
            const left = impersonation.expiresAt - Date.now();
            if (left <= 0) {
                setImpersonation(null);
                setRemaining(0);
                clearInterval(timerRef.current);
            } else {
                setRemaining(left);
            }
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [impersonation]);

    if (!impersonation) return null;

    const startedAt = new Date(impersonation.expiresAt - IMPERSONATION_DURATION_MS);
    const startedStr = startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div
            role="alert"
            className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500 text-amber-950 text-sm font-medium shadow-lg"
        >
            <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                    {t('ipc.impersonationBanner', {
                        creator: impersonation.creator,
                        startedAt: startedStr,
                        remaining: formatCountdown(remaining),
                    })}
                </span>
            </div>
            <button
                onClick={() => setImpersonation(null)}
                aria-label={t('common.close')}
                className="p-1 hover:bg-amber-600/30 rounded"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
