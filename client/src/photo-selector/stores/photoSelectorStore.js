import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePhotoSelectorStore = create(
    persist(
        (set, get) => ({
            // ============ CONFIG ============
            archiveInfo: null,
            operationMode: null, // 'archive_new' | 'archive_existing' | 'folder_only'

            // ============ PHOTOS ============
            photos: [],
            photosLoading: false,
            thumbnailProgress: { done: 0, total: 0 },

            // ============ VIEW STATE ============
            currentView: 'grid',
            selectedIndex: 0,
            compareIndices: [0, 1],
            zoomLevel: 1,
            panOffset: { x: 0, y: 0 },
            filterMode: 'all',
            gridColumns: 5,

            // ============ FAVORITES ============
            favorites: new Set(),
            removedFavorites: new Set(),

            // ============ NUMBERING ============
            numberedPhotos: [],
            nextOrderNumber: 1,

            // ============ PRICING ============
            priceList: null,
            priceBreakdown: [],
            totalPrice: 0,

            // ============ UNDO/REDO ============
            undoStack: [],
            redoStack: [],

            // ============ SAVE STATE ============
            isDirty: false,
            lastSavedAt: null,

            // ============ ACTIONS ============

            initFromConfig: (config) => set({
                archiveInfo: config,
                operationMode: config.operationMode || null,
                photos: [],
                favorites: new Set(),
                removedFavorites: new Set(),
                numberedPhotos: [],
                undoStack: [],
                redoStack: [],
                currentView: 'grid',
                selectedIndex: 0,
                filterMode: 'all',
                isDirty: false,
                nextOrderNumber: 1,
                priceBreakdown: [],
                totalPrice: 0,
            }),

            setOperationMode: (mode) => set({ operationMode: mode }),

            setPhotos: (photos) => set({
                photos,
                photosLoading: false,
                // Clear stale data from Zustand persist (previous session) to prevent
                // flash of incorrect numbered/favorites between setPhotos and restoreFromIni
                numberedPhotos: [],
                nextOrderNumber: 1,
                favorites: new Set(),
                removedFavorites: new Set(),
            }),
            setPhotosLoading: (loading) => set({ photosLoading: loading }),
            setThumbnailProgress: (progress) => set({ thumbnailProgress: progress }),

            updatePhotoThumbnail: (photoId, thumbnailPath) => {
                const { photos } = get();
                set({
                    photos: photos.map(p =>
                        p.id === photoId ? { ...p, thumbnailPath } : p
                    )
                });
            },

            setAllThumbnails: (thumbnailDir) => {
                const { photos } = get();
                set({
                    photos: photos.map(p => {
                        // Use currentName (disk filename) for thumbnail lookup,
                        // since thumbnails are generated from actual files on disk
                        const diskName = p.currentName || p.originalName;
                        const thumbName = diskName.replace(/\.[^.]+$/, '.jpg');
                        return { ...p, thumbnailPath: `${thumbnailDir}/${thumbName}` };
                    })
                });
            },

            // --- View ---
            setView: (view) => set({
                currentView: view,
                zoomLevel: 1,
                panOffset: { x: 0, y: 0 }
            }),
            setSelectedIndex: (index) => set({ selectedIndex: index }),
            setCompareIndices: (indices) => set({ compareIndices: indices }),
            setZoom: (level) => set({ zoomLevel: Math.max(0.5, Math.min(level, 10)) }),
            setPan: (offset) => set({ panOffset: offset }),
            setFilterMode: (mode) => set({ filterMode: mode, selectedIndex: 0 }),
            setGridColumns: (cols) => set({ gridColumns: cols }),

            // --- Favorites ---
            toggleFavorite: (photoId) => {
                const { favorites, removedFavorites, undoStack } = get();
                const newFavs = new Set(favorites);
                const newRemoved = new Set(removedFavorites);
                const wasFavorite = newFavs.has(photoId);

                if (wasFavorite) {
                    newFavs.delete(photoId);
                    newRemoved.add(photoId);
                } else {
                    newFavs.add(photoId);
                    newRemoved.delete(photoId);
                }

                set({
                    favorites: newFavs,
                    removedFavorites: newRemoved,
                    undoStack: [...undoStack, {
                        type: 'toggleFavorite',
                        payload: { photoId, wasFavorite },
                        timestamp: Date.now()
                    }],
                    redoStack: [],
                    isDirty: true,
                });
            },

            restoreFavorite: (photoId) => {
                const { favorites, removedFavorites } = get();
                const newFavs = new Set(favorites);
                const newRemoved = new Set(removedFavorites);
                newFavs.add(photoId);
                newRemoved.delete(photoId);
                set({ favorites: newFavs, removedFavorites: newRemoved, isDirty: true });
            },

            // --- Numbering ---
            assignNumber: (photoId, options = [], optionDetails = {}) => {
                const { numberedPhotos, nextOrderNumber, undoStack } = get();
                if (numberedPhotos.find(np => np.photoId === photoId)) return;

                set({
                    numberedPhotos: [...numberedPhotos, {
                        photoId, orderNumber: nextOrderNumber, options, optionDetails, isCancelled: false
                    }],
                    nextOrderNumber: nextOrderNumber + 1,
                    undoStack: [...undoStack, {
                        type: 'assignNumber',
                        payload: { photoId, orderNumber: nextOrderNumber },
                        timestamp: Date.now()
                    }],
                    redoStack: [],
                    isDirty: true,
                });
            },

            updateNumberOptions: (photoId, options, optionDetails) => {
                const { numberedPhotos, undoStack } = get();
                const existing = numberedPhotos.find(np => np.photoId === photoId);
                if (!existing) return;

                set({
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, options, optionDetails } : np
                    ),
                    undoStack: [...undoStack, {
                        type: 'updateNumberOptions',
                        payload: {
                            photoId,
                            oldOptions: existing.options,
                            oldDetails: existing.optionDetails,
                            newOptions: options,
                            newDetails: optionDetails
                        },
                        timestamp: Date.now()
                    }],
                    redoStack: [],
                    isDirty: true,
                });
            },

            removeNumber: (photoId) => {
                const { numberedPhotos } = get();
                set({
                    numberedPhotos: numberedPhotos.filter(np => np.photoId !== photoId),
                    isDirty: true,
                });
            },

            reorderNumbered: (newOrder) => set({
                numberedPhotos: newOrder.map((item, i) => ({
                    ...item, orderNumber: i + 1
                })),
                isDirty: true,
            }),

            cancelPhoto: (photoId) => {
                const { numberedPhotos } = get();
                set({
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, isCancelled: true } : np
                    ),
                    isDirty: true,
                });
            },

            uncancelPhoto: (photoId) => {
                const { numberedPhotos } = get();
                set({
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, isCancelled: false } : np
                    ),
                    isDirty: true,
                });
            },

            // --- Pricing ---
            setPriceList: (priceList) => set({ priceList }),
            updatePricing: (breakdown, total) => set({ priceBreakdown: breakdown, totalPrice: total }),

            // --- Undo/Redo ---
            undo: () => {
                const { undoStack, redoStack, favorites, removedFavorites, numberedPhotos } = get();
                if (undoStack.length === 0) return;

                const action = undoStack[undoStack.length - 1];
                const newUndo = undoStack.slice(0, -1);
                const newRedo = [...redoStack, action];

                if (action.type === 'toggleFavorite') {
                    const { photoId, wasFavorite } = action.payload;
                    const newFavs = new Set(favorites);
                    const newRemoved = new Set(removedFavorites);
                    if (wasFavorite) {
                        newFavs.add(photoId);
                        newRemoved.delete(photoId);
                    } else {
                        newFavs.delete(photoId);
                    }
                    set({
                        favorites: newFavs, removedFavorites: newRemoved,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true
                    });
                } else if (action.type === 'assignNumber') {
                    set({
                        numberedPhotos: numberedPhotos.filter(
                            np => np.photoId !== action.payload.photoId
                        ),
                        nextOrderNumber: get().nextOrderNumber - 1,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                } else if (action.type === 'updateNumberOptions') {
                    set({
                        numberedPhotos: numberedPhotos.map(np =>
                            np.photoId === action.payload.photoId
                                ? { ...np, options: action.payload.oldOptions, optionDetails: action.payload.oldDetails }
                                : np
                        ),
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                }
            },

            redo: () => {
                const { undoStack, redoStack, favorites, removedFavorites, numberedPhotos, nextOrderNumber } = get();
                if (redoStack.length === 0) return;

                const action = redoStack[redoStack.length - 1];
                const newRedo = redoStack.slice(0, -1);
                const newUndo = [...undoStack, action];

                if (action.type === 'toggleFavorite') {
                    const { photoId, wasFavorite } = action.payload;
                    const newFavs = new Set(favorites);
                    const newRemoved = new Set(removedFavorites);
                    if (wasFavorite) {
                        newFavs.delete(photoId);
                        newRemoved.add(photoId);
                    } else {
                        newFavs.add(photoId);
                        newRemoved.delete(photoId);
                    }
                    set({
                        favorites: newFavs, removedFavorites: newRemoved,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true
                    });
                } else if (action.type === 'assignNumber') {
                    set({
                        numberedPhotos: [...numberedPhotos, {
                            photoId: action.payload.photoId,
                            orderNumber: action.payload.orderNumber,
                            options: [], optionDetails: {}, isCancelled: false
                        }],
                        nextOrderNumber: nextOrderNumber + 1,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                } else if (action.type === 'updateNumberOptions') {
                    set({
                        numberedPhotos: numberedPhotos.map(np =>
                            np.photoId === action.payload.photoId
                                ? { ...np, options: action.payload.newOptions, optionDetails: action.payload.newDetails }
                                : np
                        ),
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                }
            },

            // --- Save ---
            markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),

            // --- Restore from INI ---
            restoreFromIni: (iniResult) => {
                if (!iniResult) return;
                const { favorites, removedFavorites, numberedPhotos, nextOrderNumber, photoNameMap } = iniResult;

                const { photos } = get();

                // Guard: skip restore if photos haven't loaded yet
                if (!photos || photos.length === 0) {
                    console.warn('[restoreFromIni] Photos not loaded yet, skipping restore');
                    return;
                }

                // Create a reverse map to match physical renamed files back to their original IDs
                const reverseMap = {};
                if (photoNameMap) {
                    Object.entries(photoNameMap).forEach(([orig, curr]) => {
                        reverseMap[curr] = orig;
                    });
                }

                const updatedPhotos = photos.map(p => {
                    // If the file on disk was renamed (e.g. 001.JPG), reconnect it to its original ID
                    if (reverseMap[p.originalName]) {
                        const realOrig = reverseMap[p.originalName];
                        return { ...p, id: realOrig, originalName: realOrig, currentName: p.originalName };
                    }

                    // Otherwise apply forward mapping if any
                    const mappedName = photoNameMap?.[p.originalName];
                    return mappedName ? { ...p, currentName: mappedName } : p;
                });

                set({
                    favorites,
                    removedFavorites,
                    numberedPhotos,
                    nextOrderNumber: nextOrderNumber || 1,
                    photos: updatedPhotos,
                });
            },

            // --- Computed ---
            getFilteredPhotos: () => {
                const { photos, favorites, removedFavorites, numberedPhotos, filterMode } = get();
                switch (filterMode) {
                    case 'favorites':
                        return photos.filter(p => favorites.has(p.id));
                    case 'unfavorited':
                        return photos.filter(p => removedFavorites.has(p.id));
                    case 'numbered': {
                        const numberedMap = new Map();
                        numberedPhotos.forEach(np => {
                            if (!np.isCancelled) numberedMap.set(String(np.photoId), np.orderNumber);
                        });
                        return photos
                            .filter(p => numberedMap.has(String(p.id)) || numberedMap.has(p.originalName))
                            .sort((a, b) => {
                                const oA = numberedMap.get(String(a.id)) ?? numberedMap.get(a.originalName);
                                const oB = numberedMap.get(String(b.id)) ?? numberedMap.get(b.originalName);
                                return oA - oB;
                            });
                    }
                    default:
                        return photos;
                }
            },

            getPhotoByIndex: (index) => {
                const filtered = get().getFilteredPhotos();
                return filtered[index] || null;
            },
        }),
        {
            name: 'photo-selector-storage',
            partialize: (state) => ({
                archiveInfo: state.archiveInfo,
                favorites: Array.from(state.favorites),
                removedFavorites: Array.from(state.removedFavorites),
                numberedPhotos: state.numberedPhotos,
                nextOrderNumber: state.nextOrderNumber,
                filterMode: state.filterMode,
                gridColumns: state.gridColumns,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.favorites = new Set(state.favorites || []);
                    state.removedFavorites = new Set(state.removedFavorites || []);
                }
            },
        }
    )
);

export default usePhotoSelectorStore;
