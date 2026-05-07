# NovaPanel Cloudflare Integration - User Flow Guide

## Overview

NovaPanel's Cloudflare integration provides a unified interface to manage:
1. **Cloudflare Tunnels** - Expose your server services to the internet via Cloudflare's network
2. **Zone Management** - Link Cloudflare domains and manage DNS, SSL, firewall rules, and more

---

## Getting Started

### 1. Initial Setup

**Prerequisites:**
- A Cloudflare account with at least one domain
- A Cloudflare API token with:
  - `Cloudflare Tunnel: Edit` permission
  - `Zone: DNS: Edit` permission

**First-time Setup:**

1. Navigate to **Cloudflare** in the sidebar
2. If not connected, you'll see the setup modal
3. Enter your Cloudflare API Token
4. Click **Validate Token** to verify
5. Select your account and zone
6. Click **Connect**

```
┌─────────────────────────────────────┐
│       Connect to Cloudflare         │
├─────────────────────────────────────┤
│  API Token: [••••••••••••••••]     │
│                                     │
│  [ Validate Token ]                 │
│                                     │
│  Account: [ My Account      ▼ ]    │
│  Zone:    [ example.com      ▼ ]    │
│                                     │
│  [ Connect ]  [ Cancel ]            │
└─────────────────────────────────────┘
```

---

## Main Cloudflare Dashboard

After connecting, you land on the **Overview** tab which shows:

### Overview Tab
- **Tunnel Status Banner** - Shows if tunnel is connected and how many connections
- **Stats Grid**:
  - Tunnels (count + active tunnel name)
  - Domains (count + active domains)
  - Routes (total routes + active routes)
  - SSL Secured (domains with strict/full SSL)
- **Active Routes List** - Quick view of tunnel routes
- **Linked Domains List** - Quick view of connected zones

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 Tunnel Connected                                          ││
│  │ 4 connections to Cloudflare edge • 3 routes active         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Tunnels  │  │ Domains  │  │ Routes   │  │ SSL Secured  │   │
│  │    1     │  │    2     │  │    3     │  │      2       │   │
│  │ maruf    │  │  2 active│  │ 3 active │  │  of 2 domains│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tunnel Management

### Tunnels Tab

This tab lets you create, manage, and monitor Cloudflare Tunnels.

#### Creating a Tunnel

1. Click **+ New Tunnel**
2. Fill in the form:
   - **Tunnel Name**: A friendly name (e.g., "production", "maruf-server")
3. Click **Create Tunnel**

Behind the scenes, NovaPanel:
- Creates the tunnel via Cloudflare API
- Stores the tunnel token securely
- Installs cloudflared as a systemd service
- Starts the service

```
┌─────────────────────────────────────┐
│       Create New Tunnel             │
├─────────────────────────────────────┤
│  Tunnel Name: [production        ]   │
│                                     │
│  [ Create ]  [ Cancel ]             │
└─────────────────────────────────────┘
```

#### Tunnel Card

Each tunnel displays:
- **Name** and **Status** (Active/Inactive/Down/Degraded)
- **Toggle Switch** - Enable/disable tunnel
- **Routes** - List of hostname → service mappings
- **Action Buttons**:
  - Add Route
  - Expose Panel (quick action to expose NovaPanel)
  - Config (view cloudflared config)
  - Logs (real-time tunnel logs)
  - Delete

```
┌─────────────────────────────────────────────────────────────┐
│  maruf                                       🟢 Active    ⏻│
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                     │
│  ├── maruf-bd.site → http://localhost:80     [Edit] [🗑]  │
│  ├── n8n.maruf-bd.site → http://localhost:5678 [Edit] [🗑] │
│  └── + Add Route                                            │
│                                                             │
│  [Add Route]  [Expose Panel]  [Config]  [Logs]  [Delete]    │
└─────────────────────────────────────────────────────────────┘
```

#### Adding a Route

1. Click **+ Add Route** on the tunnel card
2. Choose a preset or enter custom values:
   - **Preset Examples**:
     - Website (port 80)
     - SSL Website (port 443)
     - Custom
3. Enter:
   - **Subdomain**: e.g., `www`, `api`, `n8n`
   - **Domain**: Select from your linked zones
   - **Destination**: `http://localhost:PORT`
4. Toggle **Disable TLS Verify** if using self-signed certs
5. Click **Add Route**

```
┌─────────────────────────────────────┐
│       Add Route                     │
├─────────────────────────────────────┤
│  Presets:                           │
│  [Website (port 80)        ]         │
│  [SSL Website (port 443)   ]         │
│  [Custom                   ]         │
│                                     │
│  Subdomain: [api                ]   │
│  Domain:   [example.com     ▼ ]    │
│  Destination: [http://localhost:3000] │
│                                     │
│  [ ] Disable TLS Verify             │
│                                     │
│  [ Add Route ]  [ Cancel ]          │
└─────────────────────────────────────┘
```

---

## Zone Management

### Domains Tab

View and manage all linked Cloudflare zones.

#### Linking a New Zone

1. Click **Link Domain**
2. Select a domain from your Cloudflare account
3. Click **Connect**

#### Zone Detail View

Click on a zone to see detailed management:

##### Overview Sub-tab
- Zone status (active/paused)
- Plan info
- Nameservers
- DNS verification status
- Quick stats (DNS records, firewall rules, etc.)

