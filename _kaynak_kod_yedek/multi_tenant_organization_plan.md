# Multi-Tenant Organizasyon Planı - Studyo SaaS

> **Proje:** Studyo Yönetim Sistemi
> **Mimari:** Multi-Tenant SaaS (Firebase + Electron + React)
> **Son Güncelleme:** 2026-02-23
> **Durum:** ~70% Tamamlandı - Kritik eksikler bu planda detaylandırılmıştır.

---

## 1. Genel Bakış ve Mevcut Durum

### 1.1 Proje Amacı
Mevcut tekil stüdyo yönetimi uygulaması, birden fazla **organizasyon ve stüdyo grubuna** hizmet verecek merkezi bir SaaS yapısına dönüştürülecektir. Stüdyolar organizasyonlar altında gruplandırılacak (örn: Zümrüt → 20 şube, Yakut → 20 şube), her organizasyonun ve stüdyonun verisi izole edilecek, "Super Admin" (Creator) tüm organizasyonları tek panelden yönetebilecek, organizasyon sahipleri (org_admin) kendi şubelerini görebilecek, lisanslama donanım bazlı (HWID) kısıtlanacak ve eski veriler otomatik içeri aktarılabilecek.

### 1.2 Mevcut Mimari Özet
```
R:\Studyo/
├── client/                    # Electron + React (Stüdyo Masaüstü Uygulaması)
│   ├── electron/
│   │   ├── main.js            # Electron ana process, HWID IPC handler'ları
│   │   ├── preload.js         # IPC köprüsü (contextBridge)
│   │   ├── whatsapp.js        # WhatsApp Baileys entegrasyonu
│   │   └── photoSelector.js   # Fotoğraf seçici modül
│   ├── security/
│   │   └── hwid_generator.py  # Python HWID çıkarıcı
│   └── src/
│       ├── pages/             # Login, Setup, Archives, Customers, vb.
│       ├── services/api.js    # Cloud Functions çağrı katmanı
│       ├── store/authStore.js # Zustand auth state
│       └── lib/firebase.js    # Firebase SDK init
├── firebase/
│   ├── functions/src/
│   │   ├── index.js           # Tüm function export'ları
│   │   ├── admin-init.js      # createStudio, deleteStudio, HWID, 2FA
│   │   ├── handlers/
│   │   │   ├── DatabaseHandler.js  # Multi-tenant veri izolasyon katmanı
│   │   │   └── auditLogger.js     # Audit trail loglama
│   │   ├── archives.js        # Arşiv CRUD
│   │   ├── appointments.js    # Randevu yönetimi
│   │   ├── customers.js       # Müşteri yönetimi
│   │   ├── finance.js         # Finans takibi
│   │   ├── shoots.js          # Çekim yönetimi
│   │   ├── settings.js        # Stüdyo ayarları
│   │   ├── options.js         # ShootTypes, Locations, Photographers
│   │   ├── users.js           # Kullanıcı yönetimi
│   │   ├── migration.js       # Multi-tenant migration
│   │   └── ...diğer modüller
│   ├── firestore.rules        # Güvenlik kuralları
│   ├── storage.rules          # Storage güvenlik kuralları
│   └── firestore.indexes.json # Sorgu indeksleri
└── creator_control_panel/     # React Web (Super Admin Paneli)
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx  # İstatistik dashboard
        │   ├── Studios.jsx    # Stüdyo CRUD + HWID yönetimi
        │   ├── Login.jsx      # Creator girişi
        │   └── Migration.jsx  # Veri taşıma arayüzü
        └── services/
            └── creatorApi.js  # Cloud Functions çağrıları
```

### 1.3 Tamamlanan Bileşenler
| Bileşen | Durum | Dosya(lar) |
|---------|-------|-----------|
| Firestore multi-tenant şema | ✅ Tam | `firestore.rules` |
| DatabaseHandler izolasyon | ✅ Tam | `handlers/DatabaseHandler.js` |
| Auth custom claims (role, studioId) | ✅ Tam | `admin-init.js:180-194` |
| Tüm data function'ları studioId desteği | ✅ Tam | `archives.js`, `customers.js`, vb. |
| Storage rules multi-tenant | ✅ Tam | `storage.rules` |
| Creator panel temel yapı | ✅ Tam | `creator_control_panel/` |
| Stüdyo CRUD (Create/Delete) | ✅ Tam | `admin-init.js:114-294` |
| Rate limiting | ✅ Tam | `admin-init.js:13-34` |
| 2FA (TOTP) | ✅ Tam | `admin-init.js:366-476` |
| HWID Python script | ✅ Tam | `security/hwid_generator.py` |
| HWID IPC handler'ları | ✅ Tam | `electron/main.js:386-498` |
| License config local storage | ✅ Tam | `electron/main.js:459-498` |
| Legacy collection'lar disabled | ✅ Tam | `firestore.rules:174-208` |

### 1.4 Eksik/Tamamlanmamış Bileşenler
| Bileşen | Durum | Öncelik |
|---------|-------|---------|
| HWID doğrulama Cloud Function'da | ❌ Yok | KRİTİK |
| İlk çalıştırma HWID kayıt akışı | ❌ Yok | KRİTİK |
| Lisans süre kontrolü (expiration) | ❌ Yok | YÜKSEK |
| Subscription suspend/reactivate zorlaması | ❌ Yok | YÜKSEK |
| Creator panel HWID reset Cloud Function | ⚠️ Kısmi (sadece Firestore update) | YÜKSEK |
| Paket Deployment Builder | ❌ Yok | ORTA |
| Migration UI backend bağlantısı | ❌ Yok | ORTA |
| Audit log görüntüleyici | ❌ Yok | ORTA |
| Lisans anahtarı yenileme/iptal | ❌ Yok | ORTA |
| Finance subcollection kullanımı | ⚠️ Kısmi | DÜŞÜK |

---

## 2. Veritabanı Mimarisi (Firebase Firestore)

### 2.1 Hedef Şema Yapısı (Organizations Katmanlı)

```
organizations/ (Root Collection) ← YENİ KATMAN
  └── {orgId}/ (Document)
        ├── name: string              ("Zümrüt Fotoğrafçılık")
        ├── slug: string              ("zumrut")
        ├── owner: string             ("Uğur Kırcı")
        ├── email: string             ("ugur@zumrut.com")
        ├── phone: string
        ├── isActive: boolean
        ├── createdAt: timestamp
        ├── updatedAt: timestamp
        ├── createdBy: string         (creator uid)
        │
        └── studios/ (Subcollection)
              └── {studioId}/ (Document)
                    ├── name: string                  ("Zümrüt İzmit")
                    ├── organizationId: string         ← geri referans
                    ├── info: {
                    │     owner: string,
                    │     email: string,
                    │     contact: string,
                    │     subscription_status: 'active' | 'suspended' | 'expired'
                    │   }
                    ├── license: {
                    │     hwid_lock: string | null,
                    │     mac_address: string | null,
                    │     license_key: 'XXXX-XXXX-XXXX-XXXX',
                    │     is_active: boolean,
                    │     max_users: number,
                    │     registered_at: timestamp | null,
                    │     expires_at: timestamp | null      // ❌ EKSİK - Eklenmeli
                    │   }
                    ├── createdAt: timestamp
                    ├── createdBy: string (creator uid)
                    ├── updatedAt: timestamp
                    │
                    ├── archives/ (Subcollection)         ✅ Aktif
                    ├── appointments/ (Subcollection)     ✅ Aktif
                    ├── customers/ (Subcollection)        ✅ Aktif
                    ├── shoots/ (Subcollection)           ✅ Aktif
                    ├── finance/ (Subcollection)          ⚠️ Planlandı ama kullanılmıyor
                    ├── payments/ (Subcollection)         ✅ Aktif
                    ├── shootTypes/ (Subcollection)       ✅ Aktif
                    ├── locations/ (Subcollection)        ✅ Aktif
                    ├── photographers/ (Subcollection)    ✅ Aktif
                    ├── packages/ (Subcollection)         ✅ Aktif
                    ├── settings/ (Subcollection)         ✅ Aktif
                    ├── users/ (Subcollection)            ✅ Aktif
                    ├── schools/ (Subcollection)          ✅ Aktif (Photo Selector)
                    ├── priceLists/ (Subcollection)       ✅ Aktif (Photo Selector)
                    ├── integrations/ (Subcollection)     ✅ Aktif
                    ├── activityLogs/ (Subcollection)     ✅ Aktif (immutable)
                    ├── auditLogs/ (Subcollection)        ✅ Aktif (immutable)
                    ├── counters/ (Subcollection)         ✅ Aktif (Cloud Functions only)
                    ├── system_users/ (Subcollection)     ✅ Aktif (Cloud Functions only)
                    └── paymentIntents/ (Subcollection)   ✅ Aktif (Cloud Functions only)

users/ (Root - Creator/Super Admin profilleri)
  └── {uid}/ → totpSecret, totpEnabled, organizationId, studioId, role

_rateLimits/ (Root - Cloud Functions only)
  └── {key}/ → count, resetAt
```

