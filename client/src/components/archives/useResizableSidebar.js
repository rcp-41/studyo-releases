import { useState, useCallback, useRef } from 'react';

/**
 * Sürüklenebilir kenar çubuğu genişliği yönetimi.
 * containerRef: dış kapsayıcıya bağlanmalıdır.
 */
export function useResizableSidebar(storageKey = 'archives_sidebar_width', defaultWidth = 320) {
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        return saved ? parseInt(saved, 10) : defaultWidth;
    });
    const isDragging = useRef(false);
    const containerRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = Math.max(200, Math.min(600, rect.right - ev.clientX));
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setSidebarWidth(w => { localStorage.setItem(storageKey, w); return w; });
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [storageKey]);

    return { sidebarWidth, containerRef, handleMouseDown };
}