##### DNS Sub-tab

**List Records:**
- View all DNS records (A, CNAME, MX, TXT, etc.)
- See proxy status (cloud icon)
- Edit or delete records

**Create Record:**
1. Click **+ Add Record**
2. Select record type
3. Fill in name, content, TTL
4. Toggle proxy status
5. Click **Create**

##### SSL/TLS Sub-tab
- View current SSL mode (Off/Flexible/Full/Strict)
- Change SSL mode
- Generate Origin CA Certificate
- View certificate details

##### Settings Sub-tab
- Browser Cache TTL
- Always Use HTTPS
- Automatic HTTPS Rewrites
- HTTP/2, HTTP/3 settings
- Min TLS Version

##### Firewall Sub-tab
- View firewall rules
- Create rules with expression builder
- Delete rules

##### Redirects Sub-tab
- View redirect rules
- Create redirects (301/302/303/307/308)
- Delete redirects

##### Mail Sub-tab
- Apply mail provider presets:
  - **Google Workspace**
  - **Microsoft 365**
  - **Zoho**
- Add custom MX, TXT, SRV records

##### Wildcard Sub-tab
- Enable/disable wildcard subdomain (`*.example.com`)
- Status indicator

---

## Settings Integration

### Global Cloudflare Settings

Access via **Settings → Cloudflare** or the setup modal:

- **API Token**: Stored securely (encrypted)
- **Account ID**: Cloudflare account identifier

---

## Typical User Flows

### Flow 1: First-Time Setup

```
1. Login to NovaPanel
2. Go to Cloudflare (sidebar)
3. Click "Connect Cloudflare"
4. Enter API token → Validate
5. Select account and zone
6. Click Connect
7. Now see Overview with tunnel and zone status
```

### Flow 2: Expose a Service via Tunnel

```
1. Go to Cloudflare → Tunnels tab
2. Click "New Tunnel" → Create tunnel (one-time)
3. On tunnel card, click "Add Route"
4. Select preset or enter custom
5. Enter subdomain, select domain, enter localhost:port
6. Click Add Route
7. DNS CNAME is auto-created on Cloudflare
8. Service now accessible via Cloudflare!
```

### Flow 3: Link a New Domain to Manage

```
1. Go to Cloudflare → Domains tab
2. Click "Link Domain"
3. Select domain from dropdown (uses stored API token)
4. Click Connect
5. Domain now appears in your zones list
6. Click domain to manage DNS, SSL, firewall, etc.
```

### Flow 4: Enable SSL for a Domain

```
1. Go to Cloudflare → Domains tab
2. Click on the domain
3. Go to SSL/TLS sub-tab
4. Select "Full (strict)" mode
5. Optionally generate Origin Certificate
6. SSL now enforced for all traffic
```

### Flow 5: Create a Redirect Rule

```
1. Go to Cloudflare → Domains tab
2. Click on domain
3. Go to Redirects sub-tab
4. Click "Create Redirect"
5. Enter source path (e.g., /old-page)
6. Enter destination URL
7. Select redirect type (301, 302, etc.)
8. Click Create
```

### Flow 6: Apply Mail Provider DNS

```
1. Go to Cloudflare → Domains tab
2. Click on domain
3. Go to Mail sub-tab
4. Select provider (Google/Microsoft/Zoho)
5. Click "Apply [Provider] Records"
6. MX, TXT, and other records auto-created
```

---

## Status Indicators

### Tunnel Statuses
| Status | Meaning | Color |
|--------|---------|-------|
| **Active** | Tunnel connected with HA connections | 🟢 Green |
| **Inactive** | Tunnel created but cloudflared not connected | ⚪ Gray |
| **Degraded** | Running but some connections failed | 🟡 Yellow |
| **Down** | Previously connected but now disconnected | 🔴 Red |

### Zone Statuses
| Status | Meaning |
|--------|---------|
| **Active** | Cloudflare proxy enabled |
| **Paused** | Cloudflare proxy disabled (gray cloud) |

### Proxy Status
| Icon | Meaning |
|------|---------|
| ☁️ Orange | Proxied through Cloudflare |
| ○ Gray | DNS only (not proxied) |

---

## Troubleshooting

### Tunnel Shows "Inactive" in Cloudflare Dashboard
- This means Cloudflare sees the tunnel token as never connected
- Verify the running cloudflared service is using the correct token
- Check: `systemctl status cloudflared`

### Can't Add Route - "Host already exists"
- A DNS record for that hostname already exists
- Delete existing record in DNS tab or Cloudflare dashboard

### SSL Errors After Enabling
- If using "Full (strict)" mode, you need a valid SSL cert on your origin
- Use Origin CA certificate from SSL/TLS tab, or
- Set to "Flexible" temporarily to test

### Tunnel Connected But Site Not Loading
- Check cloudflared logs for errors
- Verify origin service is running on the specified port
- Check firewall allows traffic to origin port

---

## Keyboard Shortcuts & Tips

- **Real-time Logs**: Click "Logs" on tunnel card to stream live tunnel logs
- **Quick Expose**: Use "Expose Panel" to quickly add a route for NovaPanel itself
- **Sync Routes**: If routes were added directly in Cloudflare dashboard, use "Sync" to pull them into NovaPanel
- **Bulk Actions**: On Domains tab, use checkboxes to select multiple domains