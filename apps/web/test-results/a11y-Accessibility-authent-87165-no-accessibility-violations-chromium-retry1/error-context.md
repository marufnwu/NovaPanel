# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility (authenticated) >> Webserver page has no accessibility violations
- Location: tests\a11y.spec.ts:54:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Apps</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(1) > .mb-1 > .text-section-label.text-foreground-tertiary.uppercase"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Server</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(2) > .mb-1 > .text-section-label.text-foreground-tertiary.uppercase"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Domains</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(3) > .mb-1 > .text-section-label.text-foreground-tertiary.uppercase"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">System</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(4) > .mb-1 > .text-section-label.text-foreground-tertiary.uppercase"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Domain</th>", "impact": "serious", "none": [], "target": ["th:nth-child(1)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Web Server</th>", "impact": "serious", "none": [], "target": ["th:nth-child(2)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Status</th>", "impact": "serious", "none": [], "target": ["th:nth-child(3)"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure table headers have discernible text", "help": "Table header text should not be empty", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/empty-table-header?application=playwright", "id": "empty-table-header", "impact": "minor", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element does not have text that is visible to screen readers", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\"></th>", "impact": "minor", "none": [], "target": ["th:nth-child(4)"]}], "tags": ["cat.name-role-value", "best-practice"]}, {"description": "Ensure the order of headings is semantically correct", "help": "Heading levels should only increase by one", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/heading-order?application=playwright", "id": "heading-order", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Heading order invalid", "html": "<h3 class=\"text-card-title font-medium\">Nginx</h3>", "impact": "moderate", "none": [], "target": [".p-4.bg-background-primary.border:nth-child(1) > .mb-3.justify-between > h3"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure landmarks are unique", "help": "Landmarks should have a unique role or role/label/title (i.e. accessible name) combination", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-unique?application=playwright", "id": "landmark-unique", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable", "html": "<nav class=\"flex-1 overflow-y-auto py-2\">", "impact": "moderate", "none": [], "target": ["aside > nav"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div class=\"h-9 flex items-center px-6 bg-background-secondary border-b border-border-tertiary text-small gap-6\">", "impact": "moderate", "none": [], "target": [".h-9"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
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
          - generic [ref=e192]: Web Server
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
          - generic [ref=e209]: 66%
        - generic [ref=e210]:
          - generic [ref=e211]: RAM
          - generic [ref=e212]: 32%
        - generic [ref=e213]:
          - generic [ref=e214]: Disk
          - generic [ref=e215]: 30%
        - generic [ref=e216]:
          - generic [ref=e217]: Uptime
          - generic [ref=e218]: 6h
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
          - heading "Web Server" [level=1] [ref=e256]
          - generic [ref=e257]:
            - generic [ref=e258]:
              - heading "Nginx" [level=3] [ref=e260]
              - generic [ref=e261]:
                - generic [ref=e262]: Stopped
                - button "Reload" [ref=e264] [cursor=pointer]
            - generic [ref=e265]:
              - heading "Apache" [level=3] [ref=e267]
              - generic [ref=e268]:
                - generic [ref=e269]: Stopped
                - button "Reload" [ref=e271] [cursor=pointer]
          - generic [ref=e272]:
            - heading "Domain Configurations" [level=3] [ref=e274]
            - table [ref=e276]:
              - rowgroup [ref=e277]:
                - row "Domain Web Server Status" [ref=e278]:
                  - columnheader "Domain" [ref=e279]
                  - columnheader "Web Server" [ref=e280]
                  - columnheader "Status" [ref=e281]
                  - columnheader [ref=e282]
              - rowgroup [ref=e283]:
                - row "e2e.example.com undefined Active Configure" [ref=e284]:
                  - cell "e2e.example.com" [ref=e285]
                  - cell "undefined" [ref=e286]
                  - cell "Active" [ref=e287]:
                    - generic [ref=e288]: Active
                  - cell "Configure" [ref=e290]:
                    - button "Configure" [ref=e291] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e292]:
                  - cell "e2e.example.com" [ref=e293]
                  - cell "undefined" [ref=e294]
                  - cell "Active" [ref=e295]:
                    - generic [ref=e296]: Active
                  - cell "Configure" [ref=e298]:
                    - button "Configure" [ref=e299] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e300]:
                  - cell "e2e.example.com" [ref=e301]
                  - cell "undefined" [ref=e302]
                  - cell "Active" [ref=e303]:
                    - generic [ref=e304]: Active
                  - cell "Configure" [ref=e306]:
                    - button "Configure" [ref=e307] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e308]:
                  - cell "e2e.example.com" [ref=e309]
                  - cell "undefined" [ref=e310]
                  - cell "Active" [ref=e311]:
                    - generic [ref=e312]: Active
                  - cell "Configure" [ref=e314]:
                    - button "Configure" [ref=e315] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e316]:
                  - cell "e2e.example.com" [ref=e317]
                  - cell "undefined" [ref=e318]
                  - cell "Active" [ref=e319]:
                    - generic [ref=e320]: Active
                  - cell "Configure" [ref=e322]:
                    - button "Configure" [ref=e323] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e324]:
                  - cell "e2e.example.com" [ref=e325]
                  - cell "undefined" [ref=e326]
                  - cell "Active" [ref=e327]:
                    - generic [ref=e328]: Active
                  - cell "Configure" [ref=e330]:
                    - button "Configure" [ref=e331] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e332]:
                  - cell "e2e.example.com" [ref=e333]
                  - cell "undefined" [ref=e334]
                  - cell "Active" [ref=e335]:
                    - generic [ref=e336]: Active
                  - cell "Configure" [ref=e338]:
                    - button "Configure" [ref=e339] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e340]:
                  - cell "e2e.example.com" [ref=e341]
                  - cell "undefined" [ref=e342]
                  - cell "Active" [ref=e343]:
                    - generic [ref=e344]: Active
                  - cell "Configure" [ref=e346]:
                    - button "Configure" [ref=e347] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e348]:
                  - cell "e2e.example.com" [ref=e349]
                  - cell "undefined" [ref=e350]
                  - cell "Active" [ref=e351]:
                    - generic [ref=e352]: Active
                  - cell "Configure" [ref=e354]:
                    - button "Configure" [ref=e355] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e356]:
                  - cell "e2e.example.com" [ref=e357]
                  - cell "undefined" [ref=e358]
                  - cell "Active" [ref=e359]:
                    - generic [ref=e360]: Active
                  - cell "Configure" [ref=e362]:
                    - button "Configure" [ref=e363] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e364]:
                  - cell "e2e.example.com" [ref=e365]
                  - cell "undefined" [ref=e366]
                  - cell "Active" [ref=e367]:
                    - generic [ref=e368]: Active
                  - cell "Configure" [ref=e370]:
                    - button "Configure" [ref=e371] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e372]:
                  - cell "e2e.example.com" [ref=e373]
                  - cell "undefined" [ref=e374]
                  - cell "Active" [ref=e375]:
                    - generic [ref=e376]: Active
                  - cell "Configure" [ref=e378]:
                    - button "Configure" [ref=e379] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e380]:
                  - cell "e2e.example.com" [ref=e381]
                  - cell "undefined" [ref=e382]
                  - cell "Active" [ref=e383]:
                    - generic [ref=e384]: Active
                  - cell "Configure" [ref=e386]:
                    - button "Configure" [ref=e387] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e388]:
                  - cell "e2e.example.com" [ref=e389]
                  - cell "undefined" [ref=e390]
                  - cell "Active" [ref=e391]:
                    - generic [ref=e392]: Active
                  - cell "Configure" [ref=e394]:
                    - button "Configure" [ref=e395] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e396]:
                  - cell "e2e.example.com" [ref=e397]
                  - cell "undefined" [ref=e398]
                  - cell "Active" [ref=e399]:
                    - generic [ref=e400]: Active
                  - cell "Configure" [ref=e402]:
                    - button "Configure" [ref=e403] [cursor=pointer]
                - row "e2e-domain-1779620107431.com undefined Active Configure" [ref=e404]:
                  - cell "e2e-domain-1779620107431.com" [ref=e405]
                  - cell "undefined" [ref=e406]
                  - cell "Active" [ref=e407]:
                    - generic [ref=e408]: Active
                  - cell "Configure" [ref=e410]:
                    - button "Configure" [ref=e411] [cursor=pointer]
                - row "e2e.example.com undefined Active Configure" [ref=e412]:
                  - cell "e2e.example.com" [ref=e413]
                  - cell "undefined" [ref=e414]
                  - cell "Active" [ref=e415]:
                    - generic [ref=e416]: Active
                  - cell "Configure" [ref=e418]:
                    - button "Configure" [ref=e419] [cursor=pointer]
                - row "e2e-add-domain-1779620162885.com undefined Active Configure" [ref=e420]:
                  - cell "e2e-add-domain-1779620162885.com" [ref=e421]
                  - cell "undefined" [ref=e422]
                  - cell "Active" [ref=e423]:
                    - generic [ref=e424]: Active
                  - cell "Configure" [ref=e426]:
                    - button "Configure" [ref=e427] [cursor=pointer]
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