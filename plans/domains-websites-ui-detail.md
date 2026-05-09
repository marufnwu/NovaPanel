# Domains & Websites UI Detail

**Generated from:** Actual file reads
**Source Files:**
- `apps/web/src/pages/domains/DomainsPage.tsx` (2461 lines)
- `apps/web/src/pages/websites/WebsitesPage.tsx` (448 lines)
- `apps/web/src/pages/websites/WebsiteDetailPage.tsx` (901 lines)

---

## 1. Domains Page (`/domains`)

**File:** [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx)

### 1.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: "Domains" + [Add Domain] button                       │
├──────────────────────────────────────────────────────────────────┤
│ Success Banner (post-creation, dismissible)                       │
│ ├── Domain name + "is now active"                                 │
│ ├── "Set Up Tunnel" link → /cloudflare                            │
│ └── "Upload Files" link → /files                                  │
├──────────────────────────────────────────────────────────────────┤
│ Search Bar + Domain Count                                         │
├──────────────────────────────────────────────────────────────────┤
│ Domains Table (checkbox selection enabled)                        │
│ ├── Checkbox | Domain | Access | Status | Type | SSL | Website | Actions │
│ └── Row click → DomainDetail panel                                │
├──────────────────────────────────────────────────────────────────┤
│ Bulk Action Bar (floating, appears when items selected)           │
│ ├── N selected                                                    │
│ ├── [Suspend] [Activate] [Delete]                                │
│ └── X clear                                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Hooks

| Hook | Purpose |
|------|---------|
| `useDomains()` | List all domains |
| `useCreateDomain()` | Create new domain |
| `useDeleteDomain()` | Delete domain |
| `useUpdateDomain()` | Update domain (rename) |
| `useSuspendDomain()` | Suspend domain |
| `useActivateDomain()` | Activate domain |
| `useBulkSuspendDomains()` | Bulk suspend |
| `useBulkActivateDomains()` | Bulk activate |
| `useBulkDeleteDomains()` | Bulk delete |
| `useSubdomains(domainId)` | Get subdomains for domain |
| `useAliases(domainId)` | Get aliases for domain |
| `useRedirects(domainId)` | Get redirects for domain |
| `useDomainLogStats(domainId)` | Get access log stats |
| `useDomainCloudflareStatus(domainId)` | Cloudflare status |
| `useDomainCloudflareZone(domainId)` | Cloudflare zone |
| `useDomainCloudflareDns(domainId)` | Cloudflare DNS records |
| `useDomainCloudflareSsl(domainId)` | Cloudflare SSL settings |
| `useDomainCloudflareFirewall(domainId)` | Cloudflare firewall rules |
| `useDomainCloudflareRedirects(domainId)` | Cloudflare redirects |
| `useVerifyDomainDns()` | Verify DNS configuration |
| `useServerContext()` | Server IP, tunnel status |
| `useTunnelRoutes()` | Tunnel routes |
| `useCloudflareConfig()` | Cloudflare API token |

### 1.3 Table Columns

| Column | Content |
|--------|---------|
| Checkbox | Bulk selection |
| Domain | Name + CF badge (if tunnel active) + external link icon |
| Access | `DomainStatusBadge` component |
| Status | active/suspended badge |
| Type | primary badge |
| SSL | Shield icon (green if enabled) |
| Website | "View" link if linked, else "—" |
| Actions | Edit, Suspend/Activate, Delete, Details (ChevronRight) |

### 1.4 Interactive Elements

| Element | Behavior |
|---------|----------|
| Row Click | Opens `DomainDetail` panel (inline, not route) |
| Checkbox | Toggle selection for bulk actions |
| Add Domain button | Shows `CreateDomainForm` inline |
| Success Banner X | Dismisses banner |
| Actions column buttons | Stop propagation, individual actions |

### 1.5 Modals/Dialogs

| Modal | Trigger | Purpose |
|-------|---------|---------|
| `CreateDomainForm` (inline) | Add Domain button | Multi-field form for domain creation |
| `DeleteConfirm` | Delete button | Type domain name to confirm deletion |
| `RenameDomainModal` | Edit button | Rename domain |
| `ConfirmDialog` | Bulk actions, Suspend | Generic confirmation |
| `LinkWebsiteModal` | DomainDetail → Link to Website | Associate domain with website |

