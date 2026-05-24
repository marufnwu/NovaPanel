# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crud.spec.ts >> Sites CRUD >> creates a site via API
- Location: tests\crud.spec.ts:16:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 429
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { login, loginViaApi } from './helpers';
  3   | 
  4   | const TS = Date.now();
  5   | 
  6   | test.describe.configure({ mode: 'serial' });
  7   | 
  8   | test.describe('Sites CRUD', () => {
  9   |   let siteId: string;
  10  |   let sessionCookie: string;
  11  | 
  12  |   test.beforeAll(async ({ request }) => {
  13  |     sessionCookie = await loginViaApi(request);
  14  |   });
  15  | 
  16  |   test('creates a site via API', async ({ request }) => {
  17  |     const res = await request.post('/api/v1/sites', {
  18  |       headers: { Cookie: `sf_session=${sessionCookie}`, 'Content-Type': 'application/json' },
  19  |       data: { name: `e2e-site-${TS}`, runtime: { runtime: 'static' }, sourceType: 'empty' },
  20  |     });
> 21  |     expect(res.status()).toBe(201);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  22  |     const body = await res.json();
  23  |     expect(body.success).toBe(true);
  24  |     siteId = body.data.id;
  25  |   });
  26  | 
  27  |   test('reads site list', async ({ request }) => {
  28  |     const res = await request.get('/api/v1/sites', {
  29  |       headers: { Cookie: `sf_session=${sessionCookie}` },
  30  |     });
  31  |     expect(res.status()).toBe(200);
  32  |     const body = await res.json();
  33  |     expect(body.success).toBe(true);
  34  |     expect(Array.isArray(body.data)).toBe(true);
  35  |   });
  36  | 
  37  |   test('reads single site', async ({ request }) => {
  38  |     if (!siteId) return;
  39  |     const res = await request.get(`/api/v1/sites/${siteId}`, {
  40  |       headers: { Cookie: `sf_session=${sessionCookie}` },
  41  |     });
  42  |     expect(res.status()).toBe(200);
  43  |     const body = await res.json();
  44  |     expect(body.success).toBe(true);
  45  |     expect(body.data.id).toBe(siteId);
  46  |   });
  47  | 
  48  |   test('deletes site via API', async ({ request }) => {
  49  |     if (!siteId) return;
  50  |     const res = await request.delete(`/api/v1/sites/${siteId}`, {
  51  |       headers: { Cookie: `sf_session=${sessionCookie}` },
  52  |     });
  53  |     expect([200, 204]).toContain(res.status());
  54  |   });
  55  | });
  56  | 
  57  | test.describe('Domains CRUD', () => {
  58  |   let domainId: string;
  59  |   let sessionCookie: string;
  60  | 
  61  |   test.beforeAll(async ({ request }) => {
  62  |     sessionCookie = await loginViaApi(request);
  63  |   });
  64  | 
  65  |   test('creates a domain via API', async ({ request }) => {
  66  |     const res = await request.post('/api/v1/domains', {
  67  |       headers: { Cookie: `sf_session=${sessionCookie}`, 'Content-Type': 'application/json' },
  68  |       data: { name: `e2e-domain-${TS}.com`, skipDnsVerification: true },
  69  |     });
  70  |     expect([201, 200]).toContain(res.status());
  71  |     const body = await res.json();
  72  |     if (body.success) {
  73  |       domainId = body.data.id;
  74  |     }
  75  |   });
  76  | 
  77  |   test('reads domain list', async ({ request }) => {
  78  |     const res = await request.get('/api/v1/domains', {
  79  |       headers: { Cookie: `sf_session=${sessionCookie}` },
  80  |     });
  81  |     expect(res.status()).toBe(200);
  82  |     const body = await res.json();
  83  |     expect(body.success).toBe(true);
  84  |     expect(Array.isArray(body.data)).toBe(true);
  85  |   });
  86  | 
  87  |   test('deletes domain via API', async ({ request }) => {
  88  |     if (!domainId) return;
  89  |     const res = await request.delete(`/api/v1/domains/${domainId}`, {
  90  |       headers: { Cookie: `sf_session=${sessionCookie}` },
  91  |     });
  92  |     expect([200, 204]).toContain(res.status());
  93  |   });
  94  | });
  95  | 
  96  | test.describe('Databases CRUD', () => {
  97  |   let sessionCookie: string;
  98  | 
  99  |   test.beforeAll(async ({ request }) => {
  100 |     sessionCookie = await loginViaApi(request);
  101 |   });
  102 | 
  103 |   test('reads database list', async ({ request }) => {
  104 |     const res = await request.get('/api/v1/databases', {
  105 |       headers: { Cookie: `sf_session=${sessionCookie}` },
  106 |     });
  107 |     expect(res.status()).toBe(200);
  108 |     const body = await res.json();
  109 |     expect(body.success).toBe(true);
  110 |     expect(Array.isArray(body.data)).toBe(true);
  111 |   });
  112 | });
  113 | 
  114 | test.describe('Sites UI', () => {
  115 |   test('sites page loads', async ({ page }) => {
  116 |     await login(page);
  117 |     await page.goto('/sites');
  118 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  119 |     const body = await page.content();
  120 |     expect(body.length).toBeGreaterThan(100);
  121 |   });
```