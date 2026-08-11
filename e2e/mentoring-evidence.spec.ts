import path from 'node:path';
import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('mentoring photo evidence', () => {
  test.skip(
    !email || !password,
    'Set E2E_USER_EMAIL dan E2E_USER_PASSWORD untuk menjalankan alur bukti foto.'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  });

  test('creates one session, uploads a canonical image, and serves it privately', async ({
    page,
  }) => {
    await page.goto('/mentoring/new');
    await page.getByLabel('Outlet', { exact: true }).selectOption({ label: 'Outlet Senen' });
    await page.getByLabel('Catatan Umum Outlet (opsional)').fill('Evidence E2E validation');

    const galleryInput = page.locator('input[type="file"][multiple]');
    await galleryInput.setInputFiles(path.join(process.cwd(), 'public', 'logo.png'));
    await expect(page.getByText('Siap diupload')).toBeVisible();

    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/mentoring-sessions\/[^/]+\/evidence$/.test(response.url())
    );
    await page.getByRole('button', { name: 'Simpan Sesi' }).click();

    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    await expect(page).toHaveURL(/\/mentoring\/[0-9a-f-]+$/i, { timeout: 15_000 });

    const evidenceImage = page.getByAltText('Bukti foto 1').first();
    await expect(evidenceImage).toBeVisible();
    await expect
      .poll(() => evidenceImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);

    const imageUrl = await evidenceImage.getAttribute('src');
    expect(imageUrl).toMatch(/^\/api\/mentoring-sessions\/[0-9a-f-]+\/evidence\/[0-9a-f-]+$/i);

    const firstDelivery = await page.request.get(imageUrl!);
    expect(firstDelivery.status()).toBe(200);
    expect(firstDelivery.headers()['content-type']).toContain('image/webp');
    expect(firstDelivery.headers()['cache-control']).toContain('private');
    const etag = firstDelivery.headers().etag;
    expect(etag).toBeTruthy();

    const conditionalDelivery = await page.request.get(imageUrl!, {
      headers: { 'If-None-Match': etag! },
    });
    expect(conditionalDelivery.status()).toBe(304);

    await page.getByRole('button', { name: 'Buka bukti foto 1' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup bukti foto' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
