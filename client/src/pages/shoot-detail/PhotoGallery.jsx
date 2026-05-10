import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../services/api';
import notify from '../../lib/notify';
import { Image, Camera, FolderOpen, Loader2, X, ChevronDown } from 'lucide-react';

export default function PhotoGallery({ archiveNumber, photoSelectionData }) {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lightbox, setLightbox] = useState(null);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.getAll().then(r => r.data)
    });

    const basePath = settings?.general?.archiveFolderPath || '';

    const loadPhotos = async () => {
        if (!basePath || !archiveNumber) {
            notify.error('Arşiv klasör yolu ayarlanmamış');
            return;
        }
        setLoading(true);
        try {
            const folderPath = `${basePath}\\${archiveNumber}`;
            if (window.electron?.listPhotos) {
                const result = await window.electron.listPhotos(folderPath);
                if (result.success) {
                    setPhotos(result.files || []);
                    if (!result.files?.length) notify.info('Klasörde fotoğraf bulunamadı');
                } else {
                    notify.error(result.error || 'Fotoğraflar yüklenemedi');
                }
            } else {
                if (window.electron?.openFolder) {
                    await window.electron.openFolder(folderPath);
                }
            }
        } catch {
            notify.error('Fotoğraf yükleme hatası');
        }
        setLoading(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Image className="w-5 h-5" /> Fotoğraflar
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={loadPhotos}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        Fotoğrafları Yükle
                    </button>
                    {basePath && (
                        <button
                            onClick={async () => {
                                const folderPath = `${basePath}\\${archiveNumber}`;
                                if (window.electron?.openFolder) await window.electron.openFolder(folderPath);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80"
                        >
                            <FolderOpen className="w-4 h-4" /> Klasörü Aç
                        </button>
                    )}
                </div>
            </div>

            {photos.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo, i) => {
                        const fileName = photo.name || photo.path?.split(/[/\\]/).pop();
                        const selectedInfo = photoSelectionData?.selectedPhotos?.find(
                            sp => String(sp.photoId) === fileName || String(sp.photoId) === String(i)
                        );
                        const isNumbered = selectedInfo && !selectedInfo.isCancelled;

                        return (
                            <div
                                key={i}
                                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${isNumbered ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-primary'}`}
                                onClick={() => setLightbox(photo)}
                            >
                                <img src={photo.thumbnail || photo.path} alt="" className="w-full h-full object-cover" />
                                {isNumbered && (
                                    <div className="absolute top-1.5 right-1.5 bg-amber-500 text-black font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full shadow border-2 border-neutral-900 shadow-black/50">
                                        {selectedInfo.orderNumber}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">
                    "Fotoğrafları Yükle" butonuna tıklayarak klasördeki fotoğrafları görüntüleyin
                </p>
            )}

            {lightbox && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    onClick={() => setLightbox(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setLightbox(null);
                        if (e.key === 'ArrowRight') {
                            const idx = photos.findIndex(p => p.path === lightbox.path);
                            if (idx < photos.length - 1) setLightbox(photos[idx + 1]);
                        }
                        if (e.key === 'ArrowLeft') {
                            const idx = photos.findIndex(p => p.path === lightbox.path);
                            if (idx > 0) setLightbox(photos[idx - 1]);
                        }
                    }}
                    tabIndex={0}
                    ref={(el) => el?.focus()}
                >
                    <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg z-10"
                        onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
                        <X className="w-6 h-6" />
                    </button>
                    {photos.findIndex(p => p.path === lightbox.path) > 0 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = photos.findIndex(p => p.path === lightbox.path);
                                setLightbox(photos[idx - 1]);
                            }}
                        >
                            <ChevronDown className="w-8 h-8 -rotate-90" />
                        </button>
                    )}
                    {photos.findIndex(p => p.path === lightbox.path) < photos.length - 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                const idx = photos.findIndex(p => p.path === lightbox.path);
                                setLightbox(photos[idx + 1]);
                            }}
                        >
                            <ChevronDown className="w-8 h-8 rotate-90" />
                        </button>
                    )}
                    <img src={lightbox.path} alt="" className="max-w-[90vw] max-h-[90vh] object-contain select-none" draggable={false} />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                        {photos.findIndex(p => p.path === lightbox.path) + 1} / {photos.length}
                    </div>
                </div>
            )}
        </div>
    );
}
