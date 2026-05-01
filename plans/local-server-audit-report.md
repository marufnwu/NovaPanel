# LOCAL SERVER (NO PUBLIC IP) AUDIT REPORT
## ServerForge — Comprehensive Code Audit

---

## SYSTEM UNDERSTANDING

[Cover how each layer works — install script, backend, frontend — based on the findings below]

### Installation Script
The install script (`scripts/install.sh`) is a bare-metal installer for Ubuntu/Debian. Pipeline: preflight → system packages → service config → panel deploy → verification → summary.

Core assumption: server has a resolvable FQDN or public IP reachable on port 80/443. Zero detection or warning for the no-public-IP scenario.

- **Public IP Detection**: Uses `hostname -I` first, falls back to `curl ifconfig.me` only if hostname -I returns empty or 127.0.0.1. On a local server with private IP (192.168.x.x), hostname -I succeeds, so external lookup never triggers. No check against RFC1918 private ranges.
- **PANEL_URL**: Derived from `hostname -f` or falls back to `SERVER_IP`. Becomes `http://<private-ip>:8732` on local servers. Written to `.env` at install time, never auto-updated.
- **SSL**: Certbot installed but never invoked. Panel runs on plain HTTP. No self-signed fallback.
- **Cloudflared**: Binary installed via GitHub download but no tunnel created, no service started, no config generated.
- **Mail**: MAIL_HOSTNAME defaults to `mail.<hostname -d>` → `mail.local` on local servers. Postfix/Dovecot installed. Port 25/587 opened in UFW. No warning about external mail requirements.
- **BIND9**: Configured with `allow-recursion { 127.0.0.1; ::1; }` (correctly restricted). systemd-resolved stopped and replaced with Google DNS. No warning about external DNS limitations.

### Backend
- **PANEL_URL**: Read from `process.env.PANEL_URL`, defaults to `https://localhost:8443`. Used as CORS origin.
- **Server IP**: Obtained via `hostname -I` (first IP). Used for DNS A records, SPF records.
- **SSL Issuance**: HTTP-01 challenge only (webroot or standalone). No DNS-01 implementation despite wildcard flag in schema. No port reachability check before attempting.
- **Cloudflare Tunnel**: Creates tunnel via cloudflared CLI, stores credentials, installs systemd service. Status checked via `systemctl is-active` (process-only). PANEL_URL never auto-updated after tunnel setup.
- **Mail**: No reachability check. MX records point to private IP. SPF includes private IP.
- **DNS**: A records auto-created with private IP from `hostname -I`.
- **Nginx**: Config rollback on failure is implemented. Website configs isolated per-file.
- **Service Status**: All services checked via `systemctl is-active`. No capability vs process state distinction.

### Frontend
- **Dashboard**: Shows TunnelStatusWidget (gray "Not configured" when no tunnel). Service status cards. Quick actions for common tasks. No local server detection banner.
- **SSL Page**: Offers Let's Encrypt, Custom, Self-Signed. DNS-01 for wildcards supported. No HTTP-01 port 80 warning. Raw error messages shown.
- **Tunnel Page**: 3-step SetupModal (token → zone → name). Quick Expose Domains section hidden until tunnel active.
- **Domain Page**: "Open" button links to `http://${domain.name}` — unreachable externally. No tunnel setup guidance after domain creation.
- **Mail Page**: ConnectionInfoCard shows `mail.${domainName}`. No external accessibility warning. Webmail link will fail without tunnel.
- **DNS Page**: Propagation check queries external resolvers — will never succeed with private IP A records.
- **Settings**: Panel URL field shows current value with no private IP warning.

---

## ISSUES FOUND

### LOCAL-001: PANEL_URL Set to Private IP at Install Time
Area: Installation / Backend / Frontend
Severity: **Critical**

What I Found:
Install script (`scripts/install.sh:254-257`) derives PANEL_URL from hostname or SERVER_IP. On local servers, becomes `http://192.168.x.x:8732`. Written to `.env` at line 1087. Backend reads it in `env.ts:7` and uses as CORS origin in `server.ts:30`. Frontend settings page shows it in `ServerSettingsPage.tsx:294`.

What Happens on a Local Server:
- Panel URL is a private IP unreachable from outside the LAN
- CORS blocks API requests from browsers not on the same LAN
- After setting up Cloudflare Tunnel, PANEL_URL is never auto-updated
- Admin must manually edit `.env` and restart the service

