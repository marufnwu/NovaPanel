# Domain & Website Management - Detailed Implementation Plan

**Date:** 2026-05-08
**Based on:** `plans/domain-website-mgmt-audit-report.md`
**Status:** Implementation Planning

---

## Overview

This plan expands the 4-phase improvement strategy into actionable tasks with specific file locations and implementation notes.

---

## PHASE 1: UX Polish (Quick Wins)
**Timeline:** 1-2 days
**Goal:** Fix user frustration points without changing architecture

### 1.1 Domain Pre-Check Before Submission

**Backend API Addition:**
- File: `apps/api/src/modules/domains/domains.service.ts`
- Add method: `async preCheckDomain(domainName: string): Promise<PreCheckResult>`
- Logic:
  - Check DNS A record resolution using `verifyDomainPointsToIp()`
  - Return: `{ canCreate: boolean, issues: string[], suggestions: string[] }`

**Frontend Changes:**
- File: `apps/web/src/pages/domains/DomainsPage.tsx`
- Location: `CreateDomainForm` component (lines 165-200)
- Add: Pre-check button next to domain input
- Add: Real-time feedback panel showing DNS status

**Implementation:**
```
User types domain → clicks "Check DNS" → shows:
✓ DNS resolves to 123.45.67.89 (server IP)
⚠ Warning: DNS propagation may take 24-48 hours
→ OR
✗ DNS does not point to this server (found: 98.76.54.32)
→ Suggest: Update A record to 123.45.67.89
```

### 1.2 Domain Creation Progress Steps

**Backend:**
- File: `apps/api/src/modules/domains/domains.service.ts`
- Modify `create()` to accept `onProgress?: (step: string) => void`
- Emit progress: "Creating website...", "Configuring nginx...", "Setting up DNS..."

**Frontend:**
- File: `apps/web/src/pages/domains/DomainsPage.tsx`
- Location: `CreateDomainForm` (handleSubmit function)
- Replace: Simple loading spinner
- With: Step-by-step progress indicator
  ```
  ⏳ Creating domain...
     ↓ Creating website files...
     ↓ Configuring web server...
     ↓ Setting up DNS zone...
     ↓ Enabling Cloudflare tunnel route...
  ✓ Domain created successfully!
  ```

### 1.3 Add Quick Actions After Domain Creation

**Frontend:**
- File: `apps/web/src/pages/domains/DomainsPage.tsx`
- Location: Success state after domain creation (handleSubmit callback)
- Add: Action buttons after success message
  ```tsx
  {success && (
    <div className="flex gap-2 mt-4">
      <Button onClick={() => navigate(`/domains/${id}`)}>Open Domain</Button>
      <Button variant="outline" onClick={() => navigate(`/files?domain=${domainName}`)}>Upload Files</Button>
      <Button variant="outline" onClick={() => openSslModal(domainId)}>Configure SSL</Button>
    </div>
  )}
  ```

### 1.4 Search/Filter on Domain List

**Frontend:**
- File: `apps/web/src/pages/domains/DomainsPage.tsx`
- Location: `DomainsPage` component (line ~1929)
- Add: Search input with debounce (300ms)
- Add: Filter dropdown (All / Active / Suspended / Has Website / DNS Only)
- Implementation:
  ```tsx
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const filtered = domains.filter(d => {
    const matchesSearch = d.name.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  ```

### 1.5 Bulk Actions on Domain List

**Frontend:**
- File: `apps/web/src/pages/domains/DomainsPage.tsx`
- Location: BulkActionBar component (lines 699-739)
- Add: Checkbox column in domain table (line ~2117-2135)
- Add: Bulk suspend, bulk activate, bulk delete
- Implementation:
  ```tsx
  const selectedIds = useState<string[]>([]);
  
  // Add checkbox to table rows
  <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggleSelect(d.id)} />
  
  // Bulk action bar appears when selectedIds.length > 0
  <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} ... />
  ```

### 1.6 Split DomainsPage.tsx

**Current State:** 2378 lines, monolithic

