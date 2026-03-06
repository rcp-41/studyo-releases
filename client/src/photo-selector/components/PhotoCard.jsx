import { useState, useRef, useEffect } from 'react';
import { Star, ImageOff } from 'lucide-react';

export default function PhotoCard({
    photo,
    isFavorite,
    orderNumber,
    isSelected,
    onClick,
    onDoubleClick,
    onToggleFavorite,
    onContextMenu,
    nextNumber,
    onAssignNumber,
    onRemoveNumber,
    showOverlay = true,
}) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);

    // Reset states when photo changes
    useEffect(() => {
        setLoaded(false);
        setError(false);
    }, [photo.thumbnailPath]);

    const thumbnailSrc = photo.thumbnailPath
        ? `file:///${photo.thumbnailPath.replace(/\\/g, '/')}`
        : null;

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, photo.id);
    };

    return (
        <div
            className={`photo-grid-item group ${isSelected ? 'selected' : ''} ${isFavorite ? 'is-favorite' : ''}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={handleContextMenu}
        >
            {/* Image */}
            <div className="aspect-square bg-neutral-800 relative">
                {thumbnailSrc && !error ? (
                    <img
                        ref={imgRef}
                        src={thumbnailSrc}
                        alt={photo.currentName}
                        loading="lazy"
                        onLoad={() => setLoaded(true)}
                        onError={() => setError(true)}
                        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        draggable={false}
                    />
                ) : error ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-8 h-8 text-neutral-600" />
                    </div>
                ) : (
                    <div className="thumb-placeholder w-full h-full">
                        <div className="w-8 h-8 rounded bg-neutral-700" />
                    </div>
                )}

                {/* Loading overlay when thumbnail is generating */}
                {!loaded && !error && thumbnailSrc && (
                    <div className="absolute inset-0 thumb-placeholder" />
                )}
            </div>

            {/* Favorite star */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(e);
                }}
                className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-all z-[15]
                    ${isFavorite
                        ? 'bg-yellow-400/20 text-yellow-400'
                        : 'bg-black/40 text-neutral-400 opacity-0 group-hover:opacity-100'
                    }`}
            >
                <Star className={`w-4 h-4 favorite-star ${isFavorite ? 'fill-yellow-400' : ''}`} />
            </button>

            {/* Order number badge (top-left) */}
            {orderNumber && (
                <div className="ps-number-badge">
                    {String(orderNumber).padStart(2, '0')}
                </div>
            )}

            {/* Gradient overlay with filename + number button */}
            {showOverlay && (
                <div className="ps-photo-overlay">
                    <span className="ps-photo-name">{photo.currentName}</span>
                    {orderNumber ? (
                        <button
                            className="ps-number-btn remove"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveNumber?.(photo.id);
                            }}
                        >
                            Kaldır
                        </button>
                    ) : (
                        <button
                            className="ps-number-btn assign"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAssignNumber?.(photo.id);
                            }}
                        >
                            Numara ({String(nextNumber || 1).padStart(2, '0')})
                        </button>
                    )}
                </div>
            )}

            {/* Selection ring */}
            {isSelected && (
                <div className="absolute inset-0 ring-2 ring-amber-400 rounded-lg pointer-events-none" />
            )}
        </div>
    );
}
