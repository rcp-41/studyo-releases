import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    formatDate,
    toJSDate,
    formatRelativeTime,
    getInitials,
    truncate,
    getStatusLabel,
    getShootTypeLabel,
    getUserFriendlyError,
} from './utils';

describe('formatCurrency', () => {
    it('sıfır miktarı formatlar', () => {
        expect(formatCurrency(0)).toContain('0');
    });
    it('pozitif miktarı TRY olarak formatlar', () => {
        const result = formatCurrency(1500);
        expect(result).toContain('1.500');
    });
    it('undefined/null için 0 döner', () => {
        expect(formatCurrency(null)).toContain('0');
        expect(formatCurrency(undefined)).toContain('0');
    });
});

describe('toJSDate', () => {
    it('null için null döner', () => {
        expect(toJSDate(null)).toBeNull();
    });
    it('Date nesnesini olduğu gibi döner', () => {
        const d = new Date('2024-01-15');
        expect(toJSDate(d)).toBe(d);
    });
    it('Firestore Timestamp (_seconds) dönüştürür', () => {
        const ts = { _seconds: 1705276800 };
        const result = toJSDate(ts);
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2024);
    });
    it('ISO string dönüştürür', () => {
        const result = toJSDate('2024-03-20');
        expect(result).toBeInstanceOf(Date);
    });
    it('geçersiz string için null döner', () => {
        expect(toJSDate('bozuk-tarih-xyz-!!!')).toBeNull();
    });
});

describe('formatDate', () => {
    it('geçerli tarihi Türkçe formatlar', () => {
        const result = formatDate(new Date('2024-06-15'));
        expect(result).toBe('15.06.2024');
    });
    it('null için tire döner', () => {
        expect(formatDate(null)).toBe('-');
    });
});

describe('getInitials', () => {
    it('iki kelimeli isim', () => {
        expect(getInitials('Ahmet Yılmaz')).toBe('AY');
    });
    it('tek kelime — sadece ilk harf alınır', () => {
        // getInitials splits by space; single word yields 1 char
        expect(getInitials('Mehmet')).toBe('M');
    });
    it('boş string için ??', () => {
        expect(getInitials('')).toBe('??');
        expect(getInitials(null)).toBe('??');
    });
});

describe('truncate', () => {
    it('kısa metni kesmez', () => {
        expect(truncate('Merhaba', 20)).toBe('Merhaba');
    });
    it('uzun metni keser ve ... ekler', () => {
        const result = truncate('Bu çok uzun bir metin parçasıdır', 10);
        expect(result).toBe('Bu çok uzu...');
        expect(result.length).toBe(13);
    });
    it('null için boş string', () => {
        expect(truncate(null)).toBe('');
    });
});

describe('getStatusLabel', () => {
    it('bilinen durumları çevirir', () => {
        expect(getStatusLabel('new')).toBe('Yeni');
        expect(getStatusLabel('delivered')).toBe('Teslim Edildi');
        expect(getStatusLabel('cancelled')).toBe('İptal');
    });
    it('bilinmeyen durum için kendisini döner', () => {
        expect(getStatusLabel('custom_status')).toBe('custom_status');
    });
});

describe('getShootTypeLabel', () => {
    it('çekim türlerini çevirir', () => {
        expect(getShootTypeLabel('wedding')).toBe('Düğün');
        expect(getShootTypeLabel('baby')).toBe('Bebek');
    });
});

describe('getUserFriendlyError', () => {
    it('permission-denied hatasını Türkçe açıklar', () => {
        const err = { code: 'permission-denied' };
        expect(getUserFriendlyError(err)).toContain('yetki');
    });
    it('functions/ prefix kaldırır', () => {
        const err = { code: 'functions/not-found' };
        expect(getUserFriendlyError(err)).toContain('bulunamadı');
    });
    it('bilinmeyen hata için genel mesaj', () => {
        expect(getUserFriendlyError({})).toContain('Beklenmeyen');
    });
});
