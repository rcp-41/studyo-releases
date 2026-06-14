import { describe, it, expect, beforeEach } from 'vitest';
import usePhotoSelectorStore from './photoSelectorStore';

const store = usePhotoSelectorStore;
const get = () => store.getState();

const reset = () => {
    store.setState({
        photos: [],
        favorites: new Set(),
        removedFavorites: new Set(),
        numberedPhotos: [],
        nextOrderNumber: 1,
        giftAssignments: {},
        optionAssignments: {},
        undoStack: [],
        redoStack: [],
        filterMode: 'all',
        isDirty: false,
    });
};

describe('photoSelectorStore — undo/redo coverage (#5)', () => {
    beforeEach(reset);

    it('toggleFavorite undo/redo', () => {
        get().toggleFavorite('p1');
        expect(get().favorites.has('p1')).toBe(true);
        get().undo();
        expect(get().favorites.has('p1')).toBe(false);
        get().redo();
        expect(get().favorites.has('p1')).toBe(true);
    });

    it('removeNumber is now undoable (regression for previously-missing coverage)', () => {
        get().assignNumber('p1');
        expect(get().numberedPhotos).toHaveLength(1);
        get().removeNumber('p1');
        expect(get().numberedPhotos).toHaveLength(0);
        get().undo();
        expect(get().numberedPhotos).toHaveLength(1);
        expect(get().numberedPhotos[0].photoId).toBe('p1');
    });

    it('cancelPhoto is now undoable', () => {
        get().assignNumber('p1');
        get().cancelPhoto('p1');
        expect(get().numberedPhotos[0].isCancelled).toBe(true);
        get().undo();
        expect(get().numberedPhotos[0].isCancelled).toBe(false);
    });

    it('gift assignment is now undoable', () => {
        store.setState({ activePackage: { gifts: [{ abbr: 'X', maxSelections: 0 }] } });
        get().assignGift('p1', 'X');
        expect(get().giftAssignments.X).toContain('p1');
        get().undo();
        expect(get().giftAssignments.X || []).not.toContain('p1');
    });

    it('redo stack clears after a new action', () => {
        get().toggleFavorite('p1');
        get().undo();
        expect(get().redoStack).toHaveLength(1);
        get().toggleFavorite('p2');
        expect(get().redoStack).toHaveLength(0);
    });

    it('multiple undos walk back the full history', () => {
        get().toggleFavorite('a');
        get().toggleFavorite('b');
        get().assignNumber('a');
        get().undo();
        expect(get().numberedPhotos).toHaveLength(0);
        get().undo();
        expect(get().favorites.has('b')).toBe(false);
        get().undo();
        expect(get().favorites.has('a')).toBe(false);
    });
});

describe('photoSelectorStore — favorites order (#3)', () => {
    beforeEach(reset);

    it('favorites filter preserves favorite order, not disk order', () => {
        store.setState({ photos: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
        get().toggleFavorite('c');
        get().toggleFavorite('a');
        store.setState({ filterMode: 'favorites' });
        expect(get().getFilteredPhotos().map(p => p.id)).toEqual(['c', 'a']);
    });

    it('reorderFavorites reorders and is undoable', () => {
        store.setState({ photos: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
        get().toggleFavorite('a');
        get().toggleFavorite('b');
        get().toggleFavorite('c');
        get().reorderFavorites(0, 2); // [a,b,c] -> [b,c,a]
        expect(Array.from(get().favorites)).toEqual(['b', 'c', 'a']);
        get().undo();
        expect(Array.from(get().favorites)).toEqual(['a', 'b', 'c']);
    });
});
