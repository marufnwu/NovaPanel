import { test, expect } from '@playwright/test';
import { login, loginViaApi } from './helpers';

const TS = Date.now();

test.describe.configure({ mode: 'serial' });

test.describe('Sites CRUD', () => {
  let siteId: string;
  let sessionCookie: string;

  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginViaApi(request);
  });

  test('creates a site via API', async ({ request }) => {
    const res = await request.post('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionCookie}`, 'Content-Type': 'application/json' },
      data: { name: `e2e-site-${TS}`, runtime: { runtime: 'static' }, sourceType: 'empty' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    siteId = body.data.id;
  });

  test('reads site list', async ({ request }) => {
    const res = await request.get('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('reads single site', async ({ request }) => {
    if (!siteId) return;
    const res = await request.get(`/api/v1/sites/${siteId}`, {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(siteId);
  });

  test('deletes site via API', async ({ request }) => {
    if (!siteId) return;
    const res = await request.delete(`/api/v1/sites/${siteId}`, {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect([200, 204]).toContain(res.status());
  });
});

test.describe('Domains CRUD', () => {
  let domainId: string;
  let sessionCookie: string;

  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginViaApi(request);
  });

  test('creates a domain via API', async ({ request }) => {
    const res = await request.post('/api/v1/domains', {
      headers: { Cookie: `sf_session=${sessionCookie}`, 'Content-Type': 'application/json' },
      data: { name: `e2e-domain-${TS}.com`, skipDnsVerification: true },
    });
    expect([201, 200]).toContain(res.status());
    const body = await res.json();
    if (body.success) {
      domainId = body.data.id;
    }
  });

  test('reads domain list', async ({ request }) => {
    const res = await request.get('/api/v1/domains', {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('deletes domain via API', async ({ request }) => {
    if (!domainId) return;
    const res = await request.delete(`/api/v1/domains/${domainId}`, {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect([200, 204]).toContain(res.status());
  });
});

test.describe('Databases CRUD', () => {
  let sessionCookie: string;

  test.beforeAll(async ({ request }) => {
    sessionCookie = await loginViaApi(request);
  });

  test('reads database list', async ({ request }) => {
    const res = await request.get('/api/v1/databases', {
      headers: { Cookie: `sf_session=${sessionCookie}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe('Sites UI', () => {
  test('sites page loads', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});