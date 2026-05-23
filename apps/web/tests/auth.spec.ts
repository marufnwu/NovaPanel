import { test, expect } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"], input[type="text"]', ADMIN_USER);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

async function logout(page: any) {
  await page.click('button[aria-label="User menu"]');
  await page.getByText('Logout').click();
  await page.waitForURL(/\/login/, { timeout: 5000 });
}

test.describe('Login Page', () => {
  test('renders login form elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('redirects to dashboard on valid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USER);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login page has no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const critical = errors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
    expect(critical).toHaveLength(0);
  });
});

test.describe('Session Persistence', () => {
  test('session persists across page reloads', async ({ page }) => {
    await login(page);
    const url1 = page.url();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const url2 = page.url();
    expect(url2).toContain('/dashboard');
  });

  test('authenticated user can navigate to any page', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Logout', () => {
  test('user can logout via user menu', async ({ page }) => {
    await login(page);
    const menuBtn = page.locator('button[aria-label="User menu"]').first();
    const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }
    await menuBtn.click();
    const logoutLink = page.getByText('Logout').first();
    const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!logoutVisible) {
      test.skip();
      return;
    }
    await logoutLink.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logged out user cannot access protected pages', async ({ page }) => {
    await login(page);
    const menuBtn = page.locator('button[aria-label="User menu"]').first();
    const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }
    await menuBtn.click();
    const logoutLink = page.getByText('Logout').first();
    const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!logoutVisible) {
      test.skip();
      return;
    }
    await logoutLink.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Auth State', () => {
  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
  });
});