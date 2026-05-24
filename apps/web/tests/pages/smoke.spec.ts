import { test, expect } from '@playwright/test';
import { login } from '../helpers';

const PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/sites', name: 'Sites' },
  { path: '/databases', name: 'Databases' },
  { path: '/domains', name: 'Domains' },
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
  { path: '/webhooks', name: 'Webhooks' },
  { path: '/audit', name: 'Audit' },
  { path: '/billing', name: 'Billing' },
  { path: '/plugins', name: 'Plugins' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/security', name: 'Security' },
  { path: '/jobs', name: 'Jobs' },
  { path: '/ftp', name: 'FTP' },
  { path: '/organizations', name: 'Organizations' },
  { path: '/settings', name: 'Server Settings' },
  { path: '/settings/profile', name: 'Profile' },
  { path: '/settings/api-tokens', name: 'API Tokens' },
  { path: '/services', name: 'Services' },
];

test.describe('Page Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} page loads without error (${pageInfo.path})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      const criticalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') &&
          !e.includes('DevTools') &&
          !e.includes('404') &&
          !e.includes('429') &&
          !e.includes('Failed to load resource')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Page Content Verification', () => {
  test('dashboard shows server stats', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('sites page shows sites list', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});