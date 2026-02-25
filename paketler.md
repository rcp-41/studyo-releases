# Studyo Yonetim Sistemi - Satis Paketleri

---

## PAKET 1 - BASLANGIC (Starter)

**Hedef:** Kucuk studyolar, yeni baslayanlar

- Musteri yonetimi (ekleme, duzenleme, arama)
- Randevu takvimi (ay/hafta/gun gorunumu)
- Cekim arsiv kayitlari ve durum takibi
- Temel finans (gelir/gider, odeme takibi)
- Gunluk kasa raporu
- Excel/CSV dis aktarim
- Tek kullanici (admin)
- **Whatsapp:** Manuel tek tek mesaj gonderme
- **YZ destegi:** Yok
- **Voicebot:** Yok

---

## PAKET 2 - PROFESYONEL (Professional)

**Hedef:** Orta olcekli studyolar, aktif is hacmi olan isletmeler

_Baslangic paketindeki her sey +_

- Coklu kullanici destegi (admin + personel rolleri)
- Detayli raporlama (cekim turu, fotografci, musteri kaynagi, vadesi gecmis)
- Grafik ve istatistik paneli (Dashboard)
- Toplu musteri iceri aktarimi (CSV/Excel)
- Toplu WhatsApp mesajlasma (sablon destegi ile)
- Vadesi gecmis odemelere otomatik hatirlatma mesaji
- Randevu cakisma kontrolu
- Foto secim sistemi (Pixonai)
- WooCommerce entegrasyonu (online satis)
- Bildirim merkezi
- **YZ destegi:** Yok
- **Voicebot:** Yok

---

## PAKET 3 - ISLETME (Business)

**Hedef:** Yogun tempolu studyolar, otomasyon isteyen isletmeler

_Profesyonel paketindeki her sey +_

- **YZ Destekli WhatsApp Chatbot:**
  - Otomatik randevu olusturma ve iptal (musteri chatbot uzerinden randevu alabilir)
  - Randevu hatirlatma mesajlari (otomatik, gun oncesi)
  - Fotograflar hazir / odeme bildirimi (otomatik tetikleme)
  - Musteri SSS yanitlama (calisma saatleri, fiyat bilgisi, konum)
  - Dogal dil anlama ile serbest metin ile randevu alma
- Coklu sube yonetimi (multi-tenant)
- Organizasyon bazli gruplama
- Lisans ve cihaz yonetimi
- Denetim kayitlari (audit log)
- Google Drive yedekleme
- **Voicebot:** Yok

---

## PAKET 4 - KURUMSAL (Enterprise)

**Hedef:** Zincir studyolar, maksimum otomasyon ve prestij isteyen isletmeler

_Isletme paketindeki her sey +_

- **YZ Destekli Voicebot (Sesli Asistan):**
  - Telefonla arayan musterilere otomatik sesli yanit
  - Sesli komutla randevu olusturma, sorgulama ve iptal
  - Musallak cagrilari kayit altina alma ve geri arama listesi
  - Turkce dogal dil isleme ile anlama
  - Mesai saatleri disinda 7/24 otomatik karsilama
- **Gelismis YZ Chatbot Ozellikleri:**
  - Kisisellestirilmis kampanya ve teklif mesajlari (YZ uretimi)
  - Musteri davranis analizi ve randevu tahmini
  - Otomatik yukari satis onerileri (upsell)
  - Coklu dil destegi
- Ozel API erisimi (ucuncu parti entegrasyonlar)
- Oncelikli teknik destek (7/24)
- Ozel marka ve tema ozellestirme (white-label)
- SLA garantisi (%99.9 uptime)

---

## Paket Karsilastirma Ozeti

