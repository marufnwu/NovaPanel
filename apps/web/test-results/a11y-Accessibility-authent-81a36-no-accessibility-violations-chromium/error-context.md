# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility (authenticated) >> Backups page has no accessibility violations
- Location: tests\a11y.spec.ts:54:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  [{"description": "Ensure each HTML document contains a non-empty <title> element", "help": "Documents must have <title> element to aid in navigation", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/document-title?application=playwright", "id": "document-title", "impact": "serious", "nodes": [{"all": [], "any": [{"data": null, "id": "doc-has-title", "impact": "serious", "message": "Document does not have a non-empty <title> element", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Document does not have a non-empty <title> element", "html": "<html><head><meta name=\"color-scheme\" content=\"light dark\"><meta charset=\"utf-8\"></head><body><pre>{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}</pre><div class=\"json-formatter-container\"></div></body></html>", "impact": "serious", "none": [], "target": ["html"]}], "tags": ["cat.text-alternatives", "wcag2a", "wcag242", "TTv5", "TT12.a", "EN-301-549", "EN-9.2.4.2", "ACT", "RGAAv4", "RGAA-8.5.1"]}, {"description": "Ensure every HTML document has a lang attribute", "help": "<html> element must have a lang attribute", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/html-has-lang?application=playwright", "id": "html-has-lang", "impact": "serious", "nodes": [{"all": [], "any": [{"data": {"messageKey": "noLang"}, "id": "has-lang", "impact": "serious", "message": "The <html> element does not have a lang attribute", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  The <html> element does not have a lang attribute", "html": "<html><head><meta name=\"color-scheme\" content=\"light dark\"><meta charset=\"utf-8\"></head><body><pre>{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}</pre><div class=\"json-formatter-container\"></div></body></html>", "impact": "serious", "none": [], "target": ["html"]}], "tags": ["cat.language", "wcag2a", "wcag311", "TTv5", "TT11.a", "EN-301-549", "EN-9.3.1.1", "ACT", "RGAAv4", "RGAA-8.3.1"]}, {"description": "Ensure the document has a main landmark", "help": "Document should have one main landmark", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright", "id": "landmark-one-main", "impact": "moderate", "nodes": [{"all": [{"data": null, "id": "page-has-main", "impact": "moderate", "message": "Document does not have a main landmark", "relatedNodes": []}], "any": [], "failureSummary": "Fix all of the following:
  Document does not have a main landmark", "html": "<html><head><meta name=\"color-scheme\" content=\"light dark\"><meta charset=\"utf-8\"></head><body><pre>{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}</pre><div class=\"json-formatter-container\"></div></body></html>", "impact": "moderate", "none": [], "target": ["html"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure that the page, or at least one of its frames contains a level-one heading", "help": "Page should contain a level-one heading", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright", "id": "page-has-heading-one", "impact": "moderate", "nodes": [{"all": [{"data": null, "id": "page-has-heading-one", "impact": "moderate", "message": "Page must have a level-one heading", "relatedNodes": []}], "any": [], "failureSummary": "Fix all of the following:
  Page must have a level-one heading", "html": "<html><head><meta name=\"color-scheme\" content=\"light dark\"><meta charset=\"utf-8\"></head><body><pre>{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}</pre><div class=\"json-formatter-container\"></div></body></html>", "impact": "moderate", "none": [], "target": ["html"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<pre>{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}</pre>", "impact": "moderate", "none": [], "target": ["pre"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}]
```

# Page snapshot

```yaml
- generic [ref=e2]: "{\"success\":false,\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}"
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