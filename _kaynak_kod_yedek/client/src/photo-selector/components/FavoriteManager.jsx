import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { Star, RotateCcw, ImageOff } from 'lucide-react';

export default function FavoriteManager() {
    const photos = usePhotoSelectorStore(s => s.photos);
    const removedFavorites = usePhotoSelectorStore(s => s.removedFavorites);
    const restoreFavorite = usePhotoSelectorStore(s => s.restoreFavorite);

    const removedPhotos = photos.filter(p => removedFavorites.has(p.id));

    if (removedPhotos.length === 0) {
        return (
            <div className="p-4 text-center text-neutral-500 text-sm">
                <p>Bu oturumda favoriden kaldırılan fotoğraf yok</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                Favoriden Kaldırılanlar ({removedPhotos.length})
            </h3>
            <div className="space-y-1">
                {removedPhotos.map(photo => {
                    const thumbnailSrc = photo.thumbnailPath
                        ? `file:///${photo.thumbnailPath.replace(/\\/g, '/')}`
                        : null;

                    return (
                        <div key={photo.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg
                                       bg-neutral-800/50 border border-neutral-800 group">
                            {thumbnailSrc ? (
                                <img src={thumbnailSrc}
                                    className="w-10 h-10 object-cover rounded opacity-60" alt="" />
                            ) : (
                                <div className="w-10 h-10 flex items-center justify-center
                                                bg-neutral-800 rounded">
                                    <ImageOff className="w-4 h-4 text-neutral-600" />
                                </div>
                            )}

                            <span className="flex-1 text-sm text-neutral-400 truncate">
                                {photo.currentName}
                            </span>

                            <button
                                onClick={() => restoreFavorite(photo.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs
                                           text-amber-400 hover:bg-amber-500/10 rounded
                                           transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Geri Al
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