### 1.6 CreateDomainForm Fields

```tsx
{
  name: string;                    // Domain name
  documentRoot: string;            // Optional, auto-generated
  phpVersion: string;             // Dropdown
  phpHandler: string;             // 'php-fpm' | 'cgi' | 'disabled'
  webServer: string;              // 'nginx' | 'apache' | 'nginx+apache'
  createDns: boolean;             // Create DNS zone
  createMail: boolean;            // Enable mail domain
  websiteMode: 'none' | 'create' | 'existing';
  websiteId: string;              // Required if websiteMode='existing'
  makePublic: boolean;            // Cloudflare Tunnel exposure
  tunnelId: string;               // Tunnel for public exposure
  skipDnsVerification: boolean;   // Skip DNS check
}
```

**DNS Verification:**
- Triggers on domain name blur
- Shows green checkmark if points to server
- Shows red X with error if not configured
- "Skip DNS verification" checkbox when DNS not ready

### 1.7 Bulk Action Bar

**Floating bar at bottom center when items selected:**
- Shows count of selected items
- Suspend button (warning style)
- Activate button (info style)
- Delete button (danger style)
- X button to clear selection

---

## 2. Domain Detail (Inline Panel)

**Component:** `DomainDetail` (defined in [`DomainsPage.tsx`](apps/web/src/pages/domains/DomainsPage.tsx:718-1480))

### 2.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ [← Back to domains]                                               │
├──────────────────────────────────────────────────────────────────┤
│ Header: Domain name + Status badge + [Open] / [Not Accessible]    │
├──────────────────────────────────────────────────────────────────┤
│ Tab Bar: Overview | Subdomains | Aliases | Redirects | Cloudflare │
├──────────────────────────────────────────────────────────────────┤
│ Tab Content (varies by tab)                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Tabs

| Tab | Purpose |
|-----|---------|
| Overview | Domain info, linked website, Cloudflare integration, quick links |
| Subdomains | Create/list subdomains |
| Aliases | Create/list domain aliases |
| Redirects | Create/list URL redirects (301/302) |
| Cloudflare | CONDITIONAL - only if Cloudflare configured |

### 2.3 Overview Tab Content

**Linked Website Section:**
- Shows linked website name + document root
- "View Website" link
- If no website: "Link to Website" button

**Cloudflare Integration Section:**
- Shows tunnel route status (Active badge if configured)
- "Manage in Cloudflare" link
- If no tunnel: "Set Up Cloudflare" link

**Domain Info Cards (3-column grid):**
- SSL: Enabled/Disabled + link to SSL management
- System User: system username (monospace)
- Disk Usage: MB used

**Domain Services Quick Links (3-column grid):**
- DNS Records → `/dns`
- SSL/TLS → `/ssl`
- Mail → `/mail`

**Access Log Stats (if available):**
- Total Requests, Error Count, Error Rate
- Top URLs list

### 2.4 Subdomains Tab

**Create Form:**
- Subdomain prefix input
- Document root input (auto-generated pattern)
- Add button with validation

**Validation:**
- Reserved names check (www, mail, ftp, admin, etc.)
- Duplicate check
- Regex validation for subdomain format

**Table Columns:** Subdomain | Document Root | PHP | Actions (delete)

### 2.5 Aliases Tab

**Create Form:**
- Alias domain input
- Add button

**Table Columns:** Alias | Target | Actions (delete)

### 2.6 Redirects Tab

**Create Form:**
- Source path input
- Target URL input
- Type dropdown (301/302)
- Add button

**Table Columns:** Source | Target | Type | Actions (delete)

### 2.7 Cloudflare Tab

**Sub-tabs:** DNS Records | SSL/TLS | Firewall | Redirects

**Quick Actions Bar:**
- "Make Private" / "Make Public" toggle button
- "Enable SSL" button
- "Setup Redirects" button

