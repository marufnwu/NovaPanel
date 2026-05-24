import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/login', name: 'login' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/sites', name: 'sites' },
  { path: '/domains', name: 'domains' },
  { path: '/databases', name: 'databases' },
  { path: '/ssl', name: 'ssl' },
  { path: '/dns', name: 'dns' },
  { path: '/php', name: 'php' },
  { path: '/webserver', name: 'webserver' },
  { path: '/firewall', name: 'firewall' },
  { path: '/backups', name: 'backups' },
  { path: '/monitoring', name: 'monitoring' },
  { path: '/cron', name: 'cron' },
  { path: '/mail', name: 'mail' },
  { path: '/logs', name: 'logs' },
  { path: '/files', name: 'files' },
  { path: '/containers', name: 'containers' },
  { path: '/registries', name: 'registries' },
  { path: '/notifications', name: 'notifications' },
  { path: '/security', name: 'security' },
  { path: '/jobs', name: 'jobs' },
  { path: '/settings', name: 'settings' },
];

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('7656ea4205a1b648632549c37c2089dc');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  });

  for (const pageInfo of PAGES) {
    test(`screenshot: ${pageInfo.name}`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await expect(page).toHaveScreenshot(`${pageInfo.name}.png`, { maxDiffPixels: 100 });
    });
  }
});

test.describe('Visual Regression (public)', () => {
  test('screenshot: login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page).toHaveScreenshot('login-public.png', { maxDiffPixels: 100 });
  });
});