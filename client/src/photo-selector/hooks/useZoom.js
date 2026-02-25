import { useState, useCallback, useRef, useEffect } from 'react';

export default function useZoom(initialZoom = 1) {
    const [zoom, setZoom] = useState(initialZoom);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        setZoom(prev => Math.max(0.5, Math.min(10, prev + delta * prev)));
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (zoom <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    }, [zoom, pan]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setPan({
            x: panStart.current.x + (e.clientX - dragStart.current.x),
            y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const resetZoom = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    const zoomIn = useCallback(() => setZoom(prev => Math.min(10, prev * 1.3)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(0.5, prev / 1.3)), []);

    // Zoom fit'e döndüğünde pan'ı sıfırla
    useEffect(() => {
        if (zoom <= 1) setPan({ x: 0, y: 0 });
    }, [zoom]);

    const style = {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        willChange: 'transform',
    };

    return {
        zoom, pan, isDragging, style,
        handlers: {
            onWheel: handleWheel,
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
        },
        resetZoom, zoomIn, zoomOut, setZoom,
    };
}