| Ozellik                          | Baslangic | Profesyonel | Isletme | Kurumsal |
|----------------------------------|:---------:|:-----------:|:-------:|:--------:|
| Musteri Yonetimi                 |     +     |      +      |    +    |    +     |
| Randevu Takvimi                  |     +     |      +      |    +    |    +     |
| Arsiv & Cekim Takibi             |     +     |      +      |    +    |    +     |
| Temel Finans                     |     +     |      +      |    +    |    +     |
| Coklu Kullanici                  |     -     |      +      |    +    |    +     |
| Detayli Raporlama                |     -     |      +      |    +    |    +     |
| Toplu WhatsApp Mesaj             |     -     |      +      |    +    |    +     |
| WooCommerce / Online Satis       |     -     |      +      |    +    |    +     |
| Foto Secim Sistemi               |     -     |      +      |    +    |    +     |
| YZ WhatsApp Chatbot              |     -     |      -      |    +    |    +     |
| Otomatik Randevu (Chatbot)       |     -     |      -      |    +    |    +     |
| Coklu Sube Yonetimi              |     -     |      -      |    +    |    +     |
| YZ Voicebot (Sesli Asistan)      |     -     |      -      |    -    |    +     |
| Kampanya YZ Uretimi              |     -     |      -      |    -    |    +     |
| White-label & API Erisimi        |     -     |      -      |    -    |    +     |
| Oncelikli 7/24 Destek            |     -     |      -      |    -    |    +     |

---

# Fiyatlandirma Stratejisi

## Pazar Analizi

Turkiye'de fotografciliga ozel stüdyo yonetim yazilimi **yok**. Rakipler ya genel muhasebe
programlari (Parasut ~95 TL/ay) ya da yabanci platformlar (Pixieset, ShootProof — $10-50/ay,
~440-2.200 TL/ay). Bu bosluk, Turkce + sektore ozel + YZ entegreli bir urun icin ciddi bir firsat.

---

## Maliyet Tablosu (Studyo Basina Aylik Altyapi Maliyeti)

| Maliyet Kalemi               | Baslangic | Profesyonel | Isletme  | Kurumsal   |
|-------------------------------|:---------:|:-----------:|:--------:|:----------:|
| Firebase (hosting/db/func)    |  ~$3      |  ~$8        |  ~$15    |  ~$25      |
| WhatsApp Business API         |  —        |  ~$5-10     |  ~$10-15 |  ~$15-20   |
| YZ Chatbot (LLM API)          |  —        |  —          |  ~$3-5   |  ~$5-10    |
| Voicebot (STT+LLM+TTS+telco) |  —        |  —          |  —       |  ~$300-500 |
| **Toplam maliyet/studyo**     |  **~$3**  |  **~$15**   |  **~$30**|  **~$350+**|
| **TL karsiligi (~37 kur)**    | ~110 TL   | ~555 TL     | ~1.110 TL| ~13.000 TL |

> Voicebot en buyuk maliyet kalemidir (STT + LLM + TTS + telefon hatti). Bu nedenle
> Kurumsal paket ya yuksek fiyatli olmali ya da voicebot kullanimi kotali/dakika bazli faturalanmali.

---

## Onerilen Fiyatlar

### Ana Fiyat Tablosu

| Paket          | Aylik Fiyat  | Yillik Fiyat (aylik)  | Yillik Toplam  | Tasarruf |
|----------------|:------------:|:---------------------:|:--------------:|:--------:|
| **Baslangic**  | 499 TL/ay    | 399 TL/ay             | 4.788 TL/yil   | 2 ay bedava |
| **Profesyonel**| 999 TL/ay    | 799 TL/ay             | 9.588 TL/yil   | 2 ay bedava |
| **Isletme**    | 1.999 TL/ay  | 1.599 TL/ay           | 19.188 TL/yil  | 2 ay bedava |
| **Kurumsal**   | 4.999 TL/ay  | 3.999 TL/ay           | 47.988 TL/yil  | 2 ay bedava |

> Tum fiyatlar KDV haric. Charm pricing (9 ile biten) uygulanmistir.

### Neden Bu Fiyatlar?

- **Baslangic (499 TL):** Parasut'un (95 TL) ustunde ama sektore ozel deger katiyor.
  Kucuk studyo icin uygun esik. Maliyet ~110 TL, **kar marji ~%78**.

- **Profesyonel (999 TL):** Yabanci alternatiflerin ($20-30/ay = 740-1.110 TL) fiyat araliginda
  ama WhatsApp + WooCommerce + Turkce avantaji var. Maliyet ~555 TL, **kar marji ~%44**.

- **Isletme (1.999 TL):** YZ chatbot ile otomasyon deger teklifi yuksek.
  Maliyet ~1.110 TL, **kar marji ~%44**. Hedef: is hacmi yuksek studyolar.

