import { useEffect, useState } from 'react';
import usePhotoSelectorStore from './stores/photoSelectorStore';
import GridView from './components/GridView';
import SingleView from './components/SingleView';
import CompareView from './components/CompareView';
import SelectionPanel from './components/SelectionPanel';
import PackageSidebar from './components/PackageSidebar';
import Toolbar from './components/Toolbar';
import FaceRecognition from './components/FaceRecognition';
import StartupScreen from './components/StartupScreen';
import useAutoSave from './hooks/useAutoSave';
import useKeyboardNav from './hooks/useKeyboardNav';
import usePhotoLoader from './hooks/usePhotoLoader';
import { archivesApi, settingsApi, pixonaiApi } from '../services/api';
import { toast } from 'sonner';
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
    const setPixonaiConfig = usePhotoSelectorStore(s => s.setPixonaiConfig);
    const shootCategoryType = usePhotoSelectorStore(s => s.shootCategoryType);
    const pixonaiConfig = usePhotoSelectorStore(s => s.pixonaiConfig);
    const filterMode = usePhotoSelectorStore(s => s.filterMode);

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
            loadPixonaiConfig(config.shootCategory);
        }
    }, []);

    // Helper: load pixonai config for a given shoot category
    const loadPixonaiConfig = async (shootCategory) => {
        if (!shootCategory) return;
        try {
            console.log('[Pixonai] Loading config for shootCategory:', shootCategory);
            const result = await pixonaiApi.getConfig(shootCategory);
            console.log('[Pixonai] getConfig result:', result);
            if (result?.config) {
                setPixonaiConfig(result.config);
            } else {
                console.warn('[Pixonai] No config found for:', shootCategory);
            }
        } catch (err) {
            console.warn('[Pixonai] getConfig error:', err);
        }
    };

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

            // Load pixonai config for this shoot category
            loadPixonaiConfig(shootCategory);

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

            // Load pixonai config for this shoot category
            loadPixonaiConfig(shootCategory);

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
    const handleMode3 = async (folderPath, pixonaiConfigObj) => {
        setStartupComplete(true);
        setInitializing(true);

        try {
            initFromConfig({
                folderPath: folderPath,
                operationMode: 'folder_only',
                shootCategory: pixonaiConfigObj?.shootCategoryId || '',
                shootCategoryType: pixonaiConfigObj?.type || 'none',
            });

            // If a pixonai config was selected, set it in the store
            if (pixonaiConfigObj) {
                setPixonaiConfig(pixonaiConfigObj);
            }

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

    // ==================== Save Numbering (no close) ====================
    const handleSaveNumbering = async () => {
        await performSave();

        const state = usePhotoSelectorStore.getState();

        // Build rename mapping
        const renameMapping = {};
        const renameOps = state.numberedPhotos
            .filter(np => !np.isCancelled && np.orderNumber)
            .map(np => {
                const photo = state.photos.find(p => p.id === np.photoId);
                if (!photo) return null;

                const ext = photo.name?.split('.').pop() || photo.originalName?.split('.').pop() || 'jpg';
                const paddedNum = String(np.orderNumber).padStart(2, '0');
                const dir = (photo.fullPath || photo.path)?.replace(/[\\/][^\\/]+$/, '') || '';

                // Collect gift codes assigned to this photo
                const suffixCodes = [];
                if (state.giftAssignments) {
                    Object.entries(state.giftAssignments).forEach(([abbr, photoIds]) => {
                        if (photoIds.includes(np.photoId)) {
                            suffixCodes.push(abbr);
                        }
                    });
                }

                // Collect option codes assigned to this photo
                if (state.optionAssignments) {
                    Object.entries(state.optionAssignments).forEach(([abbr, photoIds]) => {
                        if (photoIds.includes(np.photoId) && !suffixCodes.includes(abbr)) {
                            suffixCodes.push(abbr);
                        }
                    });
                }

                const suffix = suffixCodes.length ? ' - ' + suffixCodes.join(' - ') : '';
                const newName = `${paddedNum}${suffix}.${ext}`;
                const newPath = dir ? `${dir}\\${newName}` : newName;

                if (photo.currentName === newName && photo.originalName === newName) return null;

                renameMapping[np.photoId] = { newName, newPath };
                return { oldPath: photo.fullPath || photo.path, newPath };
            })
            .filter(Boolean);

        if (renameOps.length > 0 && window.electron?.photoSelector?.batchRename) {
            try {
                const renameResult = await window.electron.photoSelector.batchRename({ operations: renameOps });
                if (!renameResult.success) {
                    toast.error('Yeniden adlandırma hatası: ' + (renameResult.error || 'Bilinmeyen hata'));
                } else {
                    // Update BOTH originalName and currentName so INI keys match disk filenames
                    const updatedPhotos = state.photos.map(p => {
                        const mapping = renameMapping[p.id];
                        if (mapping) {
                            return {
                                ...p,
                                originalName: mapping.newName,
                                currentName: mapping.newName,
                                name: mapping.newName,
                                fullPath: mapping.newPath,
                            };
                        }
                        return p;
                    });
                    usePhotoSelectorStore.setState({ photos: updatedPhotos, isDirty: true });
                    // Re-save INI with updated originalNames so it matches files on disk
                    await performSave();
                    toast.success('Numaralandırma kaydedildi');
                }
            } catch (err) {
                toast.error('Yeniden adlandırma başarısız: ' + err.message);
            }
        } else {
            toast.success('Kaydedildi');
        }

        // Save note text file if there's a note
        if (state.noteText?.trim() && window.electron?.photoSelector?.writeFile) {
            try {
                const firstPhoto = state.photos[0];
                const dir = (firstPhoto?.fullPath || firstPhoto?.path)?.replace(/[\\/][^\\/]+$/, '') || '';
                if (dir) {
                    const notePath = `${dir}\\not.txt`;
                    await window.electron.photoSelector.writeFile({ path: notePath, content: state.noteText.trim() });
                }
            } catch (err) {
                console.error('Note save error:', err);
            }
        }
    };

    // ==================== Save & Close ====================
    const handleSaveAndClose = async () => {
        await performSave();

        const state = usePhotoSelectorStore.getState();

        // Build rename mapping: photoId -> { newName, newPath }
        const renameMapping = {};
        const renameOps = state.numberedPhotos
            .filter(np => !np.isCancelled && np.orderNumber)
            .map(np => {
                const photo = state.photos.find(p => p.id === np.photoId);
                if (!photo) return null;

                const ext = photo.name?.split('.').pop() || photo.originalName?.split('.').pop() || 'jpg';
                const paddedNum = String(np.orderNumber).padStart(2, '0');
                const dir = (photo.fullPath || photo.path)?.replace(/[\\/][^\\/]+$/, '') || '';

                // Build gift shortcodes
                const giftCodes = [];
                if (state.activePackage?.gifts) {
                    state.activePackage.gifts.forEach(gift => {
                        const assigned = state.giftAssignments[gift.abbr] || [];
                        if (assigned.includes(np.photoId)) {
                            giftCodes.push(gift.abbr);
                        }
                    });
                }

                const giftSuffix = giftCodes.length ? ' - ' + giftCodes.join(' - ') : '';
                const newName = `${paddedNum}${giftSuffix}.${ext}`;
                const newPath = dir ? `${dir}\\${newName}` : newName;

                if (photo.originalName === newName || photo.currentName === newName) return null;

                renameMapping[np.photoId] = { newName, newPath };
                return { oldPath: photo.fullPath || photo.path, newPath };
            })
            .filter(Boolean);

        if (renameOps.length > 0 && window.electron?.photoSelector?.batchRename) {
            try {
                const renameResult = await window.electron.photoSelector.batchRename({ operations: renameOps });
                if (!renameResult.success) {
                    toast.error('Yeniden adlandırma hatası: ' + (renameResult.error || 'Bilinmeyen hata'));
                } else {
                    // Update photos in store with new currentName/fullPath so INI re-save is accurate
                    const updatedPhotos = state.photos.map(p => {
                        const mapping = renameMapping[p.id];
                        if (mapping) {
                            return { ...p, currentName: mapping.newName, fullPath: mapping.newPath };
                        }
                        return p;
                    });
                    usePhotoSelectorStore.setState({ photos: updatedPhotos, isDirty: true });

                    // Re-save INI with updated file names so next load matches correctly
                    await performSave();
                }
            } catch (err) {
                toast.error('Yeniden adlandırma başarısız: ' + err.message);
            }
        }

        // Save note text file if there's a note
        if (state.noteText?.trim() && window.electron?.photoSelector?.writeFile) {
            try {
                const firstPhoto = state.photos[0];
                const dir = (firstPhoto?.fullPath || firstPhoto?.path)?.replace(/[\\/][^\\/]+$/, '') || '';
                if (dir) {
                    const notePath = `${dir}\\not.txt`;
                    await window.electron.photoSelector.writeFile({ path: notePath, content: state.noteText.trim() });
                }
            } catch (err) {
                console.error('Note save error:', err);
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
                    giftAssignments: state.giftAssignments || {},
                    activePackage: state.activePackage ? {
                        id: state.activePackage.id,
                        name: state.activePackage.name,
                        price: state.activePackage.price,
                    } : null,
                };

                // Build abbreviation summary for açıklama 1
                const summaryParts = state.numberedPhotos
                    .filter(np => !np.isCancelled)
                    .map(np => {
                        const summary = np.optionDetails?._summary;
                        if (summary) return `#${np.number || np.orderNumber}: ${summary}`;
                        return null;
                    })
                    .filter(Boolean);
                const description1 = summaryParts.join(', ');

                // Fetch existing archive to append to notes safely
                let newNotes = undefined;
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../lib/firebase');
                    const archiveSnap = await getDoc(doc(db, 'archives', state.archiveInfo.archiveId));
                    const currentNotes = archiveSnap.exists() ? (archiveSnap.data().notes || '') : '';
                    
                    const giftSummary = state.activePackage?.gifts?.map(g => {
                        const count = (state.giftAssignments[g.abbr] || []).length;
                        return count > 0 ? `${count}x ${g.name}` : null;
                    }).filter(Boolean).join(', ') || '';

                    const selectionSummary = `\n\n--- PIXONAI SEÇİM (${new Date().toLocaleDateString('tr-TR')}) ---\nSeçilen Paket: ${state.activePackage?.name || 'Yok'}\nTutar: ${state.totalPrice} TL${giftSummary ? '\nHediyeler: ' + giftSummary : ''}\nDetaylar: ${description1}`;
                    newNotes = currentNotes ? currentNotes + selectionSummary : selectionSummary.trim();
                } catch (err) {
                    console.warn('Could not append to notes:', err);
                }

                await archivesApi.update(state.archiveInfo.archiveId, {
                    photoSelectionData,
                    selectedCount: photoSelectionData.selectedCount,
                    autoPrice: state.totalPrice,
                    workflowStatus: 'selection_complete',
                    ...(description1 ? { description1 } : {}),
                    ...(newNotes !== undefined ? { notes: newNotes } : {}),
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
                onSaveNumbering={handleSaveNumbering}
                onOpenFaceRecognition={() => setFaceRecognitionOpen(true)}
                onBack={handleBack}
            />

            <main className="flex-1 overflow-hidden flex">
                <div className="flex-1 overflow-hidden">
                    {currentView === 'grid' && <GridView />}
                    {currentView === 'single' && <SingleView />}
                    {currentView === 'compare' && <CompareView />}
                </div>

                {/* Show sidebar when there's a pixonai config, shoot category, or numbered photos */}
                {(pixonaiConfig || (shootCategoryType && shootCategoryType !== 'none') || numberedPhotos.length > 0) && (
                    <PackageSidebar onSaveNumbering={handleSaveNumbering} />
                )}
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
