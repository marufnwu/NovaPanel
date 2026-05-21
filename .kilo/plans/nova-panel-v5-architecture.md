# NovaPanel v5 — Modern Server Control Panel Architecture

## Philosophy

Build a cloud-native server panel that feels like Vercel + DigitalOcean + Cloudflare combined, but self-hosted. Everything should be:
- **API-first** — every feature exposed via REST + WebSocket
- **Event-driven** — reactive architecture with real-time updates
- **Infrastructure-as-Code** — GitOps, templates, reproducible deployments
- **Multi-tenant** — full multi-user with roles, quotas, billing
- **Observable** — metrics, logs, traces out of the box
- **Extensible** — plugin marketplace, custom integrations

---

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           Frontend (SPA + TUI)          │
│   React + Real-time + Mobile-ready      │
├─────────────────────────────────────────┤
│              API Gateway                │
│   Rate limiting, caching, versioning    │
├─────────────────────────────────────────┤
│           Core Services                 │
│   Auth, Tenancy, Billing, Audit         │
├─────────────────────────────────────────┤
│          Feature Modules                │
│   Sites, Domains, DBs, Containers...    │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│   Reconciler, Job Queue, Scheduler      │
├─────────────────────────────────────────┤
│         System Interface                │
│   Docker, systemd, nginx, CLI wrappers  │
└─────────────────────────────────────────┘
```

---

## Feature Architecture

### 1. Identity & Access

| Feature | Implementation |
|---------|---------------|
| Multi-tenant | Organizations → Projects → Resources hierarchy |
| RBAC | Granular permissions (e.g., `domains:read`, `sites:write`) |
| SSO | OAuth2/OIDC (Google, GitHub, Azure AD, SAML) |
| MFA | TOTP, WebAuthn/FIDO2, recovery codes |
| API Keys | Scoped tokens with fine-grained permissions, rate limits |
| Service Accounts | Headless auth for CI/CD automation |
| Audit Log | Immutable activity stream, tamper-evident |

### 2. Site Management (v5)

```
Site
├── Runtime (docker / native / static)
│   ├── Docker: Dockerfile, Compose, image registry
│   ├── Native: Node.js, Python, PHP, Go, Rust (auto-detect)
│   └── Static: Static site generator (Next.js, Hugo, etc.)
├── Source
│   ├── Git integration (GitHub/GitLab/Bitbucket webhooks)
│   ├── Upload / CLI deploy
│   └── Container registry (push-to-deploy)
├── Environment Variables (encrypted at rest)
├── Domains (multiple, auto-SSL)
├── CDN / Edge config
├── Health checks
└── Auto-scaling rules
```

| Feature | Details |
|---------|---------|
| GitOps | Auto-deploy on push, preview deployments per PR |
| Build Pipeline | Dockerfile or buildpack detection, cached layers |
| Preview Envs | Automatic staging URLs for PRs/branches |
| Rollbacks | One-click rollback to previous deployment |
| Environment Vars | Encrypted, versioned, per-environment |
| Health Checks | HTTP + custom script, auto-restart on failure |
| Auto-scaling | Horizontal (replicas) + vertical (CPU/memory) |

### 3. Domain & DNS

| Feature | Details |
|---------|---------|
| DNS Hosting | Full DNS management (A, AAAA, CNAME, MX, TXT, SRV, CAA, NS) |
| DNSSEC | One-click DNSSEC signing |
| Wildcard | `*.example.com` support |
| GeoDNS | Route by location, latency, or custom rules |
| Load Balancing | Round-robin, weighted, failover |
| API + Webhook | Programmatic DNS updates |

### 4. SSL/TLS

| Feature | Details |
|---------|---------|
| Auto SSL | Let's Encrypt, Google Trust Services, ZeroSSL |
| Wildcard | `*.example.com` with DNS-01 |
| Custom Certs | Upload + automated renewal reminders |
| mTLS | Client certificate authentication |
| SSL Report | Grade + remediation suggestions |

### 5. Databases

| Type | Features |
|------|----------|
| PostgreSQL | Managed PG, extensions, read replicas, PITR |
| MySQL/MariaDB | Managed, InnoDB tuning, slow query log |
| MongoDB | Managed clusters, sharding |
| Redis | Managed Redis/Valkey, persistence, clustering |
| SQLite | Embedded, per-app instances |

**Universal DB Features:**
- Automated backups (hourly/daily/weekly)
- Point-in-time recovery
- Connection pooling (PgBouncer, ProxySQL)
- Query performance insights
- Database branching (copy for staging)

### 6. File Storage

| Feature | Details |
|---------|---------|
| Object Storage | S3-compatible API (MinIO) |
| Volumes | Block storage attach/detach |
| Backups | Automated, cross-region replication |
| CDN Integration | Cache static assets at edge |
| SFTP/FTPS | Managed access to storage buckets |

### 7. Containers & Orchestration

```
Project
├── Services (Docker Compose / K8s manifests)
│   ├── web (nginx + app)
│   ├── worker (background jobs)
│   └── scheduler (cron)
├── Networks (internal + external)
├── Volumes (persistent storage)
└── Secrets (injected at runtime)
```

| Feature | Details |
|---------|---------|
| Docker Compose | Native support, UI editor |
| Kubernetes | K3s/K8s integration, Helm charts |
| Registry | Private container registry |
| Service Mesh | mTLS between services, traffic splitting |
| Serverless | Functions-as-a-Service (OpenFaaS/Knative) |

### 8. Networking

| Feature | Details |
|---------|---------|
| VPC / Private Network | Isolated networks between services |
| VPN | WireGuard, OpenVPN server/client |
| Load Balancer | HAProxy/nginx layer 4/7, health checks |
| Firewall | WAF rules, IP allowlisting, Geo-blocking |
| DDoS Protection | Rate limiting, challenge pages |
| Port Management | Custom port forwarding, UPnP |

### 9. Monitoring & Observability

| Feature | Details |
|---------|---------|
| Metrics | Prometheus + Grafana dashboards (built-in) |
| Logs | Loki / Vector, structured logging, live tail |
| Traces | OpenTelemetry / Jaeger, distributed tracing |
| Alerting | PagerDuty, Slack, Discord, email, webhook |
| Uptime Checks | Multi-region HTTP/ICMP monitoring |
| Resource Usage | Per-site/container breakdown, billing integration |
| Log Analysis | AI-powered anomaly detection |

### 10. Backups & Disaster Recovery

| Feature | Details |
|---------|---------|
| Automated Backups | Site files, databases, configs |
| Incremental | Block-level deduplication |
| Offsite Storage | S3, B2, Wasabi, Glacier |
| Disaster Recovery | Cross-region failover, automated runbooks |
| Immutable Backups | WORM storage, ransomware protection |

### 11. Security

| Feature | Details |
|---------|---------|
| WAF | ModSecurity / Coreruleset, custom rules |
| Bot Protection | JavaScript challenge, CAPTCHA, bot scoring |
| Vulnerability Scan | Dependency audit, CVE database |
| Secrets Manager | HashiCorp Vault integration, rotation |
| Intrusion Detection | Fail2ban + custom heuristics |
| Compliance | SOC2, GDPR helpers, data retention policies |

### 12. Email

| Feature | Details |
|---------|---------|
| Mail Server | Full Postfix/Dovecot (SMTP, IMAP, POP3) |
| Webmail | Roundcube / SnappyMail |
| Mailing Lists | Mailman / Sympa |
| SMTP Relay | Amazon SES, Mailgun, SendGrid integration |
| DKIM/DMARC/SPF | Automated setup + monitoring |
| Catch-all | Wildcard addresses |

### 13. Automation

| Feature | Details |
|---------|---------|
| CI/CD Pipelines | Built-in or GitHub Actions/GitLab CI |
| Webhooks | Inbound + outbound event subscriptions |
| Scheduled Jobs | Cron with UI + monitoring + retry logic |
| IaC Templates | Terraform / Pulumi export, reusable blueprints |
| CLI Tool | `novapanel` CLI for all operations |

### 14. Billing & Reseller (Multi-tenant)

| Feature | Details |
|---------|---------|
| Plans | Resource-based pricing (CPU, RAM, storage, bandwidth) |
| Usage Tracking | Per-site/per-organization metering |
| Invoicing | Stripe/PayPal integration, tax (TaxJar) |
| Reseller | White-label, custom domains, sub-accounts |
| Quotas | Hard + soft limits, auto-suspend |

### 15. Marketplace & Plugins

| Feature | Details |
|---------|---------|
| App Store | 1-click installs (WordPress, Nextcloud, Ghost, etc.) |
| Plugins | Third-party extensions with sandboxed permissions |
| Themes | Custom panel branding per organization |
| Templates | Reusable site/app configurations |

### 16. AI Features

| Feature | Details |
|---------|---------|
| Log Analysis | Natural language log queries, anomaly detection |
| Security Advisor | AI-powered security recommendations |
| Auto-Scaling | ML-based predictive scaling |
| Code Assistant | AI help for nginx configs, DNS records, SQL |
| Chat Support | AI support bot trained on docs |

---

## Technical Architecture

### Database Schema Design

```
organizations
├── projects
│   ├── sites
│   │   ├── deployments
│   │   ├── domains
│   │   ├── environment_variables
│   │   └── health_checks
│   ├── databases
│   ├── containers
│   └── backups
├── members (RBAC)
├── audit_logs
└── billing
```

### API Design

```
/api/v1/
├── /auth
├── /organizations
├── /projects
├── /sites
├── /domains
├── /databases
├── /containers
├── /networks
├── /storage
├── /backups
├── /monitoring
├── /billing
├── /marketplace
├── /webhooks
└── /settings
```

All endpoints return `{ success, data, error, meta }`

### Real-time Architecture

- **WebSocket hub** for live updates (deployments, logs, metrics)
- **SSE streams** for long-running operations (builds, backups)
- **Pub/Sub** (Redis/NATS) for event distribution across nodes

### Job Queue

- **BullMQ** or **temporal.io** for durable job execution
- Every mutation creates a job for the reconciler
- Jobs are idempotent, retryable, with exponential backoff

### Multi-node Support

```
Control Plane (API + UI)
    ↓
