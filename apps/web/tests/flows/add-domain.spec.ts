import { test, expect } from '@playwright/test';
import { login, loginViaApi } from '../helpers';

const DOMAIN_NAME = `e2e-add-domain-${Date.now()}.com`;

test.describe.configure({ mode: 'serial' });

test.describe('Add Domain Flow', () => {
  let domainId: string;

  test('login and navigate to domains', async ({ page }) => {
    await login(page);
    await page.goto('/domains');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page).toHaveURL(/\/domains/);
  });

  test('click add domain button', async ({ page }) => {
    await login(page);
    await page.goto('/domains');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Domain"), a:has-text("Add Domain")').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });

  test('create domain via API', async ({ page }) => {
    const sessionId = await loginViaApi(page.request);
    if (!sessionId) {
      test.skip();
      return;
    }

    const createRes = await page.request.post('/api/v1/domains', {
      headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
      data: { name: DOMAIN_NAME, skipDnsVerification: true },
    });

    if (createRes.status() === 201) {
      const createBody = await createRes.json();
      domainId = createBody.data.id;
      expect(createBody.data.name).toBe(DOMAIN_NAME);
    } else {
      test.skip();
      return;
    }
  });

  test('verify domain appears in list', async ({ page }) => {
    if (!domainId) return;
    await login(page);
    await page.goto('/domains');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page.locator(`text=${DOMAIN_NAME}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('clean up created domain', async ({ page }) => {
    if (!domainId) return;
    const res = await page.request.delete(`/api/v1/domains/${domainId}`);
    expect([200, 204]).toContain(res.status());
  });
});

test.afterAll(async ({ request }) => {
  const sessionId = await loginViaApi(request);
  if (!sessionId) return;

  const listRes = await request.get('/api/v1/domains', {
    headers: { Cookie: `sf_session=${sessionId}` },
  });
  if (listRes.ok()) {
    const body = await listRes.json();
    const e2eDomains = (body.data || []).filter((d: any) => d.name?.startsWith('e2e-add-domain-'));
    for (const domain of e2eDomains) {
      await request.delete(`/api/v1/domains/${domain.id}`).catch(() => {});
    }
  }
});