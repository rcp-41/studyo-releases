import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import useZoom from '../hooks/useZoom';
import { previewCache } from '../utils/imageCache';
import PhotoContextMenu from './PhotoContextMenu';
import {
    Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize,
    ImageOff, Loader2, Hash, Minus, RotateCcw, RotateCw, ScanSearch
} from 'lucide-react';

// Fixed zoom used by the loupe toggle for quick focus/sharpness inspection.
const LOUPE_ZOOM = 4;

function formatBytes(b) {
    if (!b) return '';
    const mb = b / 1048576;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

function megapixels(w, h) {
    if (!w || !h) return '';
    return `${((w * h) / 1e6).toFixed(1)} MP`;
}

export default function SingleView() {
    const { t } = useTranslation();
    const photos = usePhotoSelectorStore(s => s.getFilteredPhotos());
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const setSelectedIndex = usePhotoSelectorStore(s => s.setSelectedIndex);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const nextOrderNumber = usePhotoSelectorStore(s => s.nextOrderNumber);
    const rotations = usePhotoSelectorStore(s => s.rotations);
    const rotatePhoto = usePhotoSelectorStore(s => s.rotatePhoto);

    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [exif, setExif] = useState(null);

    const { zoom, isDragging, style, handlers, resetZoom, zoomIn, zoomOut, setZoom } = useZoom();

    const currentPhoto = photos[selectedIndex] || null;
    const rotation = currentPhoto ? (rotations[currentPhoto.id] || 0) : 0;
    const isFavorite = currentPhoto ? favorites.has(currentPhoto.id) : false;
    const numbered = currentPhoto
        ? numberedPhotos.find(np => np.photoId === currentPhoto.id && !np.isCancelled)
        : null;

    // Load image at the given rotation. `isCancelled` aborts applying an
    // out-of-order async result after the user has navigated away. The cache key
    // includes rotation so each orientation is cached independently.
    const loadImage = useCallback(async (photo, rot, isCancelled) => {
        if (!photo) return;

        const cacheKey = `${photo.id}@${rot}`;
        const cached = previewCache.get(cacheKey);
        if (cached) {
            if (isCancelled?.()) return;
            setImageSrc(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(false);

        try {
            const result = await window.electron?.photoSelector?.getImageAsBase64({
                filePath: photo.fullPath,
                maxWidth: 1600,
                rotate: rot || undefined,
            });

            if (isCancelled?.()) return;

            if (result?.success) {
                previewCache.set(cacheKey, result.data.base64);
                setImageSrc(result.data.base64);
            } else {
                setError(true);
            }
        } catch {
            if (isCancelled?.()) return;
            setError(true);
        } finally {
            if (!isCancelled?.()) setLoading(false);
        }
    }, []);

    useEffect(() => {
        resetZoom();
        if (!currentPhoto) return;
        let cancelled = false;
        loadImage(currentPhoto, rotation, () => cancelled);
        return () => { cancelled = true; };
    }, [currentPhoto?.id, rotation]);

    // Fetch image metadata (dimensions / format / size) for the info bar.
    useEffect(() => {
        if (!currentPhoto) return;
        let cancelled = false;
        window.electron?.photoSelector?.readExif?.({ filePath: currentPhoto.fullPath })
            .then(res => { if (!cancelled && res?.success) setExif(res.data); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [currentPhoto?.id]);

    const navigate = useCallback((dir) => {
        const newIndex = selectedIndex + dir;
        if (newIndex >= 0 && newIndex < photos.length) {
            setSelectedIndex(newIndex);
        }
    }, [selectedIndex, photos.length, setSelectedIndex]);

    // Loupe: toggle between fit and a fixed inspection zoom for sharpness checks.
    const toggleLoupe = useCallback(() => {
        if (zoom > 1.01) resetZoom();
        else setZoom(LOUPE_ZOOM);
    }, [zoom, resetZoom, setZoom]);

    // Local shortcuts for view-only controls whose state lives in this component
    // (rotation + loupe). Global nav shortcuts are handled by useKeyboardNav.
    useEffect(() => {
        const onKey = (e) => {
            const el = e.target;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (!currentPhoto) return;
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                rotatePhoto(currentPhoto.id, e.shiftKey ? -90 : 90);
            } else if (e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                toggleLoupe();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [currentPhoto?.id, rotatePhoto, toggleLoupe]);

    if (!currentPhoto) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-neutral-500">{t('photoSelector.single.noPhotoSelected')}</p>
            </div>
        );
    }

    return (
        <>
            <div className="h-full flex flex-col"
                onContextMenu={(e) => {
                    if (currentPhoto) {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, photoId: currentPhoto.id });
                    }
                }}
            >
                {/* Image area */}
                <div className="flex-1 relative overflow-hidden bg-neutral-950">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                        </div>
                    )}

                    {error && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <ImageOff className="w-12 h-12 text-neutral-600" />
                            <p className="text-neutral-500 text-sm">{t('photoSelector.single.imageLoadFailed')}</p>
                        </div>
                    )}

                    {imageSrc && !error && (
                        <div
                            className={`zoom-container ${isDragging ? 'dragging' : ''}`}
                            {...handlers}
                        >
                            <img
                                src={imageSrc}
                                alt={currentPhoto.currentName}
                                style={style}
                                className="w-full h-full object-contain"
                                draggable={false}
                            />
                        </div>
                    )}

                    {/* Navigation arrows */}
                    {selectedIndex > 0 && (
                        <button
                            onClick={() => navigate(-1)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {selectedIndex < photos.length - 1 && (
                        <button
                            onClick={() => navigate(1)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 hover:text-white transition-colors"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}

                    {/* Top-left: order badge */}
                    {numbered && (
                        <div className="ps-number-badge" style={{ top: 16, left: 16, fontSize: 14, height: 32, minWidth: 32, borderRadius: 8 }}>
                            {String(numbered.orderNumber).padStart(2, '0')}
                        </div>
                    )}

                    {/* Top-right: Favorite + number controls */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {/* Number button */}
                        {numbered ? (
                            <button
                                onClick={() => removeNumber(currentPhoto.id)}
                                className="ps-number-btn remove flex items-center gap-1"
                            >
                                <Minus className="w-3.5 h-3.5" /> Kaldır
                            </button>
                        ) : (
                            <button
                                onClick={() => assignNumber(currentPhoto.id)}
                                className="ps-number-btn assign flex items-center gap-1"
                            >
                                <Hash className="w-3.5 h-3.5" /> Numara ({String(nextOrderNumber).padStart(2, '0')})
                            </button>
                        )}
                        <button
                            onClick={() => toggleFavorite(currentPhoto.id)}
                            className={`p-2 rounded-full transition-all ${isFavorite
                                    ? 'bg-yellow-400/20 text-yellow-400'
                                    : 'bg-black/50 text-neutral-400 hover:text-yellow-400'
                                }`}
                        >
                            <Star className={`w-6 h-6 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                        </button>
                    </div>

                    {/* Bottom-left: rotation controls */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-1
                                bg-black/50 rounded-lg p-1">
                        <button onClick={() => rotatePhoto(currentPhoto.id, -90)}
                            title={t('photoSelector.single.rotateLeft')}
                            className="p-1.5 text-neutral-400 hover:text-white rounded">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => rotatePhoto(currentPhoto.id, 90)}
                            title={t('photoSelector.single.rotateRight')}
                            className="p-1.5 text-neutral-400 hover:text-white rounded">
                            <RotateCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Zoom controls */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-1
                                bg-black/50 rounded-lg p-1">
                        <button onClick={toggleLoupe}
                            title={t('photoSelector.single.loupe')}
                            className={`p-1.5 rounded ${zoom > 1.01 ? 'text-amber-400' : 'text-neutral-400 hover:text-white'}`}>
                            <ScanSearch className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-neutral-700 mx-0.5" />
                        <button onClick={zoomOut}
                            className="p-1.5 text-neutral-400 hover:text-white rounded">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-neutral-400 w-10 text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button onClick={zoomIn}
                            className="p-1.5 text-neutral-400 hover:text-white rounded">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={resetZoom}
                            className="p-1.5 text-neutral-400 hover:text-white rounded">
                            <Maximize className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Bottom info bar */}
                <div className="h-10 flex items-center justify-between px-4 bg-neutral-900
                            border-t border-neutral-800 text-xs text-neutral-400">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono truncate">{currentPhoto.currentName}</span>
                        {exif && (
                            <span className="text-neutral-500 whitespace-nowrap">
                                {exif.width}×{exif.height}
                                {megapixels(exif.width, exif.height) ? ` · ${megapixels(exif.width, exif.height)}` : ''}
                                {exif.format ? ` · ${exif.format.toUpperCase()}` : ''}
                                {formatBytes(exif.size) ? ` · ${formatBytes(exif.size)}` : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 whitespace-nowrap">
                        {rotation !== 0 && <span className="text-neutral-500">↻ {rotation}°</span>}
                        <span>{selectedIndex + 1} / {photos.length}</span>
                        <span>
                            {isFavorite ? '★ Favori' : ''}
                        </span>
                    </div>
                </div>
            </div>
            {/* Context Menu */}
            {contextMenu && (
                <PhotoContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    photoId={contextMenu.photoId}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
}