> **Veri Yolu Değişikliği:**
> | Mevcut | Yeni |
> |---|---|
> | `studios/{studioId}/archives/...` | `organizations/{orgId}/studios/{studioId}/archives/...` |
> | `studios/{studioId}/appointments/...` | `organizations/{orgId}/studios/{studioId}/appointments/...` |

### 2.2 Yapılması Gereken Şema Değişiklikleri

#### 2.2.1 License alanına `expires_at` eklenmesi
**Dosya:** `firebase/functions/src/admin-init.js:148-167`
**Mevcut Durum:** `license` objesi `expires_at` alanı içermiyor.
**Yapılacak:**
```javascript
// admin-init.js createStudio fonksiyonunda license objesine eklenmeli:
license: {
    hwid_lock: hwidLock || false,
    license_key: licenseKey || null,
    max_users: 5,
    is_active: true,
    registered_at: null,
    expires_at: null,           // null = süresiz, veya bir tarih
    hwid_registered: false,     // HWID kaydı yapıldı mı?
    last_validated_at: null     // Son doğrulama zamanı
}
```

#### 2.2.2 `subscription_history` subcollection eklenmesi
Stüdyo askıya alınma/aktifleştirme geçmişi tutmak için:
```
organizations/{orgId}/studios/{studioId}/subscription_history/{logId}
  ├── action: 'activated' | 'suspended' | 'expired' | 'renewed'
  ├── performedBy: string (creator uid)
  ├── reason: string
  ├── timestamp: timestamp
  └── previousStatus: string
```

#### 2.2.3 Mevcut `collectionWithFallback` mekanizmasının kaldırılması
**Dosya:** `firebase/functions/src/handlers/DatabaseHandler.js:49-59`
**Mevcut Durum:** `collectionWithFallback()` metodu legacy root-level koleksiyonlara fallback yapıyor.
**Yapılacak:** Migration tamamlandıktan sonra bu metod kaldırılmalı çünkü:
- Root-level koleksiyonlar Firestore rules'da zaten `allow read, write: if false;` ile kapatılmış
- Bu fallback gereksiz sorgu maliyeti oluşturuyor
- Her çağrıda fazladan bir `limit(1).get()` sorgusu yapılıyor

**Aksiyon:**
1. Tüm function'larda `collectionWithFallback` kullanımlarını tespit et
2. Hepsini `collection()` ile değiştir
3. `collectionWithFallback` metodunu sil
4. Bunu migration tamamen tamamlandıktan sonra yap

---

## 3. Güvenlik ve Lisanslama (HWID/MAC Lock)

### 3.1 Mevcut HWID Altyapısı

**HWID Üretimi (Python Script):**
**Dosya:** `client/security/hwid_generator.py`
- CPU/Anakart seri numarası
- Disk seri numarası
- MAC adresi
- Windows Product ID
- Çıktı formatı: `"CPU_XXX-DISK_YYY-MAC_ZZZ"`

**Electron IPC Handler'ları:**
**Dosya:** `client/electron/main.js:386-498`
```
security:getHwid          → Python script çalıştırıp HWID döndürür
security:validateLicense   → Yerel HWID ile kayıtlı HWID karşılaştırır
security:getLicenseConfig  → license.json dosyasını okur
security:saveLicenseConfig → license.json dosyasına yazar
security:clearLicenseConfig → license.json dosyasını siler
```

**Local License Dosyası:**
Konum: `{app.getPath('userData')}/license.json`
```json
{
    "studioId": "my-studio-abc123",
    "studioName": "My Studio",
    "serialKey": "XXXX-XXXX-XXXX-XXXX",
    "setupDate": "2026-02-23T10:00:00Z",
    "studios": [
        { "id": "my-studio-abc123", "name": "My Studio", "path": "/path/to/archives" }
    ]
}
```

### 3.2 Eksik: İlk Çalıştırma HWID Kayıt Akışı

**Mevcut akış** (`client/src/pages/Setup.jsx`):
1. Kullanıcı seri anahtarı girer
2. `validateSerialKey()` Cloud Function stüdyoyu bulur
3. Local `license.json` dosyasına kaydeder (studioId, studioName, serialKey)
4. Login sayfasına yönlendirir

**Eksik adımlar — Eklenmesi gereken akış:**

```
[Setup.jsx] Kullanıcı seri anahtarı girer
    ↓
[Setup.jsx] validateSerialKey() → studioId döner
    ↓
[Setup.jsx] window.electron.getHwid() → yerel HWID alınır     ← EKSİK
    ↓
[Setup.jsx] registerHwid({ studioId, hwid, macAddress }) çağır  ← EKSİK (Yeni Cloud Function)
    ↓
[Cloud Function] Firebase'de studios/{studioId}/license kontrol:
    ├── hwid_lock === null → İlk kayıt: HWID yaz, registered_at = now
    ├── hwid_lock === gelen_hwid → Aynı cihaz, OK
    └── hwid_lock !== gelen_hwid → HATA: "Farklı cihaz tespit edildi"
    ↓
[Setup.jsx] Başarılıysa license.json'a hwid de eklenerek kaydedilir
    ↓
[Login.jsx'e yönlendir]
```

**Yapılması gerekenler:**

#### 3.2.1 Yeni Cloud Function: `registerHwid`
**Dosya:** `firebase/functions/src/admin-init.js`
**Eklenecek fonksiyon:**
```javascript
exports.registerHwid = onCall({ enforceAppCheck: false }, async (request) => {
    const clientIp = request.rawRequest?.ip || 'unknown';
    await checkRateLimit(`registerHwid_${clientIp}`, 5, 600000);

    const { serialKey, hwid, macAddress } = request.data;

    // 1. Seri anahtarı ile stüdyoyu bul
    // 2. license.hwid_lock kontrol et:
    //    - null ise: ilk kayıt, HWID yaz
    //    - eşleşiyorsa: OK
    //    - eşleşmiyorsa: HATA fırlat
    // 3. Başarılıysa studioId ve studioName döndür
});
```

