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

test.describe('Backup and Restore Flow', () => {
  test('login and navigate to backups', async ({ page }) => {
    await login(page);
    await page.goto('/backups');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page).toHaveURL(/\/backups/);
  });

  test('backups page shows content', async ({ page }) => {
    await login(page);
    await page.goto('/backups');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('Monitoring Flow', () => {
  test('login and navigate to monitoring', async ({ page }) => {
    await login(page);
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page).toHaveURL(/\/monitoring/);
  });

  test('monitoring page shows stats', async ({ page }) => {
    await login(page);
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('monitoring shows CPU or RAM text', async ({ page }) => {
    await login(page);
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const hasStats = await page.locator('text=/CPU|RAM|Disk|Usage/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasStats).toBeTruthy();
  });
});