# PROJE GÜNCELLEMESİ: Multi-Tenant SaaS Mimarisi ve Super Admin Paneli

## 1. Genel Bakış
Mevcut tekil stüdyo yönetimi uygulaması, birden fazla stüdyoya hizmet verecek merkezi bir SaaS yapısına dönüştürülecektir.
**Ana Hedef:** Her stüdyonun verisi izole edilecek, "Super Admin" (Creator) tüm stüdyoları tek panelden yönetebilecek, lisanslama donanım bazlı (HWID) kısıtlanacak ve eski veriler otomatik içeri aktarılabilecek.

## 2. Veritabanı Mimarisi (Firebase Firestore)
Veri yapısı, "Collection Group" sorgularına ve izolasyona uygun olarak `root` seviyesinde ayrıştırılmalıdır.

### Yeni Şema Yapısı:
* **`studios` (Collection)**
    * `{studio_id}` (Document) -> *Her stüdyo için benzersiz ID*
        * `info`: { name, owner, contact, subscription_status }
        * `license`: { hwid_lock: "CPU-DISK-ID", mac_address, license_key, is_active }
        * **`customers` (Sub-collection):** Stüdyoya özel müşteriler.
        * **`appointments` (Sub-collection):** Çekim randevuları.
        * **`finance` (Sub-collection):** Gelir/Gider takibi.
        * **`settings` (Sub-collection):** Stüdyoya özel çekim yerleri, fotoğrafçılar vb.
* **`super_admins` (Collection)**
    * Yalnızca benim (Creator) erişebileceğim, tüm sistemi yöneten kullanıcılar.

## 3. Super Admin (Creator) Paneli Özellikleri
Bu panel, ana uygulamadan ayrı bir arayüz veya "Admin Modu" olarak çalışmalı ve şu yeteneklere sahip olmalı:

1.  **Stüdyo Yönetimi (CRUD):**
    * Yeni stüdyo oluşturma (Create).
    * Stüdyo listeleme, durdurma (Suspend) ve silme.
    * Herhangi bir stüdyonun verisine "Tanrı Modu" (God Mode) ile erişip düzenleme yapabilme.
2.  **Deployment & Build (Paket Oluşturucu):**
    * Bir stüdyo oluşturulduğunda, sisteme özel bir `config.json` ve `license.key` içeren dağıtılabilir bir klasör hazırlama butonu.
    * Bu paket, stüdyoya verildiğinde yazılım sadece o stüdyonun verilerine erişecek şekilde yapılandırılmış olmalı.
3.  **Migration Bot (Veri Dönüştürücü):**
    * Eski veritabanı formatlarını (SQL, Excel, JSON) kabul eden bir import aracı.
    * Girdi: Eski veritabanı dosyası.
    * İşlem: Verileri yeni Firebase şemasına (Customers, Appointments vb.) uygun formata dönüştürür.
    * Çıktı: Seçilen `{studio_id}` altına verileri toplu olarak (Batch Write) yazar.

## 4. Güvenlik ve Lisanslama (HWID/MAC Lock)
Yazılımın kopyalanmasını engellemek için güvenlik katmanı:

1.  **İlk Çalıştırma (Registration):**
    * Yazılım ilk açıldığında `config.json` içindeki lisans anahtarı ile sunucuya bağlanır.
    * Çalıştığı bilgisayarın HWID (Anakart/CPU ID) ve MAC adresini çeker.
    * Firebase'deki `license` alanına bu bilgileri yazar ve kilitler.
2.  **Sonraki Girişler (Validation):**
    * Her açılışta yerel HWID ile Firebase'deki kayıtlı HWID karşılaştırılır.
    * Eşleşme yoksa: "Lisanssız kullanım veya farklı cihaz tespit edildi" hatası verip programı kapatır.
    * Super Admin panelinden "HWID Reset" yapılabilir (bilgisayar değişikliği durumunda).

## 5. Uygulama İçi Değişiklikler
* Tüm Firebase sorguları (read/write), global değişken olan `CURRENT_STUDIO_ID` parametresine göre yapılmalıdır.
* Eski kodlardaki direkt yol tanımları (örn: `db.collection('users')`) yerine `db.collection('studios').doc(studio_id).collection('users')` yapısına geçilmelidir.