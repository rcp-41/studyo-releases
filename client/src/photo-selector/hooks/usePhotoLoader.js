import { useEffect, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { deserializeFromIni } from '../utils/iniManager';
import { toast } from 'sonner';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'bmp', 'cr2', 'nef', 'arw', 'dng'];

export default function usePhotoLoader() {
    const setPhotos = usePhotoSelectorStore(s => s.setPhotos);
    const setPhotosLoading = usePhotoSelectorStore(s => s.setPhotosLoading);
    const setThumbnailProgress = usePhotoSelectorStore(s => s.setThumbnailProgress);
    const setAllThumbnails = usePhotoSelectorStore(s => s.setAllThumbnails);
    const restoreFromIni = usePhotoSelectorStore(s => s.restoreFromIni);

    const loadPhotos = useCallback(async (folderPath) => {
        if (!folderPath) return;

        setPhotosLoading(true);

        try {
            // Load photos from folder
            console.log('[PhotoLoader] folderPath:', folderPath);
            console.log('[PhotoLoader] window.electron exists:', !!window.electron);
            console.log('[PhotoLoader] getFilesInFolder exists:', !!window.electron?.getFilesInFolder);
            console.log('[PhotoLoader] IMAGE_EXTENSIONS:', IMAGE_EXTENSIONS);

            const files = await window.electron?.getFilesInFolder(folderPath, IMAGE_EXTENSIONS);
            console.log('[PhotoLoader] files result:', files);

            if (!files || files.length === 0) {
                toast('Bu klasörde fotoğraf bulunamadı', { icon: '📂' });
                setPhotos([]);
                return;
            }

            const photoList = files.map(fullPath => {
                const fileName = fullPath.split(/[/\\]/).pop();
                return {
                    id: fileName,
                    originalName: fileName,
                    currentName: fileName,
                    fullPath,
                    thumbnailPath: null,
                    width: 0,
                    height: 0,
                    fileSize: 0,
                    exifDate: null,
                    status: 'none',
                    orderNumber: null,
                    options: [],
                    optionDetails: {},
                    isCancelled: false,
                };
            });

            setPhotos(photoList);

            // Try to restore from .ini
            try {
                const iniResult = await window.electron?.photoSelector?.readIni({ folderPath });
                if (iniResult?.success && iniResult.data) {
                    const restored = deserializeFromIni(iniResult.data);
                    restoreFromIni(restored);
                }
            } catch (err) {
                console.error('INI restore failed:', err);
            }

            // Generate thumbnails in background
            generateThumbnails(folderPath);

        } catch (err) {
            console.error('Photo loading error:', err);
            toast.error('Fotoğraflar yüklenemedi: ' + err.message);
            setPhotos([]);
        }
    }, [setPhotos, setPhotosLoading, restoreFromIni]);

    const generateThumbnails = useCallback(async (folderPath) => {
        // Listen for progress events
        window.electron?.photoSelector?.onThumbnailProgress?.((progress) => {
            setThumbnailProgress(progress);
        });

        try {
            const result = await window.electron?.photoSelector?.generateThumbnails({
                folderPath,
                size: 300,
            });

            if (result?.success && result.data?.thumbnailDir) {
                // Normalize path separators for file:// URLs
                const normalizedDir = result.data.thumbnailDir.replace(/\\/g, '/');
                setAllThumbnails(normalizedDir);

                if (result.data.failed.length > 0) {
                    toast(`${result.data.failed.length} fotoğraf için thumbnail oluşturulamadı`, {
                        icon: '⚠️',
                        duration: 5000,
                    });
                }
            }
        } catch (err) {
            console.error('Thumbnail generation error:', err);
        }
    }, [setThumbnailProgress, setAllThumbnails]);

    return { loadPhotos };
}
