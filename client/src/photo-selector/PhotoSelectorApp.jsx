import { useEffect, useState } from 'react';
import usePhotoSelectorStore from './stores/photoSelectorStore';
import GridView from './components/GridView';
import SingleView from './components/SingleView';
import CompareView from './components/CompareView';
import SelectionPanel from './components/SelectionPanel';
import Toolbar from './components/Toolbar';
import FaceRecognition from './components/FaceRecognition';
import StartupScreen from './components/StartupScreen';
import useAutoSave from './hooks/useAutoSave';
import useKeyboardNav from './hooks/useKeyboardNav';
import usePhotoLoader from './hooks/usePhotoLoader';
import { archivesApi, settingsApi } from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, FolderOpen, Copy, AlertTriangle } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function PhotoSelectorApp() {
    const [startupComplete, setStartupComplete] = useState(false);
    const [initializing, setInitializing] = useState(false);
    const [selectionOpen, setSelectionOpen] = useState(false);
    const [faceRecognitionOpen, setFaceRecognitionOpen] = useState(false);
    const [backConfirmOpen, setBackConfirmOpen] = useState(false);

    // Copy progress (Mode 1)
    const [copyProgress, setCopyProgress] = useState(null); // { current, total, fileName, percent }

    const currentView = usePhotoSelectorStore(s => s.currentView);
    const photosLoading = usePhotoSelectorStore(s => s.photosLoading);
    const photos = usePhotoSelectorStore(s => s.photos);
    const favorites = usePhotoSelectorStore(s => s.favorites);
    const numberedPhotos = usePhotoSelectorStore(s => s.numberedPhotos);
    const operationMode = usePhotoSelectorStore(s => s.operationMode);
    const initFromConfig = usePhotoSelectorStore(s => s.initFromConfig);
    const isDirty = usePhotoSelectorStore(s => s.isDirty);

    const { performSave } = useAutoSave();
    useKeyboardNav({ onOpenSelection: () => setSelectionOpen(true) });
    const { loadPhotos } = usePhotoLoader();

    const authLoading = useAuthStore(s => s.loading);

    // Check if opened with URL params (from main app)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const folderPath = params.get('folderPath');
        if (folderPath) {
            // Opened from main app with params — skip startup screen
            const config = {
                archiveId: params.get('archiveId'),
                archiveNo: params.get('archiveNo'),
                folderPath,
                shootType: params.get('shootType'),
                shootCategory: params.get('shootCategory'),
                customerName: params.get('customerName'),
                operationMode: 'archive_existing',
            };
            initFromConfig(config);
            setStartupComplete(true);
            setInitializing(true);
            loadPhotos(folderPath).finally(() => setInitializing(false));
        }
    }, []);

    // ==================== MODE 1 — Arşiv Kaydı Aç ====================
    const handleMode1 = async ({ sourcePath, shootType, shootCategory, customerName }) => {
        setStartupComplete(true);
        setInitializing(true);

        try {
            // 1. Get settings for archive base path
            const settingsResult = await settingsApi.getAll();
            const settings = settingsResult?.data;
            const basePath = settings?.general?.archive_base_path;
            if (!basePath) {
                toast.error('Arşiv kök yolu ayarlanmamış! Lütfen Ayarlar → Genel bölümünden ayarlayın.');
                setStartupComplete(false);
                setInitializing(false);
                return;
            }

            // 2. Create archive record
            const archiveData = {
                fullName: customerName || '',
                shootTypeId: shootType?.id || '',
                status: 'secim_bekliyor',
                workflowStatus: 'selection_pending',
            };
            const createResult = await archivesApi.create(archiveData);
            const archive = createResult;
            if (!archive) throw new Error('Arşiv kaydı oluşturulamadı');

            const archiveNumber = archive.archiveId || archive.archiveNumber;
            toast.success(`Arşiv #${archiveNumber} oluşturuldu`);

            // 3. Create archive folder
            const destPath = `${basePath}\\${archiveNumber}`;
            if (window.electron?.createFolder) {
                await window.electron.createFolder(destPath);
            }

            // 4. Copy photos with progress
            setCopyProgress({ current: 0, total: 0, fileName: '', percent: 0 });

            // Listen for progress events
            window.electron?.photoSelector?.onCopyProgress?.((progress) => {
                setCopyProgress(progress);
            });

            const copyResult = await window.electron?.photoSelector?.copyFiles({
                sourcePath,
                destPath,
            });

            if (!copyResult?.success) {
                toast.error('Fotoğraf kopyalama hatası: ' + (copyResult?.error || 'Bilinmeyen hata'));
                setStartupComplete(false);
                setInitializing(false);
                setCopyProgress(null);
                return;
            }

            toast.success(`${copyResult.data.copied} fotoğraf kopyalandı`);
            setCopyProgress(null);

            // 5. Update archive with folderPath
            try {
                await archivesApi.update(archive.id, { folderPath: destPath });
            } catch (e) {
                console.error('Archive folderPath update failed:', e);
            }

            // 6. Init store and load photos
            initFromConfig({
                archiveId: archive.id,
                archiveNo: archiveNumber,
                folderPath: destPath,
                shootType: shootType?.name,
                shootCategory: shootCategory,
                customerName: customerName,
                operationMode: 'archive_new',
            });

            await loadPhotos(destPath);
        } catch (err) {
            console.error('Mode 1 error:', err);
            toast.error('Hata: ' + err.message);
            setStartupComplete(false);
        } finally {
            setInitializing(false);
        }
    };

    // ==================== MODE 2 — Arşiv Seç ====================
    const handleMode2 = async (archive) => {
        setStartupComplete(true);
        setInitializing(true);

        try {
            // Get settings for archive base path
            const settingsResult = await settingsApi.getAll();
            const settings = settingsResult?.data;
            const basePath = settings?.general?.archive_base_path;

            const archiveNumber = archive.archiveNumber || archive.id;
            const folderPath = archive.folderPath || (basePath ? `${basePath}\\${archiveNumber}` : null);

            if (!folderPath) {
                toast.error('Bu arşivin klasör yolu bulunamadı ve arşiv kök yolu ayarlanmamış.');
                setStartupComplete(false);
                setInitializing(false);
                return;
            }

            // Determine shootCategory
            const shootCategory = archive.shootType?.name || archive.shootTypeName || archive.shootCategory || '';

            initFromConfig({
                archiveId: archive.id,
                archiveNo: archiveNumber,
                folderPath: folderPath,
                shootType: archive.shootType?.name || '',
                shootCategory: shootCategory,
                customerName: archive.fullName || '',
                operationMode: 'archive_existing',
            });

            await loadPhotos(folderPath);
        } catch (err) {
            console.error('Mode 2 error:', err);
            toast.error('Hata: ' + err.message);
            setStartupComplete(false);
        } finally {
            setInitializing(false);
        }
    };

    // ==================== MODE 3 — Klasör Seç ====================
    const handleMode3 = async (folderPath) => {
        setStartupComplete(true);
        setInitializing(true);

        try {
            initFromConfig({
                folderPath: folderPath,
                operationMode: 'folder_only',
            });
            await loadPhotos(folderPath);
        } catch (err) {
            console.error('Mode 3 error:', err);
            toast.error('Hata: ' + err.message);
            setStartupComplete(false);
        } finally {
            setInitializing(false);
        }
    };

    // ==================== Back / Return ====================
    const handleBack = () => {
        if (isDirty) {
            // Show confirmation dialog if there are unsaved changes
            setBackConfirmOpen(true);
        } else {
            doBack();
        }
    };

    const doBack = () => {
        setBackConfirmOpen(false);
        // If the photo selector was opened from the main app with URL params,
        // close the window and return to the main application
        if (window.electron?.photoSelector?.confirmClose) {
            window.electron.photoSelector.confirmClose();
        } else {
            // Fallback: close the window directly (works for standalone mode too)
            window.close();
        }
    };

    const handleBackWithSave = async () => {
        setBackConfirmOpen(false);
        await performSave();
        doBack();
    };

    // ==================== Save & Close ====================
    const handleSaveAndClose = async () => {
        await performSave();

        const state = usePhotoSelectorStore.getState();

        // Batch rename numbered photos
        const renameOps = state.numberedPhotos
            .filter(np => !np.isCancelled && np.orderNumber)
            .map(np => {
                const photo = state.photos.find(p => p.id === np.photoId);
                if (!photo) return null;

                const ext = photo.name?.split('.').pop() || photo.originalName?.split('.').pop() || 'jpg';
                const paddedNum = String(np.orderNumber).padStart(2, '0');
                const dir = (photo.fullPath || photo.path)?.replace(/[\\/][^\\/]+$/, '') || '';
                const newName = `${paddedNum}.${ext}`;
                const newPath = dir ? `${dir}\\${newName}` : newName;

                if (photo.originalName === newName || photo.currentName === newName) return null;

                return { oldPath: photo.fullPath || photo.path, newPath };
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

        // If archive mode, update the archive record
        if ((state.operationMode === 'archive_new' || state.operationMode === 'archive_existing')
            && state.archiveInfo?.archiveId) {
            try {
                const photoSelectionData = {
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
                };

                // Build abbreviation summary for açıklama 1
                const summaryParts = state.numberedPhotos
                    .filter(np => !np.isCancelled)
                    .map(np => {
                        const summary = np.optionDetails?._summary;
                        if (summary) return `#${np.number}: ${summary}`;
                        return null;
                    })
                    .filter(Boolean);
                const description1 = summaryParts.join(', ');

                await archivesApi.update(state.archiveInfo.archiveId, {
                    photoSelectionData,
                    selectedCount: photoSelectionData.selectedCount,
                    autoPrice: state.totalPrice,
                    workflowStatus: 'selection_complete',
                    ...(description1 ? { description1 } : {}),
                });

                toast.success('Arşiv kaydı güncellendi');
            } catch (err) {
                console.error('Archive update error:', err);
                toast.error('Arşiv güncelleme hatası: ' + err.message);
            }
        }

        // Send result to main window (if opened from main app)
        const result = {
            archiveId: state.archiveInfo?.archiveId,
            selectedCount: state.numberedPhotos.filter(np => !np.isCancelled).length,
            totalAmount: state.totalPrice,
        };

        await window.electron?.photoSelector?.sendResult(result);
        window.electron?.photoSelector?.confirmClose();
    };

    // ==================== RENDERING ====================

    if (authLoading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-neutral-900">
                <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-4" />
                <p className="text-neutral-400 text-sm">Oturum kontrol ediliyor...</p>
            </div>
        );
    }

    // Startup screen
    if (!startupComplete) {
        return (
            <StartupScreen
                onStartMode1={handleMode1}
                onStartMode2={handleMode2}
                onStartMode3={handleMode3}
            />
        );
    }

    // Copy progress screen (Mode 1)
    if (copyProgress) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-neutral-900 gap-4">
                <Copy className="w-12 h-12 text-amber-400 mb-2" />
                <h2 className="text-lg font-semibold text-neutral-200">Fotoğraflar Kopyalanıyor...</h2>
                <p className="text-sm text-neutral-400">{copyProgress.fileName}</p>

                {/* Progress Bar */}
                <div className="w-80 h-3 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
                    <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-200"
                        style={{ width: `${copyProgress.percent || 0}%` }}
                    />
                </div>

                <p className="text-xs text-neutral-500">
                    {copyProgress.current} / {copyProgress.total} dosya
                </p>
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
                onBack={handleBack}
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
                {operationMode && (
                    <span className="text-neutral-600">
                        {operationMode === 'archive_new' ? '📁 Yeni Arşiv' :
                            operationMode === 'archive_existing' ? '📋 Arşiv Seçimi' :
                                '🖥️ Bağımsız'}
                    </span>
                )}
                {isDirty && <span className="text-amber-400">Kaydedilmemiş değişiklik</span>}
            </div>

            {selectionOpen && (
                <SelectionPanel onClose={() => setSelectionOpen(false)} />
            )}

            {faceRecognitionOpen && (
                <FaceRecognition onClose={() => setFaceRecognitionOpen(false)} />
            )}

            {/* Back confirmation dialog */}
            {backConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <h3 className="text-base font-semibold text-neutral-100">
                                Kaydedilmemis Degisiklikler
                            </h3>
                        </div>
                        <p className="text-sm text-neutral-400 mb-6">
                            Kaydedilmemis degisiklikleriniz var. Cikmadan once kaydetmek ister misiniz?
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setBackConfirmOpen(false)}
                                className="px-4 py-2 text-sm rounded-lg bg-neutral-700 text-neutral-300
                                           hover:bg-neutral-600 transition-colors"
                            >
                                Iptal
                            </button>
                            <button
                                onClick={doBack}
                                className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400
                                           hover:bg-red-500/30 transition-colors"
                            >
                                Kaydetmeden Cik
                            </button>
                            <button
                                onClick={handleBackWithSave}
                                className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-neutral-900
                                           hover:bg-amber-400 transition-colors font-medium"
                            >
                                Kaydet ve Cik
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
