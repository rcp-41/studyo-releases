/**
 * Tüm numaralandırılmış fotoğraflar için toplam fiyat hesapla
 * @param {Array} numberedPhotos
 * @param {Object} priceList
 * @param {string} shootCategory
 * @returns {{ breakdown: Array, total: number }}
 */
export function calculatePrices(numberedPhotos, priceList, shootCategory) {
    if (!priceList || !numberedPhotos.length) return { breakdown: [], total: 0 };

    const breakdown = [];
    let total = 0;

    for (const photo of numberedPhotos) {
        if (photo.isCancelled) continue;

        const options = photo.optionDetails || {};
        let lineTotal = 0;
        const lineItems = [];

        switch (shootCategory) {
            case 'vesikalik_biyometrik': {
                const adet = options.adet || '4';
                const adetFiyat = priceList.vesikalik_biyometrik?.adet?.[adet] || 0;
                lineTotal += adetFiyat;
                lineItems.push(`${adet}'lü: ${adetFiyat}`);
                break;
            }
            case 'aile_ajans': {
                const olcu = options.olcu || '15x21';
                const olcuFiyat = priceList.standart_olculer?.[olcu] || 0;
                lineTotal += olcuFiyat;
                lineItems.push(`${olcu}: ${olcuFiyat}`);
                break;
            }
            case 'yillik': {
                const pozFiyat = priceList.yillik?.poz_fiyat || 450;
                lineTotal += pozFiyat;
                lineItems.push(`Poz: ${pozFiyat}`);
                if (options.hediye && priceList.yillik?.hediye_ucretsiz) {
                    lineItems.push('Hediye: Ücretsiz');
                }
                break;
            }
            case 'etkinlik': {
                lineTotal += options.manuelFiyat || 0;
                lineItems.push(`Manuel: ${options.manuelFiyat || 0}`);
                break;
            }
        }

        // Ek ölçü
        if (options.ekOlcu && options.ekOlcu !== 'yok') {
            const ekFiyat = priceList.standart_olculer?.[options.ekOlcu] || 0;
            lineTotal += ekFiyat;
            lineItems.push(`Ek ${options.ekOlcu}: ${ekFiyat}`);
        }

        // Çoğaltma
        if (options.cogaltmaAdet && options.cogaltmaAdet > 0) {
            const baseOlcu = options.cogaltmaOlcu || options.olcu || '15x21';
            const basePrice = priceList.standart_olculer?.[baseOlcu] || 0;
            const carpan = priceList.cogaltma_carpan || 0.5;
            const copyPrice = Math.round(basePrice * carpan) * options.cogaltmaAdet;
            lineTotal += copyPrice;
            lineItems.push(`${options.cogaltmaAdet}x Çoğaltma: ${copyPrice}`);
        }

        // Çerçeve / Fotoblok / Kanvas
        if (options.cerceve) {
            const f = priceList.cerceve?.olculer?.[options.olcu] || priceList.cerceve?.varsayilan || 500;
            lineTotal += f;
            lineItems.push(`Çerçeve: ${f}`);
        }
        if (options.fotoblok) {
            const f = priceList.fotoblok?.olculer?.[options.olcu] || priceList.fotoblok?.varsayilan || 400;
            lineTotal += f;
            lineItems.push(`Fotoblok: ${f}`);
        }
        if (options.kanvas) {
            const f = priceList.kanvas_tablo?.olculer?.[options.olcu] || priceList.kanvas_tablo?.varsayilan || 600;
            lineTotal += f;
            lineItems.push(`Kanvas: ${f}`);
        }

        breakdown.push({
            photoId: photo.photoId,
            orderNumber: photo.orderNumber,
            label: lineItems.join(' + '),
            amount: lineTotal,
        });

        total += lineTotal;
    }

    return { breakdown, total };
}

/**
 * Otomatik açıklama oluştur
 */
export function generateAutoDescription(numberedPhotos, shootCategory) {
    if (!numberedPhotos.length) return '';

    const activePhotos = numberedPhotos.filter(np => !np.isCancelled);
    if (!activePhotos.length) return '';

    const parts = [];
    const typeCounts = {};

    for (const photo of activePhotos) {
        const details = photo.optionDetails || {};
        let key = '';

        switch (shootCategory) {
            case 'vesikalik_biyometrik':
                key = `${details.adet || '4'}${(details.tur || 'Vs').substring(0, 3)}`;
                break;
            case 'yillik':
                key = details.tur || 'Yıllık';
                break;
            case 'aile_ajans':
                key = details.olcu || '15x21';
                break;
            case 'etkinlik':
                key = details.tur || 'Etkinlik';
                break;
            default:
                key = 'Poz';
        }

        typeCounts[key] = (typeCounts[key] || 0) + 1;
    }

    for (const [key, count] of Object.entries(typeCounts)) {
        if (count > 1) {
            parts.push(`${count}x${key}`);
        } else {
            parts.push(key);
        }
    }

    return parts.join(' + ');
}
