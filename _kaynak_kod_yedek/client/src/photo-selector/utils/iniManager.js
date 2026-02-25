/**
 * Store state'ini .ini format objesine dönüştür
 */
export function serializeToIni(state) {
    const { archiveInfo, photos, favorites, removedFavorites, numberedPhotos } = state;

    const iniData = {
        General: {
            archiveNo: archiveInfo?.archiveNo || '',
            createdDate: new Date().toISOString().split('T')[0],
            lastModified: new Date().toISOString(),
            sessionId: archiveInfo?.archiveId || 'standalone',
        },
        Photos: {},
        RemovedFromFavorites: {},
    };

    const numberedMap = new Map();
    numberedPhotos.forEach(np => numberedMap.set(np.photoId, np));

    photos.forEach(photo => {
        const isFav = favorites.has(photo.id);
        const isRemoved = removedFavorites.has(photo.id);
        const numbered = numberedMap.get(photo.id);

        const status = isRemoved ? 'unfavorited' : (isFav ? 'favorite' : 'none');
        const orderNum = numbered ? numbered.orderNumber : 0;
        const opts = numbered ? numbered.options.join(',') : '';

        iniData.Photos[photo.originalName] =
            `${photo.currentName}|${status}|${orderNum}|${opts}`;
    });

    removedFavorites.forEach(photoId => {
        iniData.RemovedFromFavorites[photoId] = `removed_at:${new Date().toISOString()}`;
    });

    return iniData;
}

/**
 * Parse edilmiş .ini verisinden store state geri yükle
 */
export function deserializeFromIni(iniData) {
    const result = {
        favorites: new Set(),
        removedFavorites: new Set(),
        numberedPhotos: [],
        photoNameMap: {},
        nextOrderNumber: 1,
    };

    if (!iniData?.Photos) return result;

    let maxOrder = 0;

    for (const [originalName, value] of Object.entries(iniData.Photos)) {
        const parts = value.split('|');
        if (parts.length < 4) continue;

        const [currentName, status, orderStr, optsStr] = parts;
        const orderNumber = parseInt(orderStr, 10) || 0;

        result.photoNameMap[originalName] = currentName;

        if (status === 'favorite') result.favorites.add(originalName);
        if (status === 'unfavorited') result.removedFavorites.add(originalName);

        if (orderNumber > 0) {
            result.numberedPhotos.push({
                photoId: originalName,
                orderNumber,
                options: optsStr ? optsStr.split(',').filter(Boolean) : [],
                optionDetails: {},
                isCancelled: false,
            });
            maxOrder = Math.max(maxOrder, orderNumber);
        }
    }

    result.nextOrderNumber = maxOrder + 1;
    result.numberedPhotos.sort((a, b) => a.orderNumber - b.orderNumber);
    return result;
}
