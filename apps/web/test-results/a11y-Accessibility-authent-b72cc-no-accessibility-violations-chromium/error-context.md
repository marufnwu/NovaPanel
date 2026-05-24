# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility (authenticated) >> Jobs page has no accessibility violations
- Location: tests\a11y.spec.ts:54:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 4
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Apps</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(1) > .mb-1 > .text-section-label.uppercase.tracking-wide"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Server</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(2) > .mb-1 > .text-section-label.uppercase.tracking-wide"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">Domains</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(3) > .mb-1 > .text-section-label.uppercase.tracking-wide"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #6b7280, background color: #1a1d27, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"text-section-label text-foreground-tertiary uppercase tracking-wide\">System</span>", "impact": "serious", "none": [], "target": [".mb-4:nth-child(4) > .mb-1 > .text-section-label.uppercase.tracking-wide"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 2.43 (foreground color: #f9fafb, background color: #60a5fa, font size: 9.8pt (13px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<button class=\"inline-flex items-ce...\">", "impact": "serious", "none": [], "target": [".bg-foreground-info"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Type</th>", "impact": "serious", "none": [], "target": ["th:nth-child(1)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Status</th>", "impact": "serious", "none": [], "target": ["th:nth-child(2)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Attempts</th>", "impact": "serious", "none": [], "target": ["th:nth-child(3)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Scheduled</th>", "impact": "serious", "none": [], "target": ["th:nth-child(4)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.9 (foreground color: #6b7280, background color: #0f1117, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\">Duration</th>", "impact": "serious", "none": [], "target": ["th:nth-child(5)"]}, …], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure table headers have discernible text", "help": "Table header text should not be empty", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/empty-table-header?application=playwright", "id": "empty-table-header", "impact": "minor", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element does not have text that is visible to screen readers", "html": "<th class=\"text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary\"></th>", "impact": "minor", "none": [], "target": ["th:nth-child(6)"]}], "tags": ["cat.name-role-value", "best-practice"]}, {"description": "Ensure landmarks are unique", "help": "Landmarks should have a unique role or role/label/title (i.e. accessible name) combination", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-unique?application=playwright", "id": "landmark-unique", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
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
          - generic [ref=e192]: Jobs
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
          - generic [ref=e209]: 56%
        - generic [ref=e210]:
          - generic [ref=e211]: RAM
          - generic [ref=e212]: 33%
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
          - heading "Background Jobs" [level=1] [ref=e256]
          - generic [ref=e257]:
            - button "All" [ref=e258] [cursor=pointer]
            - button "Pending" [ref=e259] [cursor=pointer]
            - button "Running" [ref=e260] [cursor=pointer]
            - button "Success" [ref=e261] [cursor=pointer]
            - button "Failed" [ref=e262] [cursor=pointer]
          - table [ref=e265]:
            - rowgroup [ref=e266]:
              - row "Type Status Attempts Scheduled Duration" [ref=e267]:
                - columnheader "Type" [ref=e268]
                - columnheader "Status" [ref=e269]
                - columnheader "Attempts" [ref=e270]
                - columnheader "Scheduled" [ref=e271]
                - columnheader "Duration" [ref=e272]
                - columnheader [ref=e273]
            - rowgroup [ref=e274]:
              - row "metric_collect success Completed 0/1 5/22/2026, 2:53:13 AM 0ms" [ref=e275]:
                - cell "metric_collect success" [ref=e276]:
                  - generic [ref=e277]:
                    - text: metric_collect
                    - paragraph [ref=e278]: success
                - cell "Completed" [ref=e279]:
                  - generic [ref=e280]: Completed
                - cell "0/1" [ref=e282]:
                  - generic [ref=e283]: 0/1
                - cell "5/22/2026, 2:53:13 AM" [ref=e284]
                - cell "0ms" [ref=e285]
                - cell [ref=e286]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:53:13 AM 0ms" [ref=e287]:
                - cell "alert_evaluate success" [ref=e288]:
                  - generic [ref=e289]:
                    - text: alert_evaluate
                    - paragraph [ref=e290]: success
                - cell "Completed" [ref=e291]:
                  - generic [ref=e292]: Completed
                - cell "0/1" [ref=e294]:
                  - generic [ref=e295]: 0/1
                - cell "5/22/2026, 2:53:13 AM" [ref=e296]
                - cell "0ms" [ref=e297]
                - cell [ref=e298]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:54:13 AM 0ms" [ref=e299]:
                - cell "metric_collect success" [ref=e300]:
                  - generic [ref=e301]:
                    - text: metric_collect
                    - paragraph [ref=e302]: success
                - cell "Completed" [ref=e303]:
                  - generic [ref=e304]: Completed
                - cell "0/1" [ref=e306]:
                  - generic [ref=e307]: 0/1
                - cell "5/22/2026, 2:54:13 AM" [ref=e308]
                - cell "0ms" [ref=e309]
                - cell [ref=e310]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:54:13 AM 0ms" [ref=e311]:
                - cell "alert_evaluate success" [ref=e312]:
                  - generic [ref=e313]:
                    - text: alert_evaluate
                    - paragraph [ref=e314]: success
                - cell "Completed" [ref=e315]:
                  - generic [ref=e316]: Completed
                - cell "0/1" [ref=e318]:
                  - generic [ref=e319]: 0/1
                - cell "5/22/2026, 2:54:13 AM" [ref=e320]
                - cell "0ms" [ref=e321]
                - cell [ref=e322]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:55:13 AM 0ms" [ref=e323]:
                - cell "metric_collect success" [ref=e324]:
                  - generic [ref=e325]:
                    - text: metric_collect
                    - paragraph [ref=e326]: success
                - cell "Completed" [ref=e327]:
                  - generic [ref=e328]: Completed
                - cell "0/1" [ref=e330]:
                  - generic [ref=e331]: 0/1
                - cell "5/22/2026, 2:55:13 AM" [ref=e332]
                - cell "0ms" [ref=e333]
                - cell [ref=e334]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:55:13 AM 0ms" [ref=e335]:
                - cell "alert_evaluate success" [ref=e336]:
                  - generic [ref=e337]:
                    - text: alert_evaluate
                    - paragraph [ref=e338]: success
                - cell "Completed" [ref=e339]:
                  - generic [ref=e340]: Completed
                - cell "0/1" [ref=e342]:
                  - generic [ref=e343]: 0/1
                - cell "5/22/2026, 2:55:13 AM" [ref=e344]
                - cell "0ms" [ref=e345]
                - cell [ref=e346]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:56:13 AM 1.0s" [ref=e347]:
                - cell "metric_collect success" [ref=e348]:
                  - generic [ref=e349]:
                    - text: metric_collect
                    - paragraph [ref=e350]: success
                - cell "Completed" [ref=e351]:
                  - generic [ref=e352]: Completed
                - cell "0/1" [ref=e354]:
                  - generic [ref=e355]: 0/1
                - cell "5/22/2026, 2:56:13 AM" [ref=e356]
                - cell "1.0s" [ref=e357]
                - cell [ref=e358]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:56:13 AM 0ms" [ref=e359]:
                - cell "alert_evaluate success" [ref=e360]:
                  - generic [ref=e361]:
                    - text: alert_evaluate
                    - paragraph [ref=e362]: success
                - cell "Completed" [ref=e363]:
                  - generic [ref=e364]: Completed
                - cell "0/1" [ref=e366]:
                  - generic [ref=e367]: 0/1
                - cell "5/22/2026, 2:56:13 AM" [ref=e368]
                - cell "0ms" [ref=e369]
                - cell [ref=e370]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:57:13 AM 1.0s" [ref=e371]:
                - cell "metric_collect success" [ref=e372]:
                  - generic [ref=e373]:
                    - text: metric_collect
                    - paragraph [ref=e374]: success
                - cell "Completed" [ref=e375]:
                  - generic [ref=e376]: Completed
                - cell "0/1" [ref=e378]:
                  - generic [ref=e379]: 0/1
                - cell "5/22/2026, 2:57:13 AM" [ref=e380]
                - cell "1.0s" [ref=e381]
                - cell [ref=e382]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:57:13 AM 0ms" [ref=e383]:
                - cell "alert_evaluate success" [ref=e384]:
                  - generic [ref=e385]:
                    - text: alert_evaluate
                    - paragraph [ref=e386]: success
                - cell "Completed" [ref=e387]:
                  - generic [ref=e388]: Completed
                - cell "0/1" [ref=e390]:
                  - generic [ref=e391]: 0/1
                - cell "5/22/2026, 2:57:13 AM" [ref=e392]
                - cell "0ms" [ref=e393]
                - cell [ref=e394]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:58:13 AM 1.0s" [ref=e395]:
                - cell "metric_collect success" [ref=e396]:
                  - generic [ref=e397]:
                    - text: metric_collect
                    - paragraph [ref=e398]: success
                - cell "Completed" [ref=e399]:
                  - generic [ref=e400]: Completed
                - cell "0/1" [ref=e402]:
                  - generic [ref=e403]: 0/1
                - cell "5/22/2026, 2:58:13 AM" [ref=e404]
                - cell "1.0s" [ref=e405]
                - cell [ref=e406]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:58:13 AM 0ms" [ref=e407]:
                - cell "alert_evaluate success" [ref=e408]:
                  - generic [ref=e409]:
                    - text: alert_evaluate
                    - paragraph [ref=e410]: success
                - cell "Completed" [ref=e411]:
                  - generic [ref=e412]: Completed
                - cell "0/1" [ref=e414]:
                  - generic [ref=e415]: 0/1
                - cell "5/22/2026, 2:58:13 AM" [ref=e416]
                - cell "0ms" [ref=e417]
                - cell [ref=e418]
              - row "metric_collect success Completed 0/1 5/22/2026, 2:59:13 AM 0ms" [ref=e419]:
                - cell "metric_collect success" [ref=e420]:
                  - generic [ref=e421]:
                    - text: metric_collect
                    - paragraph [ref=e422]: success
                - cell "Completed" [ref=e423]:
                  - generic [ref=e424]: Completed
                - cell "0/1" [ref=e426]:
                  - generic [ref=e427]: 0/1
                - cell "5/22/2026, 2:59:13 AM" [ref=e428]
                - cell "0ms" [ref=e429]
                - cell [ref=e430]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 2:59:13 AM 0ms" [ref=e431]:
                - cell "alert_evaluate success" [ref=e432]:
                  - generic [ref=e433]:
                    - text: alert_evaluate
                    - paragraph [ref=e434]: success
                - cell "Completed" [ref=e435]:
                  - generic [ref=e436]: Completed
                - cell "0/1" [ref=e438]:
                  - generic [ref=e439]: 0/1
                - cell "5/22/2026, 2:59:13 AM" [ref=e440]
                - cell "0ms" [ref=e441]
                - cell [ref=e442]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:00:13 AM 0ms" [ref=e443]:
                - cell "metric_collect success" [ref=e444]:
                  - generic [ref=e445]:
                    - text: metric_collect
                    - paragraph [ref=e446]: success
                - cell "Completed" [ref=e447]:
                  - generic [ref=e448]: Completed
                - cell "0/1" [ref=e450]:
                  - generic [ref=e451]: 0/1
                - cell "5/22/2026, 3:00:13 AM" [ref=e452]
                - cell "0ms" [ref=e453]
                - cell [ref=e454]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:00:13 AM 0ms" [ref=e455]:
                - cell "alert_evaluate success" [ref=e456]:
                  - generic [ref=e457]:
                    - text: alert_evaluate
                    - paragraph [ref=e458]: success
                - cell "Completed" [ref=e459]:
                  - generic [ref=e460]: Completed
                - cell "0/1" [ref=e462]:
                  - generic [ref=e463]: 0/1
                - cell "5/22/2026, 3:00:13 AM" [ref=e464]
                - cell "0ms" [ref=e465]
                - cell [ref=e466]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:01:13 AM 0ms" [ref=e467]:
                - cell "metric_collect success" [ref=e468]:
                  - generic [ref=e469]:
                    - text: metric_collect
                    - paragraph [ref=e470]: success
                - cell "Completed" [ref=e471]:
                  - generic [ref=e472]: Completed
                - cell "0/1" [ref=e474]:
                  - generic [ref=e475]: 0/1
                - cell "5/22/2026, 3:01:13 AM" [ref=e476]
                - cell "0ms" [ref=e477]
                - cell [ref=e478]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:01:13 AM 0ms" [ref=e479]:
                - cell "alert_evaluate success" [ref=e480]:
                  - generic [ref=e481]:
                    - text: alert_evaluate
                    - paragraph [ref=e482]: success
                - cell "Completed" [ref=e483]:
                  - generic [ref=e484]: Completed
                - cell "0/1" [ref=e486]:
                  - generic [ref=e487]: 0/1
                - cell "5/22/2026, 3:01:13 AM" [ref=e488]
                - cell "0ms" [ref=e489]
                - cell [ref=e490]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:02:13 AM 0ms" [ref=e491]:
                - cell "metric_collect success" [ref=e492]:
                  - generic [ref=e493]:
                    - text: metric_collect
                    - paragraph [ref=e494]: success
                - cell "Completed" [ref=e495]:
                  - generic [ref=e496]: Completed
                - cell "0/1" [ref=e498]:
                  - generic [ref=e499]: 0/1
                - cell "5/22/2026, 3:02:13 AM" [ref=e500]
                - cell "0ms" [ref=e501]
                - cell [ref=e502]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:02:13 AM 0ms" [ref=e503]:
                - cell "alert_evaluate success" [ref=e504]:
                  - generic [ref=e505]:
                    - text: alert_evaluate
                    - paragraph [ref=e506]: success
                - cell "Completed" [ref=e507]:
                  - generic [ref=e508]: Completed
                - cell "0/1" [ref=e510]:
                  - generic [ref=e511]: 0/1
                - cell "5/22/2026, 3:02:13 AM" [ref=e512]
                - cell "0ms" [ref=e513]
                - cell [ref=e514]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:03:13 AM 0ms" [ref=e515]:
                - cell "metric_collect success" [ref=e516]:
                  - generic [ref=e517]:
                    - text: metric_collect
                    - paragraph [ref=e518]: success
                - cell "Completed" [ref=e519]:
                  - generic [ref=e520]: Completed
                - cell "0/1" [ref=e522]:
                  - generic [ref=e523]: 0/1
                - cell "5/22/2026, 3:03:13 AM" [ref=e524]
                - cell "0ms" [ref=e525]
                - cell [ref=e526]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:03:13 AM 0ms" [ref=e527]:
                - cell "alert_evaluate success" [ref=e528]:
                  - generic [ref=e529]:
                    - text: alert_evaluate
                    - paragraph [ref=e530]: success
                - cell "Completed" [ref=e531]:
                  - generic [ref=e532]: Completed
                - cell "0/1" [ref=e534]:
                  - generic [ref=e535]: 0/1
                - cell "5/22/2026, 3:03:13 AM" [ref=e536]
                - cell "0ms" [ref=e537]
                - cell [ref=e538]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:04:04 AM 0ms" [ref=e539]:
                - cell "metric_collect success" [ref=e540]:
                  - generic [ref=e541]:
                    - text: metric_collect
                    - paragraph [ref=e542]: success
                - cell "Completed" [ref=e543]:
                  - generic [ref=e544]: Completed
                - cell "0/1" [ref=e546]:
                  - generic [ref=e547]: 0/1
                - cell "5/22/2026, 3:04:04 AM" [ref=e548]
                - cell "0ms" [ref=e549]
                - cell [ref=e550]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:04:04 AM 0ms" [ref=e551]:
                - cell "alert_evaluate success" [ref=e552]:
                  - generic [ref=e553]:
                    - text: alert_evaluate
                    - paragraph [ref=e554]: success
                - cell "Completed" [ref=e555]:
                  - generic [ref=e556]: Completed
                - cell "0/1" [ref=e558]:
                  - generic [ref=e559]: 0/1
                - cell "5/22/2026, 3:04:04 AM" [ref=e560]
                - cell "0ms" [ref=e561]
                - cell [ref=e562]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:05:03 AM 0ms" [ref=e563]:
                - cell "metric_collect success" [ref=e564]:
                  - generic [ref=e565]:
                    - text: metric_collect
                    - paragraph [ref=e566]: success
                - cell "Completed" [ref=e567]:
                  - generic [ref=e568]: Completed
                - cell "0/1" [ref=e570]:
                  - generic [ref=e571]: 0/1
                - cell "5/22/2026, 3:05:03 AM" [ref=e572]
                - cell "0ms" [ref=e573]
                - cell [ref=e574]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:05:03 AM 0ms" [ref=e575]:
                - cell "alert_evaluate success" [ref=e576]:
                  - generic [ref=e577]:
                    - text: alert_evaluate
                    - paragraph [ref=e578]: success
                - cell "Completed" [ref=e579]:
                  - generic [ref=e580]: Completed
                - cell "0/1" [ref=e582]:
                  - generic [ref=e583]: 0/1
                - cell "5/22/2026, 3:05:03 AM" [ref=e584]
                - cell "0ms" [ref=e585]
                - cell [ref=e586]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:06:03 AM 0ms" [ref=e587]:
                - cell "metric_collect success" [ref=e588]:
                  - generic [ref=e589]:
                    - text: metric_collect
                    - paragraph [ref=e590]: success
                - cell "Completed" [ref=e591]:
                  - generic [ref=e592]: Completed
                - cell "0/1" [ref=e594]:
                  - generic [ref=e595]: 0/1
                - cell "5/22/2026, 3:06:03 AM" [ref=e596]
                - cell "0ms" [ref=e597]
                - cell [ref=e598]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:06:03 AM 0ms" [ref=e599]:
                - cell "alert_evaluate success" [ref=e600]:
                  - generic [ref=e601]:
                    - text: alert_evaluate
                    - paragraph [ref=e602]: success
                - cell "Completed" [ref=e603]:
                  - generic [ref=e604]: Completed
                - cell "0/1" [ref=e606]:
                  - generic [ref=e607]: 0/1
                - cell "5/22/2026, 3:06:03 AM" [ref=e608]
                - cell "0ms" [ref=e609]
                - cell [ref=e610]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:07:03 AM 0ms" [ref=e611]:
                - cell "metric_collect success" [ref=e612]:
                  - generic [ref=e613]:
                    - text: metric_collect
                    - paragraph [ref=e614]: success
                - cell "Completed" [ref=e615]:
                  - generic [ref=e616]: Completed
                - cell "0/1" [ref=e618]:
                  - generic [ref=e619]: 0/1
                - cell "5/22/2026, 3:07:03 AM" [ref=e620]
                - cell "0ms" [ref=e621]
                - cell [ref=e622]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:07:03 AM 0ms" [ref=e623]:
                - cell "alert_evaluate success" [ref=e624]:
                  - generic [ref=e625]:
                    - text: alert_evaluate
                    - paragraph [ref=e626]: success
                - cell "Completed" [ref=e627]:
                  - generic [ref=e628]: Completed
                - cell "0/1" [ref=e630]:
                  - generic [ref=e631]: 0/1
                - cell "5/22/2026, 3:07:03 AM" [ref=e632]
                - cell "0ms" [ref=e633]
                - cell [ref=e634]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:08:03 AM 0ms" [ref=e635]:
                - cell "metric_collect success" [ref=e636]:
                  - generic [ref=e637]:
                    - text: metric_collect
                    - paragraph [ref=e638]: success
                - cell "Completed" [ref=e639]:
                  - generic [ref=e640]: Completed
                - cell "0/1" [ref=e642]:
                  - generic [ref=e643]: 0/1
                - cell "5/22/2026, 3:08:03 AM" [ref=e644]
                - cell "0ms" [ref=e645]
                - cell [ref=e646]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:08:03 AM 0ms" [ref=e647]:
                - cell "alert_evaluate success" [ref=e648]:
                  - generic [ref=e649]:
                    - text: alert_evaluate
                    - paragraph [ref=e650]: success
                - cell "Completed" [ref=e651]:
                  - generic [ref=e652]: Completed
                - cell "0/1" [ref=e654]:
                  - generic [ref=e655]: 0/1
                - cell "5/22/2026, 3:08:03 AM" [ref=e656]
                - cell "0ms" [ref=e657]
                - cell [ref=e658]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:09:03 AM 0ms" [ref=e659]:
                - cell "metric_collect success" [ref=e660]:
                  - generic [ref=e661]:
                    - text: metric_collect
                    - paragraph [ref=e662]: success
                - cell "Completed" [ref=e663]:
                  - generic [ref=e664]: Completed
                - cell "0/1" [ref=e666]:
                  - generic [ref=e667]: 0/1
                - cell "5/22/2026, 3:09:03 AM" [ref=e668]
                - cell "0ms" [ref=e669]
                - cell [ref=e670]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:09:03 AM 0ms" [ref=e671]:
                - cell "alert_evaluate success" [ref=e672]:
                  - generic [ref=e673]:
                    - text: alert_evaluate
                    - paragraph [ref=e674]: success
                - cell "Completed" [ref=e675]:
                  - generic [ref=e676]: Completed
                - cell "0/1" [ref=e678]:
                  - generic [ref=e679]: 0/1
                - cell "5/22/2026, 3:09:03 AM" [ref=e680]
                - cell "0ms" [ref=e681]
                - cell [ref=e682]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:10:03 AM 0ms" [ref=e683]:
                - cell "metric_collect success" [ref=e684]:
                  - generic [ref=e685]:
                    - text: metric_collect
                    - paragraph [ref=e686]: success
                - cell "Completed" [ref=e687]:
                  - generic [ref=e688]: Completed
                - cell "0/1" [ref=e690]:
                  - generic [ref=e691]: 0/1
                - cell "5/22/2026, 3:10:03 AM" [ref=e692]
                - cell "0ms" [ref=e693]
                - cell [ref=e694]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:10:03 AM 0ms" [ref=e695]:
                - cell "alert_evaluate success" [ref=e696]:
                  - generic [ref=e697]:
                    - text: alert_evaluate
                    - paragraph [ref=e698]: success
                - cell "Completed" [ref=e699]:
                  - generic [ref=e700]: Completed
                - cell "0/1" [ref=e702]:
                  - generic [ref=e703]: 0/1
                - cell "5/22/2026, 3:10:03 AM" [ref=e704]
                - cell "0ms" [ref=e705]
                - cell [ref=e706]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:11:00 AM 0ms" [ref=e707]:
                - cell "metric_collect success" [ref=e708]:
                  - generic [ref=e709]:
                    - text: metric_collect
                    - paragraph [ref=e710]: success
                - cell "Completed" [ref=e711]:
                  - generic [ref=e712]: Completed
                - cell "0/1" [ref=e714]:
                  - generic [ref=e715]: 0/1
                - cell "5/22/2026, 3:11:00 AM" [ref=e716]
                - cell "0ms" [ref=e717]
                - cell [ref=e718]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:11:00 AM 0ms" [ref=e719]:
                - cell "alert_evaluate success" [ref=e720]:
                  - generic [ref=e721]:
                    - text: alert_evaluate
                    - paragraph [ref=e722]: success
                - cell "Completed" [ref=e723]:
                  - generic [ref=e724]: Completed
                - cell "0/1" [ref=e726]:
                  - generic [ref=e727]: 0/1
                - cell "5/22/2026, 3:11:00 AM" [ref=e728]
                - cell "0ms" [ref=e729]
                - cell [ref=e730]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:12:00 AM 0ms" [ref=e731]:
                - cell "metric_collect success" [ref=e732]:
                  - generic [ref=e733]:
                    - text: metric_collect
                    - paragraph [ref=e734]: success
                - cell "Completed" [ref=e735]:
                  - generic [ref=e736]: Completed
                - cell "0/1" [ref=e738]:
                  - generic [ref=e739]: 0/1
                - cell "5/22/2026, 3:12:00 AM" [ref=e740]
                - cell "0ms" [ref=e741]
                - cell [ref=e742]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:12:00 AM 0ms" [ref=e743]:
                - cell "alert_evaluate success" [ref=e744]:
                  - generic [ref=e745]:
                    - text: alert_evaluate
                    - paragraph [ref=e746]: success
                - cell "Completed" [ref=e747]:
                  - generic [ref=e748]: Completed
                - cell "0/1" [ref=e750]:
                  - generic [ref=e751]: 0/1
                - cell "5/22/2026, 3:12:00 AM" [ref=e752]
                - cell "0ms" [ref=e753]
                - cell [ref=e754]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:13:00 AM 0ms" [ref=e755]:
                - cell "metric_collect success" [ref=e756]:
                  - generic [ref=e757]:
                    - text: metric_collect
                    - paragraph [ref=e758]: success
                - cell "Completed" [ref=e759]:
                  - generic [ref=e760]: Completed
                - cell "0/1" [ref=e762]:
                  - generic [ref=e763]: 0/1
                - cell "5/22/2026, 3:13:00 AM" [ref=e764]
                - cell "0ms" [ref=e765]
                - cell [ref=e766]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:13:00 AM 0ms" [ref=e767]:
                - cell "alert_evaluate success" [ref=e768]:
                  - generic [ref=e769]:
                    - text: alert_evaluate
                    - paragraph [ref=e770]: success
                - cell "Completed" [ref=e771]:
                  - generic [ref=e772]: Completed
                - cell "0/1" [ref=e774]:
                  - generic [ref=e775]: 0/1
                - cell "5/22/2026, 3:13:00 AM" [ref=e776]
                - cell "0ms" [ref=e777]
                - cell [ref=e778]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:14:00 AM 0ms" [ref=e779]:
                - cell "metric_collect success" [ref=e780]:
                  - generic [ref=e781]:
                    - text: metric_collect
                    - paragraph [ref=e782]: success
                - cell "Completed" [ref=e783]:
                  - generic [ref=e784]: Completed
                - cell "0/1" [ref=e786]:
                  - generic [ref=e787]: 0/1
                - cell "5/22/2026, 3:14:00 AM" [ref=e788]
                - cell "0ms" [ref=e789]
                - cell [ref=e790]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:14:00 AM 0ms" [ref=e791]:
                - cell "alert_evaluate success" [ref=e792]:
                  - generic [ref=e793]:
                    - text: alert_evaluate
                    - paragraph [ref=e794]: success
                - cell "Completed" [ref=e795]:
                  - generic [ref=e796]: Completed
                - cell "0/1" [ref=e798]:
                  - generic [ref=e799]: 0/1
                - cell "5/22/2026, 3:14:00 AM" [ref=e800]
                - cell "0ms" [ref=e801]
                - cell [ref=e802]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:15:00 AM 0ms" [ref=e803]:
                - cell "metric_collect success" [ref=e804]:
                  - generic [ref=e805]:
                    - text: metric_collect
                    - paragraph [ref=e806]: success
                - cell "Completed" [ref=e807]:
                  - generic [ref=e808]: Completed
                - cell "0/1" [ref=e810]:
                  - generic [ref=e811]: 0/1
                - cell "5/22/2026, 3:15:00 AM" [ref=e812]
                - cell "0ms" [ref=e813]
                - cell [ref=e814]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:15:00 AM 0ms" [ref=e815]:
                - cell "alert_evaluate success" [ref=e816]:
                  - generic [ref=e817]:
                    - text: alert_evaluate
                    - paragraph [ref=e818]: success
                - cell "Completed" [ref=e819]:
                  - generic [ref=e820]: Completed
                - cell "0/1" [ref=e822]:
                  - generic [ref=e823]: 0/1
                - cell "5/22/2026, 3:15:00 AM" [ref=e824]
                - cell "0ms" [ref=e825]
                - cell [ref=e826]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:16:00 AM 0ms" [ref=e827]:
                - cell "metric_collect success" [ref=e828]:
                  - generic [ref=e829]:
                    - text: metric_collect
                    - paragraph [ref=e830]: success
                - cell "Completed" [ref=e831]:
                  - generic [ref=e832]: Completed
                - cell "0/1" [ref=e834]:
                  - generic [ref=e835]: 0/1
                - cell "5/22/2026, 3:16:00 AM" [ref=e836]
                - cell "0ms" [ref=e837]
                - cell [ref=e838]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:16:00 AM 0ms" [ref=e839]:
                - cell "alert_evaluate success" [ref=e840]:
                  - generic [ref=e841]:
                    - text: alert_evaluate
                    - paragraph [ref=e842]: success
                - cell "Completed" [ref=e843]:
                  - generic [ref=e844]: Completed
                - cell "0/1" [ref=e846]:
                  - generic [ref=e847]: 0/1
                - cell "5/22/2026, 3:16:00 AM" [ref=e848]
                - cell "0ms" [ref=e849]
                - cell [ref=e850]
              - row "metric_collect success Completed 0/1 5/22/2026, 3:17:00 AM 0ms" [ref=e851]:
                - cell "metric_collect success" [ref=e852]:
                  - generic [ref=e853]:
                    - text: metric_collect
                    - paragraph [ref=e854]: success
                - cell "Completed" [ref=e855]:
                  - generic [ref=e856]: Completed
                - cell "0/1" [ref=e858]:
                  - generic [ref=e859]: 0/1
                - cell "5/22/2026, 3:17:00 AM" [ref=e860]
                - cell "0ms" [ref=e861]
                - cell [ref=e862]
              - row "alert_evaluate success Completed 0/1 5/22/2026, 3:17:00 AM 0ms" [ref=e863]:
                - cell "alert_evaluate success" [ref=e864]:
                  - generic [ref=e865]:
                    - text: alert_evaluate
                    - paragraph [ref=e866]: success
                - cell "Completed" [ref=e867]:
                  - generic [ref=e868]: Completed
                - cell "0/1" [ref=e870]:
                  - generic [ref=e871]: 0/1
                - cell "5/22/2026, 3:17:00 AM" [ref=e872]
                - cell "0ms" [ref=e873]
                - cell [ref=e874]
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