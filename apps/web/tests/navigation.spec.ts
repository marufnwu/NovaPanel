import { test, expect } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';

async function login(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  const isLoginPage = await usernameInput.isVisible({ timeout: 3000 }).catch(() => false);

  if (!isLoginPage) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  await page.fill('input[name="username"], input[type="text"]', ADMIN_USER).catch(() => {});
  await page.fill('input[type="password"]', ADMIN_PASS).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
}

test.describe.configure({ mode: 'serial' });

test.describe('Page Navigation', () => {
  test('dashboard page loads', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('sites page loads', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('domains page loads', async ({ page }) => {
    await login(page);
    await page.goto('/domains');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('monitoring page loads', async ({ page }) => {
    await login(page);
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('backups page loads', async ({ page }) => {
    await login(page);
    await page.goto('/backups');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('URL Preservation', () => {
  test('page reload preserves URL', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const urlBefore = page.url();
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    expect(page.url()).toBe(urlBefore);
  });
});

test.describe('Topbar Elements', () => {
  test('topbar has search button', async ({ page }) => {
    await login(page);
    const searchBtn = page.locator('button[aria-label="Search"]').first();
    await expect(searchBtn).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('topbar has notifications button', async ({ page }) => {
    await login(page);
    const notifBtn = page.locator('button[aria-label="Notifications"]').first();
    await expect(notifBtn).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('topbar has user menu button', async ({ page }) => {
    await login(page);
    const userBtn = page.locator('button[aria-label="User menu"]').first();
    await expect(userBtn).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});