#### 3.2.2 Setup.jsx güncellenmesi
**Dosya:** `client/src/pages/Setup.jsx`
**Mevcut:** `handleSetup()` fonksiyonunda sadece `validateSerialKey` çağrılıyor (satır 42-43).
**Eklenecek:** HWID alma ve kayıt adımları:
```javascript
// validateSerialKey başarılı olduktan sonra:
let hwid = null;
if (window.electron?.getHwid) {
    const hwidResult = await window.electron.getHwid();
    hwid = hwidResult.hwid;

    // Cloud Function ile HWID kaydet/doğrula
    const registerHwidFunc = httpsCallable(functions, 'setup-registerHwid');
    const hwidResponse = await registerHwidFunc({
        serialKey: serialKey.trim(),
        hwid: hwidResult.hwid,
        macAddress: hwidResult.mac_address
    });

    if (!hwidResponse.data.success) {
        toast.error('Bu lisans anahtarı farklı bir cihaza kayıtlı!');
        return;
    }
}

// license.json'a hwid de eklenerek kaydet
const config = {
    studioId,
    studioName,
    serialKey: serialKey.trim(),
    hwid: hwid,
    setupDate: new Date().toISOString()
};
```

### 3.3 Eksik: Her Açılışta HWID Doğrulama

**Mevcut akış** (`client/src/pages/Login.jsx:36-54`):
- Sadece `license.json` dosyasının varlığını kontrol ediyor
- HWID karşılaştırması YAPILMIYOR
- Subscription durumu kontrol edilmiyor

**Eklenmesi gereken akış:**

```
[Login.jsx] Component mount
    ↓
[Login.jsx] license.json oku → studioId, hwid al
    ↓
[Login.jsx] window.electron.getHwid() → yerel HWID al          ← EKSİK
    ↓
[Login.jsx] Yerel HWID vs license.json HWID karşılaştır         ← EKSİK
    ├── Eşleşmiyor → "Lisanssız kullanım" hatası, program kapanır
    └── Eşleşiyor → Devam et
    ↓
[Login.jsx] Login başarılı olduktan sonra:
    ↓
[Cloud Function] getProfile veya checkLicense → subscription_status kontrol  ← EKSİK
    ├── 'suspended' → "Hesabınız askıya alınmış" hatası
    ├── 'expired' → "Lisansınız süresi dolmuş" hatası
    └── 'active' → Normal devam
```

**Yapılması gerekenler:**

#### 3.3.1 Login.jsx'e HWID doğrulama eklenmesi
**Dosya:** `client/src/pages/Login.jsx`
**Mevcut `checkLicense` useEffect'i (satır 36-54)** güncellenmeli:
```javascript
useEffect(() => {
    const checkLicense = async () => {
        try {
            let config = null;
            if (window.electron?.getLicenseConfig) {
                config = await window.electron.getLicenseConfig();
            } else {
                const stored = localStorage.getItem('studyo_license');
                if (stored) config = JSON.parse(stored);
            }

            if (!config?.studioId) {
                navigate('/setup');
                return;
            }

            // HWID DOĞRULAMA (Electron modunda)
            if (window.electron?.getHwid && config.hwid) {
                const hwidResult = await window.electron.getHwid();
                if (hwidResult.hwid?.toUpperCase() !== config.hwid?.toUpperCase()) {
                    toast.error('Bu cihaz lisanslı cihazla eşleşmiyor! Uygulama kapatılacak.');
                    setTimeout(() => window.close(), 3000);
                    return;
                }
            }

            setStudioConfig(config);
        } catch (error) {
            console.error('Failed to load license:', error);
        }
    };
    checkLicense();
}, []);
```

#### 3.3.2 Subscription durumu kontrolü
**Dosya:** `client/src/pages/Login.jsx`
**`handleSubmit` fonksiyonuna (satır 63-89)** login sonrası kontrol eklenmeli:
```javascript
// Login başarılı olduktan sonra:
const result = await login(email, password);
if (result.success) {
    // Subscription durumu kontrol et
    const checkSubscription = httpsCallable(functions, 'auth-checkSubscription');
    const subResult = await checkSubscription();

    if (subResult.data.status === 'suspended') {
        toast.error('Stüdyo hesabınız askıya alınmış. Yöneticinizle iletişime geçin.');
        await auth.signOut();
        return;
    }
    if (subResult.data.status === 'expired') {
        toast.error('Lisans süreniz dolmuş. Lütfen yenileyin.');
        await auth.signOut();
        return;
    }

    toast.success('Giriş başarılı!');
    navigate('/');
}
```

#### 3.3.3 Yeni Cloud Function: `checkSubscription`
**Dosya:** `firebase/functions/src/auth.js`
```javascript
exports.checkSubscription = onCall({ enforceAppCheck: false }, async (request) => {
    const dbHandler = DatabaseHandler.fromRequest(request);
    const studioInfo = await dbHandler.getStudioInfo();

    const status = studioInfo.info?.subscription_status || 'active';
    const expiresAt = studioInfo.license?.expires_at;

    // Süre doldu mu kontrol et
    if (expiresAt && new Date(expiresAt) < new Date()) {
        // Otomatik expire yap
        await dbHandler.updateStudioInfo({
            'info.subscription_status': 'expired'
        });
        return { status: 'expired' };
    }

    return { status, expiresAt };
});
```

### 3.4 Eksik: Creator Panel HWID Reset Cloud Function

**Mevcut Durum:**
Creator panelindeki `handleResetHwid()` (`creator_control_panel/src/pages/Studios.jsx:255-269`) **doğrudan Firestore'a yazıyor.** Bu güvenlik açısından riskli çünkü Creator paneli client-side'dan Firestore'a erişiyor.

**Yapılması gereken:** Cloud Function üzerinden yapmak:

#### 3.4.1 Yeni Cloud Function: `resetHwid`
**Dosya:** `firebase/functions/src/admin-init.js`
```javascript
exports.resetHwid = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { studioId } = request.data;
    if (!studioId) throw new HttpsError('invalid-argument', 'studioId required');

    // Creator panelinden çağrıldığı için organizationId de request.data'dan gelmeli
    const { organizationId } = request.data;
    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId required');

    const studioRef = db.collection('organizations').doc(organizationId).collection('studios').doc(studioId);
    const studioDoc = await studioRef.get();
    if (!studioDoc.exists) throw new HttpsError('not-found', 'Studio not found');

    await studioRef.update({
        'license.hwid_lock': null,
        'license.mac_address': null,
        'license.registered_at': null,
        'license.hwid_registered': false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Audit log yaz
    await studioRef.collection('auditLogs').add({
        action: 'hwid_reset',
        performedBy: request.auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
});
```

#### 3.4.2 Yeni Cloud Function: `regenerateLicenseKey`
**Dosya:** `firebase/functions/src/admin-init.js`
```javascript
exports.regenerateLicenseKey = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    if (request.auth.token?.role !== 'creator')
        throw new HttpsError('permission-denied', 'Only Creator');

    const { organizationId, studioId } = request.data;
    if (!organizationId || !studioId) throw new HttpsError('invalid-argument', 'organizationId and studioId required');

    const newKey = DatabaseHandler.generateLicenseKey();

    await db.collection('organizations').doc(organizationId)
        .collection('studios').doc(studioId).update({
        'license.license_key': newKey,
        'license.hwid_lock': null,         // Yeni anahtar = yeni HWID gerekir
        'license.hwid_registered': false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, newLicenseKey: newKey };
});
```

### 3.5 Lisans Süre Yönetimi

#### 3.5.1 Stüdyo oluştururken süre belirleme
**Dosya:** `firebase/functions/src/admin-init.js` - `createStudio` fonksiyonu
`license` objesine `expires_at` eklenmeli. Creator panelinden oluşturulurken opsiyonel olarak süre seçilebilmeli:
- **Süresiz (null)** - varsayılan
- **1 Yıllık** - `new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)`
- **6 Aylık**
- **Özel tarih**

