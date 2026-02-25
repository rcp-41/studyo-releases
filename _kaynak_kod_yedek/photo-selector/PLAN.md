# 📸 Stüdyo Fotoğraf Seçim Eklentisi — Kapsamlı Yol Haritası

Bu belge, mevcut Stüdyo Yönetim Sistemi'ne entegre edilecek **Fotoğraf Seçim Eklentisi**'nin (Photo Selector) kapsamlı implementasyon planını içerir. Eklenti, Picasa benzeri bir fotoğraf görüntüleme, favori seçimi, eleme, numaralandırma ve fiyatlandırma deneyimi sunacaktır.

---

## Genel Mimari

```
┌─────────────────────────────────────────────┐
│       Ana Stüdyo Programı (Main Window)     │
│                                             │
│  Archives.jsx ──► "Fotoğraf Seçim Aç" ──────┼───► IPC: open-photo-selector
│  Archives.jsx ──► Arşiv kaydı oluştur ──────┼───► Firebase Cloud Functions
│                   archiveId + folderPath ◄───┼────                         
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│   Fotoğraf Seçim Eklentisi (Ayrı Window)    │
│                                             │
│  ├── Grid View (Toplu görünüm)              │
│  ├── Single View + Zoom                     │
│  ├── A/B Compare View (Senkronize)          │
│  ├── Favori Yönetimi + Undo/Redo            │
│  ├── Numaralandırma & İşaretleme            │
│  └── Fiyat Hesaplama                        │
│                                             │
│  ──► .ini metadata (lokal dosya sistemi)    │
│  ──► .thumbnails/ cache                     │
│  ──► Seçim sonuçları → Firebase             │
└─────────────────────────────────────────────┘
```

> **ÖNEMLİ:** Eklenti **ayrı bir Electron penceresi** olarak açılacak ve arşiv kaydı olmadan da bağımsız kullanılabilecektir. Arşiv bağlantısı varsa sonuçlar otomatik kaydedilir.

---

## Fazlar ve Detaylı Plan

### 🔷 Faz 1: Altyapı ve Veri Modeli Güncellemeleri

#### Backend Değişiklikleri

**archives.js (MODIFY)**
- `ALLOWED_ARCHIVE_FIELDS` listesine yeni alanlar:
  - `schoolId` — Okul referansı
  - `className` — Sınıf (ör: "12")
  - `section` — Şube (ör: "B")
  - `photoSelectionData` — Fotoğraf seçim sonuçları (JSON objesi)
  - `autoDescription` — Otomatik oluşturulan açıklama (ör: "12Bio + 6Vs")
  - `autoPrice` — Otomatik hesaplanan fiyat

**options.js (MODIFY)**
- Her çekim türüne `category` alanı eklenmesi:
  - Kategoriler: `vesikalik_biyometrik`, `aile_ajans`, `yillik`, `etkinlik`
- Yeni CRUD: **Okullar** koleksiyonu (`schools`)
  - Her okul: `{ name, classes: ["9A","9B","10A",...] }`
- Yeni CRUD: **Fiyat Listesi** koleksiyonu (`priceLists`)

**priceList.js (YENİ)**
- Fiyat listesi CRUD Cloud Functions:
  - `getAll()` — Tüm fiyat listesini getir
  - `update(data)` — Fiyat listesini güncelle
- Varsayılan fiyat yapısı:

```json
{
  "vesikalik_biyometrik": {
    "adet": { "4": 500, "6": 600, "8": 700, "12": 800 }
  },
  "standart_olculer": {
    "10x15": 500, "13x18": 600, "15x21": 700,
    "18x24": 800, "20x30": 1100, "30x40": 1400
  },
  "cogaltma_carpan": 0.5,
  "yillik": {
    "poz_fiyat": 450,
    "standart_olcu": "15x21",
    "hediye_ucretsiz": true,
    "cogaltma_carpan": 0.5
  },
  "cerceve": { "varsayilan": 500 },
  "fotoblok": { "varsayilan": 400 },
  "kanvas_tablo": { "varsayilan": 600 }
}
```

---

#### Frontend — Ana Program Değişiklikleri

**Archives.jsx (MODIFY)**
- `ArchiveModal` formuna koşullu okul/sınıf/şube alanları:
  - Çekim yeri olarak bir okul seçildiğinde sınıf ve şube dropdown'ları görünür
  - Aksi takdirde bu alanlar gizli kalır (UI temiz kalır)
- Arşiv listesi tablosuna "Fotoğraf Seçim" butonu
- `description1` → otomatik açıklama (fotoğraf seçimi tamamlandığında)
- `totalAmount` → otomatik fiyat (manuel değişiklik yapılabilir)

**Settings.jsx (MODIFY)**
- Seçenekler sekmesine:
  - **Okullar** yönetimi (okul adı + sınıf/şube listesi)
  - Çekim türlerine **kategori atama** dropdown
- Yeni **Fiyat Listesi** sekmesi

**api.js (MODIFY)**
- `schoolsApi` — Okullar CRUD
- `priceListApi` — Fiyat listesi get/update

---

#### Electron IPC Katmanı

**main.js (MODIFY)** — Yeni IPC handler'lar:
- `photo-selector:open` — Ayrı BrowserWindow açma
- `photo-selector:result` — Seçim sonucunu ana pencereye gönderme
- `photos:generateThumbnails` — Sharp ile thumbnail oluşturma
- `photos:readExif` — EXIF metadata okuma
- `photos:renameFile` — Dosya yeniden adlandırma
- `photos:createIniFile` — `.ini` metadata dosyası oluşturma/güncelleme
- `photos:readIniFile` — `.ini` dosyasını okuma
- `photos:createNotesFile` — `[ArşivNo] not.txt` oluşturma

**preload.js (MODIFY)** — Yeni namespace:
```js
photoSelector: {
  open: (config) => ipcRenderer.invoke('photo-selector:open', config),
  onResult: (callback) => ipcRenderer.on('photo-selector:result', callback),
  generateThumbnails: (folderPath) => ipcRenderer.invoke('photos:generateThumbnails', folderPath),
  readExif: (filePath) => ipcRenderer.invoke('photos:readExif', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('photos:renameFile', oldPath, newPath),
  readIni: (folderPath) => ipcRenderer.invoke('photos:readIniFile', folderPath),
  writeIni: (folderPath, data) => ipcRenderer.invoke('photos:createIniFile', folderPath, data),
  createNotes: (folderPath, archiveNo, notes) => ipcRenderer.invoke('photos:createNotesFile', folderPath, archiveNo, notes),
}
```

---

### 🔷 Faz 2: Fotoğraf Seçim Eklentisi — Core UI

#### Dosya Yapısı

```
client/src/photo-selector/
├── PhotoSelectorApp.jsx          # Ana uygulama (ayrı entry point)
├── components/
│   ├── GridView.jsx              # Toplu fotoğraf grid görünümü
│   ├── SingleView.jsx            # Tek fotoğraf büyük görünüm + zoom
│   ├── CompareView.jsx           # A/B yan-yana karşılaştırma
│   ├── FavoriteManager.jsx       # Favori yönetimi + kaldırılanlar listesi
│   ├── PhotoCard.jsx             # Tek fotoğraf kartı (thumbnail + yıldız)
│   ├── SelectionPanel.jsx        # Numaralandırma + seçenek işaretleme
│   ├── EditOrderModal.jsx        # Sıralama düzenleme modal
│   ├── PricePreview.jsx          # Fiyat önizleme widget
│   ├── Toolbar.jsx               # Üst toolbar (görünüm değiştirme, favori filtre)
│   └── KeyboardShortcuts.jsx     # Kısayol yönetimi
├── hooks/
│   ├── usePhotoLoader.js         # Fotoğraf yükleme + thumbnail cache
│   ├── useZoom.js                # Zoom/Pan kontrolleri
│   ├── useFavorites.js           # Favori state yönetimi
│   ├── useSelection.js           # Seçim + numaralandırma state
│   ├── useUndoRedo.js            # Undo/Redo stack
│   └── useKeyboardNav.js         # Klavye navigasyonu
├── utils/
│   ├── iniManager.js             # .ini dosya parse/serialize
│   ├── thumbnailCache.js         # Thumbnail oluşturma/okuma
│   ├── priceCalculator.js        # Fiyat hesaplama motoru
│   └── fileNaming.js             # Dosya adlandırma kuralları
├── stores/
│   └── photoSelectorStore.js     # Zustand global state
└── photo-selector-entry.html     # Ayrı pencere HTML entry point
```

---

### 🔷 Faz 2a: Grid Görünümü (Picasa Benzeri)

**GridView.jsx (YENİ)**
- Klasördeki tüm fotoğrafları thumbnail grid olarak gösterme
- `.thumbnails/` cache klasörü — ilk yüklemede `sharp` ile 300px thumbnail
- Lazy loading — sadece görünür alan yüklenir (virtualized grid)
- Her fotoğraf kartında:
  - Thumbnail önizleme
  - Favori yıldız ikonu (sarı = favori)
  - Dosya adı
  - Numaralandırılmış fotoğraflarda numara badge
- Filtreleme:
  - **Tümü** — tüm fotoğraflar
  - **Favoriler** — sadece yıldızlılar
  - **Favoriden Kaldırılanlar** — bu oturumda kaldırılanlar
  - **Numaralandırılmış** — sıralama yapılmış fotoğraflar

---

### 🔷 Faz 2b: Tek Fotoğraf Görünümü

**SingleView.jsx (YENİ)**
- Tam ekran fotoğraf görüntüleme
- `←/→` ok tuşları ile kaydırma
- `↑/↓` veya mouse scroll ile zoom in/out
- Pan: Zoom yapılmışken mouse drag ile kaydırma
- `Space` tuşu ile favoriye ekleme/çıkarma
- Alt bilgi çubuğu: dosya adı, boyut, çözünürlük, EXIF
- `Esc` ile grid görünüme dönüş

---

### 🔷 Faz 2c: A/B Karşılaştırma Görünümü

**CompareView.jsx (YENİ)**
- `C` tuşu veya toolbar butonu ile aktifleştirme
- Grid'den 2 fotoğraf seçip yan yana gösterme
- **Senkronize zoom/pan**: İki fotoğrafta aynı bölge aynı zoom seviyesinde
- Her fotoğraf için bağımsız favori toggle
- `←/→` ile A veya B fotoğrafını değiştirme

---

### 🔷 Faz 3: Favori Yönetimi ve Eleme Süreci

**FavoriteManager.jsx (YENİ)**

Süreç akışı:
```
Tüm Fotoğraflar ──► [Space ile yıldızla] ──► Favoriler
Favoriler ──► [Space ile kaldır] ──► Favoriden Kaldırılanlar
Favoriden Kaldırılanlar ──► [Geri Al] ──► Favoriler
Favoriler ──► [Numaralandır] ──► Satın Alınacaklar
```

- **Favori Ekleme:** Grid veya Single view'da `Space` tuşu
- **Favoriden Kaldırma:** Favori filtresinde `Space` ile kaldırma
- **Kaldırılanlar Listesi:** Oturum bazlı hafıza — geri alınabilir
- **Undo/Redo:** `Ctrl+Z` / `Ctrl+Y`
- Tüm değişiklikler `.ini` dosyasına anlık kaydedilir

---

### 🔷 Faz 4: Numaralandırma ve İşaretleme Sistemi

**SelectionPanel.jsx (YENİ) — Fotoğraf İşaretleme Penceresi**

Adlandırma formatı: `[ArşivNo] - [SıraNo] - [Seçenekler...]`
Örnek: `109744 - 01 - Yıllık - 2 Çoğaltma - 20x30 - Çerçeve`

