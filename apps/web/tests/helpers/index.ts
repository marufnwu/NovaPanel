import { type Page } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';

export async function login(page: Page, opts?: { timeout?: number }): Promise<void> {
  const timeout = opts?.timeout ?? 30000;

  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});

  const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  const isLoginPage = await usernameInput.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isLoginPage) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  }

  await usernameInput.fill(ADMIN_USER);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard/, { timeout }).catch(() => {});
}

export async function logout(page: Page): Promise<void> {
  const menuBtn = page.locator('button[aria-label="User menu"]').first();
  const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) return;

  await menuBtn.click();
  const logoutLink = page.getByText('Logout').first();
  const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
  if (!logoutVisible) return;

  await logoutLink.click();
  await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
}

export async function loginViaApi(request: any): Promise<string> {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const body = await response.json();
  return body.data?.sessionId ?? '';
}