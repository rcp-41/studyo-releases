import { useState, useEffect, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import useZoom from '../hooks/useZoom';
import { previewCache } from '../utils/imageCache';
import { Star, ChevronLeft, ChevronRight, ImageOff, Loader2 } from 'lucide-react';

function ComparePanel({ photo, isFavorite, onToggleFavorite, zoomStyle, zoomHandlers, isDragging }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!photo) return;

        const cached = previewCache.get(photo.id);
        if (cached) {
            setImageSrc(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(false);

        window.electron?.photoSelector?.getImageAsBase64({
            filePath: photo.fullPath,
            maxWidth: 1200,
        }).then(result => {
            if (result?.success) {
                previewCache.set(photo.id, result.data.base64);
                setImageSrc(result.data.base64);
            } else {
                setError(true);
            }
        }).catch(() => setError(true))
          .finally(() => setLoading(false));
    }, [photo?.id]);

    if (!photo) {
        return (
            <div className="flex-1 flex items-center justify-center bg-neutral-950">
                <p className="text-neutral-600">Fotoğraf seçilmedi</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 relative overflow-hidden bg-neutral-950">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    </div>
                )}

                {error && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ImageOff className="w-10 h-10 text-neutral-600" />
                    </div>
                )}

                {imageSrc && !error && (
                    <div
                        className={`zoom-container ${isDragging ? 'dragging' : ''}`}
                        {...zoomHandlers}
                    >
                        <img
                            src={imageSrc}
                            alt={photo.currentName}
                            style={zoomStyle}
                            className="w-full h-full object-contain"
                            draggable={false}
                        />
                    </div>
                )}

                {/* Favorite button */}
                <button
                    onClick={() => onToggleFavorite(photo.id)}
                    className={`absolute top-3 right-3 p-1.5 rounded-full transition-all ${
                        isFavorite
                            ? 'bg-yellow-400/20 text-yellow-400'
                            : 'bg-black/50 text-neutral-400 hover:text-yellow-400'
                    }`}
                >
                    <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                </button>
            </div>

            {/* File name */}
            <div className="h-8 flex items-center justify-center px-3 bg-neutral-900
                            border-t border-neutral-800 text-xs text-neutral-400">
                <span className="truncate">{photo.currentName}</span>
            </div>
        </div>
    );
}

export default function CompareView() {
    const photos = usePhotoSelectorStore(s => s.getFilteredPhotos());
    const compareIndices = usePhotoSelectorStore(s => s.compareIndices);
    const setCompareIndices = usePhotoSelectorStore(s => s.setCompareIndices);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);

    // Shared zoom state for synchronized zoom
    const { zoom, isDragging, style, handlers, resetZoom } = useZoom();

    const leftPhoto = photos[compareIndices[0]] || null;
    const rightPhoto = photos[compareIndices[1]] || null;

    const navigateLeft = useCallback((dir) => {
        const newIdx = compareIndices[0] + dir;
        if (newIdx >= 0 && newIdx < photos.length && newIdx !== compareIndices[1]) {
            setCompareIndices([newIdx, compareIndices[1]]);
        }
    }, [compareIndices, photos.length, setCompareIndices]);

    const navigateRight = useCallback((dir) => {
        const newIdx = compareIndices[1] + dir;
        if (newIdx >= 0 && newIdx < photos.length && newIdx !== compareIndices[0]) {
            setCompareIndices([compareIndices[0], newIdx]);
        }
    }, [compareIndices, photos.length, setCompareIndices]);

    if (photos.length < 2) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-neutral-500">Karşılaştırma için en az 2 fotoğraf gerekli</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 flex">
                {/* Left panel */}
                <div className="flex-1 relative">
                    <ComparePanel
                        photo={leftPhoto}
                        isFavorite={leftPhoto ? favorites.has(leftPhoto.id) : false}
                        onToggleFavorite={toggleFavorite}
                        zoomStyle={style}
                        zoomHandlers={handlers}
                        isDragging={isDragging}
                    />
                    {/* Navigation */}
                    <button
                        onClick={() => navigateLeft(-1)}
                        disabled={compareIndices[0] <= 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigateLeft(1)}
                        disabled={compareIndices[0] >= photos.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-0.5 bg-neutral-700" />

                {/* Right panel */}
                <div className="flex-1 relative">
                    <ComparePanel
                        photo={rightPhoto}
                        isFavorite={rightPhoto ? favorites.has(rightPhoto.id) : false}
                        onToggleFavorite={toggleFavorite}
                        zoomStyle={style}
                        zoomHandlers={handlers}
                        isDragging={isDragging}
                    />
                    <button
                        onClick={() => navigateRight(-1)}
                        disabled={compareIndices[1] <= 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigateRight(1)}
                        disabled={compareIndices[1] >= photos.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5
                                   bg-black/50 hover:bg-black/70 rounded-full
                                   text-neutral-300 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
