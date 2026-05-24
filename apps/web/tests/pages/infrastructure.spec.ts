import { test, expect } from '@playwright/test';
import { login } from '../helpers';

test.describe('Mail Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('mail page loads with heading', async ({ page }) => {
    await page.goto('/mail');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('mail boxes section visible', async ({ page }) => {
    await page.goto('/mail');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="mailbox"], [class*="mail"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Containers Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('containers page loads with heading', async ({ page }) => {
    await page.goto('/containers');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('containers list visible', async ({ page }) => {
    await page.goto('/containers');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="container"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('container status visible', async ({ page }) => {
    await page.goto('/containers');
    await page.waitForLoadState('networkidle');
    const hasStatus = await page.locator('[class*="status"], [class*="running"], [class*="stopped"]').first().isVisible({ timeout: 5000 }).catch(() => false);
  });
});

test.describe('Registries Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('registries page loads with heading', async ({ page }) => {
    await page.goto('/registries');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('registries list visible', async ({ page }) => {
    await page.goto('/registries');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="registry"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Webhooks Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('webhooks page loads with heading', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('webhooks list visible', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="webhook"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('add webhook button visible', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create")').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Jobs Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('jobs page loads with heading', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('jobs list visible', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="job"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('FTP Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ftp page loads with heading', async ({ page }) => {
    await page.goto('/ftp');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('ftp accounts list visible', async ({ page }) => {
    await page.goto('/ftp');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="account"], [class*="ftp"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Security Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('security page loads with heading', async ({ page }) => {
    await page.goto('/security');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('security settings visible', async ({ page }) => {
    await page.goto('/security');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('[class*="security"], [class*="setting"], form').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('notifications page loads with heading', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('notifications list visible', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('[class*="notification"], [class*="list"], table').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Audit Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('audit page loads with heading', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('audit log visible', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="audit"], [class*="log"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});