#### 3.5.2 Otomatik süre kontrolü (Scheduled Function)
**Yeni dosya:** `firebase/functions/src/scheduler.js`
```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.checkExpiredLicenses = onSchedule('every 24 hours', async (event) => {
    const db = admin.firestore();
    const now = new Date();

    // Tüm organizasyonlardaki stüdyoları tara
    const orgsSnap = await db.collection('organizations').get();
    let expiredCount = 0;

    for (const orgDoc of orgsSnap.docs) {
        const studiosSnap = await orgDoc.ref.collection('studios')
            .where('license.expires_at', '<=', now)
            .where('info.subscription_status', '==', 'active')
            .get();

        const batch = db.batch();
        studiosSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                'info.subscription_status': 'expired',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        if (!studiosSnap.empty) {
            await batch.commit();
            expiredCount += studiosSnap.size;
        }
    }

    console.log(`${expiredCount} stüdyo süresi doldu olarak işaretlendi.`);
});
```

**`index.js`'e eklenmeli:**
```javascript
exports.scheduler = require('./scheduler');
```

---

## 4. Super Admin (Creator) Paneli

### 4.1 Mevcut Yetenekler

**Dashboard (`creator_control_panel/src/pages/Dashboard.jsx`):**
- ✅ Toplam aktif/pasif stüdyo sayısı
- ✅ Toplam müşteri sayısı
- ✅ Aylık gelir toplamı
- ✅ WhatsApp aktif stüdyo sayısı
- ✅ Stüdyo gelir grafiği (bar chart)
- ✅ Stüdyo performans tablosu

