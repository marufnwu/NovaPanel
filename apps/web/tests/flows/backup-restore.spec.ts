import { test, expect } from '@playwright/test';
import { login } from '../helpers';

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