What the User Experiences:
Panel works on LAN but is completely inaccessible from outside. After tunnel setup, the panel URL still points to the private IP. No warning or guidance is given at any point.

What Correct Behavior Should Achieve:
The system should detect when PANEL_URL contains a private IP and either warn during installation or provide a guided update mechanism when a tunnel is configured for the panel domain.

---

### LOCAL-002: SSL Issuance Uses HTTP-01 Only — No DNS-01 Fallback
Area: Backend / Frontend
Severity: **Critical**

What I Found:
Backend (`certbot.service.ts:14-20`) uses `--webroot` or `--standalone` (both HTTP-01). Schema (`ssl.schema.ts:12`) declares a `wildcard` flag but DNS-01 is never implemented. Frontend (`SslPage.tsx:182-200`) offers Let's Encrypt without warning about port 80 requirement. Error display (`SslPage.tsx:72-75`) shows raw backend errors.

What Happens on a Local Server:
- User clicks "Issue Let's Encrypt Certificate"
- Certbot runs HTTP-01 challenge
- Let's Encrypt validation server cannot reach private IP
- Certbot fails with connection error
- User sees raw error: "Certbot failed: <stderr>" — no explanation of why, no DNS-01 alternative suggested

What the User Experiences:
SSL issuance fails with a cryptic error. No recovery path is offered. No explanation that HTTP-01 requires public port 80. DNS-01 (which would work behind NAT) is not available as a fallback.

What Correct Behavior Should Achieve:
The system should either implement DNS-01 as a working alternative, or clearly warn before attempting HTTP-01 that it requires a publicly reachable server, and provide actionable error messages when it fails.

---

### LOCAL-003: No Public IP Detection Anywhere in the System
Area: Installation / Backend / Frontend
Severity: **Critical**

What I Found:
No component — install script, backend, or frontend — detects whether the server has a public IP. Install script (`scripts/install.sh:232-238`) uses `hostname -I` which returns private IPs. Backend (`dns.service.ts:64-70`) uses `hostname -I` for DNS records. Frontend has no server context detection.

What Happens on a Local Server:
Every feature that depends on public reachability (SSL, mail, DNS, FTP) silently proceeds as if the server is publicly accessible. No warnings, no alternative flows, no degraded-mode indicators.

What the User Experiences:
The panel appears fully functional. Services show green/active. But nothing is reachable from the internet. The admin discovers this only when external users report they can't access sites, mail doesn't arrive, and SSL can't be issued.

What Correct Behavior Should Achieve:
The system should detect the local server scenario (private IP, no tunnel) and surface this information prominently — on the dashboard, in feature UIs, and during installation — so the admin understands what works and what doesn't.

---

### LOCAL-004: Cloudflared Binary Installed But Never Configured
Area: Installation
Severity: **High**

What I Found:
Install script (`scripts/install.sh:645-656`) downloads cloudflared binary but creates no tunnel, generates no config, starts no service. Only a `warn` on download failure.

What Happens on a Local Server:
Cloudflared binary exists but is completely unused. The admin has no path forward without reading external documentation. The tunnel setup must be done entirely through the panel UI after installation.

What the User Experiences:
After install, the admin sees "cloudflared installed" in the summary but has no tunnel. They must discover the Tunnels page in the panel UI and figure out the setup process themselves.

What Correct Behavior Should Achieve:
The install script should either configure a basic tunnel or provide clear post-install instructions explaining that tunnel setup is the next required step for external access.

---

### LOCAL-005: DNS A Records Auto-Created with Private IP
Area: Backend
Severity: **High**

What I Found:
Backend (`dns.service.ts:73-74`) creates A records for `@`, `www`, `mail` using `serverIp` from `hostname -I`. On local servers, all records point to private IP.

What Happens on a Local Server:
- DNS zones exist in local BIND9 with private IP records
- External DNS resolvers never see these zones (BIND9 is not authoritative for public DNS on a local server)
- Even if zones were transferred, A records with private IPs are useless externally
- Cloudflare Tunnel CNAME records mitigate this for tunnel users, but direct DNS is broken

What the User Experiences:
DNS appears configured in the panel. Propagation checks fail. External users can't reach any domain. No explanation of why.

What Correct Behavior Should Achieve:
DNS management should distinguish between local DNS (for internal resolution) and public DNS (requiring either public IP or Cloudflare Tunnel). The UI should communicate which mode is active and what each record means in that context.

