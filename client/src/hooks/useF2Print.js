import { useEffect, useRef } from 'react';

export default function useF2Print({ enabled = true, onF2, preventDefault = true } = {}) {
    const cbRef = useRef(onF2);
    cbRef.current = onF2;

    useEffect(() => {
        if (!enabled) return;
        const handler = (e) => {
            if (e.key !== 'F2' || e.repeat) return;
            if (preventDefault) e.preventDefault();
            cbRef.current?.(e);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enabled, preventDefault]);
}
