// E2E: Ödeme/tahsilat akışı
// TODO: Authenticated session + seed data gerektirir.
import { test, expect } from '@playwright/test';

test.describe('Ödeme akışı', () => {
    test.skip('Ödeme formu — TODO: auth + emulator + seed çekim verisi', async ({ page }) => {
        // 1. Login (emulator user)
        await page.goto('/');
        await page.fill('input[type="email"]', 'test@studyo.test');
        await page.fill('input[type="password"]', 'test1234');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|home/, { timeout: 15000 });

        // 2. Çekim listesine git
        await page.click('[href*="shoot"], [href*="cekim"]');

        // 3. İlk çekimi aç
        await page.locator('table tbody tr, [data-row]').first().click();

        // 4. Ödeme sekmesi / butonu
        await page.click('button:has-text("Ödeme"), [data-tab="payment"]');

        // 5. Tahsilat ekle
        await page.click('button:has-text("Tahsilat"), button:has-text("Ödeme Ekle")');
        await page.fill('input[name="amount"], input[placeholder*="Tutar"]', '500');
        await page.selectOption('select[name="method"]', 'cash');
        await page.click('button[type="submit"]');

        // 6. Başarı tost mesajı
        await expect(page.locator('[data-sonner-toast], [class*="toast"]').first()).toBeVisible({ timeout: 5000 });
    });
});
