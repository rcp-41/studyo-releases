/**
 * Feature Flags Context
 * Electron tarafından expose edilen window.studyo.flags API'sini kullanır.
 * Web ortamında (electron yoksa) tüm flag'ler defaultValue döner.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const FlagsContext = createContext({});

export function FlagsProvider({ children }) {
    const [flags, setFlags] = useState({});
    const [ready, setReady] = useState(false);

    const loadFlags = useCallback(async () => {
        try {
            if (window?.studyo?.flags?.get) {
                const result = await window.studyo.flags.get();
                setFlags(result || {});
            }
        } catch (err) {
            console.warn('[FeatureFlags] flags.get failed:', err);
        } finally {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        loadFlags();

        // Periyodik refresh (5 dakika)
        const interval = setInterval(async () => {
            try {
                if (window?.studyo?.flags?.refresh) {
                    const result = await window.studyo.flags.refresh();
                    setFlags(result || {});
                }
            } catch (err) {
                console.warn('[FeatureFlags] flags.refresh failed:', err);
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [loadFlags]);

    return (
        <FlagsContext.Provider value={{ flags, ready }}>
            {children}
        </FlagsContext.Provider>
    );
}

/**
 * useFlag(key, defaultValue)
 * Örnek: const showNewDashboard = useFlag('newDashboard', false);
 */
export function useFlag(key, defaultValue = false) {
    const { flags, ready } = useContext(FlagsContext);
    if (!ready) return defaultValue;
    return key in flags ? flags[key] : defaultValue;
}

export default FlagsProvider;
