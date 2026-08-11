import { expect, test } from '@playwright/test';

const cacheName = 'kpi-kasir-public-v3';
const publicAssets = [
  '/manifest.webmanifest',
  '/icons/favicon-16.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

test.describe('public PWA cache boundary', () => {
  test.skip(
    process.env.E2E_PWA !== 'true',
    'Set E2E_PWA=true against a production server to verify the service worker cache boundary.'
  );

  test('caches public assets only', async ({ page }) => {
    await page.goto('/login');

    const serviceWorker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
      };
    });

    expect(serviceWorker.scope).toMatch(/\/$/);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const cacheState = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      return requests.map((request) => new URL(request.url).pathname);
    }, cacheName);

    expect(cacheState).toEqual(expect.arrayContaining(publicAssets));
    expect(cacheState.every((pathname) => publicAssets.includes(pathname))).toBe(true);
    expect(cacheState.some((pathname) => pathname.startsWith('/api/'))).toBe(false);
    expect(cacheState).not.toContain('/dashboard');
    expect(cacheState).not.toContain('/login');
  });
});
