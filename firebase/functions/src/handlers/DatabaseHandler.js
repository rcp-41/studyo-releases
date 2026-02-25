/**
 * DatabaseHandler - Multi-Tenant Database Access Layer
 * 
 * Bu sınıf, çoklu organizasyon ve stüdyo (SaaS) mimarisinde tüm Firestore
 * sorgularını merkezi olarak yönetir ve organizasyon+stüdyo bazlı veri
 * izolasyonu sağlar.
 * 
 * Veri yolu: organizations/{orgId}/studios/{studioId}/{collection}
 * 
 * Kullanım:
 *   const dbHandler = await DatabaseHandler.fromRequest(request);
 *   const archives = await dbHandler.collection('archives').get();
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const FieldValue = admin.firestore.FieldValue;

class DatabaseHandler {
    /**
     * @param {string} studioId - Aktif stüdyo ID'si
     * @param {string} organizationId - Organizasyon ID'si (null = legacy path)
     */
    constructor(studioId, organizationId) {
        if (!studioId) {
            throw new Error('Studio ID is required for DatabaseHandler');
        }
        this.studioId = studioId;
        this.organizationId = organizationId || null;
        this.db = admin.firestore();
        // Legacy mode: organizationId yoksa eski /studios/{studioId}/ path kullanılır
        this.isLegacy = !organizationId;
    }

    /**
     * Stüdyo bazlı koleksiyon referansı döndürür
     * Path: organizations/{orgId}/studios/{studioId}/{collectionName}
     * @param {string} collectionName - Koleksiyon adı (örn: 'archives', 'customers')
     * @returns {FirebaseFirestore.CollectionReference}
     */
    collection(collectionName) {
        if (this.isLegacy) {
            return this.db
                .collection('studios')
                .doc(this.studioId)
                .collection(collectionName);
        }
        return this.db
            .collection('organizations')
            .doc(this.organizationId)
            .collection('studios')
            .doc(this.studioId)
            .collection(collectionName);
    }

    /**
     * Stüdyo dokümanına referans döndürür
     * Path: organizations/{orgId}/studios/{studioId}
     * @returns {FirebaseFirestore.DocumentReference}
     */
    studioDoc() {
        if (this.isLegacy) {
            return this.db
                .collection('studios')
                .doc(this.studioId);
        }
        return this.db
            .collection('organizations')
            .doc(this.organizationId)
            .collection('studios')
            .doc(this.studioId);
    }

    /**
     * Organizasyon dokümanına referans döndürür
     * Path: organizations/{orgId}
     * @returns {FirebaseFirestore.DocumentReference}
     */
    organizationDoc() {
        return this.db
            .collection('organizations')
            .doc(this.organizationId);
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
     * Studio ID ve Organization ID SADECE Firebase Auth custom claim'den alınır.
     * 
     * GÜVENLİK: Client'tan gönderilen studioId/organizationId kabul edilmiyor!
     * Bu, bir kullanıcının başka bir stüdyonun verilerine erişmesini engeller.
     * 
     * @param {Object} request - Cloud Function request nesnesi
     * @param {Object} [options] - Ek seçenekler
     * @param {boolean} [options.checkSubscription=false] - Subscription durumunu kontrol et
     * @returns {DatabaseHandler}
     * @throws {Error} - Auth yoksa veya claim'ler yoksa hata fırlatır
     */
    static async fromRequest(request, options = {}) {
        // Auth kontrolü
        if (!request.auth) {
            throw new Error('Authentication required. User must be logged in.');
        }

        // studioId claim kontrolü
        const studioId = request.auth.token?.studioId;
        if (!studioId) {
            throw new Error('studioId claim not found in auth token. User must be assigned to a studio.');
        }

        // organizationId claim kontrolü — legacy fallback destekli
        let organizationId = request.auth.token?.organizationId || null;

        // Legacy fallback: organizationId claim'i yoksa eski path kullan
        // Migration sonrası tüm kullanıcılar organizationId claim'e sahip olacak
        if (!organizationId) {
            console.warn(`[DatabaseHandler] User ${request.auth.uid} has no organizationId claim — using legacy path for studio ${studioId}`);
        }

        const handler = new DatabaseHandler(studioId, organizationId);

        // Subscription kontrolü (isteğe bağlı)
        if (options.checkSubscription) {
            const studioInfo = await handler.getStudioInfo();
            const status = studioInfo.info?.subscription_status;
            if (status === 'suspended') {
                throw new Error('Studio is suspended. Contact your administrator.');
            }
            if (status === 'expired') {
                throw new Error('Studio license has expired. Please renew.');
            }
        }

        return handler;
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
     * @param {string} organizationId 
     * @returns {DatabaseHandler}
     */
    static forStudio(studioId, organizationId) {
        return new DatabaseHandler(studioId, organizationId);
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
     * Tüm organizasyonları listeler (Creator için)
     * @returns {Promise<Array>}
     */
    static async listAllOrganizations() {
        const snapshot = await admin.firestore().collection('organizations').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    /**
     * Bir organizasyondaki tüm stüdyoları listeler
     * @param {string} organizationId
     * @returns {Promise<Array>}
     */
    static async listStudiosInOrganization(organizationId) {
        const snapshot = await admin.firestore()
            .collection('organizations')
            .doc(organizationId)
            .collection('studios')
            .get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    /**
     * Tüm stüdyoları listeler (tüm organizasyonlardan, Creator için)
     * @returns {Promise<Array>}
     */
    static async listAllStudios() {
        const orgs = await admin.firestore().collection('organizations').get();
        const allStudios = [];

        for (const orgDoc of orgs.docs) {
            const studiosSnap = await orgDoc.ref.collection('studios').get();
            studiosSnap.docs.forEach(studioDoc => {
                allStudios.push({
                    id: studioDoc.id,
                    organizationId: orgDoc.id,
                    organizationName: orgDoc.data().name || orgDoc.id,
                    ...studioDoc.data()
                });
            });
        }

        return allStudios;
    }

    /**
     * Yeni organizasyon oluşturur
     * @param {Object} orgData - Organizasyon bilgileri
     * @returns {Promise<Object>} - Oluşturulan organizasyon
     */
    static async createOrganization(orgData) {
        const db = admin.firestore();
        const { name, owner, slug } = orgData;

        const orgId = slug || name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const orgRef = db.collection('organizations').doc(orgId);

        // Check if already exists
        const existing = await orgRef.get();
        if (existing.exists) {
            throw new Error(`Organization with ID '${orgId}' already exists`);
        }

        await orgRef.set({
            name,
            owner: owner || '',
            slug: orgId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return { id: orgId, success: true };
    }

    /**
     * Yeni stüdyo oluşturur (organizasyon altında)
     * @param {string} organizationId - Organizasyon ID'si
     * @param {Object} studioData - Stüdyo bilgileri
     * @returns {Promise<Object>} - Oluşturulan stüdyo
     */
    static async createStudio(organizationId, studioData) {
        const db = admin.firestore();
        const { name, owner, contact, licenseKey } = studioData;

        // Validate organization exists
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgDoc = await orgRef.get();
        if (!orgDoc.exists) {
            throw new Error(`Organization not found: ${organizationId}`);
        }

        const studioRef = orgRef.collection('studios').doc();
        const studioId = studioRef.id;

        await studioRef.set({
            info: {
                name,
                owner: owner || 'Studio Owner',
                contact: contact || '',
                subscription_status: 'active'
            },
            license: {
                hwid_lock: null,
                mac_address: null,
                license_key: licenseKey || DatabaseHandler.generateLicenseKey(),
                is_active: true,
                hwid_registered: false,
                expires_at: null,
                last_validated_at: null,
                registered_at: null
            },
            organizationId: organizationId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Varsayılan counter oluştur
        await studioRef.collection('counters').doc('archives').set({
            value: 0
        });

        return {
            id: studioId,
            organizationId: organizationId,
            success: true
        };
    }

    /**
     * Rastgele lisans anahtarı oluşturur
     *
     * SECURITY: Uses crypto.randomBytes for cryptographically secure randomness.
     * Entropy: 16 characters from a 36-char alphabet = ~82.7 bits of entropy.
     * Rejection sampling eliminates modular bias (256 % 36 != 0).
     *
     * @returns {string} License key in format XXXX-XXXX-XXXX-XXXX
     */
    static generateLicenseKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const charLen = chars.length; // 36
        const segments = 4;
        const segmentLength = 4;
        const totalChars = segments * segmentLength; // 16

        // Rejection sampling: discard random bytes that would cause modular bias.
        // For 36 chars, the largest multiple of 36 that fits in a byte is 252 (36*7).
        // Bytes >= 252 are rejected and re-sampled.
        const maxUnbiased = Math.floor(256 / charLen) * charLen; // 252

        const selected = [];
        while (selected.length < totalChars) {
            const randomBytes = crypto.randomBytes(totalChars * 2); // over-provision to minimize loops
            for (let i = 0; i < randomBytes.length && selected.length < totalChars; i++) {
                if (randomBytes[i] < maxUnbiased) {
                    selected.push(chars.charAt(randomBytes[i] % charLen));
                }
            }
        }

        // Format as XXXX-XXXX-XXXX-XXXX
        const key = [];
        for (let s = 0; s < segments; s++) {
            key.push(selected.slice(s * segmentLength, (s + 1) * segmentLength).join(''));
        }

        return key.join('-');
    }
}

module.exports = DatabaseHandler;
