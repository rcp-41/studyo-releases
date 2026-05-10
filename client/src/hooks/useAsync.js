/**
 * useAsync — Tekrar eden try/catch + setLoading + notify.error kalıbını soyutlar.
 *
 * Kullanım:
 *   const { run, loading, error, data } = useAsync();
 *   await run(() => archivesApi.create(payload));
 *
 *   // Özel hata handling (default notify.error'ı bypass eder):
 *   const { run } = useAsync({ onError: (err) => { switch(err.code) { ... } } });
 *
 *   // Başarı callback:
 *   const { run } = useAsync({ onSuccess: (data) => navigate('/home') });
 *
 * Özellikler:
 *   - loading, error, data state'lerini otomatik yönetir.
 *   - Hata yakalanınca notify.error() çağırır (notify:false veya onError ile kapatılabilir).
 *   - run() her çağrıda önceki state'i sıfırlar.
 *   - run() sonucu döner (hata durumunda undefined).
 */

import { useState, useCallback, useRef } from 'react';
import notify from '../lib/notify';

/**
 * @typedef {Object} UseAsyncReturn
 * @property {function(function(): Promise): Promise<any>} run
 * @property {boolean} loading
 * @property {Error|null} error
 * @property {any} data
 * @property {function} reset
 */

/**
 * @param {object} [options]
 * @param {boolean} [options.notify=true] - Hata durumunda notify.error çağrılsın mı?
 * @param {string} [options.errorMessage] - Özel hata mesajı (varsa Error nesnesinin önüne geçer)
 * @param {function(Error): void} [options.onError] - Özel hata callback. Verilirse default notify.error atlanır.
 * @param {function(any): void} [options.onSuccess] - Başarı callback. Sonuç verisi ile çağrılır.
 * @returns {UseAsyncReturn}
 */
export function useAsync({ notify: shouldNotify = true, errorMessage, onError, onSuccess } = {}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(undefined);

    // Bileşen unmount olduktan sonra state güncellemesini önle
    const mountedRef = useRef(true);
    // useEffect cleanup yerine her render'da güncellenen ref
    // (hook kendisi unmount'u izleyemez, sadece iç run'ı iptal eder)

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setData(undefined);
    }, []);

    /**
     * @param {function(): Promise} asyncFn - Çalıştırılacak async fonksiyon
     * @returns {Promise<any>} - Başarılı sonuç veya undefined (hata durumunda)
     */
    const run = useCallback(async (asyncFn) => {
        setLoading(true);
        setError(null);

        try {
            const result = await asyncFn();
            setData(result);
            if (onSuccess) onSuccess(result);
            return result;
        } catch (err) {
            setError(err);
            if (onError) {
                onError(err);
            } else if (shouldNotify) {
                notify.error(errorMessage || err);
            }
            return undefined;
        } finally {
            setLoading(false);
        }
    }, [shouldNotify, errorMessage, onError, onSuccess]);

    return { run, loading, error, data, reset };
}

export default useAsync;
