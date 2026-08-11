import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const accessToken = process.env.E2E_ACCESS_TOKEN;
const userId = process.env.E2E_USER_ID;
const hasPasswordCredentials = Boolean(email && password);
const hasSessionCredentials = Boolean(accessToken && userId && email);

function sessionCookieValue() {
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'E2E Avatar User' },
    },
  };

  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

function sessionCookieName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55421';
  const hostname = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${hostname}-auth-token`;
}

async function authenticate(page: Page) {
  if (hasSessionCredentials) {
    await page.context().addCookies([
      {
        name: sessionCookieName(),
        value: sessionCookieValue(),
        url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    const authProbe = await page.goto('/api/branches');
    if (authProbe?.status() !== 200) {
      throw new Error(`E2E session was not accepted (status ${authProbe?.status() ?? 'unknown'})`);
    }
    return;
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
}

const avatarSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#eab308"/></svg>';

test.describe('cashier avatar lifecycle', () => {
  test.skip(
    !hasPasswordCredentials && !hasSessionCredentials,
    'Set E2E credentials or E2E_ACCESS_TOKEN/E2E_USER_ID for a non-production test user before running this suite.'
  );

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('shows a local skeleton until the avatar response is decoded', async ({ page }) => {
    let releaseResponse: () => void = () => undefined;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route('**/api/storage/cashier-avatar**', async (route) => {
      await responseGate;
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: avatarSvg });
    });

    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded' });
    const frame = page.locator('[data-avatar-frame]').first();
    if ((await frame.count()) === 0) {
      test.skip(true, 'Tidak ada avatar kasir pada fixture E2E.');
      releaseResponse();
      return;
    }

    await expect(frame).toHaveAttribute('data-avatar-state', 'loading');
    releaseResponse();
    await expect(frame).toHaveAttribute('data-avatar-state', 'loaded', { timeout: 5000 });
  });
});
