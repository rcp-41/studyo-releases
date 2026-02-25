/**
 * LRU Image Cache — bellek yönetimi için
 * Blob URL'lerini cache'ler ve kapasiteye ulaşıldığında en eski kullanılanı çıkarır
 */
class ImageCache {
    constructor(maxSize = 10) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(photoId) {
        const entry = this.cache.get(photoId);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.data;
        }
        return null;
    }

    set(photoId, data) {
        // Kapasitedeyse en eski kullanılanı çıkar
        if (this.cache.size >= this.maxSize) {
            let oldest = null;
            let oldestTime = Infinity;
            for (const [key, entry] of this.cache) {
                if (entry.lastAccess < oldestTime) {
                    oldestTime = entry.lastAccess;
                    oldest = key;
                }
            }
            if (oldest) {
                const evicted = this.cache.get(oldest);
                if (evicted.data && typeof evicted.data === 'string' && evicted.data.startsWith('blob:')) {
                    URL.revokeObjectURL(evicted.data);
                }
                this.cache.delete(oldest);
            }
        }
        this.cache.set(photoId, { data, lastAccess: Date.now() });
    }

    has(photoId) {
        return this.cache.has(photoId);
    }

    clear() {
        for (const [, entry] of this.cache) {
            if (entry.data && typeof entry.data === 'string' && entry.data.startsWith('blob:')) {
                URL.revokeObjectURL(entry.data);
            }
        }
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

// Single view preview cache (max 10 images ~2MB)
export const previewCache = new ImageCache(10);

// Full resolution cache for zoom (max 3 images)
export const fullResCache = new ImageCache(3);
