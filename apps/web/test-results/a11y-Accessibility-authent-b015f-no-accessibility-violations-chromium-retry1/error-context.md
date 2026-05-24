# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility (authenticated) >> Dashboard page has no accessibility violations
- Location: tests\a11y.spec.ts:54:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 4
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Apps</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(1) > .mb-1.px-4 > .uppercase.tracking-wide.text-section-label"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Server</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(2) > .mb-1.px-4 > .uppercase.tracking-wide.text-section-label"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Domains</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(3) > .mb-1.px-4 > .uppercase.tracking-wide.text-section-label"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">System</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(4) > .mb-1.px-4 > .uppercase.tracking-wide.text-section-label"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<div class=\"text-meta text-foreground-tertiary mb-1\">CPU</div>", "impact": "serious", "none": [], "target": [".rounded-lg.bg-background-secondary.p-4:nth-child(1) > .text-meta.mb-1.text-foreground-tertiary"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<div class=\"text-meta text-foreground-tertiary mb-1\">RAM</div>", "impact": "serious", "none": [], "target": [".rounded-lg.bg-background-secondary.p-4:nth-child(2) > .text-meta.mb-1.text-foreground-tertiary"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<div class=\"text-meta text-foreground-tertiary mb-1\">Disk</div>", "impact": "serious", "none": [], "target": [".rounded-lg.bg-background-secondary.p-4:nth-child(3) > .text-meta.mb-1.text-foreground-tertiary"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<div class=\"text-meta text-foreground-tertiary mb-1\">Sites</div>", "impact": "serious", "none": [], "target": [".rounded-lg.bg-background-secondary.p-4:nth-child(4) > .text-meta.mb-1.text-foreground-tertiary"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure the order of headings is semantically correct", "help": "Heading levels should only increase by one", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/heading-order?application=playwright", "id": "heading-order", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Heading order invalid", "html": "<h3 class=\"text-card-title font-medium\">Services</h3>", "impact": "moderate", "none": [], "target": [".border.rounded-xl.bg-background-primary:nth-child(1) > .mb-3.justify-between.flex > h3"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure landmarks are unique", "help": "Landmarks should have a unique role or role/label/title (i.e. accessible name) combination", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-unique?application=playwright", "id": "landmark-unique", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable", "html": "<nav class=\"flex-1 overflow-y-auto py-2\">", "impact": "moderate", "none": [], "target": ["aside > nav"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div class=\"h-9 flex items-center px-6 bg-background-secondary border-b border-border-tertiary text-small gap-6\">", "impact": "moderate", "none": [], "target": [".h-9"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e6]: NovaPanel
    - navigation [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: Apps
        - list [ref=e10]:
          - listitem [ref=e11]:
            - link "Sites" [ref=e12] [cursor=pointer]:
              - /url: /sites
              - img [ref=e13]
              - generic [ref=e17]: Sites
          - listitem [ref=e18]:
            - link "Databases" [ref=e19] [cursor=pointer]:
              - /url: /databases
              - img [ref=e20]
              - generic [ref=e24]: Databases
          - listitem [ref=e25]:
            - link "Cron Jobs" [ref=e26] [cursor=pointer]:
              - /url: /cron
              - img [ref=e27]
              - generic [ref=e30]: Cron Jobs
          - listitem [ref=e31]:
            - link "Installer" [ref=e32] [cursor=pointer]:
              - /url: /installer
              - img [ref=e33]
              - generic [ref=e36]: Installer
      - generic [ref=e37]:
        - generic [ref=e38]: Server
        - list [ref=e39]:
          - listitem [ref=e40]:
            - link "Services" [ref=e41] [cursor=pointer]:
              - /url: /services
              - img [ref=e42]
              - generic [ref=e45]: Services
          - listitem [ref=e46]:
            - link "Firewall" [ref=e47] [cursor=pointer]:
              - /url: /firewall
              - img [ref=e48]
              - generic [ref=e50]: Firewall
          - listitem [ref=e51]:
            - link "Backups" [ref=e52] [cursor=pointer]:
              - /url: /backups
              - img [ref=e53]
              - generic [ref=e56]: Backups
          - listitem [ref=e57]:
            - link "Terminal" [ref=e58] [cursor=pointer]:
              - /url: /terminal
              - img [ref=e59]
              - generic [ref=e61]: Terminal
          - listitem [ref=e62]:
            - link "Files" [ref=e63] [cursor=pointer]:
              - /url: /files
              - img [ref=e64]
              - generic [ref=e66]: Files
      - generic [ref=e67]:
        - generic [ref=e68]: Domains
        - list [ref=e69]:
          - listitem [ref=e70]:
            - link "Domains" [ref=e71] [cursor=pointer]:
              - /url: /domains
              - img [ref=e72]
              - generic [ref=e76]: Domains
          - listitem [ref=e77]:
            - link "DNS" [ref=e78] [cursor=pointer]:
              - /url: /dns
              - img [ref=e79]
              - generic [ref=e81]: DNS
          - listitem [ref=e82]:
            - link "SSL" [ref=e83] [cursor=pointer]:
              - /url: /ssl
              - img [ref=e84]
              - generic [ref=e88]: SSL
          - listitem [ref=e89]:
            - link "Mail" [ref=e90] [cursor=pointer]:
              - /url: /mail
              - img [ref=e91]
              - generic [ref=e94]: Mail
          - listitem [ref=e95]:
            - link "FTP" [ref=e96] [cursor=pointer]:
              - /url: /ftp
              - img [ref=e97]
              - generic [ref=e100]: FTP
      - generic [ref=e101]:
        - generic [ref=e102]: System
        - list [ref=e103]:
          - listitem [ref=e104]:
            - link "Monitoring" [ref=e105] [cursor=pointer]:
              - /url: /monitoring
              - img [ref=e106]
              - generic [ref=e110]: Monitoring
          - listitem [ref=e111]:
            - link "Logs" [ref=e112] [cursor=pointer]:
              - /url: /logs
              - img [ref=e113]
              - generic [ref=e116]: Logs
          - listitem [ref=e117]:
            - link "Containers" [ref=e118] [cursor=pointer]:
              - /url: /containers
              - img [ref=e119]
              - generic [ref=e123]: Containers
          - listitem [ref=e124]:
            - link "Jobs" [ref=e125] [cursor=pointer]:
              - /url: /jobs
              - img [ref=e126]
              - generic [ref=e127]: Jobs
          - listitem [ref=e128]:
            - link "Audit" [ref=e129] [cursor=pointer]:
              - /url: /audit
              - img [ref=e130]
              - generic [ref=e133]: Audit
      - generic [ref=e134]:
        - generic [ref=e135]: Settings
        - list [ref=e136]:
          - listitem [ref=e137]:
            - link "Server Settings" [ref=e138] [cursor=pointer]:
              - /url: /settings
              - img [ref=e139]
              - generic [ref=e142]: Server Settings
          - listitem [ref=e143]:
            - link "Security" [ref=e144] [cursor=pointer]:
              - /url: /security
              - img [ref=e145]
              - generic [ref=e148]: Security
          - listitem [ref=e149]:
            - link "Notifications" [ref=e150] [cursor=pointer]:
              - /url: /notifications
              - img [ref=e151]
              - generic [ref=e154]: Notifications
          - listitem [ref=e155]:
            - link "Webhooks" [ref=e156] [cursor=pointer]:
              - /url: /webhooks
              - img [ref=e157]
              - generic [ref=e161]: Webhooks
          - listitem [ref=e162]:
            - link "API Tokens" [ref=e163] [cursor=pointer]:
              - /url: /settings/api-tokens
              - img [ref=e164]
              - generic [ref=e166]: API Tokens
          - listitem [ref=e167]:
            - link "Plugins" [ref=e168] [cursor=pointer]:
              - /url: /plugins
              - img [ref=e169]
              - generic [ref=e171]: Plugins
          - listitem [ref=e172]:
            - link "Billing" [ref=e173] [cursor=pointer]:
              - /url: /billing
              - img [ref=e174]
              - generic [ref=e176]: Billing
          - listitem [ref=e177]:
            - link "Organizations" [ref=e178] [cursor=pointer]:
              - /url: /organizations
              - img [ref=e179]
              - generic [ref=e181]: Organizations
          - listitem [ref=e182]:
            - link "Profile" [ref=e183] [cursor=pointer]:
              - /url: /settings/profile
              - img [ref=e184]
              - generic [ref=e187]: Profile
  - generic [ref=e188]:
    - banner [ref=e189]:
      - navigation [ref=e190]:
        - generic [ref=e192]: Dashboard
      - generic [ref=e193]:
        - button "Search" [ref=e194] [cursor=pointer]:
          - img [ref=e195]
        - button "Notifications" [ref=e198] [cursor=pointer]:
          - img [ref=e199]
        - button "User menu" [ref=e202] [cursor=pointer]:
          - img [ref=e203]
    - generic [ref=e206]:
      - generic [ref=e207]:
        - generic [ref=e208]: CPU
        - generic [ref=e209]: 38%
      - generic [ref=e210]:
        - generic [ref=e211]: RAM
        - generic [ref=e212]: 83%
      - generic [ref=e213]:
        - generic [ref=e214]: Disk
        - generic [ref=e215]: 30%
      - generic [ref=e216]:
        - generic [ref=e217]: Uptime
        - generic [ref=e218]: 4d 12h
      - generic [ref=e219]:
        - generic [ref=e222]: nginx
        - generic [ref=e225]: apache2
        - generic [ref=e228]: named
        - generic [ref=e231]: mariadb
        - generic [ref=e234]: postgresql
        - generic [ref=e237]: postfix
        - generic [ref=e240]: dovecot
        - generic [ref=e243]: proftpd
        - generic [ref=e246]: ufw
        - generic [ref=e249]: fail2ban
        - generic [ref=e252]: cloudflared
    - main [ref=e253]:
      - generic [ref=e254]:
        - heading "Dashboard" [level=1] [ref=e256]
        - generic [ref=e257]:
          - generic [ref=e258]:
            - generic [ref=e259]: CPU
            - generic [ref=e260]: "38"
            - generic [ref=e261]: "%"
          - generic [ref=e262]:
            - generic [ref=e263]: RAM
            - generic [ref=e264]: "83"
            - generic [ref=e265]: "%"
          - generic [ref=e266]:
            - generic [ref=e267]: Disk
            - generic [ref=e268]: "30"
            - generic [ref=e269]: "%"
          - generic [ref=e270]:
            - generic [ref=e271]: Sites
            - generic [ref=e272]: "0"
        - generic [ref=e273]:
          - generic [ref=e274]:
            - heading "Services" [level=3] [ref=e276]
            - generic [ref=e277]:
              - generic [ref=e278]:
                - generic [ref=e279]: nginx
                - generic [ref=e280]: Running
              - generic [ref=e282]:
                - generic [ref=e283]: apache2
                - generic [ref=e284]: Running
              - generic [ref=e286]:
                - generic [ref=e287]: named
                - generic [ref=e288]: Running
              - generic [ref=e290]:
                - generic [ref=e291]: mariadb
                - generic [ref=e292]: Running
              - generic [ref=e294]:
                - generic [ref=e295]: postgresql
                - generic [ref=e296]: Running
              - generic [ref=e298]:
                - generic [ref=e299]: postfix
                - generic [ref=e300]: Running
              - generic [ref=e302]:
                - generic [ref=e303]: dovecot
                - generic [ref=e304]: Running
              - generic [ref=e306]:
                - generic [ref=e307]: proftpd
                - generic [ref=e308]: Running
              - generic [ref=e310]:
                - generic [ref=e311]: ufw
                - generic [ref=e312]: Running
              - generic [ref=e314]:
                - generic [ref=e315]: fail2ban
                - generic [ref=e316]: Running
              - generic [ref=e318]:
                - generic [ref=e319]: cloudflared
                - generic [ref=e320]: Running
          - generic [ref=e322]:
            - heading "Recent Activity" [level=3] [ref=e324]
            - generic [ref=e325]:
              - generic [ref=e326]:
                - generic [ref=e327]: metric_collect
                - generic [ref=e328]: Pending
              - generic [ref=e330]:
                - generic [ref=e331]: alert_evaluate
                - generic [ref=e332]: Pending
              - generic [ref=e334]:
                - generic [ref=e335]: metric_collect
                - generic [ref=e336]: Pending
              - generic [ref=e338]:
                - generic [ref=e339]: alert_evaluate
                - generic [ref=e340]: Pending
              - generic [ref=e342]:
                - generic [ref=e343]: metric_collect
                - generic [ref=e344]: Pending
        - generic [ref=e346]:
          - heading "Quick Actions" [level=3] [ref=e348]
          - generic [ref=e349]:
            - button "Create Site" [ref=e350] [cursor=pointer]:
              - img [ref=e351]
              - text: Create Site
            - button "Open Terminal" [ref=e352] [cursor=pointer]:
              - img [ref=e353]
              - text: Open Terminal
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | const PUBLIC_PAGES = [
  5  |   { path: '/login', name: 'Login' },
  6  | ];
  7  | 
  8  | const PROTECTED_PAGES = [
  9  |   { path: '/dashboard', name: 'Dashboard' },
  10 |   { path: '/sites', name: 'Sites' },
  11 |   { path: '/domains', name: 'Domains' },
  12 |   { path: '/databases', name: 'Databases' },
  13 |   { path: '/ssl', name: 'SSL' },
  14 |   { path: '/dns', name: 'DNS' },
  15 |   { path: '/php', name: 'PHP' },
  16 |   { path: '/webserver', name: 'Webserver' },
  17 |   { path: '/firewall', name: 'Firewall' },
  18 |   { path: '/backups', name: 'Backups' },
  19 |   { path: '/monitoring', name: 'Monitoring' },
  20 |   { path: '/cron', name: 'Cron' },
  21 |   { path: '/mail', name: 'Mail' },
  22 |   { path: '/logs', name: 'Logs' },
  23 |   { path: '/files', name: 'Files' },
  24 |   { path: '/containers', name: 'Containers' },
  25 |   { path: '/registries', name: 'Registries' },
  26 |   { path: '/notifications', name: 'Notifications' },
  27 |   { path: '/security', name: 'Security' },
  28 |   { path: '/jobs', name: 'Jobs' },
  29 |   { path: '/settings', name: 'Settings' },
  30 | ];
  31 | 
  32 | test.describe('Accessibility', () => {
  33 |   for (const pageInfo of PUBLIC_PAGES) {
  34 |     test(`login page has no accessibility violations`, async ({ page }) => {
  35 |       await page.goto(pageInfo.path);
  36 |       await page.waitForLoadState('networkidle', { timeout: 15000 });
  37 |       const results = await new AxeBuilder({ page }).analyze();
  38 |       expect(results.violations).toHaveLength(0);
  39 |     });
  40 |   }
  41 | });
  42 | 
  43 | test.describe('Accessibility (authenticated)', () => {
  44 |   test.beforeEach(async ({ page }) => {
  45 |     await page.goto('/login');
  46 |     await page.waitForLoadState('networkidle', { timeout: 15000 });
  47 |     await page.locator('input[name="username"], input[type="text"]').first().fill('admin');
  48 |     await page.locator('input[type="password"]').first().fill('7656ea4205a1b648632549c37c2089dc');
  49 |     await page.locator('button[type="submit"]').first().click();
  50 |     await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  51 |   });
  52 | 
  53 |   for (const pageInfo of PROTECTED_PAGES) {
  54 |     test(`${pageInfo.name} page has no accessibility violations`, async ({ page }) => {
  55 |       await page.goto(pageInfo.path);
  56 |       await page.waitForLoadState('networkidle', { timeout: 15000 });
  57 |       const results = await new AxeBuilder({ page }).analyze();
> 58 |       expect(results.violations).toHaveLength(0);
     |                                  ^ Error: expect(received).toHaveLength(expected)
  59 |     });
  60 |   }
  61 | });
```