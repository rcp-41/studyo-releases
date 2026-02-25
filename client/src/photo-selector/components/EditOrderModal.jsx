import { useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';

export default function EditOrderModal({ numberedPhotos, onReorder, onCancel, onClose }) {
    const [items, setItems] = useState(
        [...numberedPhotos].sort((a, b) => a.orderNumber - b.orderNumber)
    );
    const [dragIndex, setDragIndex] = useState(null);
    const [overIndex, setOverIndex] = useState(null);

    const photos = usePhotoSelectorStore(s => s.photos);

    // Photo lookup
    const photoMap = {};
    photos.forEach(p => { photoMap[p.id] = p; });

    const handleDragStart = (e, index) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIndex) return;

        const newItems = [...items];
        const [moved] = newItems.splice(dragIndex, 1);
        newItems.splice(dropIndex, 0, moved);

        const renumbered = newItems.map((item, i) => ({
            ...item, orderNumber: i + 1
        }));

        setItems(renumbered);
        setDragIndex(null);
        setOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setOverIndex(null);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative bg-neutral-800 border border-neutral-700 rounded-xl
                            shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sıralama Düzenle</h2>
                    <button onClick={onClose}
                        className="p-2 hover:bg-neutral-700 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto ps-scrollbar p-4 space-y-1">
                    {items.map((item, index) => {
                        const photo = photoMap[item.photoId];
                        const thumbnailSrc = photo?.thumbnailPath
                            ? `file:///${photo.thumbnailPath.replace(/\\/g, '/')}`
                            : null;

                        return (
                            <div
                                key={item.photoId}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab
                                    transition-colors
                                    ${dragIndex === index
                                        ? 'opacity-50 border-amber-500'
                                        : overIndex === index && dragIndex !== index
                                            ? 'bg-amber-500/10 border-amber-500/50'
                                            : 'border-neutral-700 bg-neutral-900'
                                    }
                                    ${item.isCancelled ? 'opacity-40' : ''}
                                `}
                            >
                                <GripVertical className="w-4 h-4 text-neutral-500 shrink-0" />

                                <span className="font-mono text-amber-400 w-8 text-center shrink-0">
                                    {item.orderNumber}
                                </span>

                                {thumbnailSrc && (
                                    <img src={thumbnailSrc}
                                        className="w-12 h-12 object-cover rounded shrink-0" alt="" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm truncate block ${item.isCancelled ? 'line-through' : ''}`}>
                                        {photo?.currentName || item.photoId}
                                    </span>
                                    {item.options.length > 0 && (
                                        <span className="text-xs text-neutral-500">
                                            {item.options.join(', ')}
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCancel(item.photoId);
                                        setItems(prev => prev.map(it =>
                                            it.photoId === item.photoId
                                                ? { ...it, isCancelled: !it.isCancelled }
                                                : it
                                        ));
                                    }}
                                    className={`text-xs px-2 py-1 rounded transition-colors shrink-0 ${item.isCancelled
                                            ? 'text-green-400 hover:bg-green-500/20'
                                            : 'text-red-400 hover:bg-red-500/20'
                                        }`}
                                >
                                    {item.isCancelled ? 'GERİ AL' : 'İPTAL'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-700 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-neutral-600 rounded-lg
                                   hover:bg-neutral-700 transition-colors">
                        Vazgeç
                    </button>
                    <button onClick={() => onReorder(items)}
                        className="flex-1 px-4 py-2 bg-amber-500 text-neutral-900 rounded-lg
                                   hover:bg-amber-400 font-medium transition-colors">
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
