# NovaPanel

**Modern server management panel for Linux.** Manage domains, websites, databases, mail, DNS, SSL, FTP, backups, and more — all from a clean web interface.

> ⚡ One-command install · Docker & bare-metal · Ubuntu 22.04/24.04 · Debian 11/12

---

## ✨ Features

| Category | Features |
|----------|----------|
| **Web Server** | Nginx (frontend) + Apache (backend for .htaccess), PHP 8.1/8.2/8.3 FPM |
| **Domains** | Add/manage domains, subdomains, aliases, redirects, parking |
| **Websites** | Separate website resources with per-site PHP versions and configs |
| **Databases** | MariaDB 11.4 + PostgreSQL 16 — create DBs, users, import/export |
| **SSL/TLS** | Let's Encrypt (auto-renew) + custom certificates |
| **Mail** | Postfix + Dovecot (IMAP/POP3), virtual mailboxes, DKIM, SpamAssassin |
| **DNS** | BIND9 with zone file management |
| **FTP** | ProFTPD with virtual users, passive mode |
| **File Manager** | Web-based file manager with code editor, upload, archive |
| **Terminal** | Web-based terminal (xterm.js + node-pty) |
| **Cron** | Crontab management with expression builder |
| **Backups** | Scheduled backups with restore |
| **Firewall** | UFW management + Fail2Ban |
| **DNS Tunnel** | Cloudflare Tunnel integration |
| **App Installer** | One-click WordPress, phpMyAdmin, and more |
| **Monitoring** | CPU, RAM, disk, network stats with sparkline charts |
| **Audit Log** | Full action audit trail |
| **2FA** | TOTP two-factor authentication |
| **API Tokens** | Token-based API access |

---

## 🚀 Quick Install

### Option 1: One-Line Install (Bare Metal)

The easiest way to install NovaPanel on a fresh Ubuntu/Debian server:

```bash
curl -fsSL https://raw.githubusercontent.com/marufnwu/NovaPanel/master/scripts/install.sh | sudo bash
```

Or with custom settings:

```bash
curl -fsSL https://raw.githubusercontent.com/marufnwu/NovaPanel/master/scripts/install.sh | \
  sudo ADMIN_EMAIL=admin@yourdomain.com \
         ADMIN_PASSWORD=YourStrongPassword123 \
         PANEL_URL=http://yourserver.com bash
```

### Option 2: Docker Install

```bash
git clone https://github.com/marufnwu/NovaPanel.git
cd NovaPanel

# Build and start
docker compose build
docker compose up -d

# View logs
docker compose logs -f
```

Access the panel at `http://your-server-ip` (port 80).

### Option 3: Manual Install from Source

```bash
git clone https://github.com/marufnwu/NovaPanel.git /opt/novapanel
cd /opt/novapanel

# Run the installer
sudo bash scripts/install.sh
```

---

## 🔑 Default Credentials

After installation, login with:

| Field | Default |
|-------|---------|
| **Username** | `admin` |
| **Password** | Auto-generated (shown at end of install) |
| **URL** | `http://your-server-ip` |

> ⚠️ **Change the default password immediately after first login!**

---

## 📋 Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Ubuntu 22.04 / Debian 11 | Ubuntu 24.04 |
| **RAM** | 1 GB | 2 GB+ |
| **Disk** | 10 GB | 20 GB+ |
| **Architecture** | x86_64 / ARM64 | x86_64 |
| **Access** | Root (sudo) | Root |

---

## 🏗️ Architecture

```
NovaPanel/
├── apps/
│   ├── api/          # Fastify backend (TypeScript)
│   │   ├── src/
│   │   │   ├── modules/    # Feature modules (auth, domains, websites, etc.)
│   │   │   ├── services/   # System service integrations (nginx, php-fpm, etc.)
│   │   │   ├── db/         # Drizzle ORM schema + migrations (SQLite)
│   │   │   └── config/     # Environment, logger
│   │   └── drizzle.config.ts
│   └── web/          # React frontend (Vite + TanStack Router)
│       └── src/
│           ├── pages/      # Page components
│           ├── api/        # React Query hooks
│           └── components/ # Shared UI components
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── supervisord.conf
│   ├── entrypoint.sh
│   └── systemctl-wrapper.sh
├── scripts/
│   └── install.sh    # Production installer
└── package.json      # pnpm workspace root
```

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- SQLite3

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Build both apps
pnpm build

# Run migrations
cd apps/api && node dist/db/migrate.js

# Seed the database (creates admin user)
node dist/db/seed.js

# Start API in development mode
pnpm --filter api dev

# Start web in development mode (separate terminal)
pnpm --filter web dev
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Fastify, Drizzle ORM, SQLite, BullMQ (Redis) |
| **Frontend** | React, TanStack Router/Query, Tailwind CSS, Radix UI |
| **Build** | Vite, TypeScript, pnpm workspaces |
| **Deployment** | Docker (supervisord) or bare metal (systemd) |

---

## 🔧 Management

### Bare Metal (systemd)

```bash
# Start/stop/restart the panel
sudo systemctl start novapanel
sudo systemctl stop novapanel
sudo systemctl restart novapanel

# View logs
sudo journalctl -u novapanel -f

# Check status
sudo systemctl status novapanel
```

### Docker

```bash
# Start/stop
docker compose up -d
docker compose down

# View logs
docker compose logs -f novapanel

# Shell into container
docker compose exec novapanel bash

# Restart specific service inside container
docker compose exec novapanel supervisorctl restart nginx
```

---

## 🔒 Security

- Session-based auth with HTTP-only cookies
- TOTP two-factor authentication
- CSRF protection
- Rate limiting (100 req/min)
- Helmet security headers
- Command execution allowlist (no arbitrary shell commands)
- Path traversal protection in file manager
- UFW firewall auto-configured on install

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
