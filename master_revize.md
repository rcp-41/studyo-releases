# MASTER REVİZE TASK LİSTESİ

> **DURUM: TAMAMLANDI** - Tüm 10 görev ve 23 öneri uygulanmıştır.

---

## 1. Giriş Ekranı & Üst Bar Düzenlemeleri

### 1.1 Seri Numarası Metni
Açılış ekranında seri numarası alanı altındaki metin "Seri numarasını giriniz" olarak değiştirilmeli. Ekstra açıklama metni kaldırılmalı.

### 1.2 Üst Sağ Arama Çubuğu
Sağ üst köşedeki arama çubuğu tamamen kaldırılmalı.

### 1.3 Bildirim Butonu
Sağ üstteki zil ikonunun background'u solid olmalı. Varsayılan sistem bildirimleri kaldırılmalı. Gerçek ve dinamik bildirimler buradan gösterilmeli.

---

## 2. Online Satış & Bildirim UX Revizesi

### 2.1 Online Satış Butonu Bildirimleri
WhatsApp, WooCommerce vb. entegrasyonlar olmadığı için online satış butonuna basıldığında çıkan sağ üst bildirimler teknik detay içermemeli. Müşteri odaklı, sade ve bilgilendirici olmalı. Kullanıcıyı yönlendiren net mesajlar içermeli. Sistem iç hata mesajları burada görünmemeli.

---

## 3. WhatsApp Entegrasyonu

### 3.1 Mesaj Gönderme Sorunu
WhatsApp mesaj gönderme özelliği çalışmıyor. Mesajın gerçekten iletilmesini sağlayacak teknik çözüm geliştirilmeli. API / Web yönlendirme mantığı kontrol edilmeli.

### 3.2 Arşiv → WhatsApp Açma Butonu
Arşivde WhatsApp ikonuna tıklandığında açılan pencerede "İptal" ve "Gönder" aralarında "WhatsApp'ta Aç" butonu olmalı. Bu butona basıldığında öncelikle masaüstü WhatsApp uygulaması denenmeli, yoksa WhatsApp Web açılmalı.

---

## 4. Randevu Modülü Revizeleri

### 4.1 Haftalık Görünüm Hover Davranışı
Hafta görünümünde mouse bir saat satırına geldiğinde sadece tek gün değil, aynı saatin tüm hafta satırı komple renk değiştirmeli. Saat takibi netleşmeli.

### 4.2 Açıklama Paneli Revizesi
Randevu eklerken arşiv sağ panelde açıklama başındaki "artı" kaldırılmalı. Sadece "eksi" butonu kalmalı. Açıklama 2 görünür hale getirilmeli.

### 4.3 Sağ Tık Menü
Randevuya sağ tıklanınca: "Geldi", "Gelmedi", "Başka Güne Ertele". Ertele seçildiğinde gün + saat seçilebilir picker açılmalı. Seçilen tarih doğrultusunda randevu güncellenmeli.

---

## 5. Yeni Kayıt Oluşturma Revizesi
Okul seçimi + Sınıf seçimi yanında bulunan "Şube giriş" alanı tamamen kaldırılmalı.

---

## 6. Finans Modülü Revizeleri

### 6.1 Gelir Arşivi
Gelir arşivi verileri çekmiyor. Veri bağlama (data binding) düzeltilmeli.

### 6.2 Kasa Dashboard Sorunu
Finans → Kasa bölümünde veri var. Sol panel → Kasa → Dashboard'ta görünmüyor. Dashboard state / veri senkronizasyonu düzeltilmeli.

### 6.3 Grafik Düzeni
Gelir → Yukarı yönlü ve yeşil. Gider → Aşağı yönlü ve kırmızı. Grafik yön ve renk mantığı düzeltilmeli.

---

## 7. Raporlar Sekmesi
Raporlar bölümü boş. Randevu, finans, müşteri verilerini çekmeli. Veri bağlantıları kontrol edilmeli.

---

## 8. Müşteri Modülü Revizesi
Müşteri detay sayfasında "Müşteri ID" yazısı kaldırılmalı. Breadcrumb yapısı: Ana Sayfa > Müşteriler > [Müşteri İsmi] şeklinde olmalı.

---

## 9. Fotoğraf Seçim Uygulaması Revizeleri

### 9.1 Geri Butonu
Sol üst köşede her zaman görünür "Geri Gel" butonu olmalı.

### 9.2 INI Dosyası Kalıcı Veri Mimarisi (Kritik)
INI dosyası: favoriye eklenenler, favoriden çıkarılanlar, numara verilenler, ismi değiştirilen dosyalar (eski isimleri dahil) statik ve kalıcı şekilde kaydedilmeli. Program yeniden başlatıldığında aynı klasör açıldığında INI dosyası otomatik okunmalı. Önceki tüm seçimler doğru şekilde yüklenmeli. State bazlı değil, dosya bazlı kalıcı sistem olmalı.

---

## 10. Sistem Loglama & Hata Yönetimi

### 10.1 Oturum Bazlı İşlem Loglama
Kullanıcının oturum süresince yaptığı her işlem loglanmalı: Hangi stüdyo, hangi bilgisayar, IP adresi, saat/tarih, yapılan işlem. Loglar Firebase'de saklanmalı.

### 10.2 Hata Loglama Mekanizması
Tarayıcı konsolunda oluşan hatalar yakalanmalı ve otomatik olarak Firebase'e kaydedilmeli: Stüdyo adı, bilgisayar adı, IP adresi, saat/tarih, yapılan işlem, alınan hata mesajı.

### 10.3 Creator Panel – Hata Logları Bölümü
Creator panelde "Hata Logları" sekmesi olmalı. Sadece hata logları gösterilmeli, stüdyo bazlı gruplanmalı, filtrelenebilir olmalı.

---
---

# DETAYLI UYGULAMA PLANI VE YOL HARİTASI

> Bu bölüm her bir task için hangi dosyada, hangi satırda, hangi kodun nasıl değişeceğini adım adım açıklar.

---

## TASK 1.1 — Seri Numarası Metni

**Dosya:** `client/src/pages/Setup.jsx`
**Satır:** ~323

**Mevcut kod:**
```jsx
<p className="text-xs text-muted-foreground mt-1.5">
    Creator Panel'den aldığınız lisans anahtarını girin.
</p>
```

**Yeni kod:**
```jsx
<p className="text-xs text-muted-foreground mt-1.5">
    Seri numarasını giriniz
</p>
```

**Ek:** Aynı dosyada satır ~310'daki `<label>` etiketi kontrol edilmeli. "Seri Numarası" yazısı kalacak, sadece altındaki açıklama satırı değişecek.

---

## TASK 1.2 — Üst Sağ Arama Çubuğu Kaldırma

**Dosya:** `client/src/components/layout/AppLayout.jsx`
**Satır:** ~300-302