**Target Structure:**
```
apps/web/src/pages/domains/
├── DomainsPage.tsx (main container, routes)
├── DomainListPage.tsx (list view - ~400 lines)
├── DomainDetailPage.tsx (detail view with tabs - ~500 lines)
├── CreateDomainModal.tsx (creation form - ~200 lines)
├── components/
│   ├── DomainStatusBadge.tsx
│   ├── DomainTable.tsx
│   ├── BulkActionBar.tsx
│   └── DnsVerificationPanel.tsx
└── index.ts
```

**Migration Order:**
1. Create new folder structure
2. Move `DomainStatusBadge` component (lines 78-100)
3. Move `LinkWebsiteModal` component (lines 103-162)
4. Move `CreateDomainForm` component (lines 165-603)
5. Move `DeleteConfirm` component (lines 606-642)
6. Move `RenameDomainModal` component (lines 645-696)
7. Move `BulkActionBar` component (lines 699-739)
8. Move `DomainDetail` component (lines 742-1407)
9. Move all DomainCf* components (lines 1413-1926)
10. Move `ToggleSetting` component (lines 1929-1938)
11. Create `DomainsPage` container with routing
12. Update imports in router

---

## PHASE 2: Core Features
**Timeline:** 1 week
**Goal:** Implement missing functionality that's standard in hosting panels

### 2.1 Complete File Manager

**Current State:** Basic file browser with drag-drop, batch rename, favorites

**Missing Features:**
1. **Upload progress bar** - currently shows spinner
2. **Archive extraction** - zip/tar.gz handling
3. **Permission editor** - chmod UI (already have PermissionsModal)
4. **Hidden files toggle** - show/hide .htaccess etc.
5. **File search within directory** - find file by name

**Implementation Locations:**
- File: `apps/web/src/pages/files/FilesPage.tsx`
- File: `apps/api/src/modules/files/files.service.ts`
- File: `apps/api/src/modules/files/files.routes.ts`

### 2.2 PHP-FPM Pool Settings UI

**Backend:**
- File: `apps/api/src/modules/php/php.service.ts`
- Already has: `updatePoolSettings()` method (lines 168-198)
- Schema: `pm`, `pm_max_children`, `pm_start_servers`, `pm_min_spare_servers`, `pm_max_spare_servers`, `pm_max_requests`

**Frontend - NEW PAGE:**
- File: `apps/web/src/pages/php/PhpPage.tsx` (already exists, needs enhancement)
- Add: Per-website PHP-FPM settings panel
- Settings to expose:
  ```tsx
  interface PhpPoolSettings {
    pm: 'static' | 'dynamic' | 'ondemand';
    pm_max_children: number;      // Max children processes
    pm_start_servers: number;      // Start processes (dynamic only)
    pm_min_spare_servers: number;  // Min spare (dynamic only)
    pm_max_spare_servers: number;  // Max spare (dynamic only)
    pm_max_requests: number;       // Requests before recycling
    php_memory_limit: string;      // memory_limit
    php_max_execution_time: number; // max_execution_time
    php_upload_max_filesize: string; // upload_max_filesize
  }
  ```

**UI Location:**
- Website Detail Page → PHP tab → "Advanced Pool Settings" collapsible section

### 2.3 Custom Nginx Directives

**Backend:**
- File: `apps/api/src/modules/webserver/webserver.service.ts`
- Add: `updateCustomDirectives(domainId: string, directives: string)`
- Store in: `domains.customNginx` column (add if not exists)
- Apply: Add to vhost config in `renderVhost()` in nginx.service.ts

**Frontend:**
- File: `apps/web/src/pages/webserver/WebserverPage.tsx`
- Add: "Custom Nginx Directives" textarea
- Syntax highlighting for nginx config
- Validation before save (nginx -t)

**Database Migration:**
```sql
ALTER TABLE domains ADD COLUMN custom_nginx TEXT;
```

