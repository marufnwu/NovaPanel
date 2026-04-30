# NovaPanel

A self-hosted server control panel (Plesk/cPanel alternative) built with modern web technologies.

## Features

- **Domain Management** — Add, suspend, activate domains with automatic virtual host configuration
- **Web Server** — Nginx & Apache configuration management with PHP-FPM support
- **SSL Certificates** — Let's Encrypt, custom certificates, and self-signed certs with auto-renewal
- **DNS Management** — BIND9 zone file management with import/export
- **Email** — Postfix + Dovecot mailbox & alias management with DKIM support
- **Databases** — MariaDB & PostgreSQL database and user management
- **FTP** — ProFTPd account management
- **File Manager** — Web-based file browser with editor, upload, archive support
- **Terminal** — Web-based terminal emulator via WebSocket + node-pty
- **Cron Jobs** — Scheduled task management
- **Firewall** — UFW rule management + Fail2Ban jail monitoring
- **Backups** — Full, file, database, and DNS backups with scheduling
- **Cloudflare Tunnels** — Cloudflare tunnel lifecycle management
- **Audit Log** — Complete audit trail of all administrative actions
- **Logs** — Access, error, and panel log viewer

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Backend** | Fastify 5, TypeScript 5, Drizzle ORM, SQLite (libsql) |
| **Frontend** | React 19, Vite 6, TanStack Router/Query, Zustand |
| **UI** | Tailwind CSS, Radix UI, Lucide Icons |
| **Auth** | Argon2id, session cookies, API tokens, TOTP 2FA |
| **Queue** | BullMQ + Redis (Valkey) |
| **Shell** | execa for safe command execution |

## Project Structure

```
NovaPanel/
├── apps/
│   ├── api/                    # Fastify 5 backend
│   │   ├── src/
│   │   │   ├── config/         # Environment, logger
│   │   │   ├── db/             # Drizzle ORM, schema, migrations
│   │   │   ├── modules/        # Feature modules (auth, domains, ssl, etc.)
│   │   │   ├── services/       # System service wrappers (nginx, mariadb, etc.)
│   │   │   ├── utils/          # Crypto utilities
│   │   │   ├── routes.ts       # Central route registration
│   │   │   └── server.ts       # Fastify server setup
│   │   └── package.json
│   └── web/                    # React 19 frontend
│       ├── src/
│       │   ├── api/            # API client + TanStack Query hooks
│       │   ├── components/     # Layout, UI, auth components
│       │   ├── pages/          # Page components for each module
│       │   ├── store/          # Zustand stores
│       │   └── router.tsx      # TanStack Router config
│       └── package.json
├── install.sh                  # Server installer script
├── turbo.json                  # Turborepo configuration
└── pnpm-workspace.yaml         # pnpm workspace config
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- SQLite 3

### Development

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Run database migrations
cd apps/api && pnpm db:migrate

# Seed the database (creates admin user)
pnpm db:seed

# Start development servers (API + Web)
pnpm dev
```

The API runs on `http://localhost:3000` and the web app on `http://localhost:5173`.

### Production Build

```bash
pnpm build
```

Output:
- `apps/api/dist/` — Compiled API server
- `apps/web/dist/` — Static frontend assets

### Running Tests

```bash
cd apps/api && pnpm test
```

## Server Installation

To install NovaPanel on a fresh Ubuntu 22.04/24.04 or Debian 12 server:

```bash
curl -fsSL https://your-domain.com/install.sh | sudo bash
```

The installer will:
1. Install all system dependencies (Nginx, MariaDB, PostgreSQL, BIND9, Postfix, Dovecot, ProFTPd, Certbot, UFW, Fail2Ban, Redis)
2. Configure the firewall with sensible defaults
3. Build and deploy NovaPanel
4. Create a systemd service for production use
5. Seed the database with an admin account

## API Endpoints

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| Health | `/api/v1/health` | GET |
| Auth | `/api/v1/auth` | POST login, logout, 2FA, GET me |
| Stats | `/api/v1/stats` | GET server, services, summary |
| Domains | `/api/v1/domains` | CRUD + suspend/activate |
| Web Server | `/api/v1/webserver` | GET status, vhost, test-config, reload |
| PHP | `/api/v1/php` | GET versions, settings |
| SSL | `/api/v1/ssl` | CRUD + Let's Encrypt, renew |
| DNS | `/api/v1/dns` | Zone CRUD + import/export |
| Mail | `/api/v1/mail` | Mailbox & alias CRUD + DKIM |
| Databases | `/api/v1/db` | Database & user CRUD + export/import |
| FTP | `/api/v1/ftp` | Account CRUD |
| Tunnels | `/api/v1/tunnel` | Setup, start/stop, routes |
| Files | `/api/v1/files` | List, upload, edit, archive |
| Terminal | `/ws/terminal` | WebSocket |
| Logs | `/api/v1/logs` | GET access, error, panel |
| Cron | `/api/v1/cron` | CRUD + toggle, run |
| Firewall | `/api/v1/firewall` | Rules CRUD + Fail2Ban |
| Backup | `/api/v1/backup` | CRUD + restore, schedules |
| Audit | `/api/v1/audit` | GET log |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API server port | `3000` |
| `PANEL_URL` | Public panel URL | `http://localhost:3000` |
| `SESSION_SECRET` | Session encryption key | Required |
| `DATABASE_URL` | SQLite database path | `file:./novapanel.db` |
| `REDIS_HOST` | Redis host | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `LOG_LEVEL` | Log level | `info` |

## License

MIT
