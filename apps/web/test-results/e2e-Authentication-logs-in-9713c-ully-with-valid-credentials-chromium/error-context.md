# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Authentication >> logs in successfully with valid credentials
- Location: tests\e2e.spec.ts:13:3

# Error details

```
TimeoutError: locator.fill: Timeout 45000ms exceeded.
Call log:
  - waiting for locator('input[name="username"], input[type="text"]').first()

```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}"
```

# Test source

```ts
  1  | import { type Page } from '@playwright/test';
  2  | 
  3  | const ADMIN_USER = 'admin';
  4  | const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';
  5  | 
  6  | export async function login(page: Page, opts?: { timeout?: number }): Promise<void> {
  7  |   const timeout = opts?.timeout ?? 30000;
  8  | 
  9  |   await page.goto('/login');
  10 |   await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  11 | 
  12 |   const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  13 |   const isLoginPage = await usernameInput.isVisible({ timeout: 5000 }).catch(() => false);
  14 | 
  15 |   if (!isLoginPage) {
  16 |     await page.evaluate(() => localStorage.clear());
  17 |     await page.goto('/login');
  18 |     await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  19 |   }
  20 | 
> 21 |   await usernameInput.fill(ADMIN_USER);
     |                       ^ TimeoutError: locator.fill: Timeout 45000ms exceeded.
  22 |   await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
  23 |   await page.locator('button[type="submit"]').first().click();
  24 |   await page.waitForURL(/\/dashboard/, { timeout }).catch(() => {});
  25 | }
  26 | 
  27 | export async function logout(page: Page): Promise<void> {
  28 |   const menuBtn = page.locator('button[aria-label="User menu"]').first();
  29 |   const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
  30 |   if (!visible) return;
  31 | 
  32 |   await menuBtn.click();
  33 |   const logoutLink = page.getByText('Logout').first();
  34 |   const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
  35 |   if (!logoutVisible) return;
  36 | 
  37 |   await logoutLink.click();
  38 |   await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
  39 | }
  40 | 
  41 | export async function loginViaApi(request: any): Promise<string> {
  42 |   const response = await request.post('/api/v1/auth/login', {
  43 |     data: { username: ADMIN_USER, password: ADMIN_PASS },
  44 |   });
  45 |   const body = await response.json();
  46 |   return body.data?.sessionId ?? '';
  47 | }
```