**Config Integration:**
In `nginx.service.ts` `renderVhost()`:
```typescript
// Add before closing server block
${ctx.customNginx ? `\n    # Custom directives\n    ${ctx.customNginx}` : ''}
```

### 2.4 Custom Error Pages

**Backend:**
- File: `apps/api/src/modules/webserver/webserver.service.ts`
- Add: `updateErrorPages(domainId: string, pages: Record<number, string>)`
- Store in: `domains.customErrorPages` JSON column

**Frontend:**
- File: `apps/web/src/pages/webserver/WebserverPage.tsx`
- Already has: `CustomErrorPagesSection` component (lines 61-168)
- Enhancement: Make it per-domain instead of global

**Error Codes:**
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable

### 2.5 Website Overview Improvements

**File:** `apps/web/src/pages/websites/WebsiteDetailPage.tsx`

Add to Overview tab:
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <StatCard label="Disk Usage" value="2.4 GB / 10 GB" progress={24} />
  <StatCard label="Bandwidth" value="45 GB / 100 GB" progress={45} />
  <StatCard label="PHP Version" value={website.phpVersion} />
  <StatCard label="Domains" value={website.domains?.length || 0} />
</div>

<div className="flex gap-2 mt-4">
  <Button onClick={() => window.open(`http://${website.primaryDomain}`)}>
    <ExternalLink className="w-4 h-4 mr-2" /> Open Website
  </Button>
  <Button variant="outline" onClick={() => navigate(`/files?website=${website.id}`)}>
    <Folder className="w-4 h-4 mr-2" /> File Manager
  </Button>
