import { useEffect, useRef, useState } from 'react';

/**
 * useOnlineStatus — React hook tracking network + Firestore connectivity.
 *
 * Returns:
 *   {
 *     online: boolean,              // navigator.onLine reactive to 'online' / 'offline' events
 *     firestoreConnected: boolean,  // best-effort Firestore reachability (mirrors `online` here,
 *                                   //   since the Firebase JS SDK does not expose a public
 *                                   //   "connected" listener outside Realtime Database).
 *     lastSyncAt: Date | null       // timestamp of the last transition into the online state
 *   }
 *
 * Implementation notes:
 *   - The Firebase Web SDK (v9+) exposes `enableNetwork` / `disableNetwork` but no reactive
 *     connectivity observable for Firestore. Rather than ship the complexity of an
 *     `onSnapshot` on a `_presence` doc (which needs a studioId, a write path and rules),
 *     we rely on `navigator.onLine`. This is the "simplest robust implementation" called
 *     out in the task brief.
 *   - We listen to both 'online' and 'offline' window events — these fire as the OS-level
 *     network state changes and are supported across Electron + modern browsers.
 *   - `lastSyncAt` is initialized to now if we mount online (the app just rendered, so by
 *     definition we are synced as of this moment), and updated every time we transition
 *     offline → online.
 */
export default function useOnlineStatus() {
    const [online, setOnline] = useState(() => {
        if (typeof navigator === 'undefined') return true;
        return navigator.onLine !== false;
    });
    const [lastSyncAt, setLastSyncAt] = useState(() => {
        if (typeof navigator === 'undefined') return new Date();
        return navigator.onLine !== false ? new Date() : null;
    });
    const prevOnlineRef = useRef(online);

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            setLastSyncAt(new Date());
        };
        const handleOffline = () => {
            setOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Guard against drift: sample the real state once on mount, in case events
        // fired before we subscribed (e.g. during the StrictMode double-invoke).
        const actual = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
        if (actual !== prevOnlineRef.current) {
            setOnline(actual);
            if (actual) setLastSyncAt(new Date());
        }
        prevOnlineRef.current = actual;

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Firestore-specific connectivity is not observable from the public SDK; mirror `online`
    // so callers can begin to differentiate if/when we wire a real presence channel.
    const firestoreConnected = online;

    return { online, firestoreConnected, lastSyncAt };
}
