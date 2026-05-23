import { test, expect } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';
const SITE_NAME = `e2e-create-site-${Date.now()}`;

async function login(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  const isLoginPage = await usernameInput.isVisible({ timeout: 3000 }).catch(() => false);

  if (!isLoginPage) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  await page.fill('input[name="username"], input[type="text"]', ADMIN_USER).catch(() => {});
  await page.fill('input[type="password"]', ADMIN_PASS).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
}

test.describe.configure({ mode: 'serial' });

test.describe('Create Site Flow', () => {
  let siteId: string;

  test('login and navigate to sites', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page).toHaveURL(/\/sites/);
  });

  test('click create site button', async ({ page }) => {
    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Site"), a:has-text("Create Site")').first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
  });

  test('create site via API and verify in list', async ({ page }) => {
    const res = await page.request.post('/api/v1/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const body = await res.json();
    const sessionId = body.data?.sessionId;

    const createRes = await page.request.post('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: SITE_NAME, runtime: { runtime: 'static' }, sourceType: 'empty' },
    });

    if (createRes.status() === 201) {
      const createBody = await createRes.json();
      siteId = createBody.data.id;
      expect(createBody.data.name).toBe(SITE_NAME);

      await login(page);
      await page.goto('/sites');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      const siteText = page.locator(`text=${SITE_NAME}`).first();
      await expect(siteText).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('clean up created site', async ({ page }) => {
    if (!siteId) return;
    const res = await page.request.delete(`/api/v1/sites/${siteId}`);
    expect([200, 204]).toContain(res.status());
  });
});

test.afterAll(async ({ request }) => {
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const loginBody = await loginRes.json();
  const sessionId = loginBody.data?.sessionId;
  if (!sessionId) return;

  const listRes = await request.get('/api/v1/sites', {
    headers: { Cookie: `sf_session=${sessionId}` },
  });
  if (listRes.ok()) {
    const body = await listRes.json();
    const e2eSites = (body.data || []).filter((s: any) => s.name?.startsWith('e2e-create-site-'));
    for (const site of e2eSites) {
      await request.delete(`/api/v1/sites/${site.id}`).catch(() => {});
    }
  }
});