</div>
```

---

## PHASE 3: Advanced Features
**Timeline:** 2-3 weeks
**Goal:** Premium features that differentiate NovaPanel

### 3.1 Remote Backup Storage

**Backend:**
- File: `apps/api/src/modules/backup/backup.service.ts`
- Add: `createBackup(destination: BackupDestination)`
- Destinations: Local, S3, R2 (S3-compatible), SFTP

**Database Schema:**
```sql
CREATE TABLE backup_destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'local' | 's3' | 'r2' | 'sftp'
  config TEXT NOT NULL, -- JSON: { bucket, region, key, secret, path }
  created_at INTEGER NOT NULL
);
```

**Frontend:**
- File: `apps/web/src/pages/backups/BackupsPage.tsx`
- Add: "Remote Destinations" tab
- Add: Connection wizard for each destination type

### 3.2 Application Installer (WordPress)

**Backend:**
- File: `apps/api/src/modules/installer/installer.service.ts` (new)
- Add: `installApp(domainId: string, app: 'wordpress' | 'woocommerce' | 'grav', options: AppOptions)`

**Frontend:**
- File: `apps/web/src/pages/installer/InstallerPage.tsx` (new or add to WebsiteDetailPage)
- App selector with one-click install
- Database auto-creation
- Admin credentials generation

**WordPress Install Flow:**
1. Create database and user
2. Download WordPress core
3. Create wp-config.php with generated keys
4. Run WordPress installation via WP-CLI
5. Install suggested plugins
6. Configure nginx rewrites

### 3.3 Wildcard SSL via Cloudflare DNS-01

**Backend:**
- File: `apps/api/src/services/certbot.service.ts`
- Add: `issueWildcard(domain: string, challenge: 'dns-01', provider: 'cloudflare')`
- Requires: Cloudflare API token with Zone:DNS:Edit permission

**Frontend:**
- File: `apps/web/src/pages/ssl/SslPage.tsx`
- Add: "Wildcard Certificate" option
- Cloudflare DNS-01 challenge flow:
  1. User enters domain (e.g., *.example.com)
  2. System creates DNS TXT record via Cloudflare API
  3. Let's Encrypt validates
  4. Certificate issued

---

## PHASE 4: Feature Parity
**Timeline:** 1-2 weeks
**Goal:** Match Plesk/cPanel features

### 4.1 IP Access Restrictions

**Backend:**
- File: `apps/api/src/modules/webserver/webserver.service.ts`
- Add: `updateIpRestrictions(domainId: string, rules: IpRule[])`

**Frontend:**
- File: `apps/web/src/pages/webserver/WebserverPage.tsx`
- Add: "IP Restrictions" section
  ```
  Mode: Allow All | Deny All | Allow Listed | Deny Listed
  
  Allow List:
  + Add IP/CIDR (e.g., 192.168.1.0/24)
  ```

**Nginx Config Generation:**
In nginx.service.ts, add:
```nginx
location / {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
}
```

### 4.2 Hotlink Protection

**Backend:**
- Add: `updateHotlinkProtection(domainId: string, enabled: boolean, domains: string[])`

**Frontend:**
- Add toggle and allowed domains input in WebserverPage

**Nginx Config:**
```nginx
location / {
    valid_referers none blocked example.com *.example.com;
    if ($invalid_referer) {
        return 403;
    }
}
```

### 4.3 Directory Password Protection

**Backend:**
- Add: `updateDirectoryAuth(domainId: string, path: string, username: string, password: string)`

**Frontend:**
- File manager: Right-click folder → "Password Protect"
- Or: WebserverPage → "Directory Security" section

**Nginx Config:**
```nginx
location /protected {
    auth_basic "Restricted";
    auth_basic_user_file /var/www/vhosts/example.com/.htpasswd;
}
```

### 4.4 Log Rotation Settings

**Backend:**
- File: `apps/api/src/services/logrotate.service.ts` (new)
- Add: `configureRotation(domainId: string, options: RotationOptions)`

**Frontend:**
- File: `apps/web/src/pages/logs/LogsPage.tsx`
- Add: Per-domain log rotation settings

**Configuration:**
```bash
/var/log/nginx/example.com-access.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        [ -s /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

---

## Database Migrations Required

```sql
-- Phase 1: UX Polish
-- No migrations needed

-- Phase 2: Core Features
ALTER TABLE domains ADD COLUMN custom_nginx TEXT;
ALTER TABLE domains ADD COLUMN custom_error_pages TEXT; -- JSON

-- Phase 3: Advanced Features
CREATE TABLE backup_destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE installed_apps (
    id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL,
    app_type TEXT NOT NULL, -- 'wordpress', 'woocommerce', etc.
    install_path TEXT NOT NULL,
    options TEXT, -- JSON
    created_at INTEGER NOT NULL,
    FOREIGN KEY (website_id) REFERENCES websites(id)
);

-- Phase 4: Feature Parity
ALTER TABLE domains ADD COLUMN ip_restrictions TEXT; -- JSON array
ALTER TABLE domains ADD COLUMN hotlink_protection TEXT; -- JSON
```

---

## Implementation Priority Order

| Priority | Task | Files to Modify | Lines |
|----------|------|-----------------|-------|
| 1 | Split DomainsPage.tsx | New folder structure | ~400 |
| 2 | Domain pre-check API + UI | domains.service.ts, DomainsPage.tsx | ~150 |
| 3 | Domain creation progress steps | domains.service.ts, DomainsPage.tsx | ~100 |
| 4 | Quick actions after domain creation | DomainsPage.tsx | ~30 |
| 5 | Search/filter on domain list | DomainsPage.tsx | ~50 |
| 6 | Bulk actions on domain list | DomainsPage.tsx | ~100 |
| 7 | PHP-FPM pool settings UI | php.service.ts, PhpPage.tsx | ~200 |
| 8 | Custom nginx directives | webserver.service.ts, nginx.service.ts, WebserverPage.tsx | ~150 |
| 9 | Custom error pages (per-domain) | webserver.service.ts, nginx.service.ts, WebserverPage.tsx | ~100 |

---

## Testing Checklist

For each change, verify:

### Domain Creation
- [ ] Pre-check shows correct DNS status
- [ ] Progress steps display during creation
- [ ] Errors during creation show rollback message
- [ ] Success shows quick action buttons
- [ ] Domain appears in list immediately after creation

### Website Management
- [ ] PHP-FPM pool settings save correctly
- [ ] Custom nginx directives apply after reload
- [ ] Custom error pages show for correct codes
- [ ] IP restrictions block/allow as configured

### Search/Filter/Bulk
- [ ] Search filters domains in real-time
- [ ] Bulk select works for multiple domains
- [ ] Bulk suspend/activate affects selected domains
- [ ] Selection persists across filter changes

---

## Rollback Plan

If any change causes issues:
1. Revert to previous commit
2. Test domain creation flow end-to-end
3. Verify nginx config regeneration works
4. Check database records are consistent

**Key rollback triggers:**
- Domain created but nginx default page shows
- Website shows 503 after PHP settings change
- Bulk action affects non-selected domains

---

*Plan created 2026-05-08 based on domain-website-mgmt-audit-report.md*