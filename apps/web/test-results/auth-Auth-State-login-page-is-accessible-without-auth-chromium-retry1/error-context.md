# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth State >> login page is accessible without auth
- Location: tests\auth.spec.ts:101:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input[name="username"], input[type="text"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('input[name="username"], input[type="text"]').first()

```

```yaml
- text: "{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}"
```

# Test source

```ts
  5   |   test('renders login form elements', async ({ page }) => {
  6   |     await page.goto('/login');
  7   |     await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
  8   |     await expect(page.locator('input[type="password"]').first()).toBeVisible();
  9   |     await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  10  |   });
  11  | 
  12  |   test('redirects to dashboard on valid login', async ({ page }) => {
  13  |     await login(page);
  14  |     await expect(page).toHaveURL(/\/dashboard/);
  15  |   });
  16  | 
  17  |   test('login page has no critical console errors', async ({ page }) => {
  18  |     const errors: string[] = [];
  19  |     page.on('console', (msg) => {
  20  |       if (msg.type() === 'error') errors.push(msg.text());
  21  |     });
  22  |     await page.goto('/login');
  23  |     await page.waitForLoadState('networkidle');
  24  |     const critical = errors.filter(e => !e.includes('favicon') && !e.includes('DevTools'));
  25  |     expect(critical).toHaveLength(0);
  26  |   });
  27  | });
  28  | 
  29  | test.describe('Session Persistence', () => {
  30  |   test('session persists across page reloads', async ({ page }) => {
  31  |     await login(page);
  32  |     const url1 = page.url();
  33  |     await page.reload();
  34  |     await page.waitForLoadState('networkidle');
  35  |     const url2 = page.url();
  36  |     expect(url2).toContain('/dashboard');
  37  |   });
  38  | 
  39  |   test('authenticated user can navigate to any page', async ({ page }) => {
  40  |     await login(page);
  41  |     await page.goto('/sites');
  42  |     await page.waitForLoadState('networkidle');
  43  |     await expect(page).not.toHaveURL(/\/login/);
  44  |   });
  45  | });
  46  | 
  47  | test.describe('Logout', () => {
  48  |   test('user can logout via user menu', async ({ page }) => {
  49  |     await login(page);
  50  |     const menuBtn = page.locator('button[aria-label="User menu"]').first();
  51  |     const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
  52  |     if (!visible) {
  53  |       test.skip();
  54  |       return;
  55  |     }
  56  |     await menuBtn.click();
  57  |     const logoutLink = page.getByText('Logout').first();
  58  |     const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
  59  |     if (!logoutVisible) {
  60  |       test.skip();
  61  |       return;
  62  |     }
  63  |     await logoutLink.click();
  64  |     await page.waitForURL(/\/login/, { timeout: 5000 });
  65  |     await expect(page).toHaveURL(/\/login/);
  66  |   });
  67  | 
  68  |   test('logged out user cannot access protected pages', async ({ page }) => {
  69  |     await login(page);
  70  |     const menuBtn = page.locator('button[aria-label="User menu"]').first();
  71  |     const visible = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false);
  72  |     if (!visible) {
  73  |       test.skip();
  74  |       return;
  75  |     }
  76  |     await menuBtn.click();
  77  |     const logoutLink = page.getByText('Logout').first();
  78  |     const logoutVisible = await logoutLink.isVisible({ timeout: 3000 }).catch(() => false);
  79  |     if (!logoutVisible) {
  80  |       test.skip();
  81  |       return;
  82  |     }
  83  |     await logoutLink.click();
  84  |     await page.waitForURL(/\/login/, { timeout: 5000 });
  85  |     await expect(page).toHaveURL(/\/login/);
  86  |     await page.goto('/dashboard');
  87  |     await page.waitForURL(/\/login/, { timeout: 5000 });
  88  |     await expect(page).toHaveURL(/\/login/);
  89  |   });
  90  | });
  91  | 
  92  | test.describe('Auth State', () => {
  93  |   test.use({ storageState: [] });
  94  | 
  95  |   test('unauthenticated user redirected to login', async ({ page }) => {
  96  |     await page.goto('/dashboard');
  97  |     await page.waitForURL(/\/login/, { timeout: 5000 });
  98  |     await expect(page).toHaveURL(/\/login/);
  99  |   });
  100 | 
  101 |   test('login page is accessible without auth', async ({ page }) => {
  102 |     await page.goto('/login');
  103 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  104 |     const input = page.locator('input[name="username"], input[type="text"]').first();
> 105 |     await expect(input).toBeVisible({ timeout: 10000 });
      |                         ^ Error: expect(locator).toBeVisible() failed
  106 |   });
  107 | });
```