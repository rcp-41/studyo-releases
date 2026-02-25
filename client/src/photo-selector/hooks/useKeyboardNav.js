import { useEffect, useCallback } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';

export default function useKeyboardNav({ onOpenSelection }) {
    const currentView = usePhotoSelectorStore(s => s.currentView);
    const setView = usePhotoSelectorStore(s => s.setView);
    const selectedIndex = usePhotoSelectorStore(s => s.selectedIndex);
    const setSelectedIndex = usePhotoSelectorStore(s => s.setSelectedIndex);
    const toggleFavorite = usePhotoSelectorStore(s => s.toggleFavorite);
    const undo = usePhotoSelectorStore(s => s.undo);
    const redo = usePhotoSelectorStore(s => s.redo);
    const setFilterMode = usePhotoSelectorStore(s => s.setFilterMode);
    const filterMode = usePhotoSelectorStore(s => s.filterMode);

    const handleKeyDown = useCallback((e) => {
        // Global shortcuts
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
            return;
        }

        const filteredPhotos = usePhotoSelectorStore.getState().getFilteredPhotos();
        const currentIndex = usePhotoSelectorStore.getState().selectedIndex;

        switch (currentView) {
            case 'grid': {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const next = Math.min(currentIndex + 1, filteredPhotos.length - 1);
                    setSelectedIndex(next);
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prev = Math.max(currentIndex - 1, 0);
                    setSelectedIndex(prev);
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const cols = usePhotoSelectorStore.getState().gridColumns;
                    const next = Math.min(currentIndex + cols, filteredPhotos.length - 1);
                    setSelectedIndex(next);
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const cols = usePhotoSelectorStore.getState().gridColumns;
                    const prev = Math.max(currentIndex - cols, 0);
                    setSelectedIndex(prev);
                }
                if (e.key === ' ') {
                    e.preventDefault();
                    const photo = filteredPhotos[currentIndex];
                    if (photo) toggleFavorite(photo.id);
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredPhotos[currentIndex]) {
                        setView('single');
                    }
                }
                if (e.key === 'c' || e.key === 'C') {
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        setView('compare');
                    }
                }
                if (e.key === 'f' || e.key === 'F') {
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        const modes = ['all', 'favorites', 'unfavorited', 'numbered'];
                        const currentIdx = modes.indexOf(filterMode);
                        setFilterMode(modes[(currentIdx + 1) % modes.length]);
                    }
                }
                if (e.key === 'Delete') {
                    e.preventDefault();
                    const photo = filteredPhotos[currentIndex];
                    if (photo) {
                        const { favorites } = usePhotoSelectorStore.getState();
                        if (favorites.has(photo.id)) {
                            toggleFavorite(photo.id);
                        }
                    }
                }
                break;
            }
            case 'single': {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const next = Math.min(currentIndex + 1, filteredPhotos.length - 1);
                    setSelectedIndex(next);
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prev = Math.max(currentIndex - 1, 0);
                    setSelectedIndex(prev);
                }
                if (e.key === ' ') {
                    e.preventDefault();
                    const photo = filteredPhotos[currentIndex];
                    if (photo) toggleFavorite(photo.id);
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setView('grid');
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (onOpenSelection) onOpenSelection();
                }
                if (e.key === 'c' || e.key === 'C') {
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        setView('compare');
                    }
                }
                if (e.key === 'Delete') {
                    e.preventDefault();
                    const photo = filteredPhotos[currentIndex];
                    if (photo) {
                        const { favorites } = usePhotoSelectorStore.getState();
                        if (favorites.has(photo.id)) {
                            toggleFavorite(photo.id);
                        }
                    }
                }
                break;
            }
            case 'compare': {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setView('grid');
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const { compareIndices } = usePhotoSelectorStore.getState();
                    const store = usePhotoSelectorStore.getState();
                    const dir = e.key === 'ArrowRight' ? 1 : -1;
                    // Shift: change right photo; otherwise change left
                    if (e.shiftKey) {
                        const next = Math.max(0, Math.min(compareIndices[1] + dir, filteredPhotos.length - 1));
                        store.setCompareIndices([compareIndices[0], next]);
                    } else {
                        const next = Math.max(0, Math.min(compareIndices[0] + dir, filteredPhotos.length - 1));
                        store.setCompareIndices([next, compareIndices[1]]);
                    }
                }
                break;
            }
        }
    }, [currentView, filterMode, onOpenSelection, undo, redo, toggleFavorite, setView,
        setSelectedIndex, setFilterMode]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