- **Kurumsal (4.999 TL):** Voicebot ciddi altyapi maliyeti tasir.
  Maliyet ~13.000 TL (yogun kullanim) olabilir, bu nedenle ek kotalandirma sart.
  Alternatif: Voicebot icin dakika bazli ek ucretlendirme.

---

## Voicebot Ozel Fiyatlandirma (Kurumsal Pakete Ek)

Voicebot maliyeti degisken oldugu icin **hibrit model** onerilir:

| Model                    | Aciklama                                      |
|--------------------------|-----------------------------------------------|
| **Dahil kota**           | Ayda 200 dakika voicebot gorusmesi dahil       |
| **Ek dakika ucreti**     | 200 dk ustu: 3 TL/dakika                      |
| **Sinirsiz voicebot**    | +3.000 TL/ay ek paket ile sinirsiz            |

> Bu model, dusuk hacimli musterilerden zarar etmeyi onler,
> yogun kullanan musterilerden ise adil gelir saglar.

---

## Psikolojik Fiyatlandirma Taktikleri

### 1. Capa (Anchor) Etkisi
Fiyat sayfasinda **Kurumsal paketi en solda/ustte** goster.
4.999 TL'yi ilk goren kullanici, 999 TL'lik Profesyonel'i "uygun" bulur.

### 2. "En Populer" Vurgusu
**Profesyonel paketi "En Populer" veya "Onerilen" olarak isaretle.**
Cogu kullanici ortadaki secenege yonelir (Golden Mean Effect).

### 3. Yillik Plan Tesvik
- "2 ay bedava" ifadesi, "%17 indirim"den daha etkilidir
- Yillik plan seceni icin ek bonus: ucretsiz kurulum destegi

### 4. Ucretsiz Deneme
- **14 gun ucretsiz deneme** (kredi karti gerekmeden)
- Deneme suresi: Profesyonel paket ozellikleri ile
- Deneme bitisinde: otomatik Baslangic'a dusurme (churn onleme)

### 5. Lansman Fiyati
- Ilk 100 musteri icin **%30 ozel lansman indirimi** (omur boyu)
- Erken kullanici sadakati + referans tabanı olusturur

---

## Ek Gelir Kanallari

| Kanal                        | Aciklama                                | Tahmini Gelir      |
|------------------------------|----------------------------------------|-------------------|
| **Kurulum ucreti**           | Tek seferlik kurulum + egitim          | 1.000 - 3.000 TL  |
| **WhatsApp mesaj paketi**    | Aylik kota ustü ek mesaj              | 0,50 TL/mesaj      |
| **Ek kullanici**             | Profesyonel'de 3 kullanici dahil, ustu| 99 TL/kullanici/ay |
| **Ek sube**                  | Isletme'de 3 sube dahil, ustu         | 299 TL/sube/ay     |
| **Ozel entegrasyon**         | API ile ucuncu parti yazilim baglama   | Proje bazli teklif |
| **White-label**              | Kurumsal: logo/marka ozellestirme      | 2.000 TL tek sefer |

---

## Hedef Buyume Modeli

| Donem       | Hedef Musteri | Dagılım (B/P/I/K)    | Tahmini Aylik Gelir  |
|-------------|:------------:|-----------------------|---------------------:|
| 0-6 ay      | 50           | 25 / 15 / 8 / 2      | ~52.000 TL           |
| 6-12 ay     | 150          | 60 / 50 / 30 / 10    | ~168.000 TL          |
| 12-24 ay    | 500          | 180 / 170 / 100 / 50 | ~600.000 TL          |

> Profesyonel ve Isletme paketleri ana gelir kaynagidir (%65+ gelir).
> Baslangic paketi musteri edinme, Kurumsal ise marka prestiji saglar.

---

## Ozet Oneri

1. **Profesyonel paketi hedef paketin yap** — en cok satis buradan gelmeli
2. **Yillik plani agresif tesvik et** — nakit akisi ve churn icin kritik
3. **Voicebot'u dakika bazli fiyatlandir** — sabit fiyat risk tasir
4. **14 gun ucretsiz deneme sun** — donusum oranini 2-3x arttirir
5. **Ilk 100 musteri icin lansman indirimi** — erken adopsiyon ve referans
6. **6 ayda bir fiyat guncelle** — enflasyona karsi TL bazli fiyatlamayi korumak icin
