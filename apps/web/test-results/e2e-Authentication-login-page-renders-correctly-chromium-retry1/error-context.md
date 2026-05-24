# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Authentication >> login page renders correctly
- Location: tests\e2e.spec.ts:5:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input[type="text"], input[name="username"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('input[type="text"], input[name="username"]').first()

```

```yaml
- text: "{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { login, loginViaApi } from './helpers';
  3   | 
  4   | test.describe('Authentication', () => {
  5   |   test('login page renders correctly', async ({ page }) => {
  6   |     await page.goto('/login');
  7   |     await page.waitForLoadState('networkidle', { timeout: 10000 });
> 8   |     await expect(page.locator('input[type="text"], input[name="username"]').first()).toBeVisible();
      |                                                                                      ^ Error: expect(locator).toBeVisible() failed
  9   |     await expect(page.locator('input[type="password"]').first()).toBeVisible();
  10  |     await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  11  |   });
  12  | 
  13  |   test('logs in successfully with valid credentials', async ({ page }) => {
  14  |     await login(page);
  15  |     await expect(page).toHaveURL(/\/dashboard/);
  16  |   });
  17  | });
  18  | 
  19  | test.describe('Dashboard Navigation', () => {
  20  |   test('can login and see dashboard', async ({ page }) => {
  21  |     await login(page);
  22  |     await expect(page.locator('body')).toBeVisible();
  23  |   });
  24  | });
  25  | 
  26  | test.describe('API Health', () => {
  27  |   test('health endpoint responds', async ({ request }) => {
  28  |     const res = await request.get('/api/v1/health');
  29  |     expect(res.status()).toBe(200);
  30  |     const body = await res.json();
  31  |     expect(body.success).toBe(true);
  32  |     expect(body.data.status).toBe('ok');
  33  |   });
  34  | });
  35  | 
  36  | test.describe('Sites API', () => {
  37  |   let sessionId: string;
  38  | 
  39  |   test.beforeAll(async ({ request }) => {
  40  |     sessionId = await loginViaApi(request);
  41  |   });
  42  | 
  43  |   test('sites list returns array', async ({ request }) => {
  44  |     const res = await request.get('/api/v1/sites', {
  45  |       headers: { Cookie: `sf_session=${sessionId}` },
  46  |     });
  47  |     expect(res.status()).toBe(200);
  48  |     const body = await res.json();
  49  |     expect(body.success).toBe(true);
  50  |     expect(Array.isArray(body.data)).toBe(true);
  51  |   });
  52  | 
  53  |   test('can create a site', async ({ request }) => {
  54  |     const res = await request.post('/api/v1/sites', {
  55  |       headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
  56  |       data: { name: 'e2e-test-site', runtime: { runtime: 'static' }, sourceType: 'empty' },
  57  |     });
  58  |     expect(res.status()).toBe(201);
  59  |     const body = await res.json();
  60  |     expect(body.success).toBe(true);
  61  |     expect(body.data.name).toBe('e2e-test-site');
  62  |   });
  63  | 
  64  |   test('can delete a site', async ({ request }) => {
  65  |     const createRes = await request.post('/api/v1/sites', {
  66  |       headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
  67  |       data: { name: 'e2e-delete-site', runtime: { runtime: 'static' }, sourceType: 'empty' },
  68  |     });
  69  |     const created = await createRes.json();
  70  |     const delRes = await request.delete(`/api/v1/sites/${created.data.id}`, {
  71  |       headers: { Cookie: `sf_session=${sessionId}` },
  72  |     });
  73  |     expect(delRes.status()).toBe(200);
  74  |   });
  75  | });
  76  | 
  77  | test.describe('Domains API', () => {
  78  |   let sessionId: string;
  79  | 
  80  |   test.beforeAll(async ({ request }) => {
  81  |     sessionId = await loginViaApi(request);
  82  |   });
  83  | 
  84  |   test('domains list returns array', async ({ request }) => {
  85  |     const res = await request.get('/api/v1/domains', {
  86  |       headers: { Cookie: `sf_session=${sessionId}` },
  87  |     });
  88  |     expect(res.status()).toBe(200);
  89  |     const body = await res.json();
  90  |     expect(body.success).toBe(true);
  91  |     expect(Array.isArray(body.data)).toBe(true);
  92  |   });
  93  | 
  94  |   test('can create a domain', async ({ request }) => {
  95  |     const res = await request.post('/api/v1/domains', {
  96  |       headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
  97  |       data: { name: 'e2e.example.com', skipDnsVerification: true },
  98  |     });
  99  |     const body = await res.json();
  100 |     if (body.success) {
  101 |       expect(body.data.name).toBe('e2e.example.com');
  102 |     } else {
  103 |       expect(body.error.code).toBe('DOMAIN_DNS_NOT_POINTING');
  104 |     }
  105 |   });
  106 | });
  107 | 
  108 | test.describe('Webserver API', () => {
```