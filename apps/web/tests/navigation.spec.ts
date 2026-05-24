import { test, expect } from '@playwright/test';
import { login } from './helpers';

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
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const searchBtn = page.locator('[data-testid="topbar-search"]').first();
    await expect(searchBtn).toBeVisible({ timeout: 10000 }).catch(async () => {
      const fallback = page.locator('button[aria-label="Search"]').first();
      await expect(fallback).toBeVisible({ timeout: 5000 });
    });
  });

  test('topbar has notifications button', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const notifBtn = page.locator('[data-testid="topbar-notifications"]').first();
    await expect(notifBtn).toBeVisible({ timeout: 10000 }).catch(async () => {
      const fallback = page.locator('button[aria-label="Notifications"]').first();
      await expect(fallback).toBeVisible({ timeout: 5000 });
    });
  });

  test('topbar has user menu button', async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const userBtn = page.locator('[data-testid="topbar-user-menu"]').first();
    await expect(userBtn).toBeVisible({ timeout: 10000 }).catch(async () => {
      const fallback = page.locator('button[aria-label="User menu"]').first();
      await expect(fallback).toBeVisible({ timeout: 5000 });
    });
  });
});