**Seçenek sıralaması (sabit, asla değişmez):**
1. Tür
2. Kullanılacak Yer / Ek Ölçü
3. Adet / Çoğaltma
4. Hediye (sadece yıllık)
5. Çerçeve / Fotoblok / Kanvas Tablo
6. Not (varsa sadece "Not" yazılır, detay txt dosyasında)

**Çekim türüne göre dinamik seçenekler:**

| Kategori | Tür | Ek Seçenekler |
|----------|-----|---------------|
| `vesikalik_biyometrik` | Arşivdeki çekim türü | Kullanılacak Yer (Pasaport/Vize/İş/Askeri/Özel), Adet, Ek Ölçü, Çoğaltma, Çerçeve/Fotoblok/Kanvas, Not |
| `aile_ajans` | Arşivdeki çekim türü | Ek Ölçü, Çoğaltma, Çerçeve/Fotoblok/Kanvas, Not |
| `yillik` | Yıllık/Vesikalık/Biyometrik/Dijital | Ek Ölçü, Çoğaltma (standart 15x21), Hediye, Not |
| `etkinlik` | Arşivdeki çekim türü | Ek Ölçü, Çoğaltma, Çerçeve/Fotoblok/Kanvas, Not |

**Ölçü seçenekleri (tüm kategoriler için ortak):**
`6x9, 10x15, 13x18, 15x21, 18x24, 20x25, 20x30, 30x40, 50x70, Diğer (manuel)`

**Not sistemi:**
- Not girildiğinde dosya adının sonuna `- Not` eklenir
- Arşiv klasöründe `[ArşivNo] not.txt` oluşturulur
- Format: Her satırda `[SıraNo]: [Not metni]`

---

### 🔷 Faz 4b: Sıralama Düzenleme

**EditOrderModal.jsx (YENİ)**
- "Sıralama Düzenle" butonu ile açılır
- Sadece numaralandırılmış fotoğraflar gösterilir
- Her fotoğraf için:
  - Sıra numarasını değiştirme (manuel input)
  - Seçenekleri düzenleme (tik ekle/kaldır)
  - **İPTAL** butonu — fotoğraf adının başına `İPTAL -` eklenir
- İptal edilen fotoğrafın numarası boş kalır, operatör diğer fotoğraflara manuel atayabilir
- Drag & drop ile sıralama değiştirme

---

### 🔷 Faz 5: Otomatik Fiyatlandırma

**priceCalculator.js (YENİ) — Fiyat Hesaplama Motoru**

```
Seçilen Fotoğraflar
    │
    ├── vesikalik_biyometrik → Adet fiyatı + Ek ölçüler
    ├── aile_ajans           → Ölçü fiyatı + Çoğaltma
    ├── yillik               → Poz x 450₺ + Çoğaltma (yarı fiyat)
    └── etkinlik             → Manuel fiyat
    │
    ▼
    + Çerçeve/Fotoblok/Kanvas
    │
    ▼
    Toplam Fiyat → Arşiv Kaydına Yaz
```

**Fiyat kuralları:**
- **Vesikalık/Biyometrik:** Adet bazlı (4'lü: 500₺, 6'lı: 600₺ vb.)
- **Standart Ölçüler:** Ölçü bazlı (10x15: 500₺, 13x18: 600₺ vb.)
- **Çoğaltma:** Seçilen ölçü fiyatının yarısı × adet
- **Yıllık:** Her poz 450₺ (standart 15x21), hediyeler ücretsiz, çoğaltma yarı fiyat
- **Etkinlik (Düğün/Nişan/Sünnet/Dış Çekim):** Manuel fiyat girişi
- **Çerçeve/Fotoblok/Kanvas:** Ölçüye göre otomatik fiyat (fiyat listesinden)
- **Toplam:** Tüm seçimlerin toplamı

**PricePreview.jsx (YENİ)**
- Gerçek zamanlı fiyat önizleme widget'ı
- Her seçenek değiştiğinde toplam güncellenir
- Detaylı döküm gösterimi

---

### 🔷 Faz 6: Açıklama Otomasyonu ve Arşiv Entegrasyonu

Fotoğraf seçimi tamamlandığında arşiv kaydına otomatik yazılacak bilgiler:

**Açıklama formatları:**
- Vesikalık: `12Bio + 6Vs` → "12'li Biyometrik + 6'lı Vesikalık"
- Yıllık: `5li Paket + 20x30 Çerçeve` → "5 poz yıllık paket + ekstra seçimler"
- Aile/Ajans: `3Poz 15x21 + 1 20x30` → "3 poz 15x21 + 1 adet 20x30"

**Arşiv kaydına yazılan alanlar:**
- `description1` → Otomatik açıklama (editlenebilir)
- `totalAmount` → Otomatik hesaplanan fiyat (manuel değiştirilebilir)
- `photoSelectionData` → JSON: tüm seçim detayları
- `workflowStatus` → `selection_pending` → `preparing` (otomatik geçiş)

---

### 🔷 Faz 7: `.ini` Metadata Sistemi

**iniManager.js (YENİ)**

Her arşiv klasöründe gizli `.studyo_meta.ini` dosyası:

```ini
[General]
archiveNo=109744
createdDate=2026-02-16
lastModified=2026-02-16T02:30:00
sessionId=abc123

[Photos]
; OriginalName=CurrentName|Favorite|OrderNumber|Options
DSC_0001.jpg=109744 - 01 - Yıllık|favorite|1|yillik,15x21
DSC_0002.jpg=109744 - 02 - 20x30 - Çerçeve|favorite|2|20x30,cerceve
DSC_0003.jpg=DSC_0003.jpg|unfavorited|0|
DSC_0004.jpg=DSC_0004.jpg|none|0|

[RemovedFromFavorites]
; Bu oturumda favoriden kaldırılan fotoğraflar
DSC_0005.jpg=removed_at:2026-02-16T02:35:00

[UndoStack]
; JSON array of undo actions
actions=[]
```

> `.ini` dosyası sayesinde program kapansa bile tüm seçimler korunur. Fotoğraf adı değişse bile orijinal ad kaydedilir.

---

### 🔷 Faz 8: Thumbnail Cache Sistemi

**thumbnailCache.js (YENİ)**
- Her klasörde `.thumbnails/` gizli alt klasörü
- İlk açılışta Electron main process'te `sharp` kütüphanesi ile:
  - 300px genişliğinde JPEG thumbnail üretimi
  - EXIF orientation koruması
  - Progressive JPEG formatı (hızlı yükleme)
- Desteklenen formatlar: JPEG, PNG, TIFF, BMP, WebP, RAW (CR2/NEF → JPEG dönüşümü yalnızca thumbnail için)
- Cache geçerliliği: Kaynak dosya değiştiğinde (modified date kontrolü) yeniden oluştur

---

### 🔷 Faz 9: Performans Optimizasyonları

| Optimizasyon | Detay |
|:-------------|:------|
| **Virtualized Grid** | React-window veya benzeri — sadece görünür thumbnail'ler render edilir |
| **Lazy Image Loading** | IntersectionObserver ile görünür olduğunda yükleme |
| **Web Workers** | Thumbnail oluşturma işlemi ayrı thread'de |
| **Memory Management** | Büyük fotoğraflar için görüntüleme sonrası bellek serbest bırakma |
| **Debounced Zoom** | Zoom seviyesi değişikliklerinde debounce ile performans |
| **GPU Acceleration** | CSS `will-change: transform` ile GPU hızlandırma |
| **Progressive Loading** | Önce düşük çözünürlük, sonra yüksek çözünürlük yükleme |

---

### 🔷 Faz 10: Yönetici Paneli — Fiyat Listesi

**Settings.jsx (MODIFY)** — Yeni `Fiyat Listesi` sekmesi:
- Vesikalık/Biyometrik adet fiyatları
- Standart ölçü fiyatları
- Çoğaltma çarpanı
- Yıllık poz fiyatı
- Çerçeve/Fotoblok/Kanvas fiyatları (ölçü bazlı tablo)
- Tüm fiyatlar anlık düzenlenebilir
- Değişiklik geçmişi

---

## Bağımlılıklar (Yeni npm paketleri)

| Paket | Amaç |
|:------|:-----|
| `sharp` | Thumbnail oluşturma (Electron native modül) |
| `ini` | .ini dosya parse/serialize |
| `react-window` veya `react-virtuoso` | Virtualized grid/list |

> **UYARI:** `sharp` bir native Node.js modülüdür ve Electron rebuilding gerektirir. `@electron/rebuild` kullanılmalıdır.

---

## Klavye Kısayolları Haritası

| Kısayol | Grid View | Single View | Compare View |
|:--------|:----------|:------------|:-------------|
| `Space` | Favorile/kaldır | Favorile/kaldır | — |
| `←` / `→` | — | Önceki/sonraki | A/B değiştir |
| `↑` / `↓` | — | Zoom in/out | Senkronize zoom |
| `Scroll` | Grid kaydırma | Zoom in/out | Senkronize zoom |
| `Esc` | — | Grid'e dön | Grid'e dön |
| `C` | Karşılaştırma modu | Karşılaştırma modu | — |
| `Enter` | Tek göster | Numaralandırma paneli | — |
| `Delete` | Favoriden kaldır | Favoriden kaldır | — |
| `Ctrl+Z` | Geri al | Geri al | — |
| `Ctrl+Y` | Yinele | Yinele | — |
| `F` | Favori filtresi | — | — |
| `1-5` | Yıldız derecelendirme | Yıldız derecelendirme | — |

---

## Geliştirme Sırası ve Tahmini İş

| Faz | Açıklama | Tahmini Dosya Sayısı |
|:----|:---------|:---------------------|
| Faz 1 | Veri modeli + Backend + Okul/Kategori/Fiyat | ~8 dosya |
| Faz 2a | Grid View + Thumbnail Cache | ~6 dosya |
| Faz 2b | Single View + Zoom + Navigasyon | ~3 dosya |
| Faz 2c | A/B Compare View | ~2 dosya |
| Faz 3 | Favori Yönetimi + Undo/Redo | ~4 dosya |
| Faz 4 | Numaralandırma + İşaretleme | ~4 dosya |
| Faz 5 | Fiyat Hesaplama | ~3 dosya |
| Faz 6 | Arşiv Entegrasyonu | ~2 dosya |
| Faz 7 | .ini Metadata | ~2 dosya |
| Faz 8 | Thumbnail Cache Optimizasyon | ~2 dosya |
| Faz 9 | Performans | ~2 dosya |
| Faz 10 | Yönetici Fiyat Paneli | ~2 dosya |
| **TOPLAM** | | **~40 dosya** |

---

## Veri Akışı

```
1. Operatör → Ana Program        : Arşiv kaydı oluştur
2. Ana Program → Firebase         : Arşiv kaydet → archiveId (109744)
3. Ana Program → Dosya Sistemi    : Klasör oluştur (D:\Arsiv\109744)
4. Operatör → Dosya Sistemi       : SD karttan fotoğrafları kopyala (manuel)
5. Operatör → Ana Program         : "Fotoğraf Seçim" butonu tıkla
6. Ana Program → Photo Selector   : Ayrı pencere aç (archiveId, shootType, folderPath)
7. Photo Selector → Dosya Sistemi : Fotoğrafları listele + thumbnail cache kontrol
8. Photo Selector → Operatör      : Grid görünümü göster
9. Operatör → Photo Selector      : Fotoğrafları görüntüle & favorile (Space)
10. Photo Selector → Dosya Sistemi: .studyo_meta.ini güncelle
11. Operatör → Photo Selector     : Favorileri filtrele & ele
12. Operatör → Photo Selector     : Numaralandır & seçenekleri işaretle
13. Photo Selector → Dosya Sistemi: Fotoğraf dosyalarını yeniden adlandır + .ini güncelle
14. Operatör → Photo Selector     : "Kaydet & Kapat"
15. Photo Selector → Firebase     : photoSelectionData + autoDescription + autoPrice
16. Photo Selector → Ana Program  : Seçim tamamlandı (IPC sonuç)
17. Ana Program → Firebase        : Arşiv güncelle (description1, totalAmount)
```

