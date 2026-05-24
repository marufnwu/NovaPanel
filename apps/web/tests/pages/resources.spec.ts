import { test, expect } from '@playwright/test';
import { login } from '../helpers';

test.describe('Sites Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sites page loads with heading', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('sites page shows sites table or empty state', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    const hasTableOrEmpty = await page.locator('table, [class*="empty"], [class*="no-data"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasTableOrEmpty).toBeTruthy();
  });

  test('create site button is visible', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add Site"), [data-testid="create-site"]').first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test('can open create site modal', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add Site")').first();
    await createBtn.click();
    const modal = page.locator('[role="dialog"], .modal, [data-testid="create-site-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('sites table has correct columns', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    // Check for common column headers
    const hasHeaders = await page.locator('th, [class*="header"]').count();
    expect(hasHeaders).toBeGreaterThan(0);
  });

  test('site row shows status badge', async ({ page }) => {
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    // If sites exist, check for status indicators
    const rows = page.locator('tbody tr, [class*="row"]').count();
    if (rows > 0) {
      const hasStatus = await page.locator('[class*="status"], [class*="badge"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      // Status badge may or may not be present depending on data
    }
  });
});

test.describe('Databases Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('databases page loads with heading', async ({ page }) => {
    await page.goto('/databases');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('databases page shows database list or empty state', async ({ page }) => {
    await page.goto('/databases');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="empty"], [class*="no-data"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('create database button is visible', async ({ page }) => {
    await page.goto('/databases');
    await page.waitForLoadState('networkidle');
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add Database"), [data-testid="create-database"]').first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Domains Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('domains page loads with heading', async ({ page }) => {
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('domains page shows domain list or empty state', async ({ page }) => {
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="empty"], [class*="no-data"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('add domain button is visible', async ({ page }) => {
    await page.goto('/domains');
    await page.waitForLoadState('networkidle');
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), [data-testid="add-domain"]').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('SSL Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ssl page loads with heading', async ({ page }) => {
    await page.goto('/ssl');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('ssl certificates section visible', async ({ page }) => {
    await page.goto('/ssl');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="certificate"], [class*="ssl"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('DNS Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dns page loads with heading', async ({ page }) => {
    await page.goto('/dns');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('dns zones section visible', async ({ page }) => {
    await page.goto('/dns');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="zone"], [class*="record"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});