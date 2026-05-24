import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_PAGES = [
  { path: '/login', name: 'Login' },
];

const PROTECTED_PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/sites', name: 'Sites' },
  { path: '/domains', name: 'Domains' },
  { path: '/databases', name: 'Databases' },
  { path: '/ssl', name: 'SSL' },
  { path: '/dns', name: 'DNS' },
  { path: '/php', name: 'PHP' },
  { path: '/webserver', name: 'Webserver' },
  { path: '/firewall', name: 'Firewall' },
  { path: '/backups', name: 'Backups' },
  { path: '/monitoring', name: 'Monitoring' },
  { path: '/cron', name: 'Cron' },
  { path: '/mail', name: 'Mail' },
  { path: '/logs', name: 'Logs' },
  { path: '/files', name: 'Files' },
  { path: '/containers', name: 'Containers' },
  { path: '/registries', name: 'Registries' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/security', name: 'Security' },
  { path: '/jobs', name: 'Jobs' },
  { path: '/settings', name: 'Settings' },
];

test.describe('Accessibility', () => {
  for (const pageInfo of PUBLIC_PAGES) {
    test(`login page has no accessibility violations`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toHaveLength(0);
    });
  }
});

test.describe('Accessibility (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('7656ea4205a1b648632549c37c2089dc');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  });

  for (const pageInfo of PROTECTED_PAGES) {
    test(`${pageInfo.name} page has no accessibility violations`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toHaveLength(0);
    });
  }
});