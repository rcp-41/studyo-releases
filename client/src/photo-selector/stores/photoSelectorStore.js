import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============ UNDO/REDO INFRASTRUCTURE ============
// Snapshot-based history: every mutating selection action captures the mutable
// slice before changing it, so a single undo() restores it wholesale. This keeps
// undo consistent across ALL actions (favorites, numbering, cancel, gifts,
// options, reorders) instead of hand-coding an inverse per action type.
const MAX_UNDO = 100;

const snapshot = (s) => ({
    favorites: new Set(s.favorites),
    removedFavorites: new Set(s.removedFavorites),
    numberedPhotos: s.numberedPhotos.map(np => ({ ...np })),
    nextOrderNumber: s.nextOrderNumber,
    giftAssignments: { ...s.giftAssignments },
    optionAssignments: { ...s.optionAssignments },
});

// Merge `changes` into state while pushing the pre-mutation snapshot onto the
// undo stack and clearing the redo stack. `get()` here still returns the
// pre-mutation state because set() has not run yet.
const commit = (get, changes) => ({
    ...changes,
    undoStack: [...get().undoStack.slice(-(MAX_UNDO - 1)), snapshot(get())],
    redoStack: [],
    isDirty: true,
});

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
            rotations: {},             // { photoId: degrees } — view-only manual rotation

            // ============ FAVORITES ============
            favorites: new Set(),
            removedFavorites: new Set(),

            // ============ NUMBERING ============
            numberedPhotos: [],
            nextOrderNumber: 1,

            // ============ PIXONAI / PACKAGES ============
            pixonaiConfig: null,       // active pixonai config from Firestore
            activePackage: null,       // matched package based on fav count
            giftAssignments: {},       // { giftAbbr: [photoId1, photoId2, ...] }
            optionAssignments: {},     // { optionAbbr: [photoId1, photoId2, ...] }
            shootCategoryType: null,   // 'yearly' | 'set' | 'portrait' | 'none'
            noteText: '',              // extra photo note (saved as txt file)

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
                pixonaiConfig: null,
                activePackage: null,
                giftAssignments: {},
                optionAssignments: {},
                shootCategoryType: config.shootCategoryType || null,
                noteText: '',
                rotations: {},
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
                // History is photo-set specific — drop it so undo can't restore a
                // selection that belonged to a previously loaded folder.
                undoStack: [],
                redoStack: [],
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

            // Rotate a photo by delta degrees (view-only, normalized to 0/90/180/270).
            rotatePhoto: (photoId, delta) => {
                const { rotations } = get();
                const next = (((rotations[photoId] || 0) + delta) % 360 + 360) % 360;
                set({ rotations: { ...rotations, [photoId]: next } });
            },

            // --- Favorites ---
            toggleFavorite: (photoId) => {
                const { favorites, removedFavorites } = get();
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

                set(commit(get, { favorites: newFavs, removedFavorites: newRemoved }));
            },

            restoreFavorite: (photoId) => {
                const { favorites, removedFavorites } = get();
                const newFavs = new Set(favorites);
                const newRemoved = new Set(removedFavorites);
                newFavs.add(photoId);
                newRemoved.delete(photoId);
                set(commit(get, { favorites: newFavs, removedFavorites: newRemoved }));
            },

            reorderFavorites: (oldIndex, newIndex) => {
                const { favorites } = get();
                const favsArray = Array.from(favorites);
                const [movedItem] = favsArray.splice(oldIndex, 1);
                favsArray.splice(newIndex, 0, movedItem);
                set(commit(get, { favorites: new Set(favsArray) }));
            },

            // --- Numbering ---
            assignNumber: (photoId, options = [], optionDetails = {}) => {
                const { numberedPhotos, nextOrderNumber } = get();
                if (numberedPhotos.find(np => np.photoId === photoId)) return;

                set(commit(get, {
                    numberedPhotos: [...numberedPhotos, {
                        photoId, orderNumber: nextOrderNumber, options, optionDetails, isCancelled: false
                    }],
                    nextOrderNumber: nextOrderNumber + 1,
                }));
            },

            updateNumberOptions: (photoId, options, optionDetails) => {
                const { numberedPhotos } = get();
                const existing = numberedPhotos.find(np => np.photoId === photoId);
                if (!existing) return;

                set(commit(get, {
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, options, optionDetails } : np
                    ),
                }));
            },

            removeNumber: (photoId) => {
                const { numberedPhotos } = get();
                if (!numberedPhotos.find(np => np.photoId === photoId)) return;
                set(commit(get, {
                    numberedPhotos: numberedPhotos.filter(np => np.photoId !== photoId),
                }));
            },

            reorderNumbered: (newOrder) => {
                const { numberedPhotos } = get();
                if (newOrder.length === 0 && numberedPhotos.length === 0) return;
                set(commit(get, {
                    numberedPhotos: newOrder.map((item, i) => ({
                        ...item, orderNumber: i + 1
                    })),
                }));
            },

            cancelPhoto: (photoId) => {
                const { numberedPhotos } = get();
                const target = numberedPhotos.find(np => np.photoId === photoId);
                if (!target || target.isCancelled) return;
                set(commit(get, {
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, isCancelled: true } : np
                    ),
                }));
            },

            uncancelPhoto: (photoId) => {
                const { numberedPhotos } = get();
                const target = numberedPhotos.find(np => np.photoId === photoId);
                if (!target || !target.isCancelled) return;
                set(commit(get, {
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, isCancelled: false } : np
                    ),
                }));
            },

            // --- Pricing ---
            setPriceList: (priceList) => set({ priceList }),
            updatePricing: (breakdown, total) => set({ priceBreakdown: breakdown, totalPrice: total }),

            // --- Pixonai / Package Gifts ---
            setPixonaiConfig: (config) => set({
                pixonaiConfig: config,
                shootCategoryType: config?.type || null,
            }),

            setActivePackage: (pkg) => set({
                activePackage: pkg,
                giftAssignments: {},  // reset assignments when package changes
            }),

            /**
             * Assign a gift to a photo.
             * Respects maxSelections: if the limit is reached, the oldest assignment
             * is removed to make room for the new one.
             */
            assignGift: (photoId, giftAbbr) => {
                const { giftAssignments, activePackage } = get();
                if (!activePackage) return;

                const gift = activePackage.gifts?.find(g => g.abbr === giftAbbr);
                if (!gift) return;

                const current = [...(giftAssignments[giftAbbr] || [])];

                // If photo already has this gift, do nothing
                if (current.includes(photoId)) return;

                // maxSelections: 0 means unlimited — no cap
                const maxSel = gift.maxSelections || 0;
                if (maxSel > 0 && current.length >= maxSel) {
                    current.shift(); // remove oldest to make room
                }
                current.push(photoId);

                set(commit(get, {
                    giftAssignments: { ...giftAssignments, [giftAbbr]: current },
                }));
            },

            removeGift: (photoId, giftAbbr) => {
                const { giftAssignments } = get();
                if (!(giftAssignments[giftAbbr] || []).includes(photoId)) return;
                const current = (giftAssignments[giftAbbr] || []).filter(id => id !== photoId);
                set(commit(get, {
                    giftAssignments: { ...giftAssignments, [giftAbbr]: current },
                }));
            },

            clearGifts: () => set({ giftAssignments: {} }),

            // --- Pixonai / Options ---
            assignOption: (photoId, optionAbbr) => {
                const { optionAssignments, pixonaiConfig } = get();
                if (!pixonaiConfig) return;

                const option = pixonaiConfig.options?.find(o => o.abbr === optionAbbr);
                if (!option) return;

                const current = [...(optionAssignments[optionAbbr] || [])];
                if (current.includes(photoId)) return;

                const maxSel = option.maxSelections || 0;
                if (maxSel > 0 && current.length >= maxSel) {
                    current.shift();
                }
                current.push(photoId);

                set(commit(get, {
                    optionAssignments: { ...optionAssignments, [optionAbbr]: current },
                }));
            },

            removeOption: (photoId, optionAbbr) => {
                const { optionAssignments } = get();
                if (!(optionAssignments[optionAbbr] || []).includes(photoId)) return;
                const current = (optionAssignments[optionAbbr] || []).filter(id => id !== photoId);
                set(commit(get, {
                    optionAssignments: { ...optionAssignments, [optionAbbr]: current },
                }));
            },

            clearOptions: () => set({ optionAssignments: {} }),
            setNoteText: (text) => set({ noteText: text, isDirty: true }),

            getGiftsForPhoto: (photoId) => {
                const { giftAssignments, activePackage } = get();
                if (!activePackage) return [];
                return (activePackage.gifts || []).filter(
                    g => (giftAssignments[g.abbr] || []).includes(photoId)
                );
            },

            // --- Undo/Redo ---
            undo: () => {
                const s = get();
                if (s.undoStack.length === 0) return;
                const prev = s.undoStack[s.undoStack.length - 1];
                set({
                    ...prev,
                    undoStack: s.undoStack.slice(0, -1),
                    redoStack: [...s.redoStack, snapshot(s)],
                    isDirty: true,
                });
            },

            redo: () => {
                const s = get();
                if (s.redoStack.length === 0) return;
                const next = s.redoStack[s.redoStack.length - 1];
                set({
                    ...next,
                    redoStack: s.redoStack.slice(0, -1),
                    undoStack: [...s.undoStack, snapshot(s)],
                    isDirty: true,
                });
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
                    // Restored selection is the new baseline — clear history.
                    undoStack: [],
                    redoStack: [],
                });
            },

            // --- Computed ---
            getFilteredPhotos: () => {
                const { photos, favorites, removedFavorites, numberedPhotos, filterMode } = get();
                switch (filterMode) {
                    case 'favorites': {
                        // Preserve the user's manual favorite order (Set insertion /
                        // drag-reorder order), not the original disk order. This is what
                        // makes drag-to-reorder in the favorites grid actually visible.
                        const byId = new Map(photos.map(p => [p.id, p]));
                        return Array.from(favorites)
                            .map(id => byId.get(id))
                            .filter(Boolean);
                    }
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
                rotations: state.rotations,
                giftAssignments: state.giftAssignments,
                optionAssignments: state.optionAssignments,
                shootCategoryType: state.shootCategoryType,
                noteText: state.noteText,
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
