# Test Altyapısı

## Kurulu Paketler
- **vitest** + **@testing-library/react** + **jsdom** — unit/integration testler
- **@playwright/test** (Chromium) — E2E testler

## Komutlar

```bash
# Unit testler (tek sefer)
npm test

# Unit testler (watch modu)
npm run test:watch

# Coverage raporu (src/coverage/)
npm run test:coverage

# E2E testler (npm run dev aktif olmalı)
npm run test:e2e

# E2E headed (tarayıcı görünür)
npm run test:e2e:headed
```

## Dosya Yapısı

```
client/
  src/
    test/setup.js           # Global mock'lar (Firebase, electronAPI, i18next)
    lib/utils.test.js       # Utility fonksiyon unit testleri
    hooks/useOnlineStatus.test.js
    components/PasswordInput.test.jsx
  e2e/
    login.spec.js           # Login akışı (form validation aktif, auth TODO)
    customer-form.spec.js   # Müşteri ekleme (TODO: emulator)
    payment.spec.js         # Ödeme akışı (TODO: emulator)
  playwright.config.js
  .env.test                 # Emulator bağlantı ayarları
```

## Test Yazma Kuralları

1. **Unit test**: `src/` altında, test ettiği dosyanın yanına `.test.js(x)` uzantısıyla.
2. **Mock'lar**: Firebase ve electronAPI `src/test/setup.js`'de global olarak stub'lanmış.
3. **E2E**: `e2e/` klasörüne `.spec.js` uzantısıyla. Firebase Emulator gerektiren testleri `test.skip()` ile işaretle, TODO yorum ekle.
4. **Fixture veriler**: `src/test/fixtures/` altında sabit JSON olarak tut.
5. **Coverage hedefi**: `src/lib/`, `src/hooks/`, `src/components/` için >%70 satır coverage.

## Firebase Emulator ile E2E

```bash
# firebase/ dizininde
firebase emulators:start --only auth,firestore,functions

# Ayrı terminalde
cd client
npm run dev
npm run test:e2e
```

`.env.test` dosyasındaki `VITE_USE_EMULATOR=true` ayarı uygulamanın emulator'a bağlanmasını sağlar.
Bunun için `src/lib/firebase.js` içinde emulator bağlantı kodu eklenmelidir (bkz. Firebase docs: connectAuthEmulator, connectFirestoreEmulator).

## CI Önerisi

```yaml
- name: Unit Tests
  run: cd client && npm test

- name: E2E Tests
  run: |
    cd client && npm run dev &
    npx wait-on http://localhost:5173
    npm run test:e2e
```
