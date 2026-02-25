import { useRef, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import PhotoCard from './PhotoCard';
import { ImageOff } from 'lucide-react';

export default function GridView() {
    const photos = usePhotoSelectorStore(s => s.getFilteredPhotos());
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const setSelectedIndex = usePhotoSelectorStore(s => s.setSelectedIndex);
    const setView = usePhotoSelectorStore(s => s.setView);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);
    const gridColumns = usePhotoSelectorStore(s => s.gridColumns);

    const gridRef = useRef(null);

    // Build numbered lookup
    const numberedMap = {};
    numberedPhotos.forEach(np => {
        if (!np.isCancelled) numberedMap[np.photoId] = np.orderNumber;
    });

    const handlePhotoClick = useCallback((index) => {
        setSelectedIndex(index);
    }, [setSelectedIndex]);

    const handlePhotoDoubleClick = useCallback((index) => {
        setSelectedIndex(index);
        setView('single');
    }, [setSelectedIndex, setView]);

    const handleToggleFavorite = useCallback((photoId) => {
        toggleFavorite(photoId);
    }, [toggleFavorite]);

    if (photos.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3">
                <ImageOff className="w-16 h-16 text-neutral-700" />
                <p className="text-neutral-500">Bu filtrede fotoğraf bulunamadı</p>
            </div>
        );
    }

    return (
        <div
            ref={gridRef}
            className="h-full overflow-y-auto ps-scrollbar p-4"
        >
            <div
                className="grid gap-2"
                style={{
                    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                }}
            >
                {photos.map((photo, index) => (
                    <PhotoCard
                        key={photo.id}
                        photo={photo}
                        isFavorite={favorites.has(photo.id)}
                        orderNumber={numberedMap[photo.id] || null}
                        isSelected={index === selectedIndex}
                        onClick={() => handlePhotoClick(index)}
                        onDoubleClick={() => handlePhotoDoubleClick(index)}
                        onToggleFavorite={() => handleToggleFavorite(photo.id)}
                    />
                ))}
            </div>
        </div>
    );
}