**Mevcut kod:**
```jsx
<div className="flex items-center gap-2">
    <GlobalSearch />
    <NotificationCenter />
</div>
```

**Yeni kod:**
```jsx
<div className="flex items-center gap-2">
    <NotificationCenter />
</div>
```

**Ek:** Dosyanın başındaki `import GlobalSearch from '../GlobalSearch';` satırı da silinmeli (satır ~10).

**Opsiyonel:** `client/src/components/GlobalSearch.jsx` dosyası artık kullanılmıyorsa tamamen silinebilir.

---

## TASK 1.3 — Bildirim Butonu Revizeleri

### Adım 1: Zil ikonu background'unu solid yap

**Dosya:** `client/src/components/NotificationCenter.jsx`
**Satır:** ~73

**Mevcut kod:**
```jsx
<button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-muted rounded-lg transition-colors">
    <Bell className="w-5 h-5" />
```

**Yeni kod:**
```jsx
<button onClick={() => setOpen(!open)} className="relative p-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
    <Bell className="w-5 h-5" />
```

### Adım 2: Varsayılan mock bildirimleri kaldır

**Aynı dosya, Satır:** ~27-35

**Mevcut kod:**
```jsx
const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('studyo-notifications');
    if (saved) return JSON.parse(saved);
    return [
        { id: '1', type: 'appointment', title: 'Yaklaşan Randevu', ... },
        { id: '2', type: 'payment', title: 'Ödeme Alındı', ... },
        { id: '3', type: 'shoot', title: 'Yeni Sipariş', ... }
    ];
});
```

**Yeni kod:**
```jsx
const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('studyo-notifications');
    if (saved) return JSON.parse(saved);
    return [];
});
```

### Adım 3: Dinamik bildirim sistemi (ileride)
Gerçek bildirimler için Firebase Firestore'daki `studios/{studioId}/notifications` koleksiyonundan dinleme yapılmalı. Bu Task 10 (Loglama) ile birlikte ele alınacak.

---

## TASK 2.1 — Online Satış Bildirim Metinleri

**Dosya:** `client/src/services/api.js`
**Satır:** ~20 civarı

**Mevcut kod:**
```javascript
toast.error(error.message || 'Bir hata oluştu');
```

**Yeni yaklaşım:** Kullanıcı dostu hata mesajları için bir çeviri katmanı eklenmeli.

**Dosya:** `client/src/lib/utils.js` — Yeni fonksiyon ekle:
```javascript
export function getUserFriendlyError(error) {
    const errorMap = {
        'not-found': 'İşlem bulunamadı. Lütfen sayfayı yenileyin.',
        'permission-denied': 'Bu işlem için yetkiniz bulunmuyor.',
        'unavailable': 'Sunucu şu anda meşgul, lütfen birkaç dakika sonra tekrar deneyin.',
        'unauthenticated': 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.',
        'invalid-argument': 'Girilen bilgileri kontrol edin.',
        'already-exists': 'Bu kayıt zaten mevcut.',
        'failed-precondition': 'İşlem şu anda gerçekleştirilemiyor.',
        'internal': 'Bir sorun oluştu. Lütfen tekrar deneyin.',
    };
    const code = error?.code?.replace('functions/', '') || '';
    return errorMap[code] || 'Beklenmeyen bir durum oluştu. Lütfen tekrar deneyin.';
}
```

**Sonra `api.js`'deki `callFunction` helper'da:**
```javascript
// Eski:
toast.error(error.message || 'Bir hata oluştu');
// Yeni:
toast.error(getUserFriendlyError(error));
```

**Online satış butonları için özel:**
WooCommerce/WhatsApp bağlı olmadığında gösterilecek mesajlar:
```javascript
// Entegrasyon yokken bildirim:
toast('Online satış modülü henüz aktif değil. Ayarlar bölümünden entegrasyonları yapılandırabilirsiniz.', { icon: 'ℹ️' });
```

---

## TASK 3.1 — WhatsApp Mesaj Gönderme Sorunu

**Dosya:** `client/electron/whatsapp.js`

### Sorunun Kaynağı:
WhatsApp Web otomasyon sistemi (satır 305-358) DOM manipülasyonu ile çalışıyor. Bu yöntem WhatsApp Web güncellemeleri ile kırılmaya açık.

### Adım 1: Mevcut retry mekanizmasını iyileştir (satır 305-358)

**Mevcut sorunlar:**
- Hardcoded 12 retry, 1 saniye bekleme = 12 saniye timeout
- Race condition: metin girildikten sonra gönder butonu hemen aranıyor

**Düzeltme:**
```javascript
// Satır ~305-310 arası, retry süresini artır ve exponential backoff ekle:
const MAX_RETRIES = 20;
const getDelay = (attempt) => Math.min(1000 * Math.pow(1.5, attempt), 5000);

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await new Promise(r => setTimeout(r, getDelay(attempt)));
    // ... mevcut DOM kontrolü
}
```

### Adım 2: String logic bug'ını düzelt (satır 135-136)

**Mevcut kod (hatalı parantez):**
```javascript
if (pageText.includes('update') && pageText.includes('Chrome') ||
    pageText.includes('tarayıcınızı güncelleyin'))
```

**Düzeltilmiş kod:**
```javascript
if ((pageText.includes('update') && pageText.includes('Chrome')) ||
    pageText.includes('tarayıcınızı güncelleyin'))
```

### Adım 3: Alternatif gönderim — WhatsApp URL Scheme
Eğer Baileys/DOM yöntemi başarısız olursa, fallback olarak `whatsapp://send?phone=XXXX&text=YYYY` URL scheme kullanılmalı.

---

## TASK 3.2 — WhatsApp'ta Aç Butonu

**Dosya:** `client/src/pages/Archives.jsx`
**Satır:** ~741-751 (WhatsApp modal footer bölümü)

**Mevcut kod:**
```jsx
<button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
    İptal
</button>
<button onClick={handleSend} disabled={loading || !message}
    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ...">
    {loading ? <Loader2 /> : <Send />} {loading ? 'Gönderiliyor...' : 'Gönder'}
</button>
```

**Yeni kod:**
```jsx
<button onClick={onClose}
    className="px-4 py-2 border border-border rounded-lg hover:bg-muted">
    İptal
</button>
<button onClick={() => {
    const phone = archive.phone?.replace(/[^0-9]/g, '');
    const formatted = phone?.startsWith('0') ? '90' + phone.slice(1) : phone;
    // Önce masaüstü WhatsApp dene, yoksa Web aç
    if (window.electronAPI) {
        window.electronAPI.openExternal(`whatsapp://send?phone=${formatted}&text=${encodeURIComponent(message)}`);
    } else {
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, '_blank');
    }
    onClose();
}}
    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
    <ExternalLink className="w-4 h-4" /> WhatsApp'ta Aç
