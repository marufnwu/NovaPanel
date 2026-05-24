import { test, expect } from '@playwright/test';
import { login, loginViaApi } from './helpers';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await expect(page.locator('input[type="text"], input[name="username"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Dashboard Navigation', () => {
  test('can login and see dashboard', async ({ page }) => {
    await login(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('API Health', () => {
  test('health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
});

test.describe('Sites API', () => {
  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    sessionId = await loginViaApi(request);
  });

  test('sites list returns array', async ({ request }) => {
    const res = await request.get('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionId}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('can create a site', async ({ request }) => {
    const res = await request.post('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: 'e2e-test-site', runtime: { runtime: 'static' }, sourceType: 'empty' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('e2e-test-site');
  });

  test('can delete a site', async ({ request }) => {
    const createRes = await request.post('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: 'e2e-delete-site', runtime: { runtime: 'static' }, sourceType: 'empty' },
    });
    const created = await createRes.json();
    const delRes = await request.delete(`/api/v1/sites/${created.data.id}`, {
      headers: { Cookie: `sf_session=${sessionId}` },
    });
    expect(delRes.status()).toBe(200);
  });
});

test.describe('Domains API', () => {
  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    sessionId = await loginViaApi(request);
  });

  test('domains list returns array', async ({ request }) => {
    const res = await request.get('/api/v1/domains', {
      headers: { Cookie: `sf_session=${sessionId}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('can create a domain', async ({ request }) => {
    const res = await request.post('/api/v1/domains', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: 'e2e.example.com', skipDnsVerification: true },
    });
    const body = await res.json();
    if (body.success) {
      expect(body.data.name).toBe('e2e.example.com');
    } else {
      expect(body.error.code).toBe('DOMAIN_DNS_NOT_POINTING');
    }
  });
});

test.describe('Webserver API', () => {
  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    sessionId = await loginViaApi(request);
  });

  test('nginx status returns ok', async ({ request }) => {
    const res = await request.get('/api/v1/webserver/status', {
      headers: { Cookie: `sf_session=${sessionId}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.nginx).toBeDefined();
  });
});

test.describe('SSL API', () => {
  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    sessionId = await loginViaApi(request);
  });

  test('can list SSL certificates', async ({ request }) => {
    const res = await request.get('/api/v1/ssl', {
      headers: { Cookie: `sf_session=${sessionId}` },
    });
    expect(res.status()).toBe(200);
  });
});