---

## Test Planı

### Manuel Test
1. Arşiv kaydı oluşturma → klasörün otomatik oluştuğunu doğrulama
2. Fotoğraf Seçim penceresini açma → ayrı pencerenin açıldığını doğrulama
3. Bağımsız kullanım → arşiv kaydı olmadan da çalıştığını doğrulama
4. Grid görünümü → thumbnail'lerin doğru oluştuğunu, lazy loading çalıştığını doğrulama
5. Tek fotoğraf görünümü → zoom, pan, ok tuşları ile navigasyon testi
6. A/B karşılaştırma → senkronize zoom/pan doğrulama
7. Favori sistemi → Space ile ekleme/çıkarma, kaldırılanlar listesi, Undo/Redo
8. Numaralandırma → doğru format, seçenek sıralaması, dosya yeniden adlandırma
9. Fiyat hesaplama → her çekim türü için doğru fiyat hesaplaması
10. Arşiv entegrasyonu → açıklama ve fiyatın arşive doğru yazıldığını doğrulama
11. `.ini` dosyası → program kapatıp açınca seçimlerin korunduğunu doğrulama

### Otomatik Doğrulama
- `priceCalculator.js` unit testler (fiyat hesaplama doğruluğu)
- `iniManager.js` unit testler (parse/serialize doğruluğu)
- `fileNaming.js` unit testler (dosya adlandırma formatı)
- Electron build testleri (`npm run electron:build` başarılı olmalı)

---

## Detaylı Teknik Implementasyon Rehberi

> Aşağıdaki bölümler, mevcut Stüdyo kod tabanının pattern'leri analiz edilerek hazırlanmıştır. Tüm kod örnekleri, mevcut projedeki Electron IPC, Zustand state management, Tailwind CSS ve Firebase Cloud Functions kalıplarına uyumludur.

---

### 🔷 Ek 1: Electron Pencere Yapılandırması

Mevcut `client/electron/main.js` dosyasındaki BrowserWindow kalıbı (width: 1400, height: 900, contextIsolation: true) temel alınarak, fotoğraf seçim penceresi **ayrı bir child window** olarak açılacaktır.

**`client/electron/photoSelector.js` (YENİ MODÜL)**

```js
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let photoSelectorWindow = null; // Singleton — tek pencere

function createPhotoSelectorWindow(mainWindow, config, isDev) {
    // Zaten açıksa odakla
    if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
        photoSelectorWindow.focus();
        return;
    }

    // Hedef monitörü belirle
    const displays = screen.getAllDisplays();
    const targetDisplay = config.preferredMonitor
        ? (displays[config.preferredMonitor] || displays[0])
        : screen.getPrimaryDisplay();

    const { x, y, width: sw, height: sh } = targetDisplay.workArea;

    photoSelectorWindow = new BrowserWindow({
        width: Math.min(1600, sw),
        height: Math.min(1000, sh),
        minWidth: 1024,
        minHeight: 700,
        x: x + Math.floor((sw - Math.min(1600, sw)) / 2),
        y: y + Math.floor((sh - Math.min(1000, sh)) / 2),
        parent: mainWindow,           // Ana pencerenin child'ı (modal DEĞİL)
        modal: false,                 // Ana pencere ile aynı anda kullanılabilir
        frame: true,
        autoHideMenuBar: true,
        title: `Fotoğraf Seçim — ${config.archiveNo || 'Bağımsız'}`,
        icon: path.join(__dirname, '../public/icon.png'),
        backgroundColor: '#171717',   // neutral-900 — sadece dark tema
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // Aynı preload, ortak API
        },
        show: false                   // ready-to-show ile göster (beyaz flaş önleme)
    });

    // URL parametreleri ile config gönderimi
    const params = new URLSearchParams();
    if (config.archiveId) params.set('archiveId', config.archiveId);
    if (config.archiveNo) params.set('archiveNo', config.archiveNo);
    if (config.folderPath) params.set('folderPath', config.folderPath);
    if (config.shootType) params.set('shootType', config.shootType);
    if (config.shootCategory) params.set('shootCategory', config.shootCategory);
    if (config.customerName) params.set('customerName', config.customerName);

    const query = params.toString() ? `?${params.toString()}` : '';

    if (isDev) {
        photoSelectorWindow.loadURL(`http://localhost:5173/photo-selector.html${query}`);
    } else {
        photoSelectorWindow.loadFile(
            path.join(__dirname, '../dist/photo-selector.html'),
            { query: Object.fromEntries(params) }
        );
    }

    photoSelectorWindow.once('ready-to-show', () => photoSelectorWindow.show());

    photoSelectorWindow.on('close', (event) => {
        photoSelectorWindow.webContents.send('photo-selector:before-close');
    });

    photoSelectorWindow.on('closed', () => { photoSelectorWindow = null; });
}

module.exports = { createPhotoSelectorWindow };
```

**Tasarım Kararları:**
- `parent: mainWindow` + `modal: false` → Operatör iki pencere arasında geçiş yapabilir
- `show: false` + `ready-to-show` → Koyu arka planda beyaz flaş önlenir
- Aynı `preload.js` kullanılır → `window.electron` API yüzeyi ortaktır
- `minWidth: 1024` → Fotoğraf grid'i yatay alana ihtiyaç duyar
- `backgroundColor: '#171717'` → neutral-900, fotoğraf görüntüleme için ideal
- Singleton pattern → Aynı anda birden fazla pencere açılması engellenir

---

### 🔷 Ek 2: Vite Çoklu Giriş Noktası (Multi-Entry Build)

Mevcut `client/vite.config.js` tek giriş noktası kullanmaktadır. Photo selector için ikinci bir HTML entry point eklenmesi gerekir:

```js
// client/vite.config.js — GÜNCELLENMİŞ
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                'photo-selector': path.resolve(__dirname, 'photo-selector.html'),
            },
        },
    },
});
```

**Çıktı yapısı:**
- `dist/index.html` → Ana uygulama (değişmez)
- `dist/photo-selector.html` → Fotoğraf seçim uygulaması
- `dist/assets/` → Paylaşılan chunk'lar (React, Zustand, Tailwind) Vite/Rollup tarafından otomatik code-split edilir

> `base: './'` ayarı (mevcut) sayesinde her iki HTML dosyası da Electron içinde doğru çalışır.

---

### 🔷 Ek 3: Photo Selector Giriş Dosyaları

**`client/photo-selector.html` (YENİ)**

```html
<!DOCTYPE html>
<html lang="tr" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fotoğraf Seçim</title>
  </head>
  <body class="bg-neutral-900 text-neutral-100">
    <div id="root"></div>
    <script type="module" src="/src/photo-selector/photo-selector-main.jsx"></script>
  </body>
</html>
```

**`client/src/photo-selector/photo-selector-main.jsx` (YENİ)**

Mevcut `client/src/main.jsx` pattern'i temel alınır, ancak Firebase Auth ve Router olmadan:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import PhotoSelectorApp from './PhotoSelectorApp';
import '../index.css';               // Tailwind base stilleri
import './photo-selector.css';        // Dark-only tema override'ları

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PhotoSelectorApp />
        <Toaster
            position="top-center"
            toastOptions={{
                duration: 3000,
                style: {
                    background: '#262626',
                    color: '#f5f5f5',
                    border: '1px solid #404040',
                },
            }}
        />
    </React.StrictMode>
);
```

**Ana uygulama (`main.jsx`) ile farklar:**
- `QueryClientProvider` yok (Firebase sorgusu yok; veri IPC ile gelir)
- `useAuthStore.getState().initialize()` yok (bağımsız auth dinleyicisi yok)
- `HashRouter` yok (tek sayfa, routing gerekmez)
- Özel Toaster stilleri (dark-only tema)

---

### 🔷 Ek 4: Zustand Store Şeması (photoSelectorStore.js)

Mevcut `authStore.js` (create pattern) ve `themeStore.js` (persist middleware) kalıpları temel alınmıştır:

