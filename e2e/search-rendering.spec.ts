import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const accessToken = process.env.E2E_ACCESS_TOKEN;
const userId = process.env.E2E_USER_ID;
const hasPasswordCredentials = Boolean(email && password);
const hasSessionCredentials = Boolean(accessToken && userId && email);

function sessionCookieValue() {
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-search-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'E2E Search User' },
    },
  };

  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

function sessionCookieName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55421';
  const hostname = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${hostname}-auth-token`;
}

test.describe('search rendering', () => {
  test.skip(
    !hasPasswordCredentials && !hasSessionCredentials,
    'Set E2E credentials or E2E_ACCESS_TOKEN/E2E_USER_ID before running the authenticated search suite.'
  );

  test.beforeEach(async ({ page }) => {
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
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
      return;
    }

    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  });

  test('Enter updates cashier results without document navigation', async ({ page }) => {
    await page.goto('/cashiers');
    const search = page.getByLabel('Cari kasir');
    await expect(search).toBeVisible();

    const documentRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests.push(request.url());
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/cashiers' &&
        response.request().method() === 'GET'
    );
    await search.fill('__search_rendering_probe__');
    await search.press('Enter');
    await responsePromise;

    expect(documentRequests).toHaveLength(0);
    await expect(page).toHaveURL(/q=__search_rendering_probe__/);
    await expect(page.getByLabel('Cari kasir')).toHaveValue('__search_rendering_probe__');
  });
});
