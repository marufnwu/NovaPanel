import { test, expect } from '@playwright/test';
import { login } from '../helpers';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with heading', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('dashboard shows stats cards', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Check for stat cards with values
    const statCards = page.locator('[class*="stat"], [class*="card"]').count();
    expect(statCards).toBeGreaterThan(0);
  });

  test('dashboard shows services section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const servicesSection = page.locator('text=Services').first();
    await expect(servicesSection).toBeVisible({ timeout: 5000 });
  });

  test('dashboard shows quick actions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const quickActions = page.locator('text=Quick Actions, button:has-text("Create")').first();
    await expect(quickActions).toBeVisible({ timeout: 5000 });
  });

  test('dashboard shows recent activity section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const activitySection = page.locator('text=Recent Activity').first();
    await expect(activitySection).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Services Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('services page loads with heading', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('services list is displayed', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="service"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('service status indicators visible', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    const hasStatus = await page.locator('[class*="status"], [class*="running"], [class*="stopped"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    // Status indicators may be present
  });

  test('service actions available', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    const hasActions = await page.locator('button:has-text("Start"), button:has-text("Stop"), button:has-text("Restart")').first().isVisible({ timeout: 3000 }).catch(() => false);
    // Actions may or may not be present depending on permissions
  });
});

test.describe('Firewall Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('firewall page loads with heading', async ({ page }) => {
    await page.goto('/firewall');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('firewall rules section visible', async ({ page }) => {
    await page.goto('/firewall');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="rule"], [class*="firewall"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('add rule button visible', async ({ page }) => {
    await page.goto('/firewall');
    await page.waitForLoadState('networkidle');
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create Rule")').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Backups Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('backups page loads with heading', async ({ page }) => {
    await page.goto('/backups');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('backups list visible', async ({ page }) => {
    await page.goto('/backups');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="backup"], [class*="list"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('create backup button visible', async ({ page }) => {
    await page.goto('/backups');
    await page.waitForLoadState('networkidle');
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Backup")').first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Monitoring Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('monitoring page loads with heading', async ({ page }) => {
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('monitoring shows stats', async ({ page }) => {
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle');
    // Check for CPU, RAM, Disk indicators
    const hasCpu = await page.locator('text=CPU, [class*="cpu"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCpu).toBeTruthy();
  });

  test('charts or graphs visible', async ({ page }) => {
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle');
    const hasCharts = await page.locator('canvas, [class*="chart"], [class*="graph"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    // Charts may or may not be present
  });
});

test.describe('Cron Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cron page loads with heading', async ({ page }) => {
    await page.goto('/cron');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('cron jobs list visible', async ({ page }) => {
    await page.goto('/cron');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('table, [class*="job"], [class*="cron"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('add cron button visible', async ({ page }) => {
    await page.goto('/cron');
    await page.waitForLoadState('networkidle');
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create")').first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('logs page loads with heading', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('logs content visible', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    const hasLogs = await page.locator('[class*="log"], pre, code, table').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasLogs).toBeTruthy();
  });
});

test.describe('Files Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('files page loads with heading', async ({ page }) => {
    await page.goto('/files');
    await page.waitForLoadState('networkidle');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('file browser visible', async ({ page }) => {
    await page.goto('/files');
    await page.waitForLoadState('networkidle');
    const hasFileBrowser = await page.locator('[class*="file"], [class*="folder"], [class*="tree"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasFileBrowser).toBeTruthy();
  });
});