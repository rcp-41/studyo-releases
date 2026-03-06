import { useState, useEffect, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import useZoom from '../hooks/useZoom';
import { previewCache } from '../utils/imageCache';
import PhotoContextMenu from './PhotoContextMenu';
import {
    Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize,
    ImageOff, Loader2, Hash, Minus
} from 'lucide-react';

export default function SingleView() {
    const photos = usePhotoSelectorStore(s => s.getFilteredPhotos());
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const setSelectedIndex = usePhotoSelectorStore(s => s.setSelectedIndex);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const nextOrderNumber = usePhotoSelectorStore(s => s.nextOrderNumber);

    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);

    const { zoom, isDragging, style, handlers, resetZoom, zoomIn, zoomOut } = useZoom();

    const currentPhoto = photos[selectedIndex] || null;
    const isFavorite = currentPhoto ? favorites.has(currentPhoto.id) : false;
    const numbered = currentPhoto
        ? numberedPhotos.find(np => np.photoId === currentPhoto.id && !np.isCancelled)
        : null;

    // Load image
    const loadImage = useCallback(async (photo) => {
        if (!photo) return;

        // Check cache first
        const cached = previewCache.get(photo.id);
        if (cached) {
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
            });

            if (result?.success) {
                previewCache.set(photo.id, result.data.base64);
                setImageSrc(result.data.base64);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        resetZoom();
        if (currentPhoto) {
            loadImage(currentPhoto);
        }
    }, [currentPhoto?.id]);

    const navigate = useCallback((dir) => {
        const newIndex = selectedIndex + dir;
        if (newIndex >= 0 && newIndex < photos.length) {
            setSelectedIndex(newIndex);
        }
    }, [selectedIndex, photos.length, setSelectedIndex]);

    if (!currentPhoto) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-neutral-500">Fotoğraf seçilmedi</p>
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
                            <p className="text-neutral-500 text-sm">Görüntü yüklenemedi</p>
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

                    {/* Zoom controls */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-1
                                bg-black/50 rounded-lg p-1">
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
                    <span className="font-mono">{currentPhoto.currentName}</span>
                    <div className="flex items-center gap-4">
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
