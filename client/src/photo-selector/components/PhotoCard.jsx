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

    return (
        <div
            className={`photo-grid-item group ${isSelected ? 'selected' : ''} ${isFavorite ? 'is-favorite' : ''}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
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
                className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-all
                    ${isFavorite
                        ? 'bg-yellow-400/20 text-yellow-400'
                        : 'bg-black/40 text-neutral-400 opacity-0 group-hover:opacity-100'
                    }`}
            >
                <Star className={`w-4 h-4 favorite-star ${isFavorite ? 'fill-yellow-400' : ''}`} />
            </button>

            {/* Order number badge */}
            {orderNumber && (
                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-neutral-900
                                text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {orderNumber}
                </div>
            )}

            {/* File name */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent
                            px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-neutral-300 truncate">{photo.currentName}</p>
            </div>

            {/* Selection ring */}
            {isSelected && (
                <div className="absolute inset-0 ring-2 ring-amber-400 rounded-lg pointer-events-none" />
            )}
        </div>
    );
}