#### 2.7.1 DNS Records Sub-tab
- Table: Type | Name | Content | Proxied | TTL | Actions
- Add Record modal with type selector (A, AAAA, CNAME, MX, TXT, SRV, CAA)

#### 2.7.2 SSL/TLS Sub-tab
- SSL Mode selector: off | flexible | full | strict
- Toggle settings: Always Use HTTPS, Automatic HTTPS Rewrites, HTTP/2, HTTP/3
- Minimum TLS Version dropdown

#### 2.7.3 Firewall Sub-tab
- Table: Action | Expression | Description | Actions
- Add Rule modal: action, expression (Wirefilter), description

#### 2.7.4 Redirects Sub-tab
- Table: Source | Destination | Type | Actions
- Add Redirect modal: source pattern, destination URL, type

---

## 3. Websites Page (`/websites`)

**File:** [`WebsitesPage.tsx`](apps/web/src/pages/websites/WebsitesPage.tsx)

### 3.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: "Websites" + [Create Website] button                 │
├──────────────────────────────────────────────────────────────────┤
│ Error State (if fetch fails)                                       │
│ ├── Icon + "Failed to load websites"                               │
│ └── [Retry] button                                               │
├──────────────────────────────────────────────────────────────────┤
│ Empty State (if no websites)                                       │
│ ├── Icon + "No websites" + description                             │
│ └── [Create Website] button                                       │
├──────────────────────────────────────────────────────────────────┤
│ Websites Table                                                    │
│ ├── Name | PHP Version | Web Server | Status | Disk | Actions     │
│ └── Row click → PLACEHOLDER (Phase 8)                             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Hooks

| Hook | Purpose |
|------|---------|
| `useWebsites()` | List all websites |
| `useCreateWebsite()` | Create website |
| `useDeleteWebsite()` | Delete website |
| `useSuspendWebsite()` | Suspend website |
| `useActivateWebsite()` | Activate website |
| `usePhpVersions()` | Get available PHP versions |

### 3.3 Table Columns

| Column | Content |
|--------|---------|
| Name | Website name + document root (truncated) |
| PHP Version | PHP version or "—" |
| Web Server | nginx/apache/nginx+apache |
| Status | StatusBadge component |
| Disk Usage | HardDrive icon + MB used |
| Actions | ActionDropdown menu |

### 3.4 Interactive Elements

| Element | Behavior |
|---------|----------|
| Row Click | PLACEHOLDER - "Navigation will be wired in Phase 8" |
| Create Button | Opens `CreateWebsiteModal` |
| Actions Dropdown | Edit, Suspend/Activate, Delete |

### 3.5 Modals

| Modal | Purpose |
|-------|---------|
| `CreateWebsiteModal` | Create new website |
| `ConfirmDialog` (danger) | Delete confirmation (requires typing name) |
| `ConfirmDialog` (warning) | Suspend confirmation |
| `ConfirmDialog` (info) | Activate confirmation |

### 3.6 CreateWebsiteModal Fields

```tsx
{
  name: string;            // Website name (required)
  documentRoot: string;    // Optional, auto-generated
  phpVersion: string;     // Dropdown from available versions
  webServer: string;       // 'nginx' | 'apache' | 'nginx+apache'
}
```

### 3.7 ActionDropdown Menu Items

| Item | Condition | Action |
|------|-----------|--------|
| Edit | Always | PLACEHOLDER |
| Suspend | If status=active | Opens suspend dialog |
| Activate | If status!=active | Opens activate dialog |
| Delete | Always | Opens delete dialog |

### 3.8 ⚠️ GAP: Row Click Not Wired

Line 355-358 in [`WebsitesPage.tsx`](apps/web/src/pages/websites/WebsitesPage.tsx:355-358):
```tsx
onClick={() => {
  // Navigation will be wired in Phase 8 when router is updated
  // For now, this is a placeholder
}}
```

**Impact:** Users cannot navigate to website detail from the table.

---

## 4. Website Detail Page (`/websites/:id`)

**File:** [`WebsiteDetailPage.tsx`](apps/web/src/pages/websites/WebsiteDetailPage.tsx)