---

### LOCAL-006: Mail Configured But Cannot Receive External Email
Area: Installation / Backend
Severity: **High**

What I Found:
Install script sets MAIL_HOSTNAME to `mail.local` (`scripts/install.sh:257`). Backend creates MX records pointing to private IP (`dns.service.ts:77`). SPF records include private IP (`mail.service.ts:409`). Frontend shows connection info with `mail.${domainName}` (`MailPage.tsx:774`) without accessibility warnings.

What Happens on a Local Server:
- Postfix/Dovecot run and accept local mail
- External mail servers cannot reach SMTP on private IP
- MX records in local BIND9 are invisible externally
- SPF with private IP causes softfail/reject at receiving servers
- Outbound mail may work but will likely be flagged as spam (no proper hostname, SPF fail)

What the User Experiences:
Mail services show as "active" in dashboard. Mailboxes can be created. But no external email arrives. Sending may appear to work but recipients may never receive it (spam-filtered). No warning explains this.

What Correct Behavior Should Achieve:
The mail system should detect and communicate that external mail delivery requires either a public IP with proper MX/SPF/DKIM records, or a mail relay service. The UI should show clear status about what mail capabilities are actually available.

---

### LOCAL-007: Cloudflare Tunnel Status Is Process-Only, Not Connectivity
Area: Backend
Severity: **High**

What I Found:
Backend (`tunnel.service.ts:302-317`) checks tunnel status via `systemctl is-active cloudflared`. This only verifies the process is running, not that it's connected to Cloudflare's edge.

What Happens on a Local Server:
- If cloudflared crashes and systemd restarts it, status may briefly show "active" during reconnection
- If credentials expire or Cloudflare account changes, status shows "active" but tunnel is non-functional
- No health check against Cloudflare API

What the User Experiences:
Tunnel shows green "active" status even when not actually serving traffic. Sites appear accessible but return errors. No diagnostic information.

What Correct Behavior Should Achieve:
Tunnel status should reflect actual connectivity to Cloudflare's edge, not just process state. This could be achieved by querying the Cloudflare API for tunnel health or checking the last connection timestamp.

---

### LOCAL-008: Domain "Open" Button Points to Unreachable URL
Area: Frontend
Severity: **High**

What I Found:
Frontend (`DomainsPage.tsx:533-541`) shows an "Open" button after domain creation linking to `http://${domain.name}`. On local servers, this URL resolves to the private IP.

