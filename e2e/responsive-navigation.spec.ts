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
      user_metadata: { full_name: 'E2E Navigation User' },
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

test.describe('responsive primary navigation', () => {
  test.skip(
    !hasPasswordCredentials && !hasSessionCredentials,
    'Set E2E credentials or E2E_ACCESS_TOKEN/E2E_USER_ID for a non-production test user before running this suite.'
  );

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('keeps the desktop sidebar in the viewport while the document scrolls', async ({ page }) => {
    test.skip(
      test.info().project.name === 'mobile',
      'Desktop sticky sidebar test runs in Chromium.'
    );

    await page.setViewportSize({ width: 1024, height: 600 });
    await page.goto('/cashiers');

    const sidebar = page.getByRole('complementary', { name: 'Sidebar aplikasi' });
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigasi utama desktop' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigasi utama mobile' })).toBeHidden();

    const canScroll = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 2
    );
    test.skip(
      !canScroll,
      'Current E2E fixture does not contain enough content to verify document scrolling.'
    );

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(async () => (await sidebar.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
      .toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('exposes mentoring on mobile and removes it from the Menu page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/dashboard');

    const mobileNav = page.getByRole('navigation', { name: 'Navigasi utama mobile' });
    const desktopSidebar = page.getByRole('complementary', { name: 'Sidebar aplikasi' });
    await expect(mobileNav).toBeVisible();
    await expect(desktopSidebar).toBeHidden();

    const mentoringLink = mobileNav.getByRole('link', { name: 'Pendampingan', exact: true });
    if (!(await mentoringLink.isVisible())) {
      test.skip(true, 'E2E user does not have the mentoring permission.');
      return;
    }

    await expect(mentoringLink).toHaveAttribute('aria-label', 'Pendampingan');
    await expect(mentoringLink.locator('span')).toHaveText('Damping');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);

    await mentoringLink.click();
    await expect(page).toHaveURL(/\/mentoring(?:\?|$)/);
    await expect(
      mobileNav.getByRole('link', { name: 'Pendampingan', exact: true })
    ).toHaveAttribute('aria-current', 'page');

    await page.goto('/menu');
    await expect(page.locator('main[data-page-content] a[href="/mentoring"]')).toHaveCount(0);
  });
});