```js
// client/src/photo-selector/stores/photoSelectorStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePhotoSelectorStore = create(
    persist(
        (set, get) => ({
            // ============ CONFIG (ana pencereden IPC ile alınır) ============
            archiveInfo: null,
            // { archiveId, archiveNo, folderPath, shootType, shootCategory, customerName }

            // ============ FOTOĞRAFLAR ============
            photos: [],
            // Her fotoğraf:
            // {
            //   id: string (originalFileName),
            //   originalName: string,
            //   currentName: string,
            //   thumbnailPath: string | null,
            //   fullPath: string,
            //   width: number,
            //   height: number,
            //   fileSize: number,
            //   exifDate: string | null,
            //   status: 'none' | 'favorite' | 'unfavorited',
            //   orderNumber: number | null,
            //   options: string[],
            //   optionDetails: object,
            //   isCancelled: boolean,
            // }

            photosLoading: false,
            thumbnailProgress: { done: 0, total: 0 },

            // ============ GÖRÜNÜM STATE ============
            currentView: 'grid',          // 'grid' | 'single' | 'compare'
            selectedIndex: 0,
            compareIndices: [0, 1],       // [leftIndex, rightIndex]
            zoomLevel: 1,                 // 1 = fit, >1 = zoomed
            panOffset: { x: 0, y: 0 },
            filterMode: 'all',            // 'all' | 'favorites' | 'unfavorited' | 'numbered'

            // ============ FAVORİLER ============
            favorites: new Set(),
            removedFavorites: new Set(),   // Bu oturumda kaldırılanlar

            // ============ NUMARALANDIRMA ============
            numberedPhotos: [],            // [{ photoId, orderNumber, options, optionDetails, isCancelled }]
            nextOrderNumber: 1,

            // ============ FİYATLANDIRMA ============
            priceList: null,               // Firebase'den çekilir
            priceBreakdown: [],            // [{ photoId, label, amount }]
            totalPrice: 0,

            // ============ UNDO/REDO ============
            undoStack: [],                 // [{ type, payload, timestamp }]
            redoStack: [],

            // ============ KAYIT DURUMU ============
            isDirty: false,
            lastSavedAt: null,

            // ============ ACTIONS ============

            // --- Başlatma ---
            initFromConfig: (config) => set({
                archiveInfo: config,
                photos: [],
                favorites: new Set(),
                removedFavorites: new Set(),
                numberedPhotos: [],
                undoStack: [],
                redoStack: [],
                currentView: 'grid',
                selectedIndex: 0,
                filterMode: 'all',
                isDirty: false,
            }),

            setPhotos: (photos) => set({ photos, photosLoading: false }),
            setPhotosLoading: (loading) => set({ photosLoading: loading }),
            setThumbnailProgress: (progress) => set({ thumbnailProgress: progress }),

            // --- Görünüm ---
            setView: (view) => set({
                currentView: view,
                zoomLevel: 1,
                panOffset: { x: 0, y: 0 }
            }),
            setSelectedIndex: (index) => set({ selectedIndex: index }),
            setCompareIndices: (indices) => set({ compareIndices: indices }),
            setZoom: (level) => set({ zoomLevel: Math.max(0.5, Math.min(level, 10)) }),
            setPan: (offset) => set({ panOffset: offset }),
            setFilterMode: (mode) => set({ filterMode: mode, selectedIndex: 0 }),

            // --- Favoriler ---
            toggleFavorite: (photoId) => {
                const { favorites, removedFavorites, undoStack } = get();
                const newFavs = new Set(favorites);
                const newRemoved = new Set(removedFavorites);
                const wasFavorite = newFavs.has(photoId);

                if (wasFavorite) {
                    newFavs.delete(photoId);
                    newRemoved.add(photoId);
                } else {
                    newFavs.add(photoId);
                    newRemoved.delete(photoId);
                }

                set({
                    favorites: newFavs,
                    removedFavorites: newRemoved,
                    undoStack: [...undoStack, {
                        type: 'toggleFavorite',
                        payload: { photoId, wasFavorite },
                        timestamp: Date.now()
                    }],
                    redoStack: [],
                    isDirty: true,
                });
            },

            restoreFavorite: (photoId) => {
                const { favorites, removedFavorites } = get();
                const newFavs = new Set(favorites);
                const newRemoved = new Set(removedFavorites);
                newFavs.add(photoId);
                newRemoved.delete(photoId);
                set({ favorites: newFavs, removedFavorites: newRemoved, isDirty: true });
            },

            // --- Numaralandırma ---
            assignNumber: (photoId, options, optionDetails) => {
                const { numberedPhotos, nextOrderNumber, undoStack } = get();
                const existing = numberedPhotos.find(np => np.photoId === photoId);
                if (existing) return;

                set({
                    numberedPhotos: [...numberedPhotos, {
                        photoId, orderNumber: nextOrderNumber, options, optionDetails
                    }],
                    nextOrderNumber: nextOrderNumber + 1,
                    undoStack: [...undoStack, {
                        type: 'assignNumber',
                        payload: { photoId, orderNumber: nextOrderNumber },
                        timestamp: Date.now()
                    }],
                    redoStack: [],
                    isDirty: true,
                });
            },

            removeNumber: (photoId) => {
                const { numberedPhotos } = get();
                set({
                    numberedPhotos: numberedPhotos.filter(np => np.photoId !== photoId),
                    isDirty: true,
                });
            },

            reorderNumbered: (newOrder) => set({ numberedPhotos: newOrder, isDirty: true }),

            cancelPhoto: (photoId) => {
                const { numberedPhotos } = get();
                set({
                    numberedPhotos: numberedPhotos.map(np =>
                        np.photoId === photoId ? { ...np, isCancelled: true } : np
                    ),
                    isDirty: true,
                });
            },

            // --- Fiyatlandırma ---
            setPriceList: (priceList) => set({ priceList }),
            updatePricing: (breakdown, total) => set({
                priceBreakdown: breakdown, totalPrice: total
            }),

            // --- Undo/Redo ---
            undo: () => {
                const { undoStack, redoStack, favorites, removedFavorites, numberedPhotos } = get();
                if (undoStack.length === 0) return;

                const action = undoStack[undoStack.length - 1];
                const newUndo = undoStack.slice(0, -1);
                const newRedo = [...redoStack, action];

                if (action.type === 'toggleFavorite') {
                    const { photoId, wasFavorite } = action.payload;
                    const newFavs = new Set(favorites);
                    const newRemoved = new Set(removedFavorites);
                    if (wasFavorite) {
                        newFavs.add(photoId);
                        newRemoved.delete(photoId);
                    } else {
                        newFavs.delete(photoId);
                    }
                    set({
                        favorites: newFavs, removedFavorites: newRemoved,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true
                    });
                } else if (action.type === 'assignNumber') {
                    set({
                        numberedPhotos: numberedPhotos.filter(
                            np => np.photoId !== action.payload.photoId
                        ),
                        nextOrderNumber: get().nextOrderNumber - 1,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                }
            },

            redo: () => {
                const { undoStack, redoStack, favorites, removedFavorites,
                        numberedPhotos, nextOrderNumber } = get();
                if (redoStack.length === 0) return;

                const action = redoStack[redoStack.length - 1];
                const newRedo = redoStack.slice(0, -1);
                const newUndo = [...undoStack, action];

                if (action.type === 'toggleFavorite') {
                    const { photoId, wasFavorite } = action.payload;
                    const newFavs = new Set(favorites);
                    const newRemoved = new Set(removedFavorites);
                    if (wasFavorite) {
                        newFavs.delete(photoId);
                        newRemoved.add(photoId);
                    } else {
                        newFavs.add(photoId);
                        newRemoved.delete(photoId);
                    }
                    set({
                        favorites: newFavs, removedFavorites: newRemoved,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true
                    });
                } else if (action.type === 'assignNumber') {
                    set({
                        numberedPhotos: [...numberedPhotos, {
                            photoId: action.payload.photoId,
                            orderNumber: action.payload.orderNumber,
                            options: []
                        }],
                        nextOrderNumber: nextOrderNumber + 1,
                        undoStack: newUndo, redoStack: newRedo, isDirty: true,
                    });
                }
            },

            // --- Kayıt ---
            markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),

            // --- Hesaplanmış (computed) ---
            getFilteredPhotos: () => {
                const { photos, favorites, removedFavorites, numberedPhotos, filterMode } = get();
                switch (filterMode) {
                    case 'favorites':
                        return photos.filter(p => favorites.has(p.id));
                    case 'unfavorited':
                        return photos.filter(p => removedFavorites.has(p.id));
                    case 'numbered': {
                        const numberedIds = new Set(numberedPhotos.map(np => np.photoId));
                        return photos.filter(p => numberedIds.has(p.id));
                    }
                    default:
                        return photos;
                }
            },
        }),
        {
            name: 'photo-selector-storage',
            partialize: (state) => ({
                archiveInfo: state.archiveInfo,
                favorites: Array.from(state.favorites),         // Set → Array (JSON uyumlu)
                removedFavorites: Array.from(state.removedFavorites),
                numberedPhotos: state.numberedPhotos,
                nextOrderNumber: state.nextOrderNumber,
                filterMode: state.filterMode,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.favorites = new Set(state.favorites);
                    state.removedFavorites = new Set(state.removedFavorites);
                }
            },
        }
    )
);

export default usePhotoSelectorStore;
```

> **Not:** `persist` middleware, `Set` tipini JSON'a kaydetmek için `partialize` ile `Array`'e çevirir, `onRehydrateStorage` ile geri `Set`'e dönüştürür.

---

### 🔷 Ek 5: Hata Yönetimi Stratejisi

Mevcut `ErrorBoundary.jsx`, `toast.error()` ve `{ success, error }` IPC dönüş formatı kalıpları temel alınmıştır:

| Hata Durumu | Tespit Yöntemi | Kullanıcı Mesajı | Kurtarma Davranışı |
|:------------|:---------------|:-----------------|:-------------------|
| Klasör bulunamadı | `fs.existsSync()` IPC handler'da | `toast.error('Arşiv klasörü bulunamadı')` | Dialog ile yeni klasör seçimi sunulur |
| Klasör boş | `folder:getFiles` boş array döner | `toast('Bu klasörde fotoğraf bulunamadı')` | Grid'de "Fotoğraf bulunamadı" placeholder |
| Görüntü bozuk | `sharp` thumbnail oluştururken hata | Dosya atlanır, console'a log | Kırık görüntü placeholder'ı gösterilir |
| `.ini` dosyası bozuk | `ini.parse()` SyntaxError | `toast.error('.ini dosyası okunamadı, yeni oturum başlatılıyor')` | Bozuk dosya `.bak` uzantısıyla yeniden adlandırılır, sıfırdan başlanır |
| `.ini` dosyası yok | `fs.existsSync()` false döner | Mesaj yok (ilk kullanım) | Yeni `.ini` oluşturulur |
| Sharp başarısız (genel) | try/catch around `sharp()` | `toast.error('Thumbnail oluşturulamadı')` | Orijinal görüntü CSS ölçekleme ile yüklenir |
| Disk alanı yetersiz | `ENOSPC` error code | `toast.error('Disk alanı yetersiz!')` | Auto-save devre dışı, kalıcı uyarı banner |
| Erişim engellendi | `EPERM` / `EACCES` error codes | `toast.error('Dosya erişim hatası')` | Dosya atlanır, kilit ikonu gösterilir |
| IPC timeout | 30s içinde yanıt yok | `toast.error('İşlem zaman aşımına uğradı')` | UI'da "Tekrar Dene" butonu |
| Beklenmeyen React hatası | ErrorBoundary yakalar | Tam sayfa hata UI + "Yeniden Dene" | Mevcut `ErrorBoundary.jsx` pattern'i |

**IPC Hata Formatı (mevcut kalıpla tutarlı):**
```js
// Her IPC handler bu yapıyı döner:
// Başarı: { success: true, data: ... }
// Hata:   { success: false, error: 'Okunabilir mesaj' }

// Renderer tarafında kullanım:
const result = await window.electron.photoSelector.generateThumbnails(folderPath);
if (!result.success) {
    toast.error(result.error || 'Bilinmeyen hata');
    return;
}
```

---

### 🔷 Ek 6: RAW Dosya Desteği Detayları

**Strateji:** Sharp native formatlar için doğrudan, RAW için dcraw fallback

```
Dosya Format Sınıflandırması:
  Sharp Native  : .jpg .jpeg .png .tiff .tif .webp .bmp .avif
  RAW (dcraw)   : .cr2 .nef .arw .orf .rw2 .raf .pef
  DNG           : Önce sharp dener, başarısız olursa dcraw fallback
```

**Implementasyon yaklaşımı:**

```js
// utils/thumbnailCache.js — RAW dosya işleme
const SHARP_NATIVE = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp', '.avif'];
const RAW_EXTS = ['.cr2', '.nef', '.arw', '.orf', '.rw2', '.dng', '.raf', '.pef'];

async function generateThumbnail(inputPath, outputPath, size = 300) {
    const ext = path.extname(inputPath).toLowerCase();

    if (SHARP_NATIVE.includes(ext)) {
        await sharp(inputPath)
            .rotate()                    // EXIF orientation'a göre döndür
            .resize(size, null, { withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toFile(outputPath);
    } else if (RAW_EXTS.includes(ext)) {
        try {
            // Önce sharp ile dene (DNG genelde çalışır)
            await sharp(inputPath)
                .rotate()
                .resize(size, null, { withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true })
                .toFile(outputPath);
        } catch {
            // Fallback: dcraw ile gömülü JPEG preview çıkar
            await extractRawThumbnail(inputPath, outputPath, size);
        }
    }
}

async function extractRawThumbnail(rawPath, outputPath, size) {
    // dcraw -e: gömülü thumbnail çıkarır, -c: stdout'a yazar
    // dcraw binary: electron/bin/dcraw.exe (Windows)
    const dcrawBin = path.join(__dirname, '../bin/dcraw.exe');
    const { execFile } = require('child_process');

    return new Promise((resolve, reject) => {
        execFile(dcrawBin, ['-e', '-c', rawPath],
            { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 },
            (err, stdout) => {
                if (err) return reject(err);
                sharp(stdout)
                    .resize(size, null, { withoutEnlargement: true })
                    .jpeg({ quality: 80, progressive: true })
                    .toFile(outputPath)
                    .then(resolve)
                    .catch(reject);
            }
        );
    });
}
```

