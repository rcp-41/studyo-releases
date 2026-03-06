import { useRef, useCallback, useState } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import PhotoCard from './PhotoCard';
import PhotoContextMenu from './PhotoContextMenu';
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
    const assignNumber = usePhotoSelectorStore(s => s.assignNumber);
    const removeNumber = usePhotoSelectorStore(s => s.removeNumber);
    const nextOrderNumber = usePhotoSelectorStore(s => s.nextOrderNumber);
    const filterMode = usePhotoSelectorStore(s => s.filterMode);

    const gridRef = useRef(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

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

    const handleContextMenu = useCallback((e, photoId) => {
        setContextMenu({ x: e.clientX, y: e.clientY, photoId });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleAssignNumber = useCallback((photoId) => {
        assignNumber(photoId);
    }, [assignNumber]);

    const handleRemoveNumber = useCallback((photoId) => {
        removeNumber(photoId);
    }, [removeNumber]);

    // Show overlay in favorites or numbered filter mode
    const showOverlay = filterMode === 'favorites' || filterMode === 'numbered';

    if (photos.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3">
                <ImageOff className="w-16 h-16 text-neutral-700" />
                <p className="text-neutral-500">Bu filtrede fotoğraf bulunamadı</p>
            </div>
        );
    }

    return (
        <>
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
                            onContextMenu={handleContextMenu}
                            nextNumber={nextOrderNumber}
                            onAssignNumber={handleAssignNumber}
                            onRemoveNumber={handleRemoveNumber}
                            showOverlay={showOverlay}
                        />
                    ))}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <PhotoContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    photoId={contextMenu.photoId}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
}
