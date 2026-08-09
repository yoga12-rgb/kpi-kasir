import { expect, test } from '@playwright/test';

const cacheName = 'kpi-kasir-public-v2';

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
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const cacheState = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      return requests.map((request) => new URL(request.url).pathname);
    }, cacheName);

    expect(cacheState).toContain('/manifest.webmanifest');
    expect(cacheState).toContain('/logo.png');
    expect(
      cacheState.every(
        (pathname) =>
          pathname === '/manifest.webmanifest' ||
          pathname === '/logo.png' ||
          pathname === '/icons/icon.svg' ||
          pathname.startsWith('/_next/static/')
      )
    ).toBe(true);

    await page.evaluate(async () => {
      const apiResponse = await fetch('/api/branches', { cache: 'no-store' });
      const privateResponse = await fetch('/dashboard', { cache: 'no-store' });
      if (apiResponse.status !== 401 || privateResponse.status !== 200) {
        throw new Error(
          `Unexpected public/private probe status: api=${apiResponse.status}, private=${privateResponse.status}`
        );
      }
    });

    const afterPrivateRequests = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      return requests.map((request) => new URL(request.url).pathname);
    }, cacheName);

    expect(afterPrivateRequests.some((pathname) => pathname.startsWith('/api/'))).toBe(false);
    expect(afterPrivateRequests).not.toContain('/dashboard');
    expect(afterPrivateRequests).not.toContain('/login');
  });
});
