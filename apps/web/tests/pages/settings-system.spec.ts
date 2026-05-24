import { test, expect } from '@playwright/test';
import { login } from '../helpers';

test.describe('Server Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('settings page loads with heading', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('settings sections visible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Check for tab navigation or section headers
    const hasContent = await page.locator('[class*="tab"], [class*="section"], form').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('save settings button visible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update")').first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('profile page loads with heading', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('profile form visible', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');
    const hasForm = await page.locator('form, [class*="profile"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasForm).toBeTruthy();
  });

  test('profile fields editable', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');
    const hasInputs = await page.locator('input, textarea').count();
    expect(hasInputs).toBeGreaterThan(0);
  });
});

test.describe('API Tokens Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('api tokens page loads with heading', async ({ page }) => {
    await page.goto('/settings/api-tokens');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('api tokens list visible', async ({ page }) => {
    await page.goto('/settings/api-tokens');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="token"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('create token button visible', async ({ page }) => {
    await page.goto('/settings/api-tokens');
    await page.waitForLoadState('networkidle');
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add Token")').first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Plugins Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('plugins page loads with heading', async ({ page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('plugins list visible', async ({ page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="plugin"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('billing page loads with heading', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('billing information visible', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('[class*="billing"], [class*="plan"], [class*="subscription"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Organizations Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('organizations page loads with heading', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('organizations list visible', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="organization"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Installer Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('installer page loads with heading', async ({ page }) => {
    await page.goto('/installer');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('installer packages section visible', async ({ page }) => {
    await page.goto('/installer');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('[class*="package"], [class*="installer"], table').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('install button visible', async ({ page }) => {
    await page.goto('/installer');
    await page.waitForLoadState('networkidle');
    const installBtn = page.locator('button:has-text("Install"), button:has-text("Install Package")').first();
    await expect(installBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Webserver Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('webserver page loads with heading', async ({ page }) => {
    await page.goto('/webserver');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('nginx status visible', async ({ page }) => {
    await page.goto('/webserver');
    await page.waitForLoadState('networkidle');
    const hasStatus = await page.locator('[class*="nginx"], [class*="webserver"], text=/nginx/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasStatus).toBeTruthy();
  });
});

test.describe('PHP Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('php page loads with heading', async ({ page }) => {
    await page.goto('/php');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('php versions section visible', async ({ page }) => {
    await page.goto('/php');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('[class*="php"], [class*="version"], table').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Terminal Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('terminal page loads', async ({ page }) => {
    await page.goto('/terminal');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    // Terminal may or may not be accessible depending on permissions
    const hasTerminal = await page.locator('[class*="terminal"], [class*="console"], pre').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasTerminal).toBeTruthy();
  });
});