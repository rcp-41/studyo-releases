/**
 * DatabaseHandler - Multi-Tenant Database Access Layer
 * 
 * Bu sınıf, çoklu stüdyo (SaaS) mimarisinde tüm Firestore sorgularını
 * merkezi olarak yönetir ve stüdyo bazlı veri izolasyonu sağlar.
 * 
 * Kullanım:
 *   const dbHandler = DatabaseHandler.fromRequest(request);
 *   const archives = await dbHandler.collection('archives').get();
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const FieldValue = admin.firestore.FieldValue;

class DatabaseHandler {
    /**
     * @param {string} studioId - Aktif stüdyo ID'si
     */
    constructor(studioId) {
        if (!studioId) {
            throw new Error('Studio ID is required for DatabaseHandler');
        }
        this.studioId = studioId;
        this.db = admin.firestore();
    }

    /**
     * Stüdyo bazlı koleksiyon referansı döndürür
     * @param {string} collectionName - Koleksiyon adı (örn: 'archives', 'customers')
     * @returns {FirebaseFirestore.CollectionReference}
     */
    collection(collectionName) {
        return this.db
            .collection('studios')
            .doc(this.studioId)
            .collection(collectionName);
    }

    /**
     * Fallback'li koleksiyon referansı döndürür.
     * Önce studios/{studioId}/{collectionName} altına bakar.
     * Eğer boşsa, top-level {collectionName} koleksiyonuna düşer.
     * Bu, veriler henüz migrate edilmemişken geriye dönük uyumluluk sağlar.
     * 
     * @param {string} collectionName - Koleksiyon adı
     * @returns {Promise<FirebaseFirestore.CollectionReference>}
     */
    async collectionWithFallback(collectionName) {
        const studioRef = this.collection(collectionName);
        // Hızlı kontrol: subcollection'da en az 1 doküman var mı?
        const probe = await studioRef.limit(1).get();
        if (!probe.empty) {
            return studioRef;
        }
        // Fallback: top-level koleksiyon
        console.log(`[DatabaseHandler] Fallback: studios/${this.studioId}/${collectionName} boş, top-level '${collectionName}' kullanılıyor`);
        return this.db.collection(collectionName);
    }

    /**
     * Stüdyo dokümanına referans döndürür
     * @returns {FirebaseFirestore.DocumentReference}
     */
    studioDoc() {
        return this.db.collection('studios').doc(this.studioId);
    }

    /**
     * Stüdyo bilgilerini getirir
     * @returns {Promise<Object>}
     */
    async getStudioInfo() {
        const doc = await this.studioDoc().get();
        if (!doc.exists) {
            throw new Error(`Studio not found: ${this.studioId}`);
        }
        return { id: doc.id, ...doc.data() };
    }

    /**
     * Stüdyo bilgilerini günceller
     * @param {Object} data - Güncellenecek veriler
     */
    async updateStudioInfo(data) {
        await this.studioDoc().update({
            ...data,
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    /**
     * Toplu yazma işlemi için batch döndürür
     * @returns {FirebaseFirestore.WriteBatch}
     */
    batch() {
        return this.db.batch();
    }

    /**
     * Transaction çalıştırır
     * @param {Function} updateFunction 
     */
    async runTransaction(updateFunction) {
        return this.db.runTransaction(updateFunction);
    }

    /**
     * Cloud Function request'inden DatabaseHandler oluşturur
     * Studio ID SADECE Firebase Auth custom claim'den alınır.
     * 
     * GÜVENLİK: Client'tan gönderilen studioId artık kabul edilmiyor!
     * Bu, bir kullanıcının başka bir stüdyonun verilerine erişmesini engeller.
     * 
     * @param {Object} request - Cloud Function request nesnesi
     * @returns {DatabaseHandler}
     * @throws {Error} - Auth yoksa veya studioId claim'i yoksa hata fırlatır
     */
    static fromRequest(request) {
        // Auth kontrolü
        if (!request.auth) {
            throw new Error('Authentication required. User must be logged in.');
        }

        // studioId claim kontrolü
        const studioId = request.auth.token?.studioId;
        if (!studioId) {
            throw new Error('studioId claim not found in auth token. User must be assigned to a studio.');
        }

        return new DatabaseHandler(studioId);
    }

    /**
     * Super Admin için tüm stüdyolara erişim sağlar (root level)
     * @returns {FirebaseFirestore.Firestore}
     */
    static getRootDb() {
        return admin.firestore();
    }

    /**
     * Belirli bir stüdyo ID'si ile handler oluşturur (Super Admin için)
     * @param {string} studioId 
     * @returns {DatabaseHandler}
     */
    static forStudio(studioId) {
        return new DatabaseHandler(studioId);
    }

    /**
     * Global koleksiyona erişim (Super Admin koleksiyonları için)
     * @param {string} collectionName 
     * @returns {FirebaseFirestore.CollectionReference}
     */
    static globalCollection(collectionName) {
        return admin.firestore().collection(collectionName);
    }

    /**
     * Tüm stüdyoları listeler (Super Admin için)
     * @returns {Promise<Array>}
     */
    static async listAllStudios() {
        const snapshot = await admin.firestore().collection('studios').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    /**
     * Yeni stüdyo oluşturur
     * @param {Object} studioData - Stüdyo bilgileri
     * @returns {Promise<Object>} - Oluşturulan stüdyo
     */
    static async createStudio(studioData) {
        const db = admin.firestore();
        const { name, owner, contact, licenseKey } = studioData;

        // Benzersiz stüdyo ID'si oluştur (slug formatında)
        const studioId = name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            + '-' + Date.now().toString(36);

        const studioRef = db.collection('studios').doc(studioId);

        await studioRef.set({
            info: {
                name,
                owner,
                contact,
                subscription_status: 'active'
            },
            license: {
                hwid_lock: null,        // İlk çalıştırmada doldurulacak
                mac_address: null,      // İlk çalıştırmada doldurulacak
                license_key: licenseKey || DatabaseHandler.generateLicenseKey(),
                is_active: true,
                registered_at: null
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Varsayılan counter oluştur
        await studioRef.collection('counters').doc('archives').set({
            value: 0
        });

        return {
            id: studioId,
            success: true
        };
    }

    /**
     * Rastgele lisans anahtarı oluşturur
     * @returns {string}
     */
    static generateLicenseKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segments = 4;
        const segmentLength = 4;

        // SECURITY: Use crypto.randomBytes instead of Math.random
        const randomBytes = crypto.randomBytes(segments * segmentLength);
        let key = [];
        for (let s = 0; s < segments; s++) {
            let segment = '';
            for (let c = 0; c < segmentLength; c++) {
                segment += chars.charAt(randomBytes[s * segmentLength + c] % chars.length);
            }
            key.push(segment);
        }

        return key.join('-'); // e.g. ABCD-1234-EFGH-5678
    }
}

module.exports = DatabaseHandler;
