// E2E: Login akışı
// Gereksinim: `npm run dev` çalışıyor olmalı; Firebase Emulator opsiyonel.
// Emulator için: VITE_USE_EMULATOR=true ortam değişkeni set et.
import { test, expect } from '@playwright/test';

test.describe('Login akışı', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('login sayfası yüklenir ve form elemanları görünür', async ({ page }) => {
        // Email ve şifre input'larını bekle
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    });

    test('boş form ile gönderim hata verir', async ({ page }) => {
        const submitBtn = page.locator('button[type="submit"]');
        await submitBtn.click();
        // HTML5 validation veya uygulama hatası beklenir
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        // input required validation
        const validity = await emailInput.evaluate((el) => el.validity.valid);
        expect(validity).toBe(false);
    });

    test('geçersiz email formatı validation hatası verir', async ({ page }) => {
        await page.fill('input[type="email"], input[name="email"]', 'gecersiz-email');
        await page.fill('input[type="password"], input[name="password"]', '123456');
        await page.click('button[type="submit"]');
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        const validity = await emailInput.evaluate((el) => el.validity.valid);
        expect(validity).toBe(false);
    });

    // TODO: Firebase Emulator kurulunca aktif et
    // test('geçerli credentials ile giriş başarılı', async ({ page }) => {
    //     await page.fill('input[type="email"]', 'test@studyo.test');
    //     await page.fill('input[type="password"]', 'test1234');
    //     await page.click('button[type="submit"]');
    //     await expect(page).toHaveURL(/dashboard|home/);
    // });
});
