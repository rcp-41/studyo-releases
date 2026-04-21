import { useEffect, useRef, useState } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';

/**
 * OfflineBanner — Global top-of-screen connectivity banner.
 *
 * Behavior:
 *   • When offline → amber/orange banner, WifiOff icon, Turkish message.
 *   • When back online (after having been offline) → green "Senkronize edildi" banner for 3s.
 *   • Otherwise → renders nothing.
 *
 * Accessibility: `role="status" aria-live="polite"` so screen readers announce the change
 * without interrupting the user.
 *
 * Mount once at the app shell (see AppLayout).
 */
const RECONNECT_BANNER_MS = 3000;

export default function OfflineBanner() {
    const { online } = useOnlineStatus();
    const [showReconnected, setShowReconnected] = useState(false);
    const wasOfflineRef = useRef(!online);
    const reconnectTimerRef = useRef(null);

    useEffect(() => {
        if (!online) {
            // Went offline (or started offline) — remember so we can show "reconnected" later.
            wasOfflineRef.current = true;
            // Clear any lingering reconnected-banner timer.
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            setShowReconnected(false);
            return;
        }

        // Online transition — only flash the green banner if we were previously offline.
        if (wasOfflineRef.current) {
            wasOfflineRef.current = false;
            setShowReconnected(true);
            reconnectTimerRef.current = setTimeout(() => {
                setShowReconnected(false);
                reconnectTimerRef.current = null;
            }, RECONNECT_BANNER_MS);
        }

        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [online]);

    if (!online) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 px-4 py-2
                           bg-amber-500 text-amber-950 shadow-md text-sm font-medium
                           animate-in slide-in-from-top-2 fade-in duration-200"
            >
                <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>İnternet bağlantısı yok — değişiklikler senkronize edilecek</span>
            </div>
        );
    }

    if (showReconnected) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 px-4 py-2
                           bg-green-600 text-white shadow-md text-sm font-medium
                           animate-in slide-in-from-top-2 fade-in duration-200"
            >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Senkronize edildi</span>
            </div>
        );
    }

    return null;
}
