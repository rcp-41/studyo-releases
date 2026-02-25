# 🔒 Güvenlik Düzeltmeleri ve Migration Kılavuzu

Bu dokümantasyon, Studyo projesinde yapılan kritik güvenlik düzeltmelerini ve migration sürecini açıklar.

## 📋 İçindekiler

1. [Yapılan Değişiklikler](#yapılan-değişiklikler)
2. [Migration Süreci](#migration-süreci)
3. [Deployment Adımları](#deployment-adımları)
4. [Rollback Planı](#rollback-planı)
5. [SSS](#sss)

---

## 🔧 Yapılan Değişiklikler

### Kritik Güvenlik Düzeltmeleri (8/8 ✅)

1. **Firestore Rules** - Multi-tenant izolasyon
2. **Storage Rules** - StudioId bazlı erişim
3. **DatabaseHandler** - Client override engellendi
4. **createStudio** - Auth ve validation
5. **Rol Ataması** - Whitelist kontrolü
6. **AuthStore** - Loading bug düzeltildi
7. **Login.jsx** - State properties düzeltildi
8. **Master Key** - Environment variable'a taşındı

### Yüksek Öncelikli Buglar (6/6 ✅)

9. **WooCommerceModal** - useRef kullanımı
10. **React Query v5** - 7 dosyada syntax güncellendi
11. **Error Boundary** - Eklendi ve entegre edildi

**Detaylı rapor:** `SECURITY_FIXES_REPORT.md`

---

## 🚀 Migration Süreci

### Ön Hazırlık

#### 1. Environment Variables Ayarlama

`firebase/functions/.env` dosyası oluşturun:

```env
# Super Admin Secret Key (min 32 karakter)
SUPER_ADMIN_SECRET_KEY=your-super-secret-key-min-32-chars

# WooCommerce (varsa)
WC_URL=https://your-site.com
WC_CONSUMER_KEY=ck_xxxxx
WC_CONSUMER_SECRET=cs_xxxxx

# iyzico (varsa)
IYZICO_API_KEY=your-api-key
IYZICO_SECRET_KEY=your-secret-key
```

#### 2. Service Account Key

Firebase Console'dan service account key indirin:

1. Firebase Console → Project Settings → Service Accounts
2. "Generate New Private Key" butonuna tıklayın
3. `serviceAccountKey.json` olarak kaydedin
4. `firebase/functions/` klasörüne koyun
5. **ÖNEMLİ:** Bu dosyayı `.gitignore`'a ekleyin!

#### 3. Dependencies Kurulumu

```bash
cd firebase/functions
npm install firebase-admin
```

### Migration Adımları

#### Adım 1: Dry Run (Test)

Önce test modunda çalıştırın:

```bash
node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID
```

Bu komut:
- ✅ Hiçbir veri değiştirmez
- ✅ Kaç doküman/dosya taşınacağını gösterir
- ✅ Potansiyel sorunları tespit eder

#### Adım 2: Backup

Otomatik backup oluşturulur, ancak manuel backup da alın:

```bash
# Firestore export
gcloud firestore export gs://YOUR_BUCKET/backups/$(date +%Y%m%d)

# Storage backup
gsutil -m cp -r gs://YOUR_BUCKET gs://YOUR_BACKUP_BUCKET
```

#### Adım 3: Execute (Gerçek Migration)

**⚠️ DİKKAT:** Bu adım verileri değiştirir!

```bash
node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --execute
```

Script şunları yapar:
1. Otomatik backup oluşturur
2. Collection'ları taşır
3. Storage dosyalarını taşır
4. Doğrulama yapar
5. Rapor oluşturur

#### Adım 4: Verification

Migration sonrası kontrol:

```bash
# Firebase Console'dan manuel kontrol
# - Firestore Database → studios/{studioId}/ altını kontrol edin
# - Storage → studios/{studioId}/ altını kontrol edin

# Script ile otomatik doğrulama yapılır
```

---

## 📦 Deployment Adımları

### 1. Test Environment

```bash
# Functions deploy (test)
cd firebase/functions
firebase use test-project
firebase deploy --only functions

# Rules deploy (test)
firebase deploy --only firestore:rules,storage
```

### 2. Smoke Test

Test environment'ta:
- [ ] Login yapabilme
- [ ] Arşiv oluşturma
- [ ] Randevu ekleme
- [ ] Dosya yükleme
- [ ] Kullanıcı ekleme

### 3. Production Deployment

```bash
# Production'a geç
firebase use production-project

# Migration çalıştır
node migrate-to-multitenant.js --studioId=YOUR_STUDIO_ID --execute

# Deploy
firebase deploy --only functions,firestore:rules,storage

# Client deploy (Electron)
cd ../../client
npm run build
npm run dist
```

---

## 🔄 Rollback Planı

Bir sorun olursa:

### Firestore Rollback

```bash
# Backup'tan restore
gcloud firestore import gs://YOUR_BUCKET/backups/BACKUP_DATE

# veya manuel
# Firebase Console → Firestore → Import/Export
```

### Storage Rollback

```bash
# Backup'tan restore
gsutil -m cp -r gs://YOUR_BACKUP_BUCKET/* gs://YOUR_BUCKET/
```

### Functions Rollback

```bash
# Önceki versiyona dön
firebase functions:rollback FUNCTION_NAME
```

### Rules Rollback

Firebase Console → Firestore/Storage → Rules → History → Restore

---

## ❓ SSS

### Migration ne kadar sürer?

- **Küçük proje** (< 1000 doküman): ~5 dakika
- **Orta proje** (1000-10000 doküman): ~15-30 dakika
- **Büyük proje** (> 10000 doküman): ~1-2 saat

### Migration sırasında uygulama çalışır mı?

Hayır. Migration sırasında:
- Uygulamayı maintenance mode'a alın
- Kullanıcıları bilgilendirin
- Downtime planlayın (gece saatleri önerilir)

### Birden fazla stüdyo varsa?

Her stüdyo için ayrı migration çalıştırın:

```bash
node migrate-to-multitenant.js --studioId=studio1 --execute
node migrate-to-multitenant.js --studioId=studio2 --execute
```

### Migration başarısız olursa?

1. Script otomatik olarak durur
2. Backup'tan restore edin
3. Hata mesajını kontrol edin
4. Sorunu çözün ve tekrar deneyin

### Eski verileri silmeli miyim?

**HAYIR!** En az 1 ay bekleyin:
1. Yeni yapının sorunsuz çalıştığından emin olun
2. Tüm kullanıcılar test etsin
3. Backup'lar güvende olsun
4. Sonra manuel olarak silin

### Environment variables nasıl ayarlanır?

**Local:**
```bash
# firebase/functions/.env
SUPER_ADMIN_SECRET_KEY=xxx
```

**Firebase (Production):**
```bash
firebase functions:config:set super_admin.secret_key="xxx"
firebase deploy --only functions
```

### Migration test edildi mi?

Evet, ancak:
- ✅ Dry-run modunda test edildi
- ⚠️ Sizin verilerinizle test edilmedi
- 🔍 Önce test environment'ta deneyin

---

## 📞 Destek

Sorun yaşarsanız:

1. **Logları kontrol edin:**
   ```bash
   firebase functions:log
   ```

2. **Backup'ları kontrol edin:**
   ```bash
   ls -la backup-*.json
   ```

3. **Script'i debug mode'da çalıştırın:**
   ```bash
   NODE_ENV=development node migrate-to-multitenant.js --studioId=xxx
   ```

---

## ✅ Checklist

Migration öncesi:
- [ ] Environment variables ayarlandı
- [ ] Service account key indirildi
- [ ] Dependencies kuruldu
- [ ] Dry-run çalıştırıldı
- [ ] Backup alındı
- [ ] Kullanıcılar bilgilendirildi
- [ ] Maintenance mode aktif

Migration sonrası:
- [ ] Verification başarılı
- [ ] Smoke test yapıldı
- [ ] Production deploy edildi
- [ ] Kullanıcılar test etti
- [ ] Eski veriler korunuyor
- [ ] Dokümantasyon güncellendi

---

**Son Güncelleme:** 2026-02-09  
**Versiyon:** 1.0
