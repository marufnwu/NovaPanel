# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows\add-domain.spec.ts >> Add Domain Flow >> click add domain button
- Location: tests\flows\add-domain.spec.ts:18:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Add"), button:has-text("New Domain"), a:has-text("Add Domain")').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("Add"), button:has-text("New Domain"), a:has-text("Add Domain")').first()

```

```yaml
- region "Notifications alt+T"
- complementary:
  - text: NovaPanel
  - navigation:
    - text: Apps
    - list:
      - listitem:
        - link "Sites":
          - /url: /sites
          - img
          - text: Sites
      - listitem:
        - link "Databases":
          - /url: /databases
          - img
          - text: Databases
      - listitem:
        - link "Cron Jobs":
          - /url: /cron
          - img
          - text: Cron Jobs
      - listitem:
        - link "Installer":
          - /url: /installer
          - img
          - text: Installer
    - text: Server
    - list:
      - listitem:
        - link "Services":
          - /url: /services
          - img
          - text: Services
      - listitem:
        - link "Firewall":
          - /url: /firewall
          - img
          - text: Firewall
      - listitem:
        - link "Backups":
          - /url: /backups
          - img
          - text: Backups
      - listitem:
        - link "Terminal":
          - /url: /terminal
          - img
          - text: Terminal
      - listitem:
        - link "Files":
          - /url: /files
          - img
          - text: Files
    - text: Domains
    - list:
      - listitem:
        - link "Domains":
          - /url: /domains
          - img
          - text: Domains
      - listitem:
        - link "DNS":
          - /url: /dns
          - img
          - text: DNS
      - listitem:
        - link "SSL":
          - /url: /ssl
          - img
          - text: SSL
      - listitem:
        - link "Mail":
          - /url: /mail
          - img
          - text: Mail
      - listitem:
        - link "FTP":
          - /url: /ftp
          - img
          - text: FTP
    - text: System
    - list:
      - listitem:
        - link "Monitoring":
          - /url: /monitoring
          - img
          - text: Monitoring
      - listitem:
        - link "Logs":
          - /url: /logs
          - img
          - text: Logs
      - listitem:
        - link "Containers":
          - /url: /containers
          - img
          - text: Containers
      - listitem:
        - link "Jobs":
          - /url: /jobs
          - img
          - text: Jobs
      - listitem:
        - link "Audit":
          - /url: /audit
          - img
          - text: Audit
    - text: Settings
    - list:
      - listitem:
        - link "Server Settings":
          - /url: /settings
          - img
          - text: Server Settings
      - listitem:
        - link "Security":
          - /url: /security
          - img
          - text: Security
      - listitem:
        - link "Notifications":
          - /url: /notifications
          - img
          - text: Notifications
      - listitem:
        - link "Webhooks":
          - /url: /webhooks
          - img
          - text: Webhooks
      - listitem:
        - link "API Tokens":
          - /url: /settings/api-tokens
          - img
          - text: API Tokens
      - listitem:
        - link "Plugins":
          - /url: /plugins
          - img
          - text: Plugins
      - listitem:
        - link "Billing":
          - /url: /billing
          - img
          - text: Billing
      - listitem:
        - link "Organizations":
          - /url: /organizations
          - img
          - text: Organizations
      - listitem:
        - link "Profile":
          - /url: /settings/profile
          - img
          - text: Profile
- banner:
  - navigation: Domains
  - button "Search":
    - img
  - button "Notifications":
    - img
  - button "User menu":
    - img
- text: CPU 33% RAM 32% Disk 30% Uptime 6h nginx apache2 named mariadb postgresql postfix dovecot proftpd ufw fail2ban cloudflared
- main:
  - img
  - heading "Failed to load" [level=3]
  - paragraph: Too many requests
  - button "Try again"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { login, loginViaApi } from '../helpers';
  3  | 
  4  | const DOMAIN_NAME = `e2e-add-domain-${Date.now()}.com`;
  5  | 
  6  | test.describe.configure({ mode: 'serial' });
  7  | 
  8  | test.describe('Add Domain Flow', () => {
  9  |   let domainId: string;
  10 | 
  11 |   test('login and navigate to domains', async ({ page }) => {
  12 |     await login(page);
  13 |     await page.goto('/domains');
  14 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  15 |     await expect(page).toHaveURL(/\/domains/);
  16 |   });
  17 | 
  18 |   test('click add domain button', async ({ page }) => {
  19 |     await login(page);
  20 |     await page.goto('/domains');
  21 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  22 |     const addBtn = page.locator('button:has-text("Add"), button:has-text("New Domain"), a:has-text("Add Domain")').first();
> 23 |     await expect(addBtn).toBeVisible({ timeout: 10000 });
     |                          ^ Error: expect(locator).toBeVisible() failed
  24 |   });
  25 | 
  26 |   test('create domain via API', async ({ page }) => {
  27 |     const sessionId = await loginViaApi(page.request);
  28 |     if (!sessionId) {
  29 |       test.skip();
  30 |       return;
  31 |     }
  32 | 
  33 |     const createRes = await page.request.post('/api/v1/domains', {
  34 |       headers: { Cookie: `sf_session=${sessionId}`, 'Content-Type': 'application/json' },
  35 |       data: { name: DOMAIN_NAME, skipDnsVerification: true },
  36 |     });
  37 | 
  38 |     if (createRes.status() === 201) {
  39 |       const createBody = await createRes.json();
  40 |       domainId = createBody.data.id;
  41 |       expect(createBody.data.name).toBe(DOMAIN_NAME);
  42 |     } else {
  43 |       test.skip();
  44 |       return;
  45 |     }
  46 |   });
  47 | 
  48 |   test('verify domain appears in list', async ({ page }) => {
  49 |     if (!domainId) return;
  50 |     await login(page);
  51 |     await page.goto('/domains');
  52 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  53 |     await page.reload();
  54 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  55 |     await expect(page.locator(`text=${DOMAIN_NAME}`).first()).toBeVisible({ timeout: 10000 });
  56 |   });
  57 | 
  58 |   test('clean up created domain', async ({ page }) => {
  59 |     if (!domainId) return;
  60 |     const res = await page.request.delete(`/api/v1/domains/${domainId}`);
  61 |     expect([200, 204]).toContain(res.status());
  62 |   });
  63 | });
  64 | 
  65 | test.afterAll(async ({ request }) => {
  66 |   const sessionId = await loginViaApi(request);
  67 |   if (!sessionId) return;
  68 | 
  69 |   const listRes = await request.get('/api/v1/domains', {
  70 |     headers: { Cookie: `sf_session=${sessionId}` },
  71 |   });
  72 |   if (listRes.ok()) {
  73 |     const body = await listRes.json();
  74 |     const e2eDomains = (body.data || []).filter((d: any) => d.name?.startsWith('e2e-add-domain-'));
  75 |     for (const domain of e2eDomains) {
  76 |       await request.delete(`/api/v1/domains/${domain.id}`).catch(() => {});
  77 |     }
  78 |   }
  79 | });
```