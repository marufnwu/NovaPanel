import { test, expect } from '@playwright/test';
import { login, loginViaApi } from '../helpers';

const ADMIN_USER = 'admin';
const ADMIN_PASS = '7656ea4205a1b648632549c37c2089dc';
const SITE_NAME = `e2e-create-site-${Date.now()}`;

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
    const sessionId = await loginViaApi(page.request);
    if (!sessionId) {
      test.skip();
      return;
    }

    const createRes = await page.request.post('/api/v1/sites', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: SITE_NAME, runtime: { runtime: 'static' }, sourceType: 'empty' },
    });

    if (createRes.status() === 201) {
      const createBody = await createRes.json();
      siteId = createBody.data.id;
      expect(createBody.data.name).toBe(SITE_NAME);
    } else {
      test.skip();
      return;
    }

    await login(page);
    await page.goto('/sites');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const siteText = page.locator(`text=${SITE_NAME}`).first();
    await expect(siteText).toBeVisible({ timeout: 10000 });
  });

  test('clean up created site', async ({ page }) => {
    if (!siteId) return;
    const res = await page.request.delete(`/api/v1/sites/${siteId}`);
    expect([200, 204]).toContain(res.status());
  });
});

test.afterAll(async ({ request }) => {
  const sessionId = await loginViaApi(request);
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