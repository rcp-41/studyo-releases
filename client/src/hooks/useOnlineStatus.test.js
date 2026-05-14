import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useOnlineStatus from './useOnlineStatus';

describe('useOnlineStatus', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    });

    it('online olunca true döner', () => {
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current.online).toBe(true);
        expect(result.current.firestoreConnected).toBe(true);
    });

    it('offline event tetiklenince false olur', () => {
        const { result } = renderHook(() => useOnlineStatus());
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current.online).toBe(false);
    });

    it('online event tetiklenince lastSyncAt güncellenir', () => {
        const { result } = renderHook(() => useOnlineStatus());
        const before = result.current.lastSyncAt;
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        act(() => {
            window.dispatchEvent(new Event('online'));
        });
        expect(result.current.online).toBe(true);
        expect(result.current.lastSyncAt).toBeInstanceOf(Date);
        // lastSyncAt should be >= the initial value
        if (before) {
            expect(result.current.lastSyncAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        }
    });
});
