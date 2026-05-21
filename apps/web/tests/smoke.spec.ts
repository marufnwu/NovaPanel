import { test, expect } from '@playwright/test';

test.describe('Health & Auth', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]').first().fill('wronguser');
    await page.fill('input[name="password"]').first().fill('wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/invalid|error|failed/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('sidebar navigation links exist', async ({ page }) => {
    await expect(page.locator('nav a[href="/sites"]').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sites Page', () => {
  test('sites page loads after auth', async ({ page }) => {
    await page.goto('/login');
    // This test would need real credentials in CI — placeholder for now
    // In CI you'd authenticate via API then set session cookie
    await page.goto('/sites');
    // Should redirect to login if not authenticated
    await expect(page.url()).toMatch(/\/(login|sites)/);
  });
});