### 4.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Websites → {website name}                              │
├──────────────────────────────────────────────────────────────────┤
│ Header: Website name + StatusBadge | Edit | Suspend | Activate | Delete │
├──────────────────────────────────────────────────────────────────┤
│ Tab Bar: Overview | Domains | Files | FTP | Cron | Databases | Backups | Apps │
├──────────────────────────────────────────────────────────────────┤
│ Tab Content                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Hooks

| Hook | Purpose |
|------|---------|
| `useWebsite(id)` | Get website details |
| `useUpdateWebsite()` | Update website |
| `useDeleteWebsite()` | Delete website |
| `useSuspendWebsite()` | Suspend website |
| `useActivateWebsite()` | Activate website |
| `useAttachDomain()` | Attach domain to website |
| `useDetachDomain()` | Detach domain from website |
| `useWebsiteFtp(websiteId)` | Get FTP accounts for website |
| `useWebsiteCron(websiteId)` | Get cron jobs for website |
| `useWebsiteBackups(websiteId)` | Get backups for website |
| `useWebsiteDatabases(websiteId)` | Get databases for website |
| `useWebsiteApps(websiteId)` | Get installed apps |
| `useDomains()` | List all domains (for attach) |

### 4.3 Tabs

| Tab | Icon | Content |
|-----|------|---------|
| Overview | Server | Info cards + quick actions |
| Domains | Globe | Attached domains list + attach button |
| Files | FolderOpen | **PLACEHOLDER** - links to /files |
| FTP | Users | FTP accounts table |
| Cron | Clock | Cron jobs table |
| Databases | Database | Databases table |
| Backups | Archive | Backups table |
| Apps | AppWindow | Installed apps table |

### 4.4 Tab Details

#### 4.4.1 Overview Tab
Info items in 3-column grid:
- Name, System User, Document Root, PHP Version, PHP Handler, Web Server, Status, Disk Usage, Bandwidth, Created

Quick actions:
- "PHP Settings" → `/php?domain={name}`
- "Open Website" → `http://{name}`

#### 4.4.2 Domains Tab
- Shows domains attached to this website
- "Attach Domain" button → `AttachDomainModal`
- Detach action per domain
- Table: Domain | Type | Status | Actions (detach)

#### 4.4.3 Files Tab (⚠️ PLACEHOLDER)
```tsx
function FilesTab({ website }: { website: Website }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">File Manager</h3>
            <p className="text-sm text-muted-foreground">
              Manage files for this website
            </p>
          </div>
        </div>
        <div className="mt-4">
          <a href={`/files?websiteId=${website.id}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <FolderOpen className="h-4 w-4" /> Open File Manager
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Document root: <code className="rounded bg-muted px-1.5 py-0.5">{website.documentRoot}</code>
        </p>
      </div>
    </div>
  );
}
```

#### 4.4.4 FTP Tab
- Table: Username | Path | Status
- Empty state if no accounts

#### 4.4.5 Cron Tab
- Table: Schedule | Command | Status
- Empty state if no jobs

#### 4.4.6 Databases Tab
- Table: Name | Type | Size
- Empty state if no databases

#### 4.4.7 Backups Tab
- Table: Name | Date | Size | Status
- Empty state if no backups

#### 4.4.8 Apps Tab
- Table: App | Version | Status
- Empty state if no apps

### 4.5 Header Action Buttons

| Button | Condition | Icon |
|--------|-----------|------|
| Edit | Always | Edit3 |
| Suspend | If status=active | Ban |
| Activate | If status!=active | CheckCircle |
| Delete | Always | Trash2 |

### 4.6 Modals

| Modal | Purpose |
|-------|---------|
| `EditWebsiteModal` | Edit website name, document root, PHP, webserver |
| `AttachDomainModal` | Attach existing domain to website |
| `ConfirmDialog` (danger) | Delete (requires typing name) |
| `ConfirmDialog` (warning) | Suspend |
| `ConfirmDialog` (info) | Activate |

### 4.7 EditWebsiteModal Fields

```tsx
{
  name: string;
  documentRoot: string;
  phpVersion: string;
  webServer: string;
}
```

### 4.8 AttachDomainModal

Filters domains not already attached to any website (`!d.websiteId`).

---

## 5. Relationships

### 5.1 Domain ↔ Website Relationship

```
Domain
├── websiteId: string | null  -- links to Website
└── status: 'active' | 'suspended'
    │
    └── DomainDetail
        ├── Overview → shows linked website
        ├── Domains tab → shows which website it's attached to
        └── "Link to Website" button if none

