import { expect, test } from '@playwright/test';

test('login surface renders without application error', async ({ page }) => {
  const response = await page.goto('/login');

  expect(response?.status()).toBeGreaterThanOrEqual(200);
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'KPI Kasir Rajaklana' })).toBeVisible();
  const loginButton = page.getByRole('button', { name: 'Masuk' });
  if (await loginButton.count()) {
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(loginButton).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/setup(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Buat Akun Administrator' })).toBeVisible();
  }
  await expect(page.locator('body')).not.toContainText('Application error');
});
