import { useRef, useCallback, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
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

const GRID_GAP = 8;
const GRID_PADDING = 16;

// React.memo ile sarıldı — aynı props geldiğinde re-render olmaz
const SortablePhotoCard = memo(function SortablePhotoCard({
    id,
    index,
    photo,
    isFavorite,
    orderNumber,
    isSelected,
    onPhotoClick,
    onPhotoDoubleClick,
    onToggleFavorite,
    onContextMenu,
    nextNumber,
    onAssignNumber,
    onRemoveNumber,
    showOverlay,
    style,
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const handleClick = useCallback(() => onPhotoClick(index), [onPhotoClick, index]);
    const handleDoubleClick = useCallback(() => onPhotoDoubleClick(index), [onPhotoDoubleClick, index]);
    const handleToggleFavorite = useCallback(() => onToggleFavorite(photo.id), [onToggleFavorite, photo.id]);
    const handleAssignNumber = useCallback(() => onAssignNumber(photo.id), [onAssignNumber, photo.id]);
    const handleRemoveNumber = useCallback(() => onRemoveNumber(photo.id), [onRemoveNumber, photo.id]);

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        position: 'relative',
        // Virtualized grid'den gelen mutlak konum style'ı ile birleştir
        ...style,
    };

    return (
        <div ref={setNodeRef} style={dragStyle} {...attributes} {...listeners}>
            <PhotoCard
                photo={photo}
                isFavorite={isFavorite}
                orderNumber={orderNumber}
                isSelected={isSelected}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onToggleFavorite={handleToggleFavorite}
                onContextMenu={onContextMenu}
                nextNumber={nextNumber}
                onAssignNumber={handleAssignNumber}
                onRemoveNumber={handleRemoveNumber}
                showOverlay={showOverlay}
            />
        </div>
    );
});

export default function GridView() {
    const { t } = useTranslation();
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
                <p className="text-neutral-500">{t('photoSelector.grid.noPhotosInFilter')}</p>
            </div>
        );
    }

    // Favorites mode: virtualized DnD grid
    // SortableContext items listesi dışarıda; react-window içindeki her hücre kendi
    // useSortable hook'unu çağıran SortablePhotoCard'ı render eder.
    const renderFavoritesGrid = () => (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                <div ref={gridRef} className="h-full">
                    <AutoSizer>
                        {({ width, height }) => {
                            const innerWidth = width - GRID_PADDING * 2;
                            const cellWidth = Math.floor((innerWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);
                            const cellHeight = Math.floor(cellWidth * 1.15);
                            const rowCount = Math.ceil(photos.length / gridColumns);

                            const FavCell = ({ columnIndex, rowIndex, style }) => {
                                const index = rowIndex * gridColumns + columnIndex;
                                if (index >= photos.length) return null;
                                const photo = photos[index];
                                const cellStyle = {
                                    ...style,
                                    left: (style.left || 0) + GRID_PADDING + columnIndex * GRID_GAP,
                                    top: (style.top || 0) + GRID_PADDING + rowIndex * GRID_GAP,
                                    width: cellWidth,
                                    height: cellHeight,
                                };
                                return (
                                    <SortablePhotoCard
                                        key={photo.id}
                                        id={photo.id}
                                        index={index}
                                        photo={photo}
                                        isFavorite={favorites.has(photo.id)}
                                        orderNumber={numberedMap[photo.id] || null}
                                        isSelected={index === selectedIndex}
                                        onPhotoClick={handlePhotoClick}
                                        onPhotoDoubleClick={handlePhotoDoubleClick}
                                        onToggleFavorite={handleToggleFavorite}
                                        onContextMenu={handleContextMenu}
                                        nextNumber={nextOrderNumber}
                                        onAssignNumber={handleAssignNumber}
                                        onRemoveNumber={handleRemoveNumber}
                                        showOverlay={showOverlay}
                                        style={cellStyle}
                                    />
                                );
                            };

                            return (
                                <FixedSizeGrid
                                    columnCount={gridColumns}
                                    columnWidth={cellWidth + GRID_GAP}
                                    rowCount={rowCount}
                                    rowHeight={cellHeight + GRID_GAP}
                                    width={width}
                                    height={height}
                                    overscanRowCount={3}
                                >
                                    {FavCell}
                                </FixedSizeGrid>
                            );
                        }}
                    </AutoSizer>
                </div>
            </SortableContext>
        </DndContext>
    );

    // All other modes: virtualised FixedSizeGrid
    const renderVirtualGrid = () => (
        <div ref={gridRef} className="h-full">
            <AutoSizer>
                {({ width, height }) => {
                    const innerWidth = width - GRID_PADDING * 2;
                    const cellWidth = Math.floor((innerWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);
                    const cellHeight = Math.floor(cellWidth * 1.15);
                    const rowCount = Math.ceil(photos.length / gridColumns);

                    const Cell = ({ columnIndex, rowIndex, style }) => {
                        const index = rowIndex * gridColumns + columnIndex;
                        if (index >= photos.length) return null;
                        const photo = photos[index];
                        // Adjust style to add gap via padding
                        const cellStyle = {
                            ...style,
                            left: (style.left || 0) + GRID_PADDING + columnIndex * GRID_GAP,
                            top: (style.top || 0) + GRID_PADDING + rowIndex * GRID_GAP,
                            width: cellWidth,
                            height: cellHeight,
                        };
                        return (
                            <div style={cellStyle}>
                                <PhotoCard
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
                            </div>
                        );
                    };

                    return (
                        <FixedSizeGrid
                            columnCount={gridColumns}
                            columnWidth={cellWidth + GRID_GAP}
                            rowCount={rowCount}
                            rowHeight={cellHeight + GRID_GAP}
                            width={width}
                            height={height}
                            overscanRowCount={3}
                        >
                            {Cell}
                        </FixedSizeGrid>
                    );
                }}
            </AutoSizer>
        </div>
    );

    return (
        <>
            {filterMode === 'favorites' ? renderFavoritesGrid() : renderVirtualGrid()}

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