What Happens on a Local Server:
Clicking "Open" either fails (DNS doesn't resolve), opens a private IP (works only on LAN), or shows a security warning (HTTP + no SSL). No explanation of why.

What the User Experiences:
After creating a domain, clicking "Open" fails silently or shows an error. No guidance about needing a tunnel for external access.

What Correct Behavior Should Achieve:
The "Open" action should be context-aware: show the local URL for LAN access, show the tunnel URL if configured, or show a message explaining that external access requires tunnel setup.

---

### LOCAL-009: Dashboard Tunnel Widget Has No Call-to-Action
Area: Frontend
Severity: **High**

What I Found:
Dashboard (`DashboardPage.tsx:592-605`) shows "Not configured" with gray dot when no tunnel exists. No prompt, no explanation, no link to setup.

What Happens on a Local Server:
Admin sees "Not configured" for tunnel status but has no idea what it means or what to do about it. For a local server user, tunnel setup is the single most important configuration step.

What the User Experiences:
Dashboard shows services as running but tunnel as "Not configured" — just text, no action button, no explanation of consequences.

What Correct Behavior Should Achieve:
When no tunnel is configured and the server appears to have no public IP, the dashboard should prominently suggest setting up a Cloudflare Tunnel as the primary way to enable external access.

---

### LOCAL-010: Error Messages Lack Troubleshooting Context
Area: Frontend / Backend
Severity: **Medium**

What I Found:
Frontend (`client.ts:3-12`, `SslPage.tsx:72-75`) displays raw backend error messages. Backend (`certbot.service.ts:24-26`) throws `Error: Certbot failed: {stderr}`. No error transformation or contextual guidance.

What Happens on a Local Server:
SSL failures show: "Certbot failed: urn:acme:error:connection :: The server could not connect to check the domain". Tunnel failures show raw API errors. DNS propagation checks show "not propagated" without explaining why.

What the User Experiences:
Cryptic technical errors with no explanation of cause or suggested fix. Admin must search the internet to understand what went wrong.

What Correct Behavior Should Achieve:
Error messages should be transformed into human-readable explanations with suggested next steps. For SSL: "Let's Encrypt couldn't reach your server on port 80. This usually means your server doesn't have a public IP. Try DNS-01 challenge instead."

---

### LOCAL-011: DNS Propagation Check Creates False Expectations
Area: Frontend
Severity: **Medium**

What I Found:
Frontend (`DnsPage.tsx:304-376`) queries external DNS resolvers (Google 8.8.8.8, Cloudflare 1.1.1.1) to check propagation. On local servers, DNS will never propagate because BIND9 is not publicly accessible and A records contain private IPs.

What Happens on a Local Server:
Propagation check always shows "not propagated". Admin may repeatedly retry expecting eventual success. No explanation that propagation is impossible without public DNS.

What the User Experiences:
Confusion and wasted time. The feature appears broken but is actually working correctly — it's just that the underlying DNS setup can never propagate.

What Correct Behavior Should Achieve:
The propagation check should detect when DNS records contain private IPs and explain that external propagation is not possible, suggesting Cloudflare Tunnel as an alternative.

---

### LOCAL-012: Service Status Shows Process State, Not Capability
Area: Backend / Frontend
Severity: **Medium**

What I Found:
Backend (`stats.service.ts:123-148`) checks all services via `systemctl is-active`. Frontend displays green/gray dots based on this. No distinction between "running and externally accessible" vs "running but only locally accessible".

What Happens on a Local Server:
All services show green/active. Postfix is "running" but can't receive external mail. BIND9 is "running" but can't serve public DNS. Cloudflare Tunnel is "running" but may not be connected. The dashboard paints a picture of a fully functional server that is actually only locally accessible.

What the User Experiences:
Everything looks fine. No indication that services are not externally reachable.

What Correct Behavior Should Achieve:
Service status should distinguish between process state and capability. At minimum, a dashboard-level indicator should show whether the server is externally reachable.

---

### LOCAL-013: FTP Passive Mode Broken for External Clients
Area: Installation
Severity: **Medium**

What I Found:
Install script (`scripts/install.sh:596-608`) sets ProFTPD `MasqueradeAddress` to `SERVER_IP` (private IP). FTP passive mode data connections will fail for clients outside the LAN.

What Happens on a Local Server:
FTP control connection works on LAN. Passive mode data connections fail for external clients because MasqueradeAddress advertises a private IP. External clients can connect but can't transfer files.

What the User Experiences:
FTP appears to work locally. External clients connect but file transfers fail silently. No error message explains why.

What Correct Behavior Should Achieve:
FTP configuration should either detect the private IP scenario and warn, or provide a mechanism to update MasqueradeAddress when a tunnel/public IP becomes available.

---

### LOCAL-014: Mail Connection Info Shows Unreachable Hostname
Area: Frontend
Severity: **Medium**

What I Found:
Frontend (`MailPage.tsx:774`) shows `mail.${domainName}` as the hostname for IMAP/POP3/SMTP connections. On local servers, this hostname resolves to a private IP. Webmail link (`https://${domainName}/webmail`) is also unreachable externally.

What Happens on a Local Server:
Connection info appears correct but is only usable from the same LAN. External mail clients can't connect. No warning about this limitation.

What the User Experiences:
Admin sees connection info, configures mail client, but can't connect from outside the LAN. No explanation.

What Correct Behavior Should Achieve:
Connection info should include context about accessibility — "Available on local network" or "Requires tunnel for external access".

---

### LOCAL-015: Quick Expose Domains Hidden Until Tunnel Active
Area: Frontend
Severity: **Medium**

What I Found:
Frontend (`TunnelsPage.tsx:721-759`) only shows the "Quick Expose Domains" section when a tunnel already exists and is active. New users never see this feature until after manual tunnel setup.

What Happens on a Local Server:
Admin must discover tunnel setup, complete it, then return to find the Quick Expose feature. The workflow is disjointed.

What the User Experiences:
No guided path from "no tunnel" to "domains exposed via tunnel". Each step must be discovered independently.

What Correct Behavior Should Achieve:
The tunnel setup flow should integrate domain exposure as part of the setup process, or at minimum show a preview of what will be possible after tunnel setup.

---

### LOCAL-016: Panel URL in Settings Shows No Private IP Warning
Area: Frontend
Severity: **Low**

What I Found:
Frontend (`ServerSettingsPage.tsx:294`) shows Panel URL field with description "Used for generating links in notifications and emails" but no warning when it contains a private IP.

What Happens on a Local Server:
Admin can see the private IP URL but gets no indication this is a problem or that it should be updated after tunnel setup.

What the User Experiences:
Settings page shows a private IP URL with no context about why this might be wrong.

What Correct Behavior Should Achieve:
The Panel URL field should detect private IPs and show a warning suggesting the admin update it to their tunnel URL.

---

---

## WHAT ALREADY WORKS CORRECTLY ON LOCAL SERVER

1. **Local Network Access**: Panel, websites, databases, FTP all work correctly within the LAN. UFW opens all necessary ports.
2. **MariaDB Idempotency**: Install script correctly handles re-runs with existing passwords.
3. **BIND9 Recursion Security**: `allow-recursion { 127.0.0.1; ::1; }` prevents open resolver attacks.
4. **systemd-resolved Handling**: Correctly stopped and replaced with Google DNS for BIND9 compatibility.
5. **Nginx Config Rollback**: Website config failures restore from backup. Panel's own config is isolated.
6. **Custom Directive Validation**: Dangerous nginx directives are blocked.
7. **Atomic File Writes**: Backend uses write-to-temp-then-move pattern.
8. **Tunnel Setup Flow**: 3-step modal (token → zone → name) is well-structured.
9. **DNS-01 for Wildcards**: Frontend properly supports multiple DNS providers for wildcard certs.
10. **Website Config Isolation**: Each website gets its own nginx config file.
11. **Command Allowlist**: Backend executor uses strict allowlist for security.
12. **Cloudflare Tunnel CNAME**: When tunnel routes are added, CNAME records are correctly created via Cloudflare API.
13. **Panel Fallback Access**: Panel API accessible on port 8732 directly if Nginx fails.

---

## THINGS THAT NEED RUNTIME VERIFICATION

1. **ACME HTTP-01 Error Message**: What exact error does certbot return when Let's Encrypt can't reach a private IP? Need to capture and verify the error string.
2. **Postfix Binding**: Does Postfix listen on `0.0.0.0` or `127.0.0.1`? If localhost-only, even LAN mail won't work from other devices.
3. **ISP Port 25 Blocking**: Many ISPs block outbound port 25. Does Postfix successfully send test emails on residential connections?
4. **ProFTPD Passive Mode**: Does passive FTP actually fail from external clients when MasqueradeAddress is a private IP?
5. **Cloudflare Tunnel Config File**: `/etc/cloudflared/config.yml` is shared. If multiple tunnels are created, do they overwrite each other?
6. **Docker Container Networking**: Does the container see the host's private IP or a Docker-internal IP?
7. **hostname -I on Multi-Homed Servers**: What happens on a cloud VM with both private and public NICs?
8. **Tunnel Status Polling**: Does the UI update when tunnel goes down during an active session?
9. **Panel URL in Notification Emails**: Does the backend use PANEL_URL in email links? If so, those links would be broken.
10. **Cloudflared Crash Recovery**: If cloudflared crashes and systemd restarts it, does the tunnel reconnect automatically?

---

## THE CRITICAL PATH FOR A LOCAL SERVER USER

### Step 1: Install Script Runs on Local Server
**State**: Installation completes successfully. No errors, no warnings.
- PANEL_URL = `http://192.168.1.100:8732`
- MAIL_HOSTNAME = `mail.local`
- All services running (Nginx, MariaDB, PostgreSQL, PHP-FPM, Postfix, Dovecot, BIND9, ProFTPD, Redis)
- cloudflared binary installed but unused
- No SSL configured
- UFW firewall configured with all ports open
**Works?** ✅ Installation succeeds. **Fails visibly?** No failures.

### Step 2: Admin Logs In for First Time
**State**: Admin opens `http://192.168.1.100:8732` from a browser on the same LAN.
- Login page loads correctly
- Dashboard shows all services as green/active
- Tunnel status shows "Not configured" (gray dot, no CTA)
- No warning about local server limitations
**Works?** ✅ Login works on LAN. **Fails visibly?** No indication of limitations.

### Step 3: Admin Adds First Domain
**State**: Admin navigates to Domains, creates `example.com`.
- Domain created successfully
- DNS zone created in local BIND9 with A records pointing to `192.168.1.100`
- "Open" button appears → links to `http://example.com` → fails (DNS doesn't resolve)
- No guidance about tunnel setup
**Works?** ⚠️ Domain creation works. **Fails visibly?** "Open" button fails silently. No next-step guidance.

### Step 4: Admin Tries to Issue SSL
**State**: Admin navigates to SSL, selects `example.com`, clicks "Issue Let's Encrypt".
- Certbot runs HTTP-01 challenge
- Let's Encrypt can't reach private IP → challenge fails
- Error shown: raw certbot stderr — "Certbot failed: ..."
- No DNS-01 alternative offered
- No explanation that HTTP-01 requires public IP
**Works?** ❌ SSL fails. **Fails visibly?** Yes, but with cryptic error and no recovery path.

### Step 5: Admin Sets Up Cloudflare Tunnel
**State**: Admin navigates to Tunnels, clicks "Create Tunnel".
- 3-step modal: API token → select zone → name tunnel
- Tunnel created, systemd service started
- CNAME record created in Cloudflare DNS
- Quick Expose Domains section now visible
- Admin adds route for `example.com` → `http://localhost:8080`
**Works?** ✅ Tunnel setup works. **But**: PANEL_URL still points to private IP. CORS may block external API calls. Admin must manually update PANEL_URL in `.env` and restart.
**Fails visibly?** Partially — tunnel works but panel URL doesn't auto-update.

### Step 6: Admin Enables Mail for Domain
**State**: Admin navigates to Mail, enables mail for `example.com`.
- Mail domain created in Postfix
- Mailboxes can be created
- Connection info shows `mail.example.com` for IMAP/SMTP
- MX record created in local BIND9 pointing to private IP
- SPF record includes private IP
**Works?** ⚠️ Local mail works. **External mail**: ❌ Cannot receive. Sending may be flagged as spam.
**Fails visibly?** No. Mail shows as fully functional.

### Step 7: Admin Creates a Database
**State**: Admin navigates to Databases, creates a new database and user.
- Database created in MariaDB
- Credentials shown
- Can be accessed from applications on the same server
**Works?** ✅ Database creation works perfectly. **Fails visibly?** No issues.

### Critical Path Summary
| Step | Works? | Visible Failure? | Recovery Path? |
|------|---------|-------------------|----------------|
| 1. Install | ✅ | No | N/A |
| 2. First Login | ✅ (LAN only) | No | N/A |
| 3. Add Domain | ⚠️ | "Open" fails silently | None shown |
| 4. Issue SSL | ❌ | Yes (cryptic) | None offered |
| 5. Setup Tunnel | ✅ | PANEL_URL not updated | Manual edit |
| 6. Enable Mail | ⚠️ | No (silent failure) | None |
| 7. Create Database | ✅ | No | N/A |

**Overall**: The critical path has 2 hard failures (SSL, external mail), 2 partial failures (domain open button, PANEL_URL), and zero proactive guidance for the local server scenario.

---

## PRIORITY ORDER

### 1. Implement Public IP Detection + Dashboard Warning (LOCAL-003)
**Why**: This is the root cause of confusion for every other issue. Without detection, no other fix can be context-aware. A dashboard banner that says "Your server appears to be on a local network. Some features require a public IP. Set up Cloudflare Tunnel for external access." would prevent the majority of user confusion.

**Impact**: Every local server user sees this immediately after first login. It provides the mental model for understanding all subsequent feature limitations.

### 2. Implement DNS-01 Challenge for SSL (LOCAL-002)
**Why**: SSL is the most visible failure. Every user wants HTTPS. HTTP-01 will never work on a local server. DNS-01 via Cloudflare API is the only path to Let's Encrypt certificates behind NAT. The backend already has Cloudflare API integration for tunnel CNAME records — extending it for DNS-01 is architecturally feasible.

**Impact**: Fixes the single most frustrating user experience — trying to get HTTPS and failing with no alternative.

### 3. Auto-Update PANEL_URL When Tunnel Is Configured for Panel Domain (LOCAL-001)
**Why**: Even after tunnel setup, the panel URL remains a private IP. This breaks CORS, email links, and any URL generation. The fix is narrow in scope: when a tunnel route is added for the panel's own domain, update PANEL_URL in `.env` and restart the service.

**Impact**: Fixes the gap between tunnel setup and a fully functional externally-accessible panel. Without this, tunnel setup alone doesn't make the panel externally usable.