**Build Notu:** `dcraw.exe` (~500KB) `client/electron/bin/` altına yerleştirilmeli ve electron-builder `files` array'ine dahil edilmelidir.

---

### 🔷 Ek 7: Otomatik Kayıt Stratejisi

```
Otomatik Kayıt Akışı:
  [Kullanıcı işlemi] → isDirty = true
       │
       ├── Debounce (2000ms) → .ini dosyasına yaz
       │
       ├── Interval (30s) → isDirty ise .ini dosyasına yaz
       │
       └── Window close → Senkron .ini yaz (beforeunload)
```

**useAutoSave hook implementasyonu:**

```js
// hooks/useAutoSave.js
import { useEffect, useRef } from 'react';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import { serializeToIni } from '../utils/iniManager';

const DEBOUNCE_MS = 2000;
const INTERVAL_MS = 30000;

export default function useAutoSave() {
    const isDirty = usePhotoSelectorStore(s => s.isDirty);
    const markSaved = usePhotoSelectorStore(s => s.markSaved);
    const debounceRef = useRef(null);
    const intervalRef = useRef(null);

    const performSave = async () => {
        const state = usePhotoSelectorStore.getState();
        if (!state.isDirty || !state.archiveInfo?.folderPath) return;

        try {
            const iniData = serializeToIni(state);
            const result = await window.electron.photoSelector.writeIni(
                state.archiveInfo.folderPath, iniData
            );
            if (result.success) markSaved();
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    };

    // Dirty state değişiminde debounced kayıt
    useEffect(() => {
        if (isDirty) {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(performSave, DEBOUNCE_MS);
        }
        return () => clearTimeout(debounceRef.current);
    }, [isDirty]);

    // 30 saniyede bir periyodik kayıt
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (usePhotoSelectorStore.getState().isDirty) performSave();
        }, INTERVAL_MS);
        return () => clearInterval(intervalRef.current);
    }, []);

    // Pencere kapatılmadan önce kayıt (IPC event)
    useEffect(() => {
        const handleBeforeClose = () => {
            performSave().then(() => {
                window.electron?.photoSelector?.confirmClose();
            });
        };
        window.electron?.photoSelector?.onBeforeClose?.(handleBeforeClose);
    }, []);
}
```

---

### 🔷 Ek 8: Bellek Yönetimi

**Problem:** 500+ fotoğraf × 5-10MB = 2.5-5GB. Tümünü belleğe yüklemek mümkün değil.

**Çözüm: Üç Katmanlı Görüntü Pipeline**

| Katman | Çözünürlük | Yüklenme Zamanı | Bellek Etkisi |
|:-------|:-----------|:----------------|:--------------|
| **Thumbnail** (300px) | ~20KB/adet | Grid view | Daima bellekte (500 × 20KB = 10MB) |
| **Preview** (1200px) | ~200KB/adet | Single view | LRU cache, max 10 görüntü (~2MB) |
| **Full resolution** | Orijinal | Zoom >2x | Talep üzerine, zoom-out sonrası serbest |

**LRU Image Cache implementasyonu:**

```js
// utils/imageCache.js
class ImageCache {
    constructor(maxSize = 10) {
        this.cache = new Map();     // key: photoId, value: { blob, lastAccess }
        this.maxSize = maxSize;
    }

    get(photoId) {
        const entry = this.cache.get(photoId);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.blob;
        }
        return null;
    }

    set(photoId, blob) {
        if (this.cache.size >= this.maxSize) {
            // En eski kullanılanı bul ve çıkar
            let oldest = null;
            let oldestTime = Infinity;
            for (const [key, entry] of this.cache) {
                if (entry.lastAccess < oldestTime) {
                    oldestTime = entry.lastAccess;
                    oldest = key;
                }
            }
            if (oldest) {
                URL.revokeObjectURL(this.cache.get(oldest).blob); // BELLEK SERBEST
                this.cache.delete(oldest);
            }
        }
        this.cache.set(photoId, { blob, lastAccess: Date.now() });
    }

    clear() {
        for (const [, entry] of this.cache) {
            URL.revokeObjectURL(entry.blob);
        }
        this.cache.clear();
    }
}

export const previewCache = new ImageCache(10);  // Single view için
export const fullResCache = new ImageCache(3);    // Zoom için
```

**Ek bellek önlemleri:**
- `react-virtuoso` ile grid: Sadece görünür DOM node'ları render edilir
- `URL.revokeObjectURL()` her çıkarılan görüntüde çağrılır
- `IntersectionObserver` ile lazy thumbnail yükleme
- Görünüm geçişlerinde (grid → single → grid) önceki görünüm görüntüleri tutulmaz

---

### 🔷 Ek 9: Güvenlik Hususları

Mevcut `main.js`'deki güvenlik kalıpları (`isPathAllowed`, `contextIsolation`, field whitelisting) temel alınmıştır:

**1. Path Doğrulama (isPathAllowed yeniden kullanımı)**

Mevcut `isPathAllowed()` fonksiyonu arşiv base path'ini de kapsamalıdır:

```js
// main.js — ALLOWED_BASE_PATHS genişletme
try {
    const licenseConfig = JSON.parse(
        fs.readFileSync(path.join(app.getPath('userData'), 'license.json'), 'utf8')
    );
    if (licenseConfig?.archiveBasePath) {
        ALLOWED_BASE_PATHS.push(path.resolve(licenseConfig.archiveBasePath));
    }
} catch { /* henüz config yok */ }
```

**2. Dosya Adı Sanitizasyonu**

```js
function sanitizeFileName(name) {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')  // Windows yasak karakterler
        .replace(/\.+$/, '')                       // Sondaki noktalar
        .replace(/\s+/g, ' ')                      // Çoklu boşluk → tekil
        .trim()
        .substring(0, 200);                        // Maksimum uzunluk
}
```

**3. IPC Input Doğrulama**

```js
ipcMain.handle('photos:renameFile', async (event, oldPath, newPath) => {
    try {
        if (!isPathAllowed(oldPath) || !isPathAllowed(newPath)) {
            return { success: false, error: 'Path not allowed' };
        }
        // Aynı dizin kontrolü (dosyanın dışarı taşınması engellenir)
        if (path.dirname(path.resolve(oldPath)) !== path.dirname(path.resolve(newPath))) {
            return { success: false, error: 'Cross-directory rename not allowed' };
        }
        // Dosya adı karakter doğrulama
        const baseName = path.basename(newPath);
        if (baseName !== sanitizeFileName(baseName)) {
            return { success: false, error: 'Invalid characters in file name' };
        }
        await fs.promises.rename(oldPath, newPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

**4. Güvenlik İlkeleri:**
- `nodeIntegration: false` + `contextIsolation: true` — korunur
- Sharp ile untrusted dosya işleme — her `sharp()` çağrısı try/catch içinde
- Dosya adı yeniden adlandırma — cross-directory taşıma engellenir
- IPC input — her handler path ve veri doğrulaması yapar

---

### 🔷 Ek 10: Component Props/Interfaces

| Bileşen | Prop | Tip | Açıklama |
|:--------|:-----|:----|:---------|
| **GridView** | `photos` | `Photo[]` | Filtrelenmiş fotoğraf dizisi |
| | `favorites` | `Set<string>` | Favori fotoğraf ID'leri |
| | `onPhotoClick` | `(index) => void` | Tek tıklama |
| | `onPhotoDoubleClick` | `(index) => void` | SingleView'ı açar |
| | `onToggleFavorite` | `(photoId) => void` | Space veya yıldız tıklama |
| | `columnCount` | `number` | 4-8, slider ile ayarlanır |
| **SingleView** | `photos` | `Photo[]` | Tüm fotoğraf dizisi (navigasyon) |
| | `currentIndex` | `number` | Aktif fotoğraf indeksi |
| | `isFavorite` | `boolean` | Mevcut fotoğrafın favori durumu |
| | `onNavigate` | `(direction: -1\|1) => void` | Ok tuşu handler |
| | `onToggleFavorite` | `() => void` | Space handler |
| | `onZoomChange` | `(level) => void` | Scroll/ok zoom |
| | `onClose` | `() => void` | Esc handler |
| | `onOpenSelection` | `() => void` | Enter ile SelectionPanel açar |
| **CompareView** | `photos` | `Photo[]` | Fotoğraf dizisi |
| | `leftIndex` | `number` | Sol panel indeksi |
| | `rightIndex` | `number` | Sağ panel indeksi |
| | `onSwapPhoto` | `(side, direction) => void` | Ok tuşu değiştirme |
| | `syncZoom` | `boolean` | Senkronize zoom aktif mi |
| | `onClose` | `() => void` | Grid'e dön |
| **PhotoCard** | `photo` | `Photo` | Tek fotoğraf verisi |
| | `isFavorite` | `boolean` | Yıldız durumu |
| | `orderNumber` | `number\|null` | Badge numarası |
| | `isSelected` | `boolean` | Seçim vurgusu |
| | `onClick` | `() => void` | Tıklama |
| | `onToggleFavorite` | `(e) => void` | Yıldız tıklama |
| **SelectionPanel** | `photo` | `Photo` | Yapılandırılan fotoğraf |
| | `archiveNo` | `string` | Arşiv numarası |
| | `shootCategory` | `string` | Kategori (seçenek filtreleme) |
| | `priceList` | `PriceList` | Güncel fiyat listesi |
| | `onSave` | `(options) => void` | Seçimi kaydet |
| | `onClose` | `() => void` | Paneli kapat |
| **EditOrderModal** | `numberedPhotos` | `NumberedPhoto[]` | Sıralı fotoğraflar |
| | `onReorder` | `(newOrder) => void` | Drag/manuel sıralama sonrası |
| | `onCancel` | `(photoId) => void` | İPTAL işaretle |
| | `onClose` | `() => void` | Modal kapat |
| **PricePreview** | `breakdown` | `PriceItem[]` | Kalem bazlı fiyatlar |
| | `total` | `number` | Genel toplam |
| **Toolbar** | `currentView` | `string` | Aktif görünüm |
| | `filterMode` | `string` | Aktif filtre |
| | `photoCount` | `object` | `{ total, favorites, numbered }` |
| | `onViewChange` | `(view) => void` | Görünüm değiştir |
| | `onFilterChange` | `(mode) => void` | Filtre değiştir |
| | `onSaveAndClose` | `() => void` | Kaydet & kapat |

---

### 🔷 Ek 11: CSS/Styling Detayları

Photo selector **sadece dark tema** kullanır — light/dark geçişi yoktur.

**`client/src/photo-selector/photo-selector.css` (YENİ)**

```css
/* Dark-only fotoğraf görüntüleme ortamı için CSS variable override'ları */
:root {
    --background: 0 0% 10%;           /* neutral-900 */
    --foreground: 0 0% 96%;           /* neutral-100 */
    --card: 0 0% 15%;                 /* neutral-850 */
    --card-foreground: 0 0% 96%;
    --popover: 0 0% 13%;
    --popover-foreground: 0 0% 96%;
    --muted: 0 0% 20%;               /* neutral-800 */
    --muted-foreground: 0 0% 64%;    /* neutral-400 */
    --border: 0 0% 22%;
    --input: 0 0% 22%;
    --primary: 47 96% 53%;           /* amber-400 — fotoğraf çalışması için sıcak accent */
    --primary-foreground: 0 0% 9%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --ring: 47 96% 53%;
}

/* Fotoğraf grid elemanı */
.photo-grid-item {
    @apply relative rounded-lg overflow-hidden cursor-pointer
           transition-all duration-150 ease-out;
}
.photo-grid-item:hover {
    @apply ring-2 ring-primary/50 scale-[1.02];
}
.photo-grid-item.selected {
    @apply ring-2 ring-primary;
}
.photo-grid-item.favorite .favorite-star {
    @apply text-yellow-400;
}

