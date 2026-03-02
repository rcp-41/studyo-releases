/**
 * Store state'ini .ini format objesine dönüştür.
 *
 * INI Format:
 *   [General]          — metadata (archiveNo, timestamps, sessionId)
 *   [Photos]           — per-photo line: originalName = currentName|status|orderNum|options|optionDetailsJSON
 *   [RemovedFromFavorites] — tracking removed favorites for auditability
 *
 * The pipe-delimited value format allows restoring full state from the INI file alone.
 */
export function serializeToIni(state) {
    const { archiveInfo, photos, favorites, removedFavorites, numberedPhotos } = state;

    if (!photos || !Array.isArray(photos)) {
        console.warn('[iniManager] serializeToIni called with no photos array');
        return null;
    }

    const iniData = {
        General: {
            version: '2',
            archiveNo: archiveInfo?.archiveNo || '',
            createdDate: new Date().toISOString().split('T')[0],
            lastModified: new Date().toISOString(),
            sessionId: archiveInfo?.archiveId || 'standalone',
            photoCount: String(photos.length),
            favoriteCount: String(favorites?.size || 0),
            numberedCount: String(numberedPhotos?.filter(np => !np.isCancelled)?.length || 0),
        },
        Photos: {},
        RemovedFromFavorites: {},
    };

    const numberedMap = new Map();
    if (numberedPhotos && Array.isArray(numberedPhotos)) {
        numberedPhotos.forEach(np => numberedMap.set(np.photoId, np));
    }

    const favSet = favorites instanceof Set ? favorites : new Set();
    const removedSet = removedFavorites instanceof Set ? removedFavorites : new Set();

    photos.forEach(photo => {
        if (!photo?.originalName) return; // Skip malformed photo entries

        const isFav = favSet.has(photo.id);
        const isRemoved = removedSet.has(photo.id);
        const numbered = numberedMap.get(photo.id);

        const status = isRemoved ? 'unfavorited' : (isFav ? 'favorite' : 'none');
        const orderNum = numbered ? numbered.orderNumber : 0;
        const opts = numbered?.options ? numbered.options.join(',') : '';
        const cancelled = numbered?.isCancelled ? '1' : '0';

        // Serialize optionDetails as compact JSON (strip newlines to keep INI valid)
        let optDetailsStr = '';
        if (numbered?.optionDetails && Object.keys(numbered.optionDetails).length > 0) {
            try {
                optDetailsStr = JSON.stringify(numbered.optionDetails).replace(/[\r\n]/g, '');
            } catch { optDetailsStr = ''; }
        }

        // Format: currentName|status|orderNum|options|cancelled|optionDetailsJSON
        iniData.Photos[photo.originalName] =
            `${photo.currentName || photo.originalName}|${status}|${orderNum}|${opts}|${cancelled}|${optDetailsStr}`;
    });

    removedSet.forEach(photoId => {
        iniData.RemovedFromFavorites[photoId] = `removed_at:${new Date().toISOString()}`;
    });

    if (numberedPhotos && numberedPhotos.length > 0) {
        iniData.NumberedPhotos = {};
        const activeNumbered = numberedPhotos.filter(np => !np.isCancelled).sort((a, b) => a.orderNumber - b.orderNumber);

        activeNumbered.forEach(np => {
            const photo = photos.find(p => p.id === np.photoId);
            const name = photo?.currentName || photo?.originalName || np.photoId;
            let val = name;

            const options = np.options?.join(', ');
            if (options) {
                val += ` | Secenekler: ${options}`;
            } else if (np.optionDetails?._packageName) {
                val += ` | Paket: ${np.optionDetails._packageName}`;
            }

            const note = np.optionDetails?.not || np.optionDetails?.description;
            if (note) val += ` | Not: ${note}`;

            iniData.NumberedPhotos[String(np.orderNumber)] = val;
        });
    }

    return iniData;
}

/**
 * Parse edilmiş .ini verisinden store state geri yükle.
 * Supports both v1 (4-field) and v2 (6-field) pipe-delimited formats.
 */
export function deserializeFromIni(iniData) {
    const result = {
        favorites: new Set(),
        removedFavorites: new Set(),
        numberedPhotos: [],
        photoNameMap: {},
        nextOrderNumber: 1,
    };

    if (!iniData || typeof iniData !== 'object') return result;
    if (!iniData.Photos || typeof iniData.Photos !== 'object') return result;

    let maxOrder = 0;

    for (const [originalName, value] of Object.entries(iniData.Photos)) {
        if (!originalName || typeof value !== 'string') continue;

        const parts = value.split('|');
        // v1 has 4 fields, v2 has 6 fields — handle both gracefully
        if (parts.length < 3) {
            console.warn(`[iniManager] Skipping malformed entry for "${originalName}": "${value}"`);
            continue;
        }

        const currentName = parts[0] || originalName;
        const status = parts[1] || 'none';
        const orderNumber = parseInt(parts[2], 10) || 0;
        const optsStr = parts[3] || '';
        const cancelledStr = parts[4] || '0';
        const optDetailsStr = parts[5] || '';

        result.photoNameMap[originalName] = currentName;

        if (status === 'favorite') result.favorites.add(originalName);
        if (status === 'unfavorited') result.removedFavorites.add(originalName);

        if (orderNumber > 0) {
            // Parse optionDetails JSON if present
            let optionDetails = {};
            if (optDetailsStr) {
                try {
                    optionDetails = JSON.parse(optDetailsStr);
                } catch {
                    console.warn(`[iniManager] Could not parse optionDetails for "${originalName}"`);
                }
            }

            result.numberedPhotos.push({
                photoId: originalName,
                orderNumber,
                options: optsStr ? optsStr.split(',').filter(Boolean) : [],
                optionDetails,
                isCancelled: cancelledStr === '1',
            });
            maxOrder = Math.max(maxOrder, orderNumber);
        }
    }

    result.nextOrderNumber = maxOrder + 1;
    result.numberedPhotos.sort((a, b) => a.orderNumber - b.orderNumber);
    return result;
}