Agent (per-server daemon)
    ↓
Docker / systemd / nginx
```

- Agents register with control plane via mTLS
- Control plane pushes configs, agents report status
- Supports hybrid cloud (on-prem + VPS + cloud VMs)

---

## Implementation Phases

| Phase | Features |
|-------|----------|
| **v5.0** | Core: Sites, Domains, SSL, Databases, Files, Terminal |
| **v5.1** | Containers, GitOps, Preview Envs, CI/CD |
| **v5.2** | Multi-tenant, RBAC, Billing, Reseller |
| **v5.3** | Monitoring stack, Alerting, Log analysis |
| **v5.4** | Marketplace, Plugins, Templates |
| **v5.5** | AI features, Advanced security, Multi-node |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| API | Fastify / Hono (Edge-compatible) |
| DB | SQLite (single-node) / PostgreSQL (multi-node) |
| ORM | Drizzle ORM |
| Cache | Redis / Valkey |
| Queue | BullMQ / Temporal |
| Search | Meilisearch |
| Web | React + Vite + TanStack |
| UI | shadcn/ui + Tailwind |
| Terminal | xterm.js + WebSocket |
| Charts | Apache ECharts |
| Metrics | Prometheus + Grafana |
| Logs | Loki + Vector |
| Traces | OpenTelemetry + Jaeger |
| Registry | Distribution (Docker) |
| Object Storage | MinIO |

---

## Differentiators

1. **GitOps Native** — Every site is a Git repo by default
2. **Preview Environments** — Like Vercel, but for any stack
3. **AI-Powered** — Natural language for logs, configs, security
4. **True Multi-tenant** — Not just multi-user, full org isolation
5. **Edge-Ready** — CDN + edge functions built-in
6. **Open Core** — Core open source, enterprise features commercial