/* Zoom container */
.zoom-container {
    @apply w-full h-full overflow-hidden relative;
    cursor: grab;
}
.zoom-container.dragging {
    cursor: grabbing;
}
.zoom-container img {
    image-rendering: auto;
    will-change: transform;
}

/* Thumbnail yükleme placeholder */
.thumb-placeholder {
    @apply bg-neutral-800 animate-pulse flex items-center justify-center;
}

/* Toolbar */
.ps-toolbar {
    @apply h-12 flex items-center justify-between px-4
           bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800
           sticky top-0 z-30;
}

/* Status bar */
.ps-statusbar {
    @apply h-8 flex items-center justify-between px-4 text-xs
           bg-neutral-950 border-t border-neutral-800 text-neutral-400
           fixed bottom-0 left-0 right-0 z-30;
}
```

**Tailwind class kalıpları:**
- Arka plan: `bg-neutral-900`, `bg-neutral-800`, `bg-neutral-950`
- Metin: `text-neutral-100`, `text-neutral-400` (soluk)
- Kenar: `border-neutral-700`, `border-neutral-800`
- Accent (favori yıldız, aktif): `text-yellow-400`, `bg-yellow-400/20`
- Accent (primary butonlar): `bg-amber-500`, `text-amber-400`
- Danger: `text-red-400`, `bg-red-500/20`
- Success: `text-green-400`, `bg-green-500/20`

---

### 🔷 Ek 12: IPC Mesaj Protokolü

Her IPC handler mevcut `{ success, data, error }` kalıbını takip eder:

| IPC Channel | İstek (Request) | Yanıt (Response) | Notlar |
|:------------|:----------------|:-----------------|:-------|
| `photo-selector:open` | `{ archiveId?, archiveNo?, folderPath, shootType?, shootCategory?, customerName?, preferredMonitor? }` | `{ success: true }` | Child window açar |
| `photo-selector:result` | _(Ana pencereye webContents.send ile)_ | `{ archiveId, selectedCount, totalAmount, autoDescription, photoSelectionData }` | "Kaydet & Kapat" tıklandığında |
| `photo-selector:confirm-close` | _(payload yok)_ | _(yanıt yok)_ | Kapatma güvenli onayı |
| `photo-selector:before-close` | _(event, renderer'a gönderilir)_ | — | Ana process kapatma öncesi bildirim |
| `photos:generateThumbnails` | `{ folderPath, size?: 300 }` | `{ success, data: { generated, skipped, failed[], thumbnailDir } }` | Progress event'leri ayrıca gönderilir |
| `photos:thumbnail-progress` | _(event, renderer'a)_ | `{ done, total, current }` | Thumbnail oluşturma progress stream |
| `photos:readExif` | `{ filePath }` | `{ success, data: { width, height, orientation, dateTime, camera, iso } }` | Tek dosya EXIF okuma |
| `photos:renameFile` | `{ oldPath, newPath }` | `{ success, error? }` | Tek dosya yeniden adlandırma |
| `photos:batchRename` | `{ operations: [{ oldPath, newPath }] }` | `{ success, results: [{ oldPath, newPath, success, error? }] }` | Toplu yeniden adlandırma (rollback destekli) |
| `photos:readIniFile` | `{ folderPath }` | `{ success, data: { General, Photos, RemovedFromFavorites } }` | Parse edilmiş .ini |
| `photos:writeIniFile` | `{ folderPath, data }` | `{ success, error? }` | Serialize edilmiş .ini yazma |
| `photos:createNotesFile` | `{ folderPath, archiveNo, notes: [{ orderNumber, text }] }` | `{ success, error? }` | `[ArşivNo] not.txt` oluşturma |
| `photos:getImageAsBase64` | `{ filePath, maxWidth?: 1200 }` | `{ success, data: { base64, width, height, format } }` | Preview yükleme (resize opsiyonel) |
| `screen:getDisplays` | _(payload yok)_ | `[{ index, label, isPrimary, bounds }]` | Monitör listesi |

**Kayıt Pattern'i** (mevcut `registerWhatsAppIPC` kalıbı temel alınır):

```js
// client/electron/photoSelector.js — IPC registration
function registerPhotoSelectorIPC(mainWindow, isPathAllowed) {
    ipcMain.handle('photo-selector:open', async (_event, config) => { /* ... */ });
    ipcMain.handle('photos:generateThumbnails', async (event, params) => { /* ... */ });
    ipcMain.handle('photos:readExif', async (_event, params) => { /* ... */ });
    ipcMain.handle('photos:renameFile', async (_event, oldPath, newPath) => { /* ... */ });
    ipcMain.handle('photos:readIniFile', async (_event, params) => { /* ... */ });
    ipcMain.handle('photos:writeIniFile', async (_event, params) => { /* ... */ });
    ipcMain.handle('photos:createNotesFile', async (_event, params) => { /* ... */ });
    ipcMain.handle('photos:getImageAsBase64', async (_event, params) => { /* ... */ });
    ipcMain.handle('screen:getDisplays', async () => { /* ... */ });
}

module.exports = { registerPhotoSelectorIPC };

