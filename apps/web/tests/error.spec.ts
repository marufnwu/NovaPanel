import { test, expect } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"], input[type="text"]', ADMIN_USER);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

test.describe('API Error Handling', () => {
  test('API returns 401 for missing session', async ({ request }) => {
    const res = await request.get('/api/v1/sites', {
      headers: { Cookie: 'sf_session=invalid-session' },
    });
    expect(res.status()).toBe(401);
  });

  test('API returns 401 for missing auth header on protected routes', async ({ request }) => {
    const res = await request.get('/api/v1/sites');
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Login Form Validation', () => {
  test('login form accepts input', async ({ page }) => {
    await page.goto('/login');
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await usernameInput.fill('testuser');
    await passwordInput.fill('testpass');
    await expect(usernameInput).toHaveValue('testuser');
    await expect(passwordInput).toHaveValue('testpass');
  });

  test('login form submit button is clickable', async ({ page }) => {
    await page.goto('/login');
    const btn = page.locator('button[type="submit"]').first();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });
});

test.describe('Page Navigation', () => {
  test('unauthenticated user redirected to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated user redirected to login from sites', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});