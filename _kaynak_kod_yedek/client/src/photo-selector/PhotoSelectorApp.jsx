import { useEffect, useState } from 'react';
import usePhotoSelectorStore from './stores/photoSelectorStore';
import GridView from './components/GridView';
import SingleView from './components/SingleView';
import CompareView from './components/CompareView';
import SelectionPanel from './components/SelectionPanel';
import Toolbar from './components/Toolbar';
import FaceRecognition from './components/FaceRecognition';
import useAutoSave from './hooks/useAutoSave';
import useKeyboardNav from './hooks/useKeyboardNav';
import usePhotoLoader from './hooks/usePhotoLoader';
import toast from 'react-hot-toast';
import { Loader2, FolderOpen } from 'lucide-react';

export default function PhotoSelectorApp() {
    const [initializing, setInitializing] = useState(true);
    const [selectionOpen, setSelectionOpen] = useState(false);
    const [noFolder, setNoFolder] = useState(false);
    const [faceRecognitionOpen, setFaceRecognitionOpen] = useState(false);

    const currentView = usePhotoSelectorStore(s => s.currentView);
    const photosLoading = usePhotoSelectorStore(s => s.photosLoading);
    const photos = usePhotoSelectorStore(s => s.photos);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const initFromConfig = usePhotoSelectorStore(s => s.initFromConfig);
    const isDirty = usePhotoSelectorStore(s => s.isDirty);

    const { performSave } = useAutoSave();
    useKeyboardNav({ onOpenSelection: () => setSelectionOpen(true) });
    const { loadPhotos } = usePhotoLoader();

    // Initialize from URL params
    useEffect(() => {
        const init = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const config = {
                    archiveId: params.get('archiveId'),
                    archiveNo: params.get('archiveNo'),
                    folderPath: params.get('folderPath'),
                    shootType: params.get('shootType'),
                    shootCategory: params.get('shootCategory'),
                    customerName: params.get('customerName'),
                };

                // If no folderPath, use the new selectFolder IPC
                if (!config.folderPath) {
                    const selected = await window.electron?.photoSelector?.selectFolder();
                    if (!selected) {
                        setNoFolder(true);
                        setInitializing(false);
                        return;
                    }
                    config.folderPath = selected;
                }

                initFromConfig(config);
                await loadPhotos(config.folderPath);
            } catch (err) {
                console.error('Init error:', err);
                toast.error('Başlangıç hatası: ' + err.message);
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, []);

    // Save & close handler — saves selection state, runs batch rename, then notifies main window
    const handleSaveAndClose = async () => {
        await performSave();

        const state = usePhotoSelectorStore.getState();

        // Batch rename numbered photos (e.g. 001.jpg, 002.jpg ...)
        const renameOps = state.numberedPhotos
            .filter(np => !np.isCancelled && np.orderNumber)
            .map(np => {
                const photo = state.photos.find(p => p.id === np.photoId);
                if (!photo) return null;

                const ext = photo.name?.split('.').pop() || 'jpg';
                const paddedNum = String(np.orderNumber).padStart(3, '0');
                const dir = photo.path?.replace(/[\\/][^\\/]+$/, '') || '';
                const newName = `${paddedNum}.${ext}`;
                const newPath = dir ? `${dir}\\${newName}` : newName;

                // Skip if already correctly named
                if (photo.name === newName) return null;

                return { oldPath: photo.path, newPath };
            })
            .filter(Boolean);

        if (renameOps.length > 0 && window.electron?.photoSelector?.batchRename) {
            try {
                const renameResult = await window.electron.photoSelector.batchRename({ operations: renameOps });
                if (!renameResult.success) {
                    toast.error('Yeniden adlandırma hatası: ' + (renameResult.error || 'Bilinmeyen hata'));
                }
            } catch (err) {
                toast.error('Yeniden adlandırma başarısız: ' + err.message);
            }
        }

        // Send result to main window
        const result = {
            archiveId: state.archiveInfo?.archiveId,
            selectedCount: state.numberedPhotos.filter(np => !np.isCancelled).length,
            totalAmount: state.totalPrice,
            autoDescription: '',
            photoSelectionData: {
                version: 1,
                completedAt: new Date().toISOString(),
                shootCategory: state.archiveInfo?.shootCategory || '',
                selectedPhotos: state.numberedPhotos.map(np => ({
                    photoId: np.photoId,
                    orderNumber: np.orderNumber,
                    options: np.options,
                    optionDetails: np.optionDetails,
                    isCancelled: np.isCancelled,
                })),
                totalPhotos: state.photos.length,
                favoriteCount: state.favorites.size,
                selectedCount: state.numberedPhotos.filter(np => !np.isCancelled).length,
                totalPrice: state.totalPrice,
            },
        };

        await window.electron?.photoSelector?.sendResult(result);
        window.electron?.photoSelector?.confirmClose();
    };

    // No folder selected — standalone startup screen
    if (noFolder) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-neutral-900 gap-4">
                <FolderOpen className="w-16 h-16 text-neutral-600" />
                <p className="text-neutral-400">Klasör seçilmedi</p>
                <button
                    onClick={async () => {
                        const selected = await window.electron?.photoSelector?.selectFolder();
                        if (selected) {
                            setNoFolder(false);
                            setInitializing(true);
                            const config = { folderPath: selected };
                            initFromConfig(config);
                            await loadPhotos(config.folderPath);
                            setInitializing(false);
                        }
                    }}
                    className="px-6 py-2 bg-amber-500 text-neutral-900 rounded-lg
                               hover:bg-amber-400 font-medium transition-colors"
                >
                    Klasör Seç
                </button>
            </div>
        );
    }

    // Loading
    if (initializing || photosLoading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-neutral-900">
                <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-4" />
                <p className="text-neutral-400 text-sm">Fotoğraflar yükleniyor...</p>
            </div>
        );
    }

    const filteredPhotos = usePhotoSelectorStore.getState().getFilteredPhotos();

    return (
        <div className="h-screen flex flex-col bg-neutral-900 text-neutral-100 overflow-hidden select-none">
            <Toolbar
                onOpenSelection={() => setSelectionOpen(true)}
                onSaveAndClose={handleSaveAndClose}
                onOpenFaceRecognition={() => setFaceRecognitionOpen(true)}
            />

            <main className="flex-1 overflow-hidden">
                {currentView === 'grid' && <GridView />}
                {currentView === 'single' && <SingleView />}
                {currentView === 'compare' && <CompareView />}
            </main>

            {/* Status bar */}
            <div className="ps-statusbar">
                <span>{filteredPhotos.length} fotoğraf</span>
                <span>{favorites.size} favori</span>
                <span>{numberedPhotos.filter(np => !np.isCancelled).length} numaralandırılmış</span>
                {isDirty && <span className="text-amber-400">Kaydedilmemiş değişiklik</span>}
            </div>

            {selectionOpen && (
                <SelectionPanel onClose={() => setSelectionOpen(false)} />
            )}

            {faceRecognitionOpen && (
                <FaceRecognition onClose={() => setFaceRecognitionOpen(false)} />
            )}
        </div>
    );
}