// main.js app.whenReady() içinde:
const { registerPhotoSelectorIPC } = require('./photoSelector');
registerPhotoSelectorIPC(mainWindow, isPathAllowed);
```

---

### 🔷 Ek 13: Drag & Drop Sıralama Implementasyonu

`EditOrderModal.jsx` için HTML5 native Drag & Drop (ek kütüphane gerektirmez):

```jsx
function EditOrderModal({ numberedPhotos, onReorder, onCancel, onClose }) {
    const [items, setItems] = useState(numberedPhotos);
    const [dragIndex, setDragIndex] = useState(null);
    const [overIndex, setOverIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIndex) return;

        const newItems = [...items];
        const [moved] = newItems.splice(dragIndex, 1);
        newItems.splice(dropIndex, 0, moved);

        // Sıra numaralarını ardışık olarak yeniden ata
        const renumbered = newItems.map((item, i) => ({
            ...item, orderNumber: i + 1
        }));

        setItems(renumbered);
        setDragIndex(null);
        setOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setOverIndex(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative bg-neutral-800 border border-neutral-700 rounded-xl
                            shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Başlık */}
                <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sıralama Düzenle</h2>
                    <button onClick={onClose}
                        className="p-2 hover:bg-neutral-700 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sürüklenebilir liste */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {items.map((item, index) => (
                        <div
                            key={item.photoId}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-grab',
                                dragIndex === index && 'opacity-50 border-amber-500',
                                overIndex === index && dragIndex !== index
                                    && 'bg-amber-500/10 border-amber-500/50',
                                !dragIndex && !overIndex && 'border-neutral-700 bg-neutral-900',
                                item.isCancelled && 'opacity-40 line-through'
                            )}
                        >
                            <GripVertical className="w-4 h-4 text-neutral-500" />
                            <span className="font-mono text-amber-400 w-8 text-center">
                                {item.orderNumber}
                            </span>
                            <img src={item.thumbnailPath}
                                 className="w-12 h-12 object-cover rounded" />
                            <span className="flex-1 text-sm truncate">{item.currentName}</span>
                            <button onClick={() => onCancel(item.photoId)}
                                className="text-red-400 hover:text-red-300 text-xs px-2 py-1
                                           rounded hover:bg-red-500/20">
                                İPTAL
                            </button>
                        </div>
                    ))}
                </div>

                {/* Alt butonlar */}
                <div className="p-4 border-t border-neutral-700 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-neutral-600 rounded-lg
                                   hover:bg-neutral-700">
                        Vazgeç
                    </button>
                    <button onClick={() => onReorder(items)}
                        className="flex-1 px-4 py-2 bg-amber-500 text-neutral-900 rounded-lg
                                   hover:bg-amber-400 font-medium">
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
```

---

### 🔷 Ek 14: Çoklu Monitör Desteği

`createPhotoSelectorWindow` fonksiyonu (Ek 1) zaten `screen.getAllDisplays()` ile multi-monitor desteği sağlar. Ek detaylar:

```js
// Ana pencereden monitör seçimi sunulması
ipcMain.handle('screen:getDisplays', () => {
    const { screen } = require('electron');
    return screen.getAllDisplays().map((d, i) => ({
        index: i,
        label: `Monitör ${i + 1} (${d.size.width}x${d.size.height})`,
        isPrimary: d.id === screen.getPrimaryDisplay().id,
        bounds: d.workArea,
    }));
});
```

**Kullanım senaryosu:** Stüdyo operatörü, fotoğraf seçim penceresini büyük kalibre edilmiş monitöre (monitör 2) taşırken, ana yönetim uygulamasını monitör 1'de tutar.

**Pencere pozisyonu kurtarma:**
- Son kullanılan pozisyon localStorage'a kaydedilir (persist middleware)
- Sonraki açılışta kaydedilen monitor hâlâ mevcutsa o pozisyon kullanılır
- Kaydedilen monitor bağlı değilse birincil monitöre fallback yapılır

---

### 🔷 Ek 15: Build & Paketleme Yapılandırması

**Sharp native modül rebuild:**

```json
{
    "scripts": {
        "postinstall": "electron-rebuild -f -w sharp",
        "rebuild-sharp": "electron-rebuild -f -w sharp"
    }
}
```

**electron-builder yapılandırma güncellemeleri** (`client/package.json` `build` bölümü):

```json
{
    "build": {
        "appId": "com.studyo.manager",
        "productName": "Stüdyo Yönetim",
        "files": [
            "dist/**/*",
            "electron/**/*"
        ],
        "extraResources": [
            {
                "from": "electron/bin/",
                "to": "bin/",
                "filter": ["dcraw*"]
            }
        ],
        "win": {
            "target": ["nsis"],
            "icon": "public/icon.ico"
        },
        "asarUnpack": [
            "node_modules/sharp/**/*"
        ]
    }
}
```

**Önemli noktalar:**
- `"asarUnpack": ["node_modules/sharp/**/*"]` → Sharp'ın native binding'leri asar içinden çalışamaz
- `"extraResources"` → dcraw binary'si RAW desteği için paketlenir
- `electron-rebuild` → `npm install` sonrası sharp'ı Electron'un Node sürümü için derler
- `@electron/rebuild` → devDependencies'e eklenir

**Yeni npm bağımlılıkları (`client/package.json`):**

```json
{
    "dependencies": {
        "sharp": "^0.33.2",
        "ini": "^4.1.1",
        "react-virtuoso": "^4.6.3"
    },
    "devDependencies": {
        "@electron/rebuild": "^3.6.0"
    }
}
```

---

### 🔷 Ek 16: Detaylı Kod Örnekleri

#### 16a: PhotoSelectorApp.jsx İskelet Kodu

```jsx
// client/src/photo-selector/PhotoSelectorApp.jsx
import { useEffect, useState } from 'react';
import usePhotoSelectorStore from './stores/photoSelectorStore';
import GridView from './components/GridView';
import SingleView from './components/SingleView';
import CompareView from './components/CompareView';
import Toolbar from './components/Toolbar';
import SelectionPanel from './components/SelectionPanel';
import useAutoSave from './hooks/useAutoSave';
import useKeyboardNav from './hooks/useKeyboardNav';
import { deserializeFromIni } from './utils/iniManager';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function PhotoSelectorApp() {
    const [initializing, setInitializing] = useState(true);
    const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);

    const currentView = usePhotoSelectorStore(s => s.currentView);
    const photosLoading = usePhotoSelectorStore(s => s.photosLoading);
    const initFromConfig = usePhotoSelectorStore(s => s.initFromConfig);
    const setPhotos = usePhotoSelectorStore(s => s.setPhotos);
    const setPhotosLoading = usePhotoSelectorStore(s => s.setPhotosLoading);

    useAutoSave();
    useKeyboardNav({ onOpenSelection: () => setSelectionPanelOpen(true) });

    useEffect(() => {
        const init = async () => {
            try {
                // Config URL parametreleri ile gelir
                const params = new URLSearchParams(window.location.search);
                const config = {
                    archiveId: params.get('archiveId'),
                    archiveNo: params.get('archiveNo'),
                    folderPath: params.get('folderPath'),
                    shootType: params.get('shootType'),
                    shootCategory: params.get('shootCategory'),
                    customerName: params.get('customerName'),
                };

                if (!config.folderPath) {
                    const result = await window.electron?.showOpenDialog({
                        properties: ['openDirectory'],
                        title: 'Fotoğraf Klasörü Seçin'
                    });
                    if (!result || result.length === 0) {
                        toast.error('Klasör seçilmedi');
                        return;
                    }
                    config.folderPath = result[0];
                }

                initFromConfig(config);

                // Mevcut .ini dosyasını yükle
                const iniResult = await window.electron?.photoSelector?.readIni(
                    { folderPath: config.folderPath }
                );
                if (iniResult?.success && iniResult.data) {
                    const restored = deserializeFromIni(iniResult.data);
                    // Store'a önceki oturum verilerini aktar
                    // ... (favorites, numberedPhotos, nextOrderNumber)
                }

                // Fotoğrafları yükle
                setPhotosLoading(true);
                const files = await window.electron?.getFilesInFolder(
                    config.folderPath,
                    ['jpg','jpeg','png','tiff','tif','webp','bmp','cr2','nef','arw','dng']
                );

                const photoList = (files || []).map(fullPath => ({
                    id: fullPath.split(/[/\\]/).pop(),
                    originalName: fullPath.split(/[/\\]/).pop(),
                    currentName: fullPath.split(/[/\\]/).pop(),
                    fullPath,
                    thumbnailPath: null,
                    status: 'none',
                    orderNumber: null,
                    options: [],
                    optionDetails: {},
                    isCancelled: false,
                }));

                setPhotos(photoList);

                // Arka planda thumbnail oluştur
                if (photoList.length > 0) {
                    window.electron?.photoSelector?.generateThumbnails({
                        folderPath: config.folderPath, size: 300
                    });
                }
            } catch (err) {
                console.error('Init error:', err);
                toast.error('Başlangıç hatası: ' + err.message);
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, []);

    if (initializing || photosLoading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-neutral-900">
                <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-4" />
                <p className="text-neutral-400 text-sm">Fotoğraflar yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-neutral-900 text-neutral-100
                        overflow-hidden select-none">
            <Toolbar onOpenSelection={() => setSelectionPanelOpen(true)} />

            <main className="flex-1 overflow-hidden">
                {currentView === 'grid' && <GridView />}
                {currentView === 'single' && <SingleView />}
                {currentView === 'compare' && <CompareView />}
            </main>

            <div className="ps-statusbar">
                <span>{usePhotoSelectorStore.getState().getFilteredPhotos().length} fotoğraf</span>
                <span>{usePhotoSelectorStore.getState().favorites.size} favori</span>
                <span>{usePhotoSelectorStore.getState().numberedPhotos.length} numaralandırılmış</span>
            </div>

            {selectionPanelOpen && (
                <SelectionPanel onClose={() => setSelectionPanelOpen(false)} />
            )}
        </div>
    );
}
```

---

#### 16b: IPC Handler Kayıt Modülü

```js
// client/electron/photoSelector.js
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ini = require('ini');

let photoSelectorWindow = null;

function registerPhotoSelectorIPC(mainWindow, isPathAllowed, isDev) {

    // Fotoğraf seçim penceresini aç
    ipcMain.handle('photo-selector:open', async (_event, config) => {
        if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
            photoSelectorWindow.focus();
            return { success: true, alreadyOpen: true };
        }
        try {
            const { createPhotoSelectorWindow } = require('./photoSelector');
            photoSelectorWindow = createPhotoSelectorWindow(mainWindow, config, isDev);
            photoSelectorWindow.on('closed', () => { photoSelectorWindow = null; });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Thumbnail oluşturma
    ipcMain.handle('photos:generateThumbnails', async (event, { folderPath, size = 300 }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };

        const thumbDir = path.join(folderPath, '.thumbnails');
        if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

        // Windows'ta .thumbnails klasörünü gizle
        if (process.platform === 'win32') {
            try { require('child_process').execSync(`attrib +h "${thumbDir}"`); } catch {}
        }

        const extensions = ['.jpg','.jpeg','.png','.tiff','.tif','.webp','.bmp',
                           '.cr2','.nef','.arw','.dng'];
        const files = fs.readdirSync(folderPath).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return extensions.includes(ext) && !f.startsWith('.');
        });

        let generated = 0, skipped = 0;
        const failed = [];
        const sender = event.sender;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const inputPath = path.join(folderPath, file);
            const thumbName = path.parse(file).name + '.jpg';
            const outputPath = path.join(thumbDir, thumbName);

            // Thumbnail mevcutsa ve kaynak değişmemişse atla
            if (fs.existsSync(outputPath)) {
                const srcStat = fs.statSync(inputPath);
                const thumbStat = fs.statSync(outputPath);
                if (thumbStat.mtimeMs > srcStat.mtimeMs) {
                    skipped++;
                    sender.send('photos:thumbnail-progress',
                        { done: i + 1, total: files.length, current: file });
                    continue;
                }
            }

            try {
                await sharp(inputPath)
                    .rotate()
                    .resize(size, null, { withoutEnlargement: true })
                    .jpeg({ quality: 80, progressive: true })
                    .toFile(outputPath);
                generated++;
            } catch (err) {
                failed.push(file);
                console.error(`Thumbnail failed for ${file}:`, err.message);
            }

            sender.send('photos:thumbnail-progress',
                { done: i + 1, total: files.length, current: file });
        }

        return { success: true, data: { generated, skipped, failed, thumbnailDir: thumbDir } };
    });

    // .ini dosyası okuma
    ipcMain.handle('photos:readIniFile', async (_event, { folderPath }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };
        const iniPath = path.join(folderPath, '.studyo_meta.ini');
        if (!fs.existsSync(iniPath)) return { success: true, data: null };
        try {
            const content = fs.readFileSync(iniPath, 'utf-8');
            return { success: true, data: ini.parse(content) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // .ini dosyası yazma
    ipcMain.handle('photos:writeIniFile', async (_event, { folderPath, data }) => {
        if (!isPathAllowed(folderPath)) return { success: false, error: 'Path not allowed' };
        const iniPath = path.join(folderPath, '.studyo_meta.ini');
        try {
            fs.writeFileSync(iniPath, ini.stringify(data), 'utf-8');
            if (process.platform === 'win32') {
                try { require('child_process').execSync(`attrib +h "${iniPath}"`); } catch {}
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // EXIF okuma
    ipcMain.handle('photos:readExif', async (_event, { filePath }) => {
        if (!isPathAllowed(filePath)) return { success: false, error: 'Path not allowed' };
        try {
            const metadata = await sharp(filePath).metadata();
            return {
                success: true,
                data: {
                    width: metadata.width,
                    height: metadata.height,
                    orientation: metadata.orientation,
                    format: metadata.format,
                    space: metadata.space,
                    density: metadata.density,
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { registerPhotoSelectorIPC };
```

---

#### 16c: INI Dosya Parse/Serialize

```js
// client/src/photo-selector/utils/iniManager.js

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

        // Format: CurrentName|Status|OrderNumber|Options
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
        photoNameMap: {},   // originalName -> currentName
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
                options: optsStr ? optsStr.split(',') : [],
            });
            maxOrder = Math.max(maxOrder, orderNumber);
        }
    }

    result.nextOrderNumber = maxOrder + 1;
    result.numberedPhotos.sort((a, b) => a.orderNumber - b.orderNumber);
    return result;
}
```

---

#### 16d: Fiyat Hesaplama Motoru

```js
// client/src/photo-selector/utils/priceCalculator.js

/**
 * Tüm numaralandırılmış fotoğraflar için toplam fiyat hesapla
 * @param {NumberedPhoto[]} numberedPhotos
 * @param {PriceList} priceList
 * @param {string} shootCategory - 'vesikalik_biyometrik'|'aile_ajans'|'yillik'|'etkinlik'
 * @returns {{ breakdown: PriceItem[], total: number }}
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
                lineItems.push(`${adet}'lü: ${adetFiyat}₺`);
                break;
            }
            case 'aile_ajans': {
                const olcu = options.olcu || '15x21';
                const olcuFiyat = priceList.standart_olculer?.[olcu] || 0;
                lineTotal += olcuFiyat;
                lineItems.push(`${olcu}: ${olcuFiyat}₺`);
                break;
            }
            case 'yillik': {
                const pozFiyat = priceList.yillik?.poz_fiyat || 450;
                lineTotal += pozFiyat;
                lineItems.push(`Poz: ${pozFiyat}₺`);

                if (options.hediye && priceList.yillik?.hediye_ucretsiz) {
                    lineItems.push('Hediye: Ücretsiz');
                }
                break;
            }
            case 'etkinlik': {
                lineTotal += options.manuelFiyat || 0;
                lineItems.push(`Manuel: ${options.manuelFiyat || 0}₺`);
                break;
            }
        }

        // Ek ölçü (tüm kategoriler için ortak)
        if (options.ekOlcu && options.ekOlcu !== 'yok') {
            const ekFiyat = priceList.standart_olculer?.[options.ekOlcu] || 0;
            lineTotal += ekFiyat;
            lineItems.push(`Ek ${options.ekOlcu}: ${ekFiyat}₺`);
        }

        // Çoğaltma (yarı fiyat × adet)
        if (options.cogaltmaAdet && options.cogaltmaAdet > 0) {
            const baseOlcu = options.cogaltmaOlcu || options.olcu || '15x21';
            const basePrice = priceList.standart_olculer?.[baseOlcu] || 0;
            const carpan = priceList.cogaltma_carpan || 0.5;
            const copyPrice = Math.round(basePrice * carpan) * options.cogaltmaAdet;
            lineTotal += copyPrice;
            lineItems.push(`${options.cogaltmaAdet}x Çoğaltma: ${copyPrice}₺`);
        }

        // Çerçeve / Fotoblok / Kanvas
        if (options.cerceve) {
            const f = priceList.cerceve?.varsayilan || 500;
            lineTotal += f;
            lineItems.push(`Çerçeve: ${f}₺`);
        }
        if (options.fotoblok) {
            const f = priceList.fotoblok?.varsayilan || 400;
            lineTotal += f;
            lineItems.push(`Fotoblok: ${f}₺`);
        }
        if (options.kanvas) {
            const f = priceList.kanvas_tablo?.varsayilan || 600;
            lineTotal += f;
            lineItems.push(`Kanvas: ${f}₺`);
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
```

---

#### 16e: Zoom/Pan Hook Implementasyonu

```jsx
// hooks/useZoom.js
import { useState, useCallback, useRef, useEffect } from 'react';

export default function useZoom(initialZoom = 1) {
    const [zoom, setZoom] = useState(initialZoom);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.max(0.5, Math.min(10, prev + delta * prev)));
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
    }, [zoom, pan]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setPan({
            x: panStart.current.x + (e.clientX - dragStart.current.x),
            y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const resetZoom = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    const zoomIn = useCallback(() => setZoom(prev => Math.min(10, prev * 1.25)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(0.5, prev / 1.25)), []);

    // Zoom fit'e döndüğünde pan'ı sıfırla
    useEffect(() => {
        if (zoom <= 1) setPan({ x: 0, y: 0 });
    }, [zoom]);

    const style = {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        willChange: 'transform',
    };

    return {
        zoom, pan, isDragging, style,
        handlers: {
            onWheel: handleWheel,
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
        },
        resetZoom, zoomIn, zoomOut,
    };
}
```

---

### 🔷 Ek 17: Firebase Veri Modeli — Yeni Koleksiyonlar

Mevcut multi-tenant yapı izlenir: Tüm veri `studios/{studioId}/...` altında, `DatabaseHandler.fromRequest(request)` ile erişilir.

#### 17a: `schools` koleksiyonu — `studios/{studioId}/schools/{schoolId}`

```json
{
    "name": "Atatürk Lisesi",
    "address": "Ankara, Çankaya",
    "classes": ["9A", "9B", "9C", "10A", "10B", "11A", "11B", "12A", "12B"],
    "contactPerson": "Müdür Bey",
    "contactPhone": "05321234567",
    "isActive": true,
    "createdAt": "Timestamp",
    "updatedAt": "Timestamp",
    "createdBy": "uid123"
}
```

#### 17b: `priceLists` koleksiyonu — `studios/{studioId}/priceLists/{priceListId}`

Tek belge yaklaşımı (stüdyo başına bir aktif fiyat listesi):

```json
{
    "name": "2026 Fiyat Listesi",
    "isActive": true,
    "vesikalik_biyometrik": {
        "adet": { "4": 500, "6": 600, "8": 700, "12": 800 }
    },
    "standart_olculer": {
        "6x9": 350, "10x15": 500, "13x18": 600,
        "15x21": 700, "18x24": 800, "20x25": 1000,
        "20x30": 1100, "30x40": 1400, "50x70": 2500
    },
    "cogaltma_carpan": 0.5,
    "yillik": {
        "poz_fiyat": 450,
        "standart_olcu": "15x21",
        "hediye_ucretsiz": true,
        "cogaltma_carpan": 0.5
    },
    "cerceve": {
        "varsayilan": 500,
        "olculer": { "15x21": 400, "20x30": 600, "30x40": 900 }
    },
    "fotoblok": {
        "varsayilan": 400,
        "olculer": {}
    },
    "kanvas_tablo": {
        "varsayilan": 600,
        "olculer": {}
    },
    "createdAt": "Timestamp",
    "updatedAt": "Timestamp",
    "updatedBy": "uid123"
}
```

#### 17c: `photoSelectionData` alanı — `studios/{studioId}/archives/{archiveId}` belgesinde

Arşiv belgesine eklenen yeni alanlar (ayrı koleksiyon DEĞİL):

```json
{
    "...mevcut arşiv alanları...": "",

    "schoolId": "school_doc_id",
    "className": "12",
    "section": "B",
    "autoDescription": "12Bio + 6Vs",
    "autoPrice": 2600,
    "photoSelectionData": {
        "version": 1,
        "completedAt": "2026-02-16T14:30:00Z",
        "shootCategory": "vesikalik_biyometrik",
        "priceListId": "pricelist_doc_id",
        "selectedPhotos": [
            {
                "originalName": "DSC_0001.jpg",
                "renamedTo": "109744 - 01 - Yıllık",
                "orderNumber": 1,
                "options": {
                    "tur": "yillik",
                    "olcu": "15x21",
                    "cogaltmaAdet": 2,
                    "hediye": true,
                    "cerceve": false,
                    "fotoblok": false,
                    "kanvas": false,
                    "not": ""
                },
                "price": 1050
            }
        ],
        "totalPhotos": 45,
        "favoriteCount": 12,
        "selectedCount": 5,
        "totalPrice": 2600,
        "notes": "Mavi fon tercih edildi"
    }
}
```

---

### 🔷 Ek 18: Zod Doğrulama Şemaları

Mevcut `validators/schemas.js` kalıbı temel alınır:

```js
// firebase/functions/src/validators/schemas.js — EKLENTİLER

const schoolSchema = z.object({
    name: z.string().min(2).max(200),
    address: z.string().max(500).optional().default(''),
    classes: z.array(z.string().max(10)).max(100).optional().default([]),
    contactPerson: z.string().max(100).optional().default(''),
    contactPhone: z.string().max(15).optional().default(''),
    isActive: z.boolean().optional().default(true),
});

const priceListSchema = z.object({
    name: z.string().min(1).max(100),
    isActive: z.boolean().optional().default(true),
    vesikalik_biyometrik: z.object({
        adet: z.record(z.string(), z.number().min(0)),
    }).optional(),
    standart_olculer: z.record(z.string(), z.number().min(0)).optional(),
    cogaltma_carpan: z.number().min(0).max(1).optional().default(0.5),
    yillik: z.object({
        poz_fiyat: z.number().min(0),
        standart_olcu: z.string().max(10).optional().default('15x21'),
        hediye_ucretsiz: z.boolean().optional().default(true),
        cogaltma_carpan: z.number().min(0).max(1).optional().default(0.5),
    }).optional(),
    cerceve: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
    fotoblok: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
    kanvas_tablo: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
});

const photoSelectionDataSchema = z.object({
    version: z.number().int().min(1).max(10),
    completedAt: z.string(),
    shootCategory: z.enum(['vesikalik_biyometrik', 'aile_ajans', 'yillik', 'etkinlik']),
    priceListId: z.string().optional(),
    selectedPhotos: z.array(z.object({
        originalName: z.string().max(300),
        renamedTo: z.string().max(300),
        orderNumber: z.number().int().min(1),
        options: z.record(z.string(), z.unknown()),
        price: z.number().min(0),
    })).max(500),
    totalPhotos: z.number().int().min(0),
    favoriteCount: z.number().int().min(0),
    selectedCount: z.number().int().min(0),
    totalPrice: z.number().min(0),
    notes: z.string().max(2000).optional().default(''),
});

// module.exports'a ekle:
// schoolSchema, priceListSchema, photoSelectionDataSchema
```

---

### 🔷 Ek 19: Firestore Güvenlik Kuralları

Mevcut `firebase/firestore.rules` dosyasındaki `match /studios/{studioId}` bloğuna eklenir:

```
// Okullar
match /schools/{schoolId} {
    allow read: if isStudioMember(studioId);
    allow write: if isStudioAdmin(studioId);
}

// Fiyat Listeleri
match /priceLists/{priceListId} {
    allow read: if isStudioMember(studioId);
    allow write: if isStudioAdmin(studioId);
}
```

> **Not:** Mevcut `archives` kuralları `isStudioMember(studioId)` read/write izni verir. `photoSelectionData`, `schoolId`, `autoDescription`, `autoPrice` gibi yeni alanlar mevcut arşiv belgesinin bir parçası olduğundan otomatik olarak kapsanır.

---

### 🔷 Ek 20: Göç (Migration) Stratejisi

**Yaklaşım: Sadece ekleme (additive-only), breaking change yok**

**1. ALLOWED_ARCHIVE_FIELDS genişletme** (`firebase/functions/src/archives.js`):

```js
const ALLOWED_ARCHIVE_FIELDS = [
    // ... mevcut alanlar değişmeden kalır ...
    'customerName', 'customerPhone', 'customerEmail',
    'fullName', 'phone', 'email',
    'shootTypeId', 'shootTypeName', 'locationId', 'locationName',
    'photographerId', 'photographerName',
    'description', 'description1', 'description2', 'notes', 'status',
    'workflowStatus', 'folderPath',
    'selectedCount', 'totalCount', 'appointmentDate', 'timeSlot',
    'wcProductIds', 'wcUploaded', 'selectionUrl',
    'price', 'paidAmount', 'paymentStatus',
    'totalAmount', 'cashAmount', 'cardAmount', 'transferAmount',
    // YENİ — Photo Selector alanları
    'schoolId', 'className', 'section',
    'photoSelectionData', 'autoDescription', 'autoPrice',
];
```

**2. Göç scripti GEREKMEZ** — Yeni alanlar eski belgelerde `undefined`'dır. UI varlıklarını kontrol eder:

```js
// Archives.jsx'te güvenli erişim kalıbı:
const hasPhotoSelection = !!archive.photoSelectionData;
const description = archive.autoDescription || archive.description1 || '';
const price = archive.autoPrice ?? archive.totalAmount ?? 0;
```

**3. Arşiv şema güncellemesi** — Mevcut `archiveSchema` doğrulamada `.partial()` kullanır, bu nedenle tüm alanlar opsiyoneldir. Yeni opsiyonel alanlar mevcut create/update çağrılarını bozmaz.

**4. Çekim türüne kategori alanı ekleme** — `options.js` `ALLOWED_FIELDS_BY_TYPE`:

```js
shootTypes: ['name', 'price', 'isActive', 'description', 'category'],
```

Mevcut çekim türlerinde `category` alanı `null`/`undefined` olur. UI "Kategori Ata" uyarısı gösterir.

**5. Yeni Cloud Function modülleri** (`firebase/functions/src/index.js`):

```js
exports.schools = require('./schools');       // CRUD
exports.priceLists = require('./priceLists'); // CRUD
```

**6. Geri alma güvenliği** — Tüm değişiklikler ekleme bazlıdır (yeni alanlar, yeni koleksiyonlar). Geri alma sadece önceki fonksiyon versiyonunu deploy etmek demektir.

---

## Kritik Dosyalar — Implementasyon Referansı

| Dosya | Değişiklik Türü | Açıklama |
|:------|:----------------|:---------|
| `client/electron/main.js` | MODIFY | Photo selector pencere oluşturma, IPC kayıt, ALLOWED_BASE_PATHS |
| `client/electron/photoSelector.js` | YENİ | IPC handler'lar, pencere yönetimi |
| `client/electron/preload.js` | MODIFY | `photoSelector` namespace ekleme |
| `client/vite.config.js` | MODIFY | `rollupOptions.input` multi-entry |
| `client/photo-selector.html` | YENİ | İkinci HTML entry point |
| `client/src/photo-selector/` | YENİ | Tüm photo selector kaynak kodu (16+ dosya) |
| `firebase/functions/src/archives.js` | MODIFY | `ALLOWED_ARCHIVE_FIELDS` genişletme |
| `firebase/functions/src/options.js` | MODIFY | `ALLOWED_FIELDS_BY_TYPE.shootTypes`'a `category` ekleme |
| `firebase/functions/src/schools.js` | YENİ | Okullar CRUD |
| `firebase/functions/src/priceLists.js` | YENİ | Fiyat listesi CRUD |
| `firebase/functions/src/index.js` | MODIFY | Yeni modül export'ları |
| `firebase/functions/src/validators/schemas.js` | MODIFY | Yeni Zod şemaları |
| `firebase/firestore.rules` | MODIFY | schools, priceLists güvenlik kuralları |
| `client/src/pages/Archives.jsx` | MODIFY | "Fotoğraf Seçim" butonu, sonuç gösterimi |
| `client/src/pages/Settings.jsx` | MODIFY | Okullar yönetimi, Fiyat Listesi sekmesi |
| `client/src/services/api.js` | MODIFY | schoolsApi, priceListApi servisleri |
| `client/package.json` | MODIFY | sharp, ini, react-virtuoso, @electron/rebuild |