Website
├── id: string
├── domains: Domain[]  -- 1:many relationship via websiteId
└── WebsiteDetail
    ├── Domains tab → list attached domains
    └── AttachDomainModal → link new domain
```

### 5.2 Navigation Flow

```
/domains
├── Click row → DomainDetail panel (inline)
│   ├── Overview tab → Quick links to /dns, /ssl, /mail
│   ├── Subdomains tab
│   ├── Aliases tab
│   ├── Redirects tab
│   └── Cloudflare tab (conditional)
└── Actions column → Modals

/websites
├── Click row → NOT WIRED (Phase 8 placeholder)
└── Actions dropdown → Modals

/websites/:id
├── Tabs: Overview, Domains, Files, FTP, Cron, Databases, Backups, Apps
└── Actions: Edit, Suspend/Activate, Delete
```

### 5.3 Cross-Page Links

| From | To | Condition |
|------|-----|-----------|
| Domain row | Website (if linked) | `d.websiteId` exists |
| DomainDetail → Overview → "View Website" | `/websites/:id` | Website linked |
| DomainDetail → "Link to Website" | LinkWebsiteModal | Opens modal |
| WebsiteDetail → Domains tab | View domains | List attached |
| WebsiteDetail → Domains tab → "Attach" | AttachDomainModal | Opens modal |
| WebsiteDetail → Overview → "PHP Settings" | `/php?domain=name` | — |
| Domain success banner | Set Up Tunnel → `/cloudflare` | — |
| Domain success banner | Upload Files → `/files` | — |

---

## 6. State Management

### 6.1 DomainsPage State

```tsx
const [search, setSearch] = useState('');                    // Search filter
const [showCreate, setShowCreate] = useState(false);        // Show create form
const [createdDomain, setCreatedDomain] = useState(null);   // Post-create banner
const [deleteTarget, setDeleteTarget] = useState(null);     // Delete modal
const [selectedDomain, setSelectedDomain] = useState(null); // Detail panel
const [renameTarget, setRenameTarget] = useState(null);     // Rename modal
const [selectedIds, setSelectedIds] = useState<Set<string>>(); // Bulk selection
const [confirmDialog, setConfirmDialog] = useState({...});   // Bulk confirm
const [suspendTarget, setSuspendTarget] = useState(null);   // Suspend confirm
```

### 6.2 DomainDetail State

```tsx
const [tab, setTab] = useState<'overview' | 'subdomains' | 'aliases' | 'redirects' | 'cloudflare'>('overview');
const [cfSubTab, setCfSubTab] = useState<'dns' | 'ssl' | 'firewall' | 'redirects'>('dns');
const [newSubdomain, setNewSubdomain] = useState('');
const [newSubdomainDocRoot, setNewSubdomainDocRoot] = useState('');
const [subdomainError, setSubdomainError] = useState<string | null>(null);
const [subdomainWarning, setSubdomainWarning] = useState<string | null>(null);
const [dnsStatus, setDnsStatus] = useState<{ created: boolean; message: string } | null>(null);
const [newAlias, setNewAlias] = useState('');
const [newRedirectSource, setNewRedirectSource] = useState('');
const [newRedirectTarget, setNewRedirectTarget] = useState('');
const [newRedirectType, setNewRedirectType] = useState<'301' | '302'>('301');
const [showLinkModal, setShowLinkModal] = useState(false);
```

### 6.3 WebsitesPage State

```tsx
const [showCreate, setShowCreate] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<Website | null>(null);
const [suspendTarget, setSuspendTarget] = useState<Website | null>(null);
const [activateTarget, setActivateTarget] = useState<Website | null>(null);
```

### 6.4 WebsiteDetailPage State

```tsx
const [activeTab, setActiveTab] = useState<TabId>('overview');
const [showEdit, setShowEdit] = useState(false);
const [showDelete, setShowDelete] = useState(false);
const [showSuspend, setShowSuspend] = useState(false);
const [showActivate, setShowActivate] = useState(false);
```

---

## 7. Key Features

### 7.1 DNS Verification on Domain Create

When entering a domain name and losing focus (blur):
1. API call to verify DNS
2. Shows green indicator if domain resolves to server IP
3. Shows red indicator with error if not
4. "Skip DNS verification" checkbox appears if not verified
5. Submit button disabled until DNS is verified OR skip is checked

### 7.2 Cloudflare Tunnel Auto-Public

When creating a domain AND Cloudflare is configured AND tunnels exist:
1. "Internet Access" section appears
2. Checkbox "Make this domain publicly accessible via Cloudflare Tunnel"
3. If checked, tunnel selector appears
4. Auto-selects first active tunnel
5. Creates tunnel route on domain creation

### 7.3 Bulk Actions

Domains page supports:
- Bulk select via checkboxes
- Bulk suspend
- Bulk activate
- Bulk delete

### 7.4 Domain Status Badge

Shows access status:
- "Local" - only accessible from local network
- "Public" - accessible via public IP
- "Tunnel" - accessible via Cloudflare Tunnel

### 7.5 Subdomain Validation

Validates:
- Format (alphanumeric, hyphens allowed, can't start/end with hyphen)
- Length (max 63 chars)
- Reserved names (www, mail, ftp, admin, etc.)
- Duplicate names

---

## 8. Component Hierarchy

```
DomainsPage
├── PageHeader
├── CreateDomainForm (conditional)
├── SuccessBanner (conditional, post-create)
├── SearchBar
├── DomainsTable
│   └── DomainStatusBadge
├── BulkActionBar
├── DeleteConfirm (conditional)
├── RenameDomainModal (conditional)
├── ConfirmDialog (conditional)
├── SuspendConfirm (conditional)
├── LinkWebsiteModal (conditional)
└── DomainDetail (conditional)
    ├── DomainDetail header + tabs
    ├── SubdomainsTab
    │   └── (inline create form + table)
    ├── AliasesTab
    │   └── (inline create form + table)
    ├── RedirectsTab
    │   └── (inline create form + table)
    ├── CloudflareTab (conditional)
    │   ├── DomainCfDnsTab
    │   ├── DomainCfSslTab
    │   ├── DomainCfFirewallTab
    │   └── DomainCfRedirectsTab
    └── LinkWebsiteModal (conditional)

