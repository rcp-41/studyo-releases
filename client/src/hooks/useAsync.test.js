/**
 * useAsync hook — vitest unit testleri
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsync } from './useAsync';

// notify modülünü mock'la — gerçek sonner çalıştırılmasın
vi.mock('../lib/notify', () => ({
    default: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

import notify from '../lib/notify';

describe('useAsync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('başlangıçta loading=false, error=null, data=undefined olmalı', () => {
        const { result } = renderHook(() => useAsync());
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.data).toBeUndefined();
    });

    it('run() çalışırken loading=true olmalı', async () => {
        let resolveFn;
        const promise = new Promise((resolve) => { resolveFn = resolve; });

        const { result } = renderHook(() => useAsync());

        let runPromise;
        act(() => {
            runPromise = result.current.run(() => promise);
        });

        expect(result.current.loading).toBe(true);

        await act(async () => {
            resolveFn('test');
            await runPromise;
        });

        expect(result.current.loading).toBe(false);
    });

    it('başarılı run() sonrası data set edilmeli', async () => {
        const { result } = renderHook(() => useAsync());

        await act(async () => {
            await result.current.run(() => Promise.resolve({ id: 1, name: 'test' }));
        });

        expect(result.current.data).toEqual({ id: 1, name: 'test' });
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('başarısız run() sonrası error set edilmeli ve notify.error çağrılmalı', async () => {
        const testError = new Error('Sunucu hatası');
        const { result } = renderHook(() => useAsync());

        await act(async () => {
            await result.current.run(() => Promise.reject(testError));
        });

        expect(result.current.error).toBe(testError);
        expect(result.current.data).toBeUndefined();
        expect(result.current.loading).toBe(false);
        expect(notify.error).toHaveBeenCalledWith(testError);
    });

    it('notify:false seçeneğinde hata olsa bile notify.error çağrılmamalı', async () => {
        const { result } = renderHook(() => useAsync({ notify: false }));

        await act(async () => {
            await result.current.run(() => Promise.reject(new Error('hata')));
        });

        expect(notify.error).not.toHaveBeenCalled();
    });

    it('özel errorMessage varsa o mesajla notify.error çağrılmalı', async () => {
        const { result } = renderHook(() => useAsync({ errorMessage: 'Kayıt silinemedi' }));

        await act(async () => {
            await result.current.run(() => Promise.reject(new Error('internal')));
        });

        expect(notify.error).toHaveBeenCalledWith('Kayıt silinemedi');
    });

    it('run() başarılı sonucu return etmeli', async () => {
        const { result } = renderHook(() => useAsync());

        let returnValue;
        await act(async () => {
            returnValue = await result.current.run(() => Promise.resolve(42));
        });

        expect(returnValue).toBe(42);
    });

    it('run() hata durumunda undefined return etmeli', async () => {
        const { result } = renderHook(() => useAsync());

        let returnValue;
        await act(async () => {
            returnValue = await result.current.run(() => Promise.reject(new Error('x')));
        });

        expect(returnValue).toBeUndefined();
    });

    it('reset() tüm state\'i temizlemeli', async () => {
        const { result } = renderHook(() => useAsync());

        await act(async () => {
            await result.current.run(() => Promise.resolve('veri'));
        });

        expect(result.current.data).toBe('veri');

        act(() => {
            result.current.reset();
        });

        expect(result.current.data).toBeUndefined();
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('birden fazla art arda run() çağrısı doğru çalışmalı', async () => {
        const { result } = renderHook(() => useAsync());

        await act(async () => {
            await result.current.run(() => Promise.resolve('ilk'));
        });
        expect(result.current.data).toBe('ilk');

        await act(async () => {
            await result.current.run(() => Promise.resolve('ikinci'));
        });
        expect(result.current.data).toBe('ikinci');
        expect(result.current.error).toBeNull();
    });

    describe('onError callback', () => {
        it('onError verilmişse hata callback çağrılmalı, notify.error çağrılmamalı', async () => {
            const onError = vi.fn();
            const testError = new Error('özel hata');
            const { result } = renderHook(() => useAsync({ onError }));

            await act(async () => {
                await result.current.run(() => Promise.reject(testError));
            });

            expect(onError).toHaveBeenCalledWith(testError);
            expect(notify.error).not.toHaveBeenCalled();
            expect(result.current.error).toBe(testError);
        });

        it('onError + notify:false beraber çalışmalı', async () => {
            const onError = vi.fn();
            const { result } = renderHook(() => useAsync({ onError, notify: false }));

            await act(async () => {
                await result.current.run(() => Promise.reject(new Error('x')));
            });

            expect(onError).toHaveBeenCalledTimes(1);
            expect(notify.error).not.toHaveBeenCalled();
        });
    });

    describe('onSuccess callback', () => {
        it('onSuccess başarılı run sonrası result ile çağrılmalı', async () => {
            const onSuccess = vi.fn();
            const { result } = renderHook(() => useAsync({ onSuccess }));

            await act(async () => {
                await result.current.run(() => Promise.resolve('tamam'));
            });

            expect(onSuccess).toHaveBeenCalledWith('tamam');
            expect(result.current.data).toBe('tamam');
        });

        it('onSuccess hata durumunda çağrılmamalı', async () => {
            const onSuccess = vi.fn();
            const { result } = renderHook(() => useAsync({ onSuccess }));

            await act(async () => {
                await result.current.run(() => Promise.reject(new Error('fail')));
            });

            expect(onSuccess).not.toHaveBeenCalled();
        });
    });
});