**Stüdyolar (`creator_control_panel/src/pages/Studios.jsx`):**
- ✅ Stüdyo listesi + arama
- ✅ Yeni stüdyo oluşturma (Cloud Function ile)
- ✅ Stüdyo düzenleme (isim, sahip, iletişim)
- ✅ Stüdyo silme (Cloud Function ile cascade)
- ✅ Durum değiştirme (aktif/askıda toggle)
- ✅ HWID bilgilerini görüntüleme (modal)
- ✅ HWID sıfırlama (doğrudan Firestore → Cloud Function'a taşınmalı)
- ✅ Çekim seçenekleri yönetimi (shootTypes, locations, photographers)
- ✅ WooCommerce entegrasyon ayarları
- ✅ WhatsApp durum görüntüleme

### 4.2 Yeni: Organizasyon Yönetimi

**Creator Panel navigasyonu organizasyon-öncelikli olacak:**

```
Giriş → Organizasyon Listesi → Şube Listesi → Şube Detay
         ┌──────────────┐     ┌────────────┐
         │ 🟢 Zümrüt    │ ──→ │ ● İzmit    │ ──→ Dashboard
         │ 🔵 Yakut     │     │ ○ Sakarya  │
         │ 🟣 Elmas     │     │ ○ Bursa    │
         └──────────────┘     └────────────┘
```

**Yeni sayfalar/bileşenler:**
- `Organizations.jsx` — Organizasyon CRUD (oluştur, düzenle, sil)
- Dashboard'da organizasyon bazında gruplandırılmış istatistikler
- Stüdyo oluştururken organizasyon seçimi zorunlu
- `createOrganization` / `deleteOrganization` Cloud Functions

### 4.3 Eksik Yetenekler ve Implementasyon Planları

#### 4.2.1 Lisans Anahtarı Yönetimi
**Mevcut:** Stüdyo oluştururken otomatik üretiliyor ama sonradan değiştirilemiyor.
**Eklenecek:**
- HWID modalına "Lisans Anahtarını Yenile" butonu
- `regenerateLicenseKey` Cloud Function çağrısı
- Yeni anahtarı gösterme (kopyalama butonu ile)

**Dosya:** `creator_control_panel/src/pages/Studios.jsx` - HWID Modal bölümü (satır 752-808)
Mevcut modalın footer'ına eklenmeli:
```jsx
<button className="btn btn-warning" onClick={() => handleRegenerateLicense(showHwidModal)}>
    <Key size={16} />
    Lisans Yenile
</button>
```

**creatorApi.js'e eklenmeli:**
```javascript
resetHwid: async (studioId) => {
    const func = httpsCallable(functions, 'setup-resetHwid');
    return (await func({ studioId })).data;
},
regenerateLicenseKey: async (studioId) => {
    const func = httpsCallable(functions, 'setup-regenerateLicenseKey');
    return (await func({ studioId })).data;
}
```

#### 4.2.2 Subscription Yönetimi (Askıya Alma/Aktifleştirme)
**Mevcut:** `handleToggleStatus()` (Studios.jsx:242-253) sadece Firestore'da `subscription_status` güncelliyor.
**Sorun:** Askıya alınan stüdyo hâlâ giriş yapıp veri okuyabiliyor. Cloud Function'larda subscription kontrolü yok.

**Yapılacak:**
1. `DatabaseHandler.fromRequest()` içine subscription kontrolü ekle
2. Cloud Function: `suspendStudio` / `activateStudio`
3. Creator panelinde neden girme alanı

**Dosya:** `firebase/functions/src/handlers/DatabaseHandler.js`
`fromRequest()` metoduna (satır 119-132) eklenmeli:
```javascript
static async fromRequest(request) {
    if (!request.auth) {
        throw new Error('Authentication required.');
    }

    const studioId = request.auth.token?.studioId;
    if (!studioId) {
        throw new Error('studioId claim not found.');
    }

    const handler = new DatabaseHandler(studioId);

    // Subscription durumu kontrolü
    const studioDoc = await handler.studioDoc().get();
    if (studioDoc.exists) {
        const status = studioDoc.data()?.info?.subscription_status;
        if (status === 'suspended') {
            throw new Error('Studio is suspended. Contact your administrator.');
        }
        if (status === 'expired') {
            throw new Error('Studio license has expired.');
        }
    }

    return handler;
}
```

> **NOT:** Bu metod her Cloud Function çağrısında çalışacağı için performans etkisi olacaktır. Bunu önlemek için sonucu bir cache mekanizmasına alabilir veya sadece kritik yazma işlemlerinde kontrol edebilirsiniz. Alternatif olarak, Firestore Rules'daki `isStudioMember()` fonksiyonuna subscription kontrolü eklenebilir.

#### 4.2.3 Paket Deployment Builder
**Spec'teki tanım:** Bir stüdyo oluşturulduğunda, sisteme özel bir `config.json` ve `license.key` içeren dağıtılabilir bir klasör hazırlama butonu.

**Mevcut Durum:** `triggerBuild` fonksiyonu sadece simülasyon döndürüyor (admin-init.js:300-315).

**İmplementasyon Planı:**

Bu özellik Electron uygulamasının client tarafında çalışacak bir build script'idir. Creator panelinde tetiklenmeli ve şunları yapmalı:

1. **Build script** (`creator_control_panel/scripts/build-studio.js`):
   - Stüdyo için özel `config.json` oluştur:
     ```json
     {
       "studioId": "xxx",
       "studioName": "Studio Name",
       "licenseKey": "XXXX-XXXX-XXXX-XXXX",
       "firebaseConfig": { ... },
       "version": "1.0.0"
     }
     ```
   - Electron uygulamasını `npm run build && npm run dist` ile paketle
   - `config.json`'ı paket içine yerleştir
   - Çıktı klasörünü zip'le

2. **Creator Panel butonu** (`Studios.jsx`):
   - "Paket Oluştur" butonu her stüdyo kartına eklenmeli
   - Tıklandığında `triggerBuild` Cloud Function çağırılır
   - Build server-side değil, Creator'ın kendi bilgisayarında çalışır

3. **Alternatif basit yaklaşım (önerilen):**
   - Creator panelinden sadece `config.json` dosyasını indirilebilir yap
   - Electron build'i manuel yapılır
   - Config dosyası `client/` klasörüne kopyalanır ve build alınır

**Dosya:** Creator paneline yeni buton ve download fonksiyonu eklenmeli:
```javascript
// Studios.jsx'e eklenecek:
async function handleDownloadConfig(studio) {
    const config = {
        studioId: studio.id,
        studioName: studio.info?.name,
        licenseKey: studio.license?.license_key,
        firebaseConfig: { /* ... production firebase config */ },
        createdAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${studio.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
```

#### 4.2.4 Audit Log Görüntüleyici
**Mevcut:** `auditLogs` subcollection'a yazılıyor ama okunmuyor.
**Eklenecek:**

1. **Cloud Function:** `getAuditLogs(studioId, limit, offset)`
2. **Creator Panel sayfası:** `AuditLogs.jsx`
   - Stüdyo seçici dropdown
   - Tarih filtresi
   - Aksiyon tipi filtresi
   - Sayfalama
   - Detay modal

**Yeni dosya:** `creator_control_panel/src/pages/AuditLogs.jsx`
**Cloud Function:** `firebase/functions/src/admin-init.js`'e `getAuditLogs` eklenmeli.

#### 4.2.5 Migration UI Backend Bağlantısı
**Mevcut:** `creator_control_panel/src/pages/Migration.jsx` var ama backend'e bağlı değil.
**Yapılacak:**
1. Migration.jsx'i `migration.js` Cloud Function'larına bağla
2. Dry-run sonuçlarını göster
3. İlerleme durumu takibi (Firestore listener ile)
4. Sonuç raporu gösterimi

---

## 5. Uygulama İçi Değişiklikler (Client App)

### 5.1 Mevcut Durum Analizi

#### 5.1.1 API Katmanı
**Dosya:** `client/src/services/api.js`
**Durum:** ✅ Tüm API çağrıları Cloud Functions üzerinden yapılıyor. `callFunction()` helper'ı kullanılıyor. studioId client'tan gönderilmiyor, auth token'dan alınıyor.

#### 5.1.2 Auth Store
**Dosya:** `client/src/store/authStore.js`
**Durum:** ✅ Zustand store, login/logout/user state yönetimi mevcut.

#### 5.1.3 Firebase Init
**Dosya:** `client/src/lib/firebase.js`
**Durum:** ✅ Firebase SDK doğru init ediliyor.

### 5.2 Yapılması Gereken Client Değişiklikleri

#### 5.2.1 Setup.jsx - HWID Kayıt Akışı
**Dosya:** `client/src/pages/Setup.jsx`
**Detay:** Bkz. Bölüm 3.2.2

#### 5.2.2 Login.jsx - HWID + Subscription Doğrulama
**Dosya:** `client/src/pages/Login.jsx`
**Detay:** Bkz. Bölüm 3.3.1 ve 3.3.2

#### 5.2.3 App.jsx - Global Subscription Guard
**Dosya:** `client/src/App.jsx`
Uygulama seviyesinde bir guard eklenerek, her route değişiminde subscription durumunun kontrol edilmesi sağlanmalı. Bu, login sonrasında da subscription askıya alınırsa kullanıcıyı çıkaracaktır.

```jsx
// App.jsx'te route wrapper:
function SubscriptionGuard({ children }) {
    const user = useAuthStore(s => s.user);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Her 5 dakikada bir subscription kontrolü
        const interval = setInterval(async () => {
            try {
                const check = httpsCallable(functions, 'auth-checkSubscription');
                const result = await check();
                if (result.data.status !== 'active') {
                    setBlocked(true);
                }
            } catch (e) { /* ignore */ }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    if (blocked) {
        return <SubscriptionBlockedScreen />;
    }

    return children;
}
```

#### 5.2.4 Preload.js API Genişletmesi
**Dosya:** `client/electron/preload.js`
HWID fonksiyonlarının renderer process'e expose edildiğinden emin olunmalı:
```javascript
contextBridge.exposeInMainWorld('electron', {
    // ...mevcut API'ler...
    getHwid: () => ipcRenderer.invoke('security:getHwid'),
    validateLicense: (hwid) => ipcRenderer.invoke('security:validateLicense', hwid),
    getLicenseConfig: () => ipcRenderer.invoke('security:getLicenseConfig'),
    saveLicenseConfig: (config) => ipcRenderer.invoke('security:saveLicenseConfig', config),
    clearLicenseConfig: () => ipcRenderer.invoke('security:clearLicenseConfig'),
});
```
Bu zaten `preload.js`'de mevcut olmalı, kontrol edilmeli.

---

## 6. Cloud Functions Tam Haritası

### 6.1 Mevcut Modüller ve Multi-Tenant Durumu

| Modül | Export Adı | Fonksiyonlar | DatabaseHandler | Multi-Tenant |
|-------|-----------|-------------|-----------------|-------------|
| `admin-init.js` | `setup` | initSuperAdmin, createStudio, deleteStudio, triggerBuild, validateSerialKey, enable2FA, verifyTotp, getStudiosWithStats, getWhatsappStatus, updateStudio, updateIntegration | Manuel/Global | ✅ Creator-only |
| `auth.js` | `auth` | getProfile, login | ⚠️ Kısmi | ⚠️ Fallback var |
| `archives.js` | `archives` | list, create, update, delete, updateStatus, deleteMultiple, transferFromAppointment, getArchiveFolderPath | ✅ fromRequest | ✅ Tam |
| `appointments.js` | `appointments` | create, get, update, list, delete | ✅ fromRequest | ✅ Tam |
| `customers.js` | `customers` | list, create, update, delete, search | ✅ fromRequest | ✅ Tam |
| `shoots.js` | `shoots` | list, create, update, delete | ✅ fromRequest | ✅ Tam |
| `finance.js` | `finance` | getFinance, addPayment, addExpense, updatePayment, deletePayment | ✅ fromRequest | ✅ Tam |
| `options.js` | `options` | saveShootType, deleteShootType, saveLocation, deleteLocation, savePhotographer, deletePhotographer | ✅ fromRequest | ✅ Tam |
| `settings.js` | `settings` | getAllSettings, updateSettings | ✅ fromRequest | ✅ Tam |
| `users.js` | `users` | list, create, update, delete, getLeaves, addLeave, deleteLeave | ✅ fromRequest | ✅ Tam |
| `dashboard.js` | `dashboard` | getStats | ✅ fromRequest | ✅ Tam |
| `packages.js` | `packages` | list, create, update, delete | ✅ fromRequest | ✅ Tam |
| `woocommerce.js` | `woocommerce` | sync, getProducts, importOrders | ✅ fromRequest | ✅ Tam |
| `payments-online.js` | `paymentsOnline` | createPaymentIntent, verifyPayment | ✅ fromRequest | ✅ Tam |
| `migration.js` | `migration` | migrateRootDataToStudios | Manuel | ✅ Özel |
| `legacy-migration.js` | `legacyMigration` | importLegacyData | Manuel | ✅ Özel |
| `handlers/auditLogger.js` | `audit` | logAction | ✅ fromRequest | ✅ Tam |
| `schools.js` | `schools` | list, create, update, delete | ✅ fromRequest | ✅ Tam |
| `priceLists.js` | `priceLists` | list, create, update, delete | ✅ fromRequest | ✅ Tam |
| `reports.js` | `reports` | getMonthlyReport, getYearlyReport | ✅ fromRequest | ✅ Tam |

### 6.2 Eklenmesi Gereken Cloud Functions

| Fonksiyon | Modül | Açıklama | Öncelik |
|-----------|-------|----------|---------|
| `registerHwid` | admin-init.js | İlk çalıştırma HWID kaydı | KRİTİK |
| `checkSubscription` | auth.js | Subscription durum kontrolü | YÜKSEK |
| `resetHwid` | admin-init.js | Creator'dan HWID sıfırlama | YÜKSEK |
| `regenerateLicenseKey` | admin-init.js | Lisans anahtarı yenileme | YÜKSEK |
| `suspendStudio` | admin-init.js | Stüdyo askıya alma (neden ile) | ORTA |
| `activateStudio` | admin-init.js | Stüdyo aktifleştirme | ORTA |
| `getAuditLogs` | admin-init.js | Audit log okuma (creator only) | ORTA |
| `checkExpiredLicenses` | scheduler.js | Scheduled: Süresi dolan lisansları expire yap | ORTA |
| `renewLicense` | admin-init.js | Lisans süresini uzatma | DÜŞÜK |

---

## 7. Firestore Güvenlik Kuralları

### 7.1 Hedef Kurallar Özeti (Organizations Katmanlı)

**Dosya:** `firebase/firestore.rules`

| Yol | Read | Write | Detay |
|-----|------|-------|-------|
| `/users/{uid}` | Owner, Creator, StudioAdmin | Admin (create), Creator/StudioAdmin (update/delete) | ✅ |
| `/organizations/{orgId}` | OrgMember, Creator | Creator (create/delete), OrgAdmin/Creator (update) | 🆕 |
| `/organizations/{orgId}/studios/{id}` | Member, OrgAdmin, Creator | Creator (create/delete), StudioAdmin/OrgAdmin/Creator (update) | 🆕 |
| `/organizations/{orgId}/studios/{id}/archives/**` | Member, OrgAdmin | Member | 🆕 |
| `/organizations/{orgId}/studios/{id}/appointments/**` | Member, OrgAdmin | Member | 🆕 |
| `/organizations/{orgId}/studios/{id}/customers/**` | Member, OrgAdmin | Member | 🆕 |
| `/organizations/{orgId}/studios/{id}/shoots/**` | Member, OrgAdmin | Member | 🆕 |
| `/organizations/{orgId}/studios/{id}/shootTypes/**` | Member, OrgAdmin | Admin only | 🆕 |
| `/organizations/{orgId}/studios/{id}/integrations/**` | Admin, OrgAdmin, Creator | Admin, OrgAdmin, Creator | 🆕 |
| `/organizations/{orgId}/studios/{id}/settings/**` | Member, OrgAdmin | Admin only (no delete) | 🆕 |
| `/organizations/{orgId}/studios/{id}/activityLogs/**` | Member, OrgAdmin, Creator | Member (create only), Immutable | 🆕 |
| `/organizations/{orgId}/studios/{id}/auditLogs/**` | Member, OrgAdmin, Creator | Member (create only), Immutable | 🆕 |
| `/organizations/{orgId}/studios/{id}/system_users/**` | None | None (CF only) | 🆕 |
| `/organizations/{orgId}/studios/{id}/counters/**` | None | None (CF only) | 🆕 |
| `/studios/{id}/**` (legacy) | Disabled | Disabled | ✅ Kapatılacak |
| `/_rateLimits/**` | None | None (CF only) | ✅ |

> **NOT:** `org_admin` rolü, organizasyondaki tüm şubelerin verisini okuyabilir. Yazma yetkisi admin-only alanlar için yine şube admin'ine aittir.

### 7.2 Önerilen Kural Değişiklikleri

#### 7.2.1 Organizations katmanı için Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Organizasyon belgesi
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId) || isCreator();
      allow create, delete: if isCreator();
      allow update: if isOrgAdmin(orgId) || isCreator();

      // Stüdyo ve alt koleksiyonları
      match /studios/{studioId}/{document=**} {
        allow read: if isStudioMember(studioId)
                     || isOrgAdmin(orgId)
                     || isCreator();
        allow write: if isStudioAdmin(studioId)
                      || isOrgAdmin(orgId)
                      || isCreator();
      }
    }

    // Helper fonksiyonlar
    function isCreator() {
      return request.auth.token.role == 'creator'
          && request.auth.token.super_admin == true;
    }
    function isOrgMember(orgId) {
      return request.auth.token.organizationId == orgId;
    }
    function isOrgAdmin(orgId) {
      return request.auth.token.organizationId == orgId
          && request.auth.token.role == 'org_admin';
    }
    function isStudioMember(studioId) {
      return request.auth.token.studioId == studioId;
    }
    function isStudioAdmin(studioId) {
      return request.auth.token.studioId == studioId
          && request.auth.token.role == 'admin';
    }
  }
}
```

#### 7.2.2 Subscription durumu kontrolü eklenmesi
Mevcut `isStudioMember()` fonksiyonuna subscription kontrolü eklenebilir:
```javascript
function isActiveStudioMember(orgId, studioId) {
    return isStudioMember(studioId) &&
        get(/databases/$(database)/documents/organizations/$(orgId)/studios/$(studioId)).data.info.subscription_status == 'active';
}
```

> **DİKKAT:** Bu, her okuma/yazma işleminde ek bir Firestore read yapacaktır. Performans etkisini değerlendirmek gerekir. Alternatif olarak sadece write işlemlerinde kontrol yapılabilir.

#### 7.2.2 Finance subcollection kuralları
Henüz rules'da `finance` için özel kural yok. Catch-all ile kapsanıyor ama açık olarak tanımlanmalı:
```javascript
match /finance/{docId} {
    allow read: if isStudioMember(studioId);
    allow create, update: if isStudioMember(studioId);
    allow delete: if isStudioAdmin(studioId);
}
```

---

## 8. Migration Stratejisi

### 8.1 Mevcut Migration Araçları

| Araç | Dosya | Durum |
|------|-------|-------|
| Multi-tenant migration script | `firebase/functions/migrate-to-multitenant.js` | ✅ Hazır |
| Legacy migration functions | `firebase/functions/src/legacy-migration.js` | ✅ Hazır |
| Root data migration CF | `firebase/functions/src/migration.js` | ✅ Hazır |
| Migration UI | `creator_control_panel/src/pages/Migration.jsx` | ⚠️ Backend bağlantısız |
| collectionWithFallback | `handlers/DatabaseHandler.js:49-59` | ⚠️ Geçici - kaldırılacak |

### 8.2 Migration Süreç Planı

```
AŞAMA 1: Hazırlık
├── [ ] Environment variables ayarla (.env)
├── [ ] Service account key indir
├── [ ] Backup al (Firestore + Storage)
└── [ ] Downtime planla

