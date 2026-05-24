# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility >> login page has no accessibility violations
- Location: tests\a11y.spec.ts:34:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 3
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [{"data": {"bgColor": "#60a5fa", "contrastRatio": 2.43, "expectedContrastRatio": "4.5:1", "fgColor": "#f9fafb", "fontSize": "9.8pt (13px)", "fontWeight": "normal", "messageKey": null}, "id": "color-contrast", "impact": "serious", "message": "Element has insufficient color contrast of 2.43 (foreground color: #f9fafb, background color: #60a5fa, font size: 9.8pt (13px), font weight: normal). Expected contrast ratio of 4.5:1", "relatedNodes": [{"html": "<button class=\"inline-flex items-ce...\" type=\"submit\">", "target": ["button"]}]}], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 2.43 (foreground color: #f9fafb, background color: #60a5fa, font size: 9.8pt (13px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<button class=\"inline-flex items-ce...\" type=\"submit\">", "impact": "serious", "none": [], "target": ["button"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure the document has a main landmark", "help": "Document should have one main landmark", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright", "id": "landmark-one-main", "impact": "moderate", "nodes": [{"all": [{"data": null, "id": "page-has-main", "impact": "moderate", "message": "Document does not have a main landmark", "relatedNodes": []}], "any": [], "failureSummary": "Fix all of the following:
  Document does not have a main landmark", "html": "<html lang=\"en\" class=\"dark\">", "impact": "moderate", "none": [], "target": ["html"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div class=\"text-center mb-8\"><h1 class=\"text-page-title font-medium mb-2\">NovaPanel</h1><p class=\"text-foreground-secondary\">Sign in to your account</p></div>", "impact": "moderate", "none": [], "target": [".text-center"]}, {"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div class=\"flex flex-col gap-1\">", "impact": "moderate", "none": [], "target": [".flex-col.gap-1.flex:nth-child(1)"]}, {"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div class=\"flex flex-col gap-1\">", "impact": "moderate", "none": [], "target": [".flex-col.gap-1.flex:nth-child(2)"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}]
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "NovaPanel" [level=1] [ref=e6]
    - paragraph [ref=e7]: Sign in to your account
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]: Username
      - textbox "Username" [ref=e11]:
        - /placeholder: Enter your username
    - generic [ref=e12]:
      - generic [ref=e13]: Password
      - textbox "Password" [ref=e14]:
        - /placeholder: Enter your password
    - button "Sign In" [ref=e15] [cursor=pointer]
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
> 38 |       expect(results.violations).toHaveLength(0);
     |                                  ^ Error: expect(received).toHaveLength(expected)
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
  58 |       expect(results.violations).toHaveLength(0);
  59 |     });
  60 |   }
  61 | });
```