WebsitesPage
├── PageHeader
├── CreateWebsiteModal (conditional)
├── ConfirmDialog (deletion)
├── ConfirmDialog (suspend)
├── ConfirmDialog (activate)
└── ActionDropdown (per row)

WebsiteDetailPage
├── Breadcrumb
├── Header (name, status, actions)
├── TabBar
├── OverviewTab
├── DomainsTab
│   ├── AttachDomainModal (conditional)
│   └── ConfirmDialog (detach)
├── FilesTab (placeholder)
├── FtpTab
├── CronTab
├── DatabasesTab
├── BackupsTab
├── AppsTab
├── EditWebsiteModal (conditional)
├── ConfirmDialog (delete)
├── ConfirmDialog (suspend)
└── ConfirmDialog (activate)
```

---

## 9. Gaps Summary

| Gap | Location | Severity | Impact |
|-----|----------|----------|--------|
| Row click not wired | WebsitesPage line 355-358 | HIGH | Cannot navigate to website detail |
| FilesTab placeholder | WebsiteDetailPage line 447-475 | LOW | Files tab just links to /files |
| DomainDetail is inline panel | DomainsPage | MEDIUM | Different UX pattern than website detail |
| Edit from WebsitesPage not wired | WebsitesPage line 390-392 | HIGH | Cannot edit from list view |
| Delete navigation back | WebsiteDetailPage line 746 | MEDIUM | No redirect after delete |
