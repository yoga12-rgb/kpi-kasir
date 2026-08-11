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
      user_metadata: { full_name: 'E2E Local Admin' },
    },
  };

  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

function sessionCookieName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55421';
  const hostname = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${hostname}-auth-token`;
}

test.describe('authenticated critical paths', () => {
  test.skip(
    !hasPasswordCredentials && !hasSessionCredentials,
    'Set E2E credentials or E2E_ACCESS_TOKEN/E2E_USER_ID for a non-production test user before running this suite.'
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
      const storedCookies = await page.context().cookies();
      if (!storedCookies.some((cookie) => cookie.name === sessionCookieName())) {
        throw new Error(`E2E session cookie was not stored (${sessionCookieName()})`);
      }
      const authProbe = await page.goto('/api/branches');
      if (authProbe?.status() !== 200) {
        const storedCookie = storedCookies.find((cookie) => cookie.name === sessionCookieName());
        throw new Error(
          `E2E session cookie was not accepted (status ${authProbe?.status() ?? 'unknown'}, ` +
            `name ${sessionCookieName()}, length ${storedCookie?.value.length ?? 0}, token ${Boolean(accessToken)})`
        );
      }
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

  test('login, core navigation, and logout', async ({ page }) => {
    for (const path of ['/cashiers', '/assessment', '/mentoring', '/leaderboard', '/menu']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).not.toContainText('Application error');
    }

    await page.getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('period management surface is reachable without executing destructive close', async ({ page }) => {
    await page.goto('/settings/periods');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('cashier detail loads secondary tabs only when opened', async ({ page }) => {
    const tabRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/api\/cashiers\/[^/]+\/tabs\?tab=/.test(url)) tabRequests.push(url);
    });

    await page.goto('/cashiers');
    const cashierLink = page.locator('a[href^="/cashiers/"]').first();
    if ((await cashierLink.count()) === 0) {
      test.skip(true, 'Tidak ada kasir yang dapat diakses oleh user E2E.');
      return;
    }

    await cashierLink.click();
    await expect(page.getByRole('tab', { name: 'Penempatan' })).toBeVisible();
    await expect.poll(() => tabRequests.some((url) => url.includes('tab=placement'))).toBe(true);
    expect(tabRequests.some((url) => url.includes('tab=mutation'))).toBe(false);
    expect(tabRequests.some((url) => url.includes('tab=mentoring'))).toBe(false);

    const mentoringTab = page.getByRole('tab', { name: 'Pendampingan' });
    if ((await mentoringTab.count()) > 0) {
      await mentoringTab.click();
      await expect.poll(() => tabRequests.some((url) => url.includes('tab=mentoring'))).toBe(true);
    }
  });
});
