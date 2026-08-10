import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('assessment configuration archive', () => {
  test.skip(
    !email || !password,
    'Set E2E_USER_EMAIL dan E2E_USER_PASSWORD untuk menjalankan alur archive/restore admin.'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  });

  test('admin can archive and restore a category and detail', async ({ page }) => {
    await page.goto('/settings/categories');
    await page.getByRole('link', { name: /Kebersihan & Kerapian/ }).click();

    const categoryArchiveButton = page.getByRole('button', {
      name: /Arsipkan kategori Kebersihan & Kerapian/,
    });
    await categoryArchiveButton.click();

    const categoryDialog = page.getByRole('dialog');
    await expect(categoryDialog).toBeVisible();
    const categoryReason = categoryDialog.getByLabel('Alasan perubahan');
    await expect(categoryReason).toBeFocused();
    await categoryReason.fill('Konfigurasi diganti untuk periode berikutnya');
    await categoryDialog.getByRole('button', { name: 'Arsipkan' }).click();
    await expect(
      page.getByRole('button', { name: /Pulihkan kategori Kebersihan & Kerapian/ })
    ).toBeVisible();

    await page.getByRole('button', { name: /Pulihkan kategori Kebersihan & Kerapian/ }).click();
    const restoreCategoryDialog = page.getByRole('dialog');
    await restoreCategoryDialog
      .getByLabel('Alasan perubahan')
      .fill('Konfigurasi digunakan kembali');
    await restoreCategoryDialog.getByRole('button', { name: 'Pulihkan' }).click();
    await expect(
      page.getByRole('button', { name: /Arsipkan kategori Kebersihan & Kerapian/ })
    ).toBeVisible();

    const detailArchiveButton = page.getByRole('button', { name: /Arsipkan detail/ }).first();
    await detailArchiveButton.click();
    const detailDialog = page.getByRole('dialog');
    await detailDialog
      .getByLabel('Alasan perubahan')
      .fill('Detail diganti untuk periode berikutnya');
    await detailDialog.getByRole('button', { name: 'Arsipkan' }).click();
    await expect(page.getByRole('button', { name: /Pulihkan detail/ }).first()).toBeVisible();

    await page
      .getByRole('button', { name: /Pulihkan detail/ })
      .first()
      .click();
    const restoreDetailDialog = page.getByRole('dialog');
    await restoreDetailDialog.getByLabel('Alasan perubahan').fill('Detail digunakan kembali');
    await restoreDetailDialog.getByRole('button', { name: 'Pulihkan' }).click();
    await expect(page.getByRole('button', { name: /Arsipkan detail/ }).first()).toBeVisible();
  });
});