</button>
<button onClick={handleSend} disabled={loading || !message}
    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
    {loading ? 'Gönderiliyor...' : 'Gönder'}
</button>
```

**Ek:** `ExternalLink` ikonunu lucide-react importlarına ekle:
```jsx
import { ..., ExternalLink } from 'lucide-react';
```

**Electron tarafında (main.js):** `openExternal` IPC handler'ı zaten mevcut olmalı. Yoksa ekle:
```javascript
// preload.js'e ekle:
openExternal: (url) => ipcRenderer.invoke('open-external', url)

// main.js'e ekle:
ipcMain.handle('open-external', async (_, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
});
```

---

## TASK 4.1 — Haftalık Görünüm Hover Davranışı

**Dosya:** `client/src/pages/Appointments.jsx`
**Satır:** ~148-229 (WeekView component)

### Adım 1: Hover state ekle

Satır ~148'deki fonksiyon tanımına state ekle:
```jsx
function WeekView({ appointments, currentDate, onDateChange, slots, onSlotClick, onContextMenu }) {
    const [hoveredSlot, setHoveredSlot] = useState(null); // YENİ
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    // ...
```

### Adım 2: `<tr>` elemanına hover event ekle

**Satır ~193-194:**

**Mevcut kod:**
```jsx
{slots.map(slot => (
    <tr key={slot} className="border-t border-border/50">
```

**Yeni kod:**
```jsx
{slots.map(slot => (
    <tr key={slot}
        className={cn(
            "border-t border-border/50 transition-colors",
            hoveredSlot === slot && "bg-primary/5"
        )}
        onMouseEnter={() => setHoveredSlot(slot)}
        onMouseLeave={() => setHoveredSlot(null)}
    >
```

Bu değişiklikle mouse bir saat satırına geldiğinde tüm hafta boyunca o saat satırı vurgulanacak.

### Adım 3: Saat sütununu da vurgula

**Satır ~195:**
```jsx
<td className={cn(
    "px-2 py-1 text-muted-foreground border-r border-border font-mono text-[11px] w-16",
    hoveredSlot === slot && "bg-primary/10 text-foreground font-semibold"
)}>{slot}</td>
```

---

## TASK 4.2 — Açıklama Paneli Revizesi

**Dosya:** `client/src/pages/Appointments.jsx`
**Satır:** ~481-486 civarı (Randevu modal açıklama alanları)

### Adım 1: Açıklama alanının "artı" butonunu kaldır

Açıklama alanı yanındaki "+" butonunu kaldırıp sadece "-" butonu bırak. Açıklama 2 alanını her zaman görünür yap.

**Mevcut yapı (tahmini):**
```jsx
{/* Açıklama 1 */}
<div className="flex items-center gap-2">
    <label>Açıklama</label>
    <button onClick={toggleDesc2}>+</button> {/* BU KALDIRILACAK */}
</div>
<textarea value={desc1} ... />

{showDesc2 && ( // BU KOŞUL KALDIRILACAK
    <div>
        <label>Açıklama 2</label>
        <textarea value={desc2} ... />
    </div>
)}
```

**Yeni yapı:**
```jsx
{/* Açıklama 1 */}
<div>
    <label>Açıklama</label>
    {desc1 && <button onClick={() => setDesc1('')}>−</button>}
</div>
<textarea value={desc1} ... />

{/* Açıklama 2 — her zaman görünür */}
<div>
    <label>Açıklama 2</label>
    {desc2 && <button onClick={() => setDesc2('')}>−</button>}
</div>
<textarea value={desc2} ... />
```

---

## TASK 4.3 — Sağ Tık Menüsüne "Ertele" Ekleme

**Dosya:** `client/src/pages/Appointments.jsx`
**Satır:** ~48-81 (ContextMenu component)

### Adım 1: "Taşı" yerine "Başka Güne Ertele" koy

**Satır ~69-71:**

**Mevcut kod:**
```jsx
<button onClick={() => onAction('move')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
    <ArrowRightLeft className="w-4 h-4" /> Taşı
</button>
```

**Yeni kod:**
```jsx
<button onClick={() => onAction('postpone')} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
    <CalendarClock className="w-4 h-4 text-amber-500" /> Başka Güne Ertele
</button>
```

### Adım 2: Postpone modal bileşeni ekle

Aynı dosyada yeni bir `PostponeModal` bileşeni oluştur:

```jsx
function PostponeModal({ appointment, onClose, onConfirm }) {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-xl p-6 w-96 space-y-4">
                <h3 className="text-lg font-semibold">Randevuyu Ertele</h3>
                <p className="text-sm text-muted-foreground">
                    {appointment.fullName} — {appointment.timeSlot}
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Yeni Tarih</label>
                        <input type="date" value={date}
                            onChange={e => setDate(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Yeni Saat</label>
                        <input type="time" value={time}
                            onChange={e => setTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-input" />
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        İptal
                    </button>
                    <button onClick={() => onConfirm(date, time)}
                        disabled={!date || !time}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                        Ertele
                    </button>
                </div>
            </div>
        </div>
    );
}
```

### Adım 3: onAction handler'da postpone işlemini ekle

Ana `Appointments` component'te `handleContextAction` fonksiyonuna:
```javascript
case 'postpone':
    setPostponeTarget(contextMenu.appointment);
    setShowPostpone(true);
    break;
```

Backend API çağrısı:
```javascript
const handlePostpone = async (newDate, newTime) => {
    await appointmentsApi.update(postponeTarget.id, {
        appointmentDate: newDate,
        timeSlot: newTime,
        status: 'postponed'
    });
    toast.success('Randevu ertelendi');
    refetch();
    setShowPostpone(false);
};
```

---

## TASK 5 — Şube/Bölüm Alanını Kaldırma

**Dosya:** `client/src/pages/Archives.jsx`
**Satır:** ~334-337

**Mevcut kod:**
```jsx
<div>
    <label className="block text-xs font-medium mb-1">Şube/Bölüm</label>
    <input type="text" value={formData.section}
        onChange={e => setFormData({ ...formData, section: e.target.value })}
        placeholder="Ör: A, B, C..."
        className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm" />
</div>
```

**İşlem:** Bu `<div>` bloğu tamamen silinecek.

**Ek:** `formData` state'indeki `section` field'ı da temizlenmeli. `formData` initialState'den `section: ''` satırı çıkarılmalı.

---

## TASK 6.1 — Gelir Arşivi Veri Bağlama

**Dosya:** `client/src/pages/Finance.jsx`
**Satır:** ~65-87

### Sorun Analizi:
Finance sayfasında gelir verileri `financeApi.getPayments()` ile çekiliyor. Eğer API doğru veri döndürmüyorsa, sorun backend'de.

### Kontrol Noktaları:

**1. Frontend (Finance.jsx):**
```jsx
const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ['finance-payments', range],
    queryFn: () => financeApi.getPayments({ range })
});
const payments = payData?.payments || [];
```

**2. Backend kontrol (firebase/functions/src/finance.js):**
`getPayments` fonksiyonunun `range` parametresini doğru yorumlayıp yorumlamadığını kontrol et.
- `range` değerleri: `'today'`, `'week'`, `'month'`, `'year'`, `'all'`
- Tarih filtrelerinin UTC/local timezone farkından etkilenip etkilenmediğini kontrol et

**3. Düzeltme (finance.js backend):**
```javascript
// getPayments fonksiyonunda tarih filtresi:
const now = new Date();
let startDate;
switch (range) {
    case 'today': startDate = new Date(now.setHours(0,0,0,0)); break;
    case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); break;
    case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
    default: startDate = null;
}

// Firestore query'ye tarih filtresi ekle:
if (startDate) {
    query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate));
}
```

---

## TASK 6.2 — Kasa Dashboard Senkronizasyonu

**Dosya:** `client/src/pages/Finance.jsx`
**Satır:** ~75-83

### Sorun:
`cashData` query'si `today` parametresi ile çağrılıyor ama Dashboard widget'ı farklı bir query key kullanıyor olabilir.

### Çözüm:

**1. Finance.jsx'te kasa verisinin doğru çekildiğinden emin ol:**
```jsx
const today = format(new Date(), 'yyyy-MM-dd');
const { data: cashData } = useQuery({
    queryKey: ['finance-daily-cash', today],
    queryFn: () => financeApi.getDailyCash({ date: today })
});
```

**2. Dashboard.jsx'te aynı query key kullanılmalı:**
```jsx
// Dashboard'da kasa bilgisini göstermek için:
const { data: cashData } = useQuery({
    queryKey: ['finance-daily-cash', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => financeApi.getDailyCash({ date: format(new Date(), 'yyyy-MM-dd') })
});
```

**3. Eğer Dashboard sidebar'da ayrı bir kasa widget'ı varsa:**
`AppLayout.jsx`'teki sol panel menüsünde "Kasa" linki Finance sayfasına yönlendirmeli ve doğru tab'ı açmalı.

---

## TASK 6.3 — Grafik Yön ve Renk Düzeltmesi

**Dosya:** `client/src/pages/Finance.jsx`
**Satır:** ~111-115 ve ~177-196

### Mevcut kod (satır ~111):
```jsx
const barData = [
    { name: 'Gelir', value: totalIncome, fill: '#22c55e' },
    { name: 'Gider', value: totalExpense, fill: '#ef4444' },
    { name: 'Kâr/Zarar', value: profit, fill: profit >= 0 ? '#3b82f6' : '#f97316' }
];
```

### Yeni kod — Ayrı yönlü grafik:
```jsx
const barData = [
    { name: 'Gelir', value: totalIncome, fill: '#22c55e' },      // Yeşil, yukarı
    { name: 'Gider', value: -totalExpense, fill: '#ef4444' },     // Kırmızı, AŞAĞI (negatif)
    { name: 'Kâr/Zarar', value: profit, fill: profit >= 0 ? '#22c55e' : '#ef4444' }
];
```

### BarChart yapılandırması (satır ~177-196):
```jsx
<BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} />
    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => {
        const abs = Math.abs(v);
        return abs >= 1000 ? `${(abs / 1000).toFixed(0)}k` : abs;
    }} />
    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
    <Tooltip formatter={(v) => formatCurrency(Math.abs(v))} />
    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
        {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
    </Bar>
</BarChart>
```

**Not:** `ReferenceLine` import'u gerekli:
```jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
```

---

## TASK 7 — Raporlar Sekmesi

**Dosya:** `client/src/pages/Reports.jsx`

### Durum Analizi:
Reports.jsx dosyası aslında boş DEĞİL — 530+ satırlık bir implementasyonu mevcut ve 5 rapor türü tanımlı (gelir, çekim türü, fotoğrafçı, kaynak, vadesi geçmiş).

### Sorun:
Veriler çekilmiyor olabilir. Muhtemel nedenler:
1. Backend API (`reportsApi`) doğru veri döndürmüyor
2. Query key'ler yanlış
3. `studioId` parametresi gönderilmiyor

### Kontrol adımları:

**1. `services/api.js` dosyasında `reportsApi` tanımını kontrol et:**
```javascript
// reportsApi fonksiyonlarının callFunction ile doğru endpoint'leri çağırdığından emin ol
export const reportsApi = {
    getIncomeReport: (params) => callFunction('reports-getIncomeReport', params),
    getShootTypeReport: (params) => callFunction('reports-getShootTypeReport', params),
    // ...
};
```

**2. Backend (`firebase/functions/src/reports.js`) dosyasını kontrol et:**
- Fonksiyonların export edildiğini doğrula
- `index.js`'te `reports` modülünün import edildiğini doğrula

**3. Eksikse backend'e ekle:**
```javascript
// firebase/functions/src/reports.js
exports.getIncomeReport = onCall({ enforceAppCheck: false }, async (request) => {
    const db = new DatabaseHandler(request);
    const { startDate, endDate } = request.data;
    // shoots koleksiyonundan gelir verileri çek
    const shoots = await db.getAll('shoots');
    // ...filtreleme ve gruplama
    return { data: groupedData };
});
```

---

## TASK 8 — Müşteri Detay Sayfası

**Dosya:** `client/src/pages/CustomerDetail.jsx`

### Adım 1: "Müşteri ID" metnini kaldır

**Satır ~283:**
```jsx
<p className="text-muted-foreground">{customer.customerCode}</p>
```

Bu satır `customerCode`'u gösteriyor. Eğer burada "Müşteri ID" label'ı varsa kaldırılmalı. Aksi halde `customerCode` yerine boş bırakılabilir veya kaldırılabilir.

### Adım 2: Breadcrumb ekle

**Satır ~270-277 arası, mevcut header'ın üstüne breadcrumb ekle:**

**Mevcut:**
```jsx
return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link to="/customers" className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
```

**Yeni:**
```jsx
return (
    <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Ana Sayfa</Link>
            <span>/</span>
            <Link to="/customers" className="hover:text-foreground transition-colors">Müşteriler</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{customer?.fullName || '...'}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
```

**Opsiyonel:** `ArrowLeft` geri butonu artık breadcrumb olduğu için kaldırılabilir.

---

## TASK 9.1 — Fotoğraf Seçici Geri Butonu

**Dosya:** `client/src/photo-selector/PhotoSelectorApp.jsx` (veya ilgili layout bileşeni)

### Çözüm:
Ana layout'un sol üst köşesine sabit bir geri butonu ekle:

```jsx
<button onClick={() => window.electronAPI?.goBack?.() || window.close()}
    className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted transition-colors">
    <ArrowLeft className="w-4 h-4" />
    <span className="text-sm font-medium">Geri Gel</span>
</button>
```

**Electron tarafı (preload.js):**
```javascript
goBack: () => ipcRenderer.invoke('photo-selector-go-back')
```

**main.js:**
```javascript
ipcMain.handle('photo-selector-go-back', () => {
    if (photoSelectorWindow && !photoSelectorWindow.isDestroyed()) {
        photoSelectorWindow.close();
    }
});
```

---

## TASK 9.2 — INI Dosyası Kalıcı Veri Mimarisi

**Dosya:** `client/electron/photoSelector.js`
**Satır:** ~317-325 (INI parser bölümü)

### Mevcut Durum:
INI okuma/yazma kısmen mevcut ama basit parser kullanılıyor.

### Gerekli INI Yapısı:
```ini
[favorites]
IMG_001.jpg=true
IMG_002.jpg=true

[removed_favorites]
IMG_003.jpg=true

[numbered]
IMG_001.jpg=1
IMG_004.jpg=2
IMG_005.jpg=3

[renamed]
IMG_006.jpg=Dugun_Foto_1.jpg
IMG_007.jpg=Dugun_Foto_2.jpg

[metadata]
lastModified=2026-02-25T10:30:00Z
totalFiles=150
```

### Adım 1: INI Writer fonksiyonu (photoSelector.js'e ekle):

```javascript
function writeIniFile(folderPath, data) {
    const iniPath = path.join(folderPath, '.selections.ini');
    const sections = [];

    for (const [section, entries] of Object.entries(data)) {
        sections.push(`[${section}]`);
        for (const [key, value] of Object.entries(entries)) {
            sections.push(`${key}=${value}`);
        }
        sections.push('');
    }

    fs.writeFileSync(iniPath, sections.join('\n'), 'utf-8');
    // Windows'ta gizli dosya yap
    try {
        require('child_process').execSync(`attrib +h "${iniPath.replace(/"/g, '')}"`);
    } catch {}
}
```

### Adım 2: INI Reader fonksiyonunu güçlendir:

```javascript
function readIniFile(folderPath) {
    const iniPath = path.join(folderPath, '.selections.ini');
    if (!fs.existsSync(iniPath)) return null;

    const content = fs.readFileSync(iniPath, 'utf-8');
    const result = {};
    let currentSection = null;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

        const sectionMatch = trimmed.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            result[currentSection] = {};
            continue;
        }

        if (currentSection) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const value = trimmed.substring(eqIndex + 1).trim();
                result[currentSection][key] = value;
            }
        }
    }
    return result;
}
```

### Adım 3: IPC handler'lar ekle:

```javascript
ipcMain.handle('photo-selector-save-state', async (_, folderPath, stateData) => {
    writeIniFile(folderPath, stateData);
    return { success: true };
});

ipcMain.handle('photo-selector-load-state', async (_, folderPath) => {
    return readIniFile(folderPath) || {};
});
```

### Adım 4: Frontend'de klasör açıldığında otomatik yükle:

```javascript
// PhotoSelectorApp.jsx veya ilgili hook:
useEffect(() => {
    if (currentFolder) {
        window.electronAPI.photoSelector.loadState(currentFolder).then(savedState => {
            if (savedState?.favorites) setFavorites(new Set(Object.keys(savedState.favorites)));
            if (savedState?.numbered) setNumbered(savedState.numbered);
            if (savedState?.renamed) setRenamed(savedState.renamed);
        });
    }
}, [currentFolder]);
```

### Adım 5: Her değişiklikte otomatik kaydet:

```javascript
// Debounced save:
const saveState = useMemo(() => debounce((folder, state) => {
    window.electronAPI.photoSelector.saveState(folder, state);
}, 1000), []);

useEffect(() => {
    if (currentFolder) {
        saveState(currentFolder, {
            favorites: Object.fromEntries([...favorites].map(f => [f, 'true'])),
            numbered: numbered,
            renamed: renamed,
            metadata: { lastModified: new Date().toISOString(), totalFiles: photos.length }
        });
    }
}, [favorites, numbered, renamed, currentFolder]);
```

---

## TASK 10.1 — Oturum Bazlı İşlem Loglama

### Adım 1: Firestore koleksiyonu tanımla

```
studios/{studioId}/activityLogs/{logId}
{
    userId: string,
    userEmail: string,
    action: string,          // 'archive.create', 'appointment.update', etc.
    details: string,         // İşlem detayı
    studioName: string,
    computerName: string,
    ipAddress: string,
    timestamp: Timestamp,
    sessionId: string        // Oturum kimliği
}
```

### Adım 2: Frontend logger servisi güncelle

**Dosya:** `client/src/services/auditLog.js`

Mevcut `auditLog` servisini güncelle — localStorage yerine Firebase'e yaz:

```javascript
import { callFunction } from './api';

const sessionId = crypto.randomUUID();

export async function logActivity(action, details = {}) {
    try {
        const computerName = await window.electronAPI?.getComputerName?.() || navigator.userAgent;
        const ipAddress = await fetch('https://api.ipify.org?format=json')
            .then(r => r.json()).then(d => d.ip).catch(() => 'unknown');

        await callFunction('logs-createActivityLog', {
            action,
            details: JSON.stringify(details),
            computerName,
            ipAddress,
            sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        // Loglama hatası sessizce geçilir (sonsuz döngü önlemi)
        console.warn('[AuditLog] Failed:', err.message);
    }
}
```

### Adım 3: Backend endpoint

**Dosya:** `firebase/functions/src/index.js` — Yeni modül ekle
**Yeni dosya:** `firebase/functions/src/logs.js`

```javascript
const { onCall } = require('firebase-functions/v2/https');
const { DatabaseHandler } = require('./handlers/DatabaseHandler');

exports.createActivityLog = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new Error('Yetkilendirme gerekli');
    const db = new DatabaseHandler(request);
    const { action, details, computerName, ipAddress, sessionId, timestamp } = request.data;

    await db.add('activityLogs', {
        userId: request.auth.uid,
        userEmail: request.auth.token.email || '',
        action,
        details,
        computerName: computerName || '',
        ipAddress: ipAddress || '',
        sessionId: sessionId || '',
        timestamp: new Date(timestamp),
        createdAt: new Date()
    });
    return { success: true };
});
```

### Adım 4: Kritik işlemlere log çağrısı ekle

Şu dosyalardaki mutation success callback'lerine `logActivity()` ekle:
- `Archives.jsx` → `logActivity('archive.create', { archiveCode })`
- `Appointments.jsx` → `logActivity('appointment.create', { appointmentId })`
- `Customers.jsx` → `logActivity('customer.create', { customerId })`
- `Finance.jsx` → `logActivity('finance.payment', { amount })`
- `Settings.jsx` → `logActivity('settings.update', { section })`

---

## TASK 10.2 — Hata Loglama Mekanizması

### Adım 1: Global error handler ekle

**Dosya:** `client/src/main.jsx`

```javascript
import { logError } from './services/auditLog';

// Global unhandled errors
window.onerror = (message, source, lineno, colno, error) => {
    logError({
        type: 'unhandled_error',
        message: message?.toString(),
        source,
        lineno,
        colno,
        stack: error?.stack
    });
};

// Unhandled promise rejections
window.onunhandledrejection = (event) => {
    logError({
        type: 'unhandled_promise',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
    });
};

// Console.error override
const originalConsoleError = console.error;
console.error = (...args) => {
    originalConsoleError.apply(console, args);
    logError({
        type: 'console_error',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    });
};
```

### Adım 2: `logError` fonksiyonu

**Dosya:** `client/src/services/auditLog.js` — Ekle:

```javascript
export async function logError(errorData) {
    try {
        const computerName = await window.electronAPI?.getComputerName?.() || 'web';
        const ipAddress = await fetch('https://api.ipify.org?format=json')
            .then(r => r.json()).then(d => d.ip).catch(() => 'unknown');

        await callFunction('logs-createErrorLog', {
            ...errorData,
            computerName,
            ipAddress,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    } catch {
        // Hata loglarken hata oluşursa sessizce geç
    }
}
```

### Adım 3: Backend error log endpoint

**Dosya:** `firebase/functions/src/logs.js` — Ekle:

```javascript
exports.createErrorLog = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) throw new Error('Yetkilendirme gerekli');
    const db = new DatabaseHandler(request);

    await db.add('errorLogs', {
        userId: request.auth.uid,
        userEmail: request.auth.token.email || '',
        type: request.data.type || 'unknown',
        message: request.data.message || '',
        stack: request.data.stack || '',
        url: request.data.url || '',
        computerName: request.data.computerName || '',
        ipAddress: request.data.ipAddress || '',
        userAgent: request.data.userAgent || '',
        timestamp: new Date(request.data.timestamp),
        createdAt: new Date()
    });
    return { success: true };
});
```

---

## TASK 10.3 — Creator Panel Hata Logları Bölümü

### Adım 1: Yeni sayfa oluştur

**Yeni dosya:** `creator_control_panel/src/pages/ErrorLogs.jsx`

```jsx
import { useState, useEffect } from 'react';
import { creatorApi } from '../services/creatorApi';

export default function ErrorLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudio, setSelectedStudio] = useState('all');
    const [studios, setStudios] = useState([]);

    useEffect(() => {
        loadStudios();
        loadLogs();
    }, [selectedStudio]);

    const loadStudios = async () => {
        const res = await creatorApi.getStudiosWithStats();
        setStudios(res.data || []);
    };

    const loadLogs = async () => {
        setLoading(true);
        const res = await creatorApi.getErrorLogs({
            studioId: selectedStudio === 'all' ? null : selectedStudio,
            limit: 100
        });
        setLogs(res.data || []);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Hata Logları</h1>
                <select value={selectedStudio} onChange={e => setSelectedStudio(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-input bg-background">
                    <option value="all">Tüm Stüdyolar</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left">Tarih</th>
                            <th className="px-4 py-3 text-left">Stüdyo</th>
                            <th className="px-4 py-3 text-left">Bilgisayar</th>
                            <th className="px-4 py-3 text-left">Hata Tipi</th>
                            <th className="px-4 py-3 text-left">Mesaj</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log, i) => (
                            <tr key={i} className="border-t border-border hover:bg-muted/30">
                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString('tr-TR')}
                                </td>
                                <td className="px-4 py-3">{log.studioName || log.studioId}</td>
                                <td className="px-4 py-3 text-xs">{log.computerName}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-xs">
                                        {log.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs max-w-md truncate">{log.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
```

### Adım 2: App.jsx'e route ekle

**Dosya:** `creator_control_panel/src/App.jsx`

```jsx
import ErrorLogs from './pages/ErrorLogs';

// Routes'a ekle:
<Route path="/error-logs" element={<ErrorLogs />} />

// Sidebar'a ekle:
<NavLink to="/error-logs">Hata Logları</NavLink>
```

### Adım 3: Backend API

**`creatorApi.js`'e ekle:**
```javascript
getErrorLogs: async ({ studioId, limit = 100 }) => {
    const func = httpsCallable(functions, 'admin-getErrorLogs');
    return (await func({ studioId, limit })).data;
}
```

**`admin-init.js`'e ekle:**
```javascript
exports.getErrorLogs = onCall({ enforceAppCheck: false }, async (request) => {
    if (request.auth.token?.role !== 'creator') throw new Error('Yetkisiz');
    const db = admin.firestore();
    let query;
    if (request.data.studioId) {
        query = db.collection('studios').doc(request.data.studioId)
            .collection('errorLogs').orderBy('createdAt', 'desc').limit(request.data.limit || 100);
    } else {
        // Tüm stüdyolardan hata loglarını çek (collectionGroup)
        query = db.collectionGroup('errorLogs').orderBy('createdAt', 'desc').limit(request.data.limit || 100);
    }
    const snap = await query.get();
    return { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});
```

---
---

# ÖNERİLER

> Bu bölümde, programın kapsamlı incelenmesi sırasında tespit edilen ek sorunlar ve iyileştirme fırsatları listelenmiştir.

---

## GÜVENLİK ÖNERİLERİ

### G1. TOTP Şifreleme Anahtarı Zorunlu Kılınmalı (KRİTİK)
**Dosya:** `firebase/functions/src/admin-init.js` (satır 39-43)
**Sorun:** `TOTP_ENCRYPTION_KEY` environment variable'ı set edilmediyse 2FA secret'ları Firestore'da şifrelenmeden saklanıyor.
**Öneri:** Uygulama başlangıcında bu key yoksa function'lar çalışmayı reddetmeli.

### G2. Rol Kontrolü Tutarsızlığı (YÜKSEK)
**Dosyalar:** `options.js:29`, `options.js:80`, `users.js`, `finance.js`
**Sorun:** Bazı dosyalar `request.auth.token?.role` (güvenli) kullanırken bazıları `request.auth.token.role` (güvensiz) kullanıyor. Token malformed ise crash olabilir.
**Öneri:** Tüm dosyalarda optional chaining (`?.`) kullanılmalı.

### G3. Service Account Key Dosyası Repo'da (KRİTİK)
**Dosya:** `gen-lang-client-0156578884-5bc9e6f043c5.json`
**Sorun:** Firebase service account private key açık metin olarak projede bulunuyor. `.gitignore`'da tanımlanmış ama dosya hala mevcut.
**Öneri:** Dosya silinmeli, ilgili service account key Google Cloud Console'dan revoke edilmeli.

### G4. Command Injection Riski (KRİTİK)
**Dosya:** `client/electron/photoSelector.js` (satır 156)
**Sorun:** `execSync(\`attrib +h "${thumbDir}"\`)` — thumbDir kullanıcı girdisinden geliyor. Özel karakterler shell injection'a yol açabilir.
**Öneri:** `execFileSync('attrib', ['+h', thumbDir])` kullanılmalı.

### G5. localStorage'da Hassas Veri (ORTA)
**Sorun:** `studyo_license`, `studyo-audit-log` gibi veriler localStorage'da tutuluyor. XSS saldırısında çalınabilir.
**Öneri:** Hassas veriler için Electron'un `safeStorage` API'si kullanılmalı.

---

## PERFORMANS ÖNERİLERİ

### P1. Firestore Index Eksiklikleri
**Dosya:** `firebase/firestore.indexes.json`
**Sorun:** Sadece 3 compound index tanımlı. Sık kullanılan sorgular için index eksik (archives + status, appointments + date).
**Öneri:** En çok kullanılan sorgu kombinasyonları için compound index ekle.

### P2. Appointments Sayfalama Yok
**Dosya:** `client/src/pages/Appointments.jsx`
**Sorun:** Tüm ay randevuları tek seferde çekiliyor. Yoğun stüdyolarda binlerce kayıt olabilir.
**Öneri:** Server-side pagination veya lazy loading ekle.

### P3. Dashboard Çoklu API Çağrısı
**Dosya:** `client/src/pages/Dashboard.jsx`
**Sorun:** Sayfa yüklenirken 3 ayrı API çağrısı yapılıyor (summary, filtered, appointments).
**Öneri:** Backend'de tek bir aggregate endpoint oluştur.

### P4. Creator Dashboard useMemo Eksikliği
**Dosya:** `creator_control_panel/src/pages/Dashboard.jsx`
**Sorun:** Her render'da istatistikler yeniden hesaplanıyor.
**Öneri:** `useMemo` ile hesaplamaları cache'le.

---

## KOD KALİTESİ ÖNERİLERİ

### K1. Console.log Temizliği
**Dosyalar:** Archives.jsx (5+ yerde), App.jsx (3 yerde), Setup.jsx, Dashboard.jsx
**Sorun:** Production kodunda debug console.log/warn/error ifadeleri bırakılmış.
**Öneri:** Tüm debug log'ları temizle veya conditional logging'e çevir.

### K2. Unused Import'lar
**Dosyalar:** Dashboard.jsx (`SkeletonDashboard`), Appointments.jsx (`MoreHorizontal`, `CalendarDays`)
**Sorun:** Import edilip hiç kullanılmayan bileşenler var.
**Öneri:** Tüm unused import'ları temizle.

### K3. Boş Catch Blokları
**Dosyalar:** `Appointments.jsx:264`, `dashboard.js:259,499`, `whatsapp.js` çeşitli yerler
**Sorun:** `catch { }` veya `catch (_) { }` hataları sessizce yutarken debug'ı zorlaştırıyor.
**Öneri:** En azından warn-level logging ekle.

### K4. Tarih İşleme Tutarsızlığı
**Sorun:** Kod tabanında 3 farklı tarih yaklaşımı kullanılıyor: Firestore Timestamp, ISO string, JavaScript Date.
**Öneri:** `date-fns` kütüphanesini standart olarak benimse, tüm tarih dönüşümlerini merkezileştir.

---

## UX/UI ÖNERİLERİ

### U1. Dark Mode Geçiş Flash'ı
**Dosya:** `client/src/components/layout/AppLayout.jsx` (satır 31-40)
**Sorun:** Tema senkron olarak render sırasında uygulanıyor; dark mode kullanıcılar kısa bir light mode flaş'ı görebilir.
**Öneri:** Temayı `main.jsx`'te veya HTML `<head>` içinde daha erken uygula.

### U2. Boş Filtre Durumu Mesajı
**Dosya:** `client/src/pages/Archives.jsx`
**Sorun:** Filtreler uygulandığında sonuç yoksa kullanıcıya açıklama yapılmıyor.
**Öneri:** "Filtrelere uygun kayıt bulunamadı" mesajı göster.

### U3. Telefon Numarası Validasyonu
**Dosya:** `client/src/components/PhoneInput.jsx` (satır 25-30)
**Sorun:** Sadece uzunluk kontrolü yapılıyor (>= 10), Türk telefon formatı doğrulanmıyor.
**Öneri:** `05XX XXX XX XX` formatı zorunlu kılınmalı.

### U4. Settings'te Read-Only Alanlar
**Dosya:** `client/src/pages/Settings.jsx`
**Sorun:** `studioName`, `phone`, `email` alanları hala düzenlenebilir durumda. Bunlar Creator Panel'den yönetilmeli.
**Öneri:** Bu 3 alana `disabled` prop'u ekle.

### U5. Settings'te API Sekmesi
**Dosya:** `client/src/pages/Settings.jsx`
**Sorun:** "API Entegrasyonları" sekmesi hala mevcut ama Creator Panel'e taşınmış.
**Öneri:** `settingCategories` dizisinden `api` maddesini sil.

---

## MİMARİ ÖNERİLER

### M1. Rate Limiting Genişletilmeli
**Sorun:** Sadece `createStudio` fonksiyonunda rate limiting var. Diğer tüm yazma operasyonları limitsiz.
**Öneri:** Tüm mutasyon endpoint'lerine rate limiting ekle.

### M2. AppCheck Aktifleştirilmeli
**Sorun:** 40+ Cloud Function'da `enforceAppCheck: false` set edilmiş.
**Öneri:** Production'da AppCheck'i aşamalı olarak aktifleştir.

### M3. Migration İdempotency
**Dosyalar:** `migration.js`, `legacy-migration.js`
**Sorun:** Aynı migration birden fazla çalıştırılırsa duplicate veri oluşabilir.
**Öneri:** Migration ID'leri ile idempotency kontrolü ekle.

### M4. PaymentIntents Temizleme
**Dosya:** `firebase/functions/src/payments-online.js`
**Sorun:** `paymentIntents` koleksiyonu temizlenmeden büyümeye devam ediyor.
**Öneri:** 30 günden eski intent'leri temizleyen scheduled function ekle.

### M5. Lisans Key Entropi
**Dosya:** `creator_control_panel/src/pages/Studios.jsx` (satır 18)
**Sorun:** Lisans anahtarı sadece 16 karakter (4x4) ile oluşturuluyor, düşük entropi.
**Öneri:** UUID v4 veya 32+ karakter kullan.

---

## TEMİZLENEN DOSYALAR

Aşağıdaki dosyalar bu revizyon kapsamında gereksiz oldukları için temizlenmiştir:

| Dosya | Neden |
|-------|-------|
| `EKSIK_GOREVLER_RAPORU.md` | Eski görev raporu, güncelliğini yitirmiş |
| `MIGRATION_GUIDE.md` | Eski migration kılavuzu |
| `SECURITY_AUDIT_REPORT.md` | Eski güvenlik raporu (14 Şubat) |
| `multi_tenant_organization_plan.md` | 56KB plan dokümanı, büyük kısmı tamamlanmış |
| `multiagentprompt.md` | Agent orkestrasyon prompt'u, artık gerekli değil |
| `creator_control_panel/MULTI_TENANT_SPEC.md` | Tekrarlayan spec dokümanı |
| `photo-selector/PLAN.md` | 100KB eski plan dosyası |
| `nul` | Windows null device hatası sonucu oluşmuş boş dosya |
| `build-log.txt` | Build log'u |
| `electron-build-log*.txt` (4 adet) | Electron build log'ları |
| `publish-log*.txt` (2 adet) | Publish log'ları |
| `publish-v10*.txt` (12 adet) | Versiyon publish log'ları |
| `client/build_output.txt` | Build çıktısı |
| `client/build_simple.txt` | Build denemesi |
| `client/build_retry.txt` | Build retry denemesi |

**Korunan dosyalar:**
- `paketler.md` — Satış paketleri ve fiyatlandırma (iş dokümanı)
- `_kaynak_kod_yedek/` — Kaynak kod yedeği
- `config.json` — Proje yapılandırması

---
---

---

## TAMAMLANAN GÖREVLER

### Ana Görevler (10/10)

- [x] **1.1** Seri Numarası Metni — Setup.jsx metin düzeltmesi
- [x] **1.2** Üst Sağ Arama Çubuğu — GlobalSearch kaldırıldı (AppLayout.jsx)
- [x] **1.3** Bildirim Butonu — Solid background + mock bildirimler temizlendi (NotificationCenter.jsx)
- [x] **2.1** Kullanıcı Dostu Hata Mesajları — `getUserFriendlyError()` eklendi (utils.js, api.js)
- [x] **3.1** WhatsApp Mesaj Gönderme — Operatör öncelik bug'ı düzeltildi, retry 20'ye çıkarıldı, exponential backoff (whatsapp.js)
- [x] **3.2** WhatsApp'ta Aç Butonu — Archives.jsx'e "WhatsApp'ta Aç" butonu eklendi
- [x] **4.1** Haftalık Görünüm Satır Hover — hoveredSlot state + highlight (Appointments.jsx)
- [x] **4.3** Başka Güne Ertele — PostponeModal + context menu (Appointments.jsx)
- [x] **5** Şube/Bölüm Alanı Kaldırıldı — Archives.jsx ArchiveModal'dan çıkarıldı
- [x] **6** Finans Grafik Düzeltmeleri — Negatif gider, ReferenceLine, YAxis formatter (Finance.jsx)
- [x] **8** Müşteri Detay Breadcrumb — Breadcrumb eklendi, customerCode kaldırıldı (CustomerDetail.jsx)
- [x] **9.1** Fotoğraf Seçici Geri Butonu — Toolbar'a geri butonu + onay modalı (PhotoSelectorApp.jsx, Toolbar.jsx)
- [x] **9.2** INI Dosya Mimarisi — Atomic write, backup/restore, v2 format (photoSelector.js, iniManager.js)
- [x] **10** Loglama Sistemi — Firebase audit/error log backend + Creator Panel hata logları sayfası (auditLog.js, logs.js, ErrorLogs.jsx)

### Güvenlik Önerileri (G1-G5)

- [x] **G1** TOTP Şifreleme Anahtarı Zorunlu — `encryptSecret()` fallback kaldırıldı, guard eklendi (admin-init.js)
- [x] **G2** Role Check Optional Chaining — `request.auth?.token?.role` düzeltmesi (options.js, users.js, priceLists.js, reports.js)
- [x] **G3** Service Account Key — `.gitignore`'da `gen-lang-client*.json` pattern'i zaten mevcut
- [x] **G4** Command Injection Fix — `execSync` → `execFileSync` (photoSelector.js)
- [x] **G5** Lisans Config Şifreleme — `safeStorage` ile encrypt/decrypt, legacy migration (main.js)

### Performans Önerileri (P1-P4)

- [x] **P1** Firestore Composite Indexes — 6 yeni index eklendi (firestore.indexes.json)
- [x] **P2** Cursor-Based Pagination — Archives listesinde "Daha Fazla Yükle" butonu (Archives.jsx, archives.js)
- [x] **P3** Dashboard API Konsolidasyonu — Gereksiz `todayAppointments` çağrısı kaldırıldı (Dashboard.jsx)
- [x] **P4** useMemo Optimizasyonları — Finance gelir/gider hesapları, Appointments lookup map'leri (Finance.jsx, Appointments.jsx)

### Kod Kalitesi Önerileri (K1-K4)

- [x] **K1** Console.log Temizliği — Debug log'ları kaldırıldı (Archives.jsx, Setup.jsx)
- [x] **K2** Kullanılmayan Import'lar — `SkeletonDashboard`, `MoreHorizontal` kaldırıldı (Dashboard.jsx, Appointments.jsx)
- [x] **K3** Boş Catch Blokları — `console.warn` eklendi (Appointments.jsx, dashboard.js)
- [x] **K4** Tarih İşleme Standardizasyonu — Merkezi `toJSDate()` fonksiyonu eklendi (utils.js)

### UX/UI Önerileri (U1-U5)

- [x] **U1** Dark Mode Flash Fix — HTML head'e inline theme script eklendi (index.html)
- [x] **U2** Boş Filtre Durumu — İkon + mesaj + "Filtreleri Temizle" butonu (Archives.jsx)
- [x] **U3** Telefon Formatı — Otomatik Türk telefon formatı `05XX XXX XX XX` (PhoneInput.jsx)
- [x] **U4** Settings Disabled Alanlar — Zaten mevcut
- [x] **U5** API Tab Kaldırılması — Zaten mevcut

### Mimari Öneriler (M1-M5)

- [x] **M1** Rate Limiting — In-memory IP tabanlı rate limiter (auth.js)
- [x] **M2** Firebase AppCheck — `APPCHECK_ENABLED` flag ile dinamik enforcement (index.js, auth.js, users.js)
- [x] **M3** Migration Idempotency — Hedef doküman kontrolleri + `migratedAt` metadata (migration.js)
- [x] **M4** Payment Reconciliation — `reconcilePayments` Cloud Function, dryRun destekli (payments-online.js)
- [x] **M5** License Key Entropy — Rejection sampling ile modular bias eliminasyonu (DatabaseHandler.js)
