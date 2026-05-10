// E2E: Müşteri ekleme form validasyonu
// TODO: Authenticated session gerektirir — Firebase Emulator ile aktif edilmeli.
import { test, expect } from '@playwright/test';

test.describe('Müşteri ekleme', () => {
    test.skip('Müşteri formu validasyon — TODO: auth + emulator', async ({ page }) => {
        // 1. Login
        await page.goto('/');
        await page.fill('input[type="email"]', 'test@studyo.test');
        await page.fill('input[type="password"]', 'test1234');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|home/, { timeout: 15000 });

        // 2. Müşteri sayfasına git
        await page.click('[href*="customer"], [href*="musteri"]');

        // 3. Yeni müşteri butonu
        await page.click('button:has-text("Yeni"), button:has-text("Ekle"), button:has-text("Müşteri")');

        // 4. Boş form gönder — hata beklenir
        await page.click('button[type="submit"]');
        await expect(page.locator('[class*="error"], [data-error]').first()).toBeVisible();

        // 5. Geçerli form doldurup kaydet
        await page.fill('input[name="name"], input[placeholder*="Ad"]', 'Test Müşteri');
        await page.fill('input[name="phone"], input[placeholder*="Telefon"]', '05001234567');
        await page.click('button[type="submit"]');
        await expect(page.locator('[class*="success"], [data-sonner-toast]').first()).toBeVisible({ timeout: 5000 });
    });
});
