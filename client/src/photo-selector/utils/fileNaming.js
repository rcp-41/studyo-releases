/**
 * Dosya adlandırma kuralları (Revamped)
 * 
 * New format: [SıraNo] - [HediyeKısaKodları]
 * Örnek: 01 - y - 4vs - 20x30ç.jpg
 * 
 * Legacy format (still supported): [ArşivNo] - [SıraNo] - [Seçenekler...]
 */

/**
 * Build filename using gift shortcodes
 * @param {number} orderNumber - Order number (1, 2, 3...)
 * @param {string[]} giftCodes - Array of gift abbreviation codes ['y', '4vs', '20x30ç']
 * @param {string} originalExt - File extension including dot (.jpg, .JPG)
 * @returns {string} Formatted filename
 */
export function buildFileNameFromGifts(orderNumber, giftCodes = [], originalExt = '.jpg') {
    const paddedNum = String(orderNumber).padStart(2, '0');

    if (giftCodes.length === 0) {
        return `${paddedNum}${originalExt}`;
    }

    return `${paddedNum} - ${giftCodes.join(' - ')}${originalExt}`;
}

/**
 * Legacy filename builder (kept for backward compatibility)
 * Format: [ArşivNo] - [SıraNo] - [Seçenekler...]
 */
export function buildFileName(archiveNo, orderNumber, optionDetails = {}, originalExt = '.jpg') {
    const parts = [];

    parts.push(archiveNo);
    parts.push(String(orderNumber).padStart(2, '0'));

    // 1. Tür
    if (optionDetails.tur) {
        parts.push(optionDetails.tur);
    }

    // 2. Kullanılacak Yer / Ek Ölçü
    if (optionDetails.kullanilarakYer) {
        parts.push(optionDetails.kullanilarakYer);
    }
    if (optionDetails.ekOlcu && optionDetails.ekOlcu !== 'yok') {
        parts.push(optionDetails.ekOlcu);
    }

    // 3. Adet / Çoğaltma
    if (optionDetails.adet) {
        parts.push(`${optionDetails.adet}'lü`);
    }
    if (optionDetails.cogaltmaAdet && optionDetails.cogaltmaAdet > 0) {
        const olcu = optionDetails.cogaltmaOlcu || '';
        parts.push(`${optionDetails.cogaltmaAdet} Çoğaltma${olcu ? ' ' + olcu : ''}`);
    }

    // 4. Hediye
    if (optionDetails.hediye) {
        parts.push('Hediye');
    }

    // 5. Çerçeve / Fotoblok / Kanvas
    if (optionDetails.cerceve) parts.push('Çerçeve');
    if (optionDetails.fotoblok) parts.push('Fotoblok');
    if (optionDetails.kanvas) parts.push('Kanvas');

    // 6. Not
    if (optionDetails.not) {
        parts.push('Not');
    }

    return parts.join(' - ') + originalExt;
}

/**
 * İptal edilmiş dosya adı
 */
export function buildCancelledFileName(archiveNo, orderNumber, originalExt = '.jpg') {
    return `İPTAL - ${archiveNo} - ${String(orderNumber).padStart(2, '0')}${originalExt}`;
}

/**
 * Dosya uzantısını al
 */
export function getFileExtension(fileName) {
    const match = fileName.match(/\.[^.]+$/);
    return match ? match[0] : '.jpg';
}
