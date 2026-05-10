/**
 * notify — Merkezi bildirim wrapper'ı (sonner tabanlı)
 *
 * Kullanım:
 *   import notify from '@/lib/notify';
 *   notify.success('Kaydedildi');
 *   notify.error(error);        // Error nesnesi veya string
 *   notify.info('Bilgi mesajı');
 *   notify.warning('Dikkat');
 *   notify.loading('Yükleniyor...');    // id döner
 *   notify.dismiss(id);
 *   notify.promise(myPromise, { loading: '...', success: '...', error: '...' });
 */

import { toast } from 'sonner';

// Firebase auth error code → kullanıcı dostu mesaj
const FIREBASE_MESSAGES = {
    'auth/wrong-password': 'Şifre hatalı.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/user-not-found': 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen bir süre bekleyin.',
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/network-request-failed': 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
    'auth/user-disabled': 'Bu hesap devre dışı bırakılmıştır.',
    'auth/requires-recent-login': 'Bu işlem için yeniden giriş yapmanız gerekiyor.',
    'permission-denied': 'Bu işlem için yetkiniz yok.',
    'unavailable': 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.',
    'not-found': 'İstenen kayıt bulunamadı.',
    'already-exists': 'Bu kayıt zaten mevcut.',
    'resource-exhausted': 'İstek limiti aşıldı. Lütfen bekleyin.',
};

/**
 * Hata nesnesinden veya string'den okunabilir mesaj üretir.
 * @param {Error|string} err
 * @returns {string}
 */
function resolveErrorMessage(err) {
    if (!err) return 'Bilinmeyen bir hata oluştu.';
    if (typeof err === 'string') return err;

    // Firebase hata kodunu çöz (code veya message içinde geçebilir)
    const code = err.code || '';
    if (code && FIREBASE_MESSAGES[code]) {
        return FIREBASE_MESSAGES[code];
    }

    // Axios response hatası
    if (err.response?.data?.error) return err.response.data.error;
    if (err.response?.data?.message) return err.response.data.message;

    // Genel Error.message
    if (err.message) return err.message;

    return 'Beklenmeyen bir hata oluştu.';
}

const notify = {
    success: (msg, options) => toast.success(msg, options),
    info: (msg, options) => toast.info(msg, options),
    warning: (msg, options) => toast.warning(msg, options),
    loading: (msg, options) => toast.loading(msg, options),
    dismiss: (id) => toast.dismiss(id),

    /**
     * @param {Error|string} err
     * @param {object} [options] — sonner toast options
     */
    error: (err, options) => {
        const message = resolveErrorMessage(err);
        return toast.error(message, options);
    },

    /**
     * Promise tabanlı bildirim. Loading → success/error geçişini otomatik yönetir.
     * Error mesajı Firebase kod çevirisi üzerinden geçer.
     *
     * @param {Promise} promise
     * @param {{ loading: string, success: string, error?: string }} messages
     * @param {object} [options] — sonner toast options
     * @returns {Promise} — orijinal promise'i döner
     */
    promise: (promise, messages, options) => {
        return toast.promise(promise, {
            loading: messages.loading,
            success: messages.success,
            error: (err) => {
                if (messages.error) return messages.error;
                return resolveErrorMessage(err);
            },
        }, options);
    },
};

export default notify;
