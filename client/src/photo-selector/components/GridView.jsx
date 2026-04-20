import { useRef, useCallback, useState } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import PhotoCard from './PhotoCard';
import PhotoContextMenu from './PhotoContextMenu';
import { ImageOff } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePhotoCard({ id, ...props }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        position: 'relative',
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <PhotoCard {...props} />
        </div>
    );
}

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
    const reorderFavorites = usePhotoSelectorStore(s => s.reorderFavorites);

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

    const shootCategoryType = usePhotoSelectorStore(s => s.shootCategoryType);

    // Show overlay in favorites/numbered mode, or when any shoot category is active
    const showOverlay = filterMode === 'favorites' || filterMode === 'numbered' || (shootCategoryType && shootCategoryType !== 'none');

    // Drag-and-drop mechanics
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = photos.findIndex(p => p.id === active.id);
            const newIndex = photos.findIndex(p => p.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderFavorites(oldIndex, newIndex);
            }
        }
    }, [photos, reorderFavorites]);

    if (photos.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3">
                <ImageOff className="w-16 h-16 text-neutral-700" />
                <p className="text-neutral-500">Bu filtrede fotoğraf bulunamadı</p>
            </div>
        );
    }

    const renderGridItems = () => photos.map((photo, index) => {
        const props = {
            photo,
            isFavorite: favorites.has(photo.id),
            orderNumber: numberedMap[photo.id] || null,
            isSelected: index === selectedIndex,
            onClick: () => handlePhotoClick(index),
            onDoubleClick: () => handlePhotoDoubleClick(index),
            onToggleFavorite: () => handleToggleFavorite(photo.id),
            onContextMenu: handleContextMenu,
            nextNumber: nextOrderNumber,
            onAssignNumber: handleAssignNumber,
            onRemoveNumber: handleRemoveNumber,
            showOverlay,
        };
        
        if (filterMode === 'favorites') {
            return <SortablePhotoCard key={photo.id} id={photo.id} {...props} />;
        }
        return <PhotoCard key={photo.id} {...props} />;
    });

    const gridContent = (
        <div
            className="grid gap-2"
            style={{
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            }}
        >
            {filterMode === 'favorites' ? (
                <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                    {renderGridItems()}
                </SortableContext>
            ) : (
                renderGridItems()
            )}
        </div>
    );

    return (
        <>
            <div
                ref={gridRef}
                className="h-full overflow-y-auto ps-scrollbar p-4"
            >
                {filterMode === 'favorites' ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        {gridContent}
                    </DndContext>
                ) : (
                    gridContent
                )}
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