AŞAMA 2: Dry-Run Test
├── [ ] migrate-to-multitenant.js --studioId=XXX (dry-run)
├── [ ] Doküman sayılarını doğrula
└── [ ] Hata raporunu kontrol et

AŞAMA 3: Gerçek Migration
├── [ ] migrate-to-multitenant.js --studioId=XXX --execute
├── [ ] Her stüdyo için ayrı çalıştır
├── [ ] Doğrulama scriptini çalıştır
└── [ ] Studio-scoped veriler kontrol et

AŞAMA 4: Post-Migration
├── [ ] collectionWithFallback kullanımlarını kaldır
├── [ ] Legacy root collection verilerini 1 ay tut
├── [ ] Smoke test: Login, arşiv oluşturma, randevu ekleme
└── [ ] Production deploy
```

### 8.3 Migration UI İmplementasyonu

**Dosya:** `creator_control_panel/src/pages/Migration.jsx`
Bu sayfanın backend'e bağlanması için:

1. `creatorApi.js`'e migration fonksiyonları ekle:
```javascript
runMigrationDryRun: async (studioId) => {
    const func = httpsCallable(functions, 'migration-dryRun');
    return (await func({ studioId })).data;
},
executeMigration: async (studioId) => {
    const func = httpsCallable(functions, 'migration-execute');
    return (await func({ studioId })).data;
},
getMigrationStatus: async (studioId) => {
    const func = httpsCallable(functions, 'migration-getStatus');
    return (await func({ studioId })).data;
}
```

2. Migration.jsx UI'ı güncelle:
   - Stüdyo seçici dropdown
   - "Dry-Run" butonu → sonuçları tablo olarak göster
   - "Migrate" butonu → onay dialog'u ile
   - İlerleme çubuğu (Firestore real-time listener)
   - Sonuç raporu gösterimi

---

## 9. Deployment ve Build Süreci

### 9.1 Mevcut Deployment Akışı

```bash
# 1. Firebase Functions deploy
cd firebase/functions && npm install && firebase deploy --only functions

