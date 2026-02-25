import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount, currency = 'TRY') {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount || 0);
}

// Format date
// K4: Centralized date conversion — handles Firestore Timestamp, ISO string, Date
export function toJSDate(date) {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'object' && date._seconds != null) return new Date(date._seconds * 1000);
    if (typeof date === 'object' && date.seconds != null) return new Date(date.seconds * 1000);
    if (typeof date === 'object' && typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
}

export function formatDate(date, options = {}) {
    const d = toJSDate(date);
    if (!d) return '-';

    try {
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric', ...options
        }).format(d);
    } catch {
        return '-';
    }
}

// Format date with time
export function formatDateTime(date) {
    const d = toJSDate(date);
    if (!d) return '-';

    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(d);
}

// Format relative time
export function formatRelativeTime(date) {
    const then = toJSDate(date);
    if (!then) return '-';

    const now = new Date();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;

    return formatDate(date);
}

// Status labels (Turkish)
export const statusLabels = {
    // Shoot statuses
    new: 'Yeni',
    confirmed: 'Onaylı',
    shot_done: 'Çekim Tamam',
    editing: 'Düzenleniyor',
    client_selection: 'Müşteri Seçimi',
    payment_pending: 'Ödeme Bekliyor',
    payment_complete: 'Ödeme Tamam',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal',

    // Appointment statuses
    pending: 'Bekliyor',
    completed: 'Tamamlandı',
    no_show: 'Gelmedi'
};

export function getStatusLabel(status) {
    return statusLabels[status] || status;
}

// Shoot type labels
export const shootTypeLabels = {
    wedding: 'Düğün',
    engagement: 'Nişan',
    baby: 'Bebek',
    portrait: 'Portre',
    corporate: 'Kurumsal',
    product: 'Ürün',
    event: 'Etkinlik',
    other: 'Diğer'
};

export function getShootTypeLabel(type) {
    return shootTypeLabels[type] || type;
}

// Role labels
export const roleLabels = {
    admin: 'Yönetici',
    photographer: 'Fotoğrafçı',
    assistant: 'Asistan',
    accountant: 'Muhasebe'
};

export function getRoleLabel(role) {
    return roleLabels[role] || role;
}

// Payment method labels
export const paymentMethodLabels = {
    cash: 'Nakit',
    card: 'Kart',
    transfer: 'Havale/EFT',
    online: 'Online'
};

// Generate initials from name
export function getInitials(name) {
    if (!name) return '??';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Truncate text
export function truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

export function getUserFriendlyError(error) {
    const errorMap = {
        'not-found': 'İşlem bulunamadı. Lütfen sayfayı yenileyin.',
        'permission-denied': 'Bu işlem için yetkiniz bulunmuyor.',
        'unavailable': 'Sunucu şu anda meşgul, lütfen birkaç dakika sonra tekrar deneyin.',
        'unauthenticated': 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.',
        'invalid-argument': 'Girilen bilgileri kontrol edin.',
        'already-exists': 'Bu kayıt zaten mevcut.',
        'failed-precondition': 'İşlem şu anda gerçekleştirilemiyor.',
        'internal': 'Bir sorun oluştu. Lütfen tekrar deneyin.',
    };
    const code = error?.code?.replace('functions/', '') || '';
    return errorMap[code] || 'Beklenmeyen bir durum oluştu. Lütfen tekrar deneyin.';
}
