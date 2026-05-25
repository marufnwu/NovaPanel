import { test as setup, expect } from '@playwright/test';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';

setup('authenticate and save session', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  console.log('Current URL:', page.url());

  const usernameInput = page.getByRole('textbox', { name: 'Username' });
  const passwordInput = page.getByRole('textbox', { name: 'Password' });
  const signInBtn = page.getByRole('button', { name: 'Sign In' });

  await usernameInput.fill('admin');
  await passwordInput.fill('7656ea4205a1b648632549c37c2089dc');
  await signInBtn.click();

  console.log('Clicked Sign In, waiting for redirect...');
  await page.waitForURL(/dashboard|sites/, { timeout: 20000 });

  const currentUrl = page.url();
  console.log('Redirected to:', currentUrl);

  if (!currentUrl.includes('dashboard') && !currentUrl.includes('sites')) {
    throw new Error(`Login failed - redirected to ${currentUrl} instead of dashboard/sites`);
  }

  const cookies = await page.context().cookies();
  console.log('Cookies after login:', JSON.stringify(cookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' }))));

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  console.log('Session saved to', STORAGE_STATE_PATH);
});