# 2. Firestore & Storage Rules deploy
firebase deploy --only firestore:rules,storage

# 3. Client App build (Electron)
cd client && npm run build && npm run dist

# 4. Creator Panel build
cd creator_control_panel && npm run build
```

### 9.2 Build Sonrası Config Enjeksiyonu

Her stüdyo için ayrı Electron paketi oluşturulurken:

1. `client/` klasörünü kopyala
2. `config.json` dosyasını oluştur ve kök dizine yerleştir
3. `npm run build && npm run dist` çalıştır
4. Çıktı: `dist/` klasöründeki `.exe` veya `.dmg` dosyası

**Config.json yapısı:**
```json
{
    "studioId": "generated-studio-id",
    "studioName": "Stüdyo Adı",
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "firebaseConfig": {
        "apiKey": "...",
        "authDomain": "...",
        "projectId": "...",
        "storageBucket": "...",
        "messagingSenderId": "...",
        "appId": "..."
    }
}
```

> **NOT:** Şu anki mimaride config.json kullanılmıyor, bunun yerine Setup sayfasından seri anahtarı girilerek stüdyo bağlanıyor. Bu daha güvenli bir yaklaşımdır çünkü config.json dosyası kopyalanabilir.

---

## 10. Performans ve Ölçeklenebilirlik

### 10.1 Bilinen Performans Sorunları

1. **`getStudiosWithStats` fonksiyonu** (`admin-init.js:481-550`):
   - Her stüdyo için tüm arşivleri çekiyor (`studioRef.collection('archives').get()`)
   - 1000+ arşivli stüdyolarda yavaşlama
   - **Çözüm:** Counter document kullanarak arşiv sayısını ve aylık geliri önceden hesapla

2. **`collectionWithFallback` metodu** (`DatabaseHandler.js:49-59`):
   - Her çağrıda fazladan bir `limit(1).get()` sorgusu yapıyor
   - **Çözüm:** Migration tamamlandıktan sonra kaldır

3. **Creator panelinde doğrudan Firestore sorguları** (`Studios.jsx:86-97`):
   - `getDocs(collection(db, 'studios'))` ile tüm stüdyolar çekiliyor
   - Cloud Function yerine doğrudan client'tan okuma
   - **Çözüm:** `getStudiosWithStats` Cloud Function'ını kullan

### 10.2 Önerilen İyileştirmeler

1. **Counter Document Pattern:**
   ```
   studios/{studioId}/counters/stats
     ├── archiveCount: number
     ├── customerCount: number
     ├── appointmentCount: number
     ├── monthlyRevenue: number
     └── lastUpdated: timestamp
   ```
   Her arşiv/müşteri/randevu oluşturma/silme işleminde counter güncellenir.

2. **Firestore Composite Index'ler:**
   `firestore.indexes.json` dosyasında gerekli index'ler tanımlı olmalı:
   ```json
   {
       "collectionGroup": "archives",
       "queryScope": "COLLECTION",
       "fields": [
           { "fieldPath": "createdAt", "order": "DESCENDING" },
           { "fieldPath": "status", "order": "ASCENDING" }
       ]
   }
   ```

---

## 11. Test Stratejisi

### 11.1 Test Edilmesi Gereken Akışlar

| # | Test Senaryosu | Bileşenler | Öncelik |
|---|---------------|-----------|---------|
| T1 | İlk kurulum: Seri anahtarı → HWID kaydı | Setup.jsx, registerHwid CF | KRİTİK |
| T2 | HWID uyumsuzluğu tespiti | Login.jsx, security:getHwid | KRİTİK |
| T3 | Askıya alınmış stüdyo giriş engeli | Login.jsx, checkSubscription CF | YÜKSEK |
| T4 | Süresi dolmuş lisans engeli | Login.jsx, checkExpiredLicenses | YÜKSEK |
| T5 | Creator'dan HWID sıfırlama | Studios.jsx, resetHwid CF | YÜKSEK |
| T6 | Creator'dan lisans anahtarı yenileme | Studios.jsx, regenerateLicenseKey CF | YÜKSEK |
| T7 | Stüdyo arası veri izolasyonu | DatabaseHandler, Firestore Rules | KRİTİK |
| T8 | **Organizasyonlar arası veri izolasyonu** | **Firestore Rules, org_admin** | **KRİTİK** |
| T9 | Subscription toggle (aktif↔askıda) | Studios.jsx, suspendStudio CF | ORTA |
| T10 | Migration dry-run + execute (**studios → organizations/**) | Migration.jsx, migration CF | ORTA |
| T11 | Config.json download | Studios.jsx | DÜŞÜK |
| T12 | Audit log kayıt + görüntüleme | auditLogger, AuditLogs.jsx | DÜŞÜK |
| T13 | **Organizasyon CRUD (oluştur/düzenle/sil)** | **Organizations.jsx, Cloud Functions** | **YÜKSEK** |

### 11.2 Smoke Test Listesi (Her Deploy Sonrası)

- [ ] Login yapabilme (admin + user)
- [ ] Arşiv oluşturma / güncelleme / silme
- [ ] Randevu ekleme / güncelleme
- [ ] Müşteri ekleme / arama
- [ ] Dosya yükleme (Storage)
- [ ] Çekim seçenekleri yönetimi
- [ ] WhatsApp bağlantısı
- [ ] Dashboard istatistikleri
- [ ] Creator panelinden stüdyo listeleme

---

## 12. Görev Tablosu

> Her görev tamamlandığında `[ ]` yerine `[x]` işaretlenecektir.

### Faz 0: Organizations Altyapısı (Öncelik: KRİTİK)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 0.1 | `organizations` koleksiyonu oluşturma ve ilk belge (`zumrut`) | Firebase Console / Script | [ ] |
| 0.2 | `DatabaseHandler` constructor'ına `organizationId` parametresi eklenmesi | `firebase/functions/src/handlers/DatabaseHandler.js` | [ ] |
| 0.3 | `DatabaseHandler.fromRequest()`'e `organizationId` claim desteği | `firebase/functions/src/handlers/DatabaseHandler.js` | [ ] |
| 0.4 | `createOrganization` Cloud Function yazımı | `firebase/functions/src/admin-init.js` | [ ] |
| 0.5 | `createStudio`'yu organizations altına stüdyo oluşturacak şekilde güncelle | `firebase/functions/src/admin-init.js` | [ ] |
| 0.6 | Tüm kullanıcıların custom claims'ine `organizationId` eklenmesi | `firebase/functions/src/admin-init.js` | [ ] |
| 0.7 | Firestore Security Rules'u `organizations/` katmanı ile güncelleme | `firebase/firestore.rules` | [ ] |
| 0.8 | Mevcut `studios/` verisini `organizations/zumrut/studios/` altına migrasyon scripti | `firebase/functions/migrate-to-orgs.js` (yeni) | [ ] |
| 0.9 | Creator Panel'e `Organizations.jsx` sayfası eklenmesi | `creator_control_panel/src/pages/Organizations.jsx` (yeni) | [ ] |
| 0.10 | Creator Panel navigasyonunu organizasyon-öncelikli yapma | `creator_control_panel/src/App.jsx` | [ ] |

### Faz 1: Kritik Güvenlik & HWID (Öncelik: KRİTİK)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 1.1 | `registerHwid` Cloud Function yazımı | `firebase/functions/src/admin-init.js` | [ ] |
| 1.2 | Setup.jsx'e HWID alma ve kayıt akışı eklenmesi | `client/src/pages/Setup.jsx` | [ ] |
| 1.3 | Login.jsx'e HWID doğrulama eklenmesi | `client/src/pages/Login.jsx` | [ ] |
| 1.4 | `checkSubscription` Cloud Function yazımı | `firebase/functions/src/auth.js` | [ ] |
| 1.5 | Login.jsx'e subscription durum kontrolü eklenmesi | `client/src/pages/Login.jsx` | [ ] |
| 1.6 | Preload.js'de HWID API'lerinin expose edildiğinin doğrulanması | `client/electron/preload.js` | [ ] |
| 1.7 | License şemasına `expires_at`, `hwid_registered`, `last_validated_at` alanları eklenmesi | `firebase/functions/src/admin-init.js` | [ ] |

### Faz 2: Creator Panel Geliştirmeleri (Öncelik: YÜKSEK)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 2.1 | `resetHwid` Cloud Function yazımı | `firebase/functions/src/admin-init.js` | [ ] |
| 2.2 | `regenerateLicenseKey` Cloud Function yazımı | `firebase/functions/src/admin-init.js` | [ ] |
| 2.3 | Studios.jsx HWID Modal'ına Cloud Function çağrıları eklenmesi (doğrudan Firestore yerine) | `creator_control_panel/src/pages/Studios.jsx` | [ ] |
| 2.4 | Studios.jsx'e "Lisans Yenile" butonu eklenmesi | `creator_control_panel/src/pages/Studios.jsx` | [ ] |
| 2.5 | creatorApi.js'e `resetHwid` ve `regenerateLicenseKey` fonksiyonları eklenmesi | `creator_control_panel/src/services/creatorApi.js` | [ ] |
| 2.6 | `suspendStudio` / `activateStudio` Cloud Function'ları (neden parametreli) | `firebase/functions/src/admin-init.js` | [ ] |
| 2.7 | Studios.jsx'de suspend/activate için neden girme dialog'u | `creator_control_panel/src/pages/Studios.jsx` | [ ] |
| 2.8 | Config.json download butonu eklenmesi | `creator_control_panel/src/pages/Studios.jsx` | [ ] |

### Faz 3: Subscription Zorlaması (Öncelik: YÜKSEK)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 3.1 | DatabaseHandler.fromRequest()'e subscription kontrolü eklenmesi | `firebase/functions/src/handlers/DatabaseHandler.js` | [ ] |
| 3.2 | App.jsx'e SubscriptionGuard wrapper eklenmesi | `client/src/App.jsx` | [ ] |
| 3.3 | Scheduled function: `checkExpiredLicenses` yazımı | `firebase/functions/src/scheduler.js` (yeni) | [ ] |
| 3.4 | `index.js`'e scheduler modülünün eklenmesi | `firebase/functions/src/index.js` | [ ] |
| 3.5 | `subscription_history` subcollection yönetimi | `firebase/functions/src/admin-init.js` | [ ] |

### Faz 4: Migration & Cleanup (Öncelik: ORTA)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 4.1 | Migration.jsx'i backend Cloud Function'larına bağlama | `creator_control_panel/src/pages/Migration.jsx` | [ ] |
| 4.2 | creatorApi.js'e migration fonksiyonları eklenmesi | `creator_control_panel/src/services/creatorApi.js` | [ ] |
| 4.3 | Migration dry-run sonuç gösterimi UI | `creator_control_panel/src/pages/Migration.jsx` | [ ] |
| 4.4 | `collectionWithFallback` kullanımlarını tespit ve kaldırma | Tüm function dosyaları | [ ] |
| 4.5 | Legacy root collection verilerinin temizlenmesi (migration sonrası) | Firebase Console / Script | [ ] |

### Faz 5: Audit & Monitoring (Öncelik: ORTA)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 5.1 | `getAuditLogs` Cloud Function yazımı | `firebase/functions/src/admin-init.js` | [ ] |
| 5.2 | AuditLogs.jsx sayfası oluşturulması | `creator_control_panel/src/pages/AuditLogs.jsx` (yeni) | [ ] |
| 5.3 | Creator panel navigasyonuna Audit Logs linki eklenmesi | `creator_control_panel/src/App.jsx` | [ ] |
| 5.4 | Tüm Creator aksiyonlarına audit log yazımı eklenmesi | `firebase/functions/src/admin-init.js` | [ ] |

### Faz 6: Performans & İyileştirmeler (Öncelik: DÜŞÜK)

| # | Görev | Dosya(lar) | Durum |
|---|-------|-----------|-------|
| 6.1 | Counter Document Pattern implementasyonu (archive/customer/appointment sayaçları) | `firebase/functions/src/archives.js`, `customers.js`, `appointments.js` | [ ] |
| 6.2 | `getStudiosWithStats` fonksiyonunu counter'ları kullanacak şekilde optimize etme | `firebase/functions/src/admin-init.js` | [ ] |
| 6.3 | Studios.jsx'deki doğrudan Firestore sorgularını Cloud Function'a taşıma | `creator_control_panel/src/pages/Studios.jsx` | [ ] |
| 6.4 | Finance subcollection'ının aktif kullanıma geçirilmesi | `firebase/functions/src/finance.js` | [ ] |
| 6.5 | Firestore composite index'lerin gözden geçirilmesi | `firebase/firestore.indexes.json` | [ ] |

### Faz 7: Test & Doğrulama

| # | Görev | Durum |
|---|-------|-------|
| 7.1 | T1: İlk kurulum HWID kayıt akışı testi | [ ] |
| 7.2 | T2: HWID uyumsuzluğu tespiti testi | [ ] |
| 7.3 | T3: Askıya alınmış stüdyo giriş engeli testi | [ ] |
| 7.4 | T4: Süresi dolmuş lisans engeli testi | [ ] |
| 7.5 | T5: Creator HWID sıfırlama testi | [ ] |
| 7.6 | T6: Lisans anahtarı yenileme testi | [ ] |
| 7.7 | T7: Stüdyo arası veri izolasyonu testi | [ ] |
| 7.8 | T8: Subscription toggle testi | [ ] |
| 7.9 | T9: Migration dry-run + execute testi | [ ] |
| 7.10 | Full smoke test (tüm sayfalar ve fonksiyonlar) | [ ] |

---

## Özet İstatistikleri

| Metrik | Değer |
|--------|-------|
| Toplam görev sayısı | **52** |
| **Faz 0 (Organizations)** | **10 görev** |
| Faz 1 (Kritik) | 7 görev |
| Faz 2 (Creator Panel) | 8 görev |
| Faz 3 (Subscription) | 5 görev |
| Faz 4 (Migration) | 5 görev |
| Faz 5 (Audit) | 4 görev |
| Faz 6 (Performans) | 5 görev |
| Faz 7 (Test) | **13 görev** (doğrulama) |
| Yeni Cloud Function sayısı | **10** |
| Yeni dosya sayısı | **4** (scheduler.js, AuditLogs.jsx, Organizations.jsx, migrate-to-orgs.js) |
| Değişiklik gereken mevcut dosya sayısı | ~18 |
