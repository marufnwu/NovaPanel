# NovaPanel: Current vs v5 Vision — Gap Analysis

## Summary

| Dimension | Current (v4) | v5 Vision | Gap |
|-----------|-------------|-----------|-----|
| **Tenancy** | Single admin | Multi-org, multi-project | Large |
| **Runtime** | PM2 + nginx | Docker + K8s + serverless | Large |
| **GitOps** | None | Native Git integration, preview envs | Large |
| **Scaling** | Single server | Multi-node, auto-scaling | Large |
| **Observability** | Basic stats | Full metrics/logs/traces | Medium |
| **Billing** | None | Full metering + invoicing | Large |
| **AI** | None | Log analysis, security advisor | Large |
| **Marketplace** | Basic installer | Plugin ecosystem | Medium |
| **Multi-tenant DB** | None | Per-tenant isolation | Large |
| **Edge/CDN** | None | Built-in edge functions | Large |
| **API Versioning** | v1 only | Versioned, rate-limited gateway | Medium |
| **Object Storage** | None | S3-compatible (MinIO) | Medium |
| **Service Mesh** | None | mTLS between services | Large |
| **CI/CD** | None | Built-in pipelines | Large |
| **SSO** | None | OAuth2/OIDC/SAML | Medium |
| **WebAuthn** | None | FIDO2 support | Medium |
| **VPC** | None | Private networking | Large |
| **WAF** | None | Full Web Application Firewall | Medium |
| **Compliance** | None | SOC2/GDPR helpers | Large |
| **Multi-node** | Single node | Control plane + agents | Large |

---

## Detailed Gap Analysis

### 1. Identity & Access

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Multi-tenant | Single admin user | Organizations → Projects → Resources | Missing entire hierarchy |
| RBAC | Basic role field | Granular permissions (`domains:read`, `sites:write`) | No permission system |
| SSO | None | OAuth2/OIDC/SAML | Missing |
| MFA | TOTP only | TOTP + WebAuthn/FIDO2 | Missing WebAuthn |
| API Keys | Basic tokens | Scoped tokens with permissions + rate limits | Missing scopes |
| Service Accounts | None | Headless CI/CD auth | Missing |
| Audit Log | Basic activity log | Immutable, tamper-evident stream | Missing integrity |

**Files affected:**
- `apps/api/src/db/schema/users.ts` — needs org/project hierarchy
- `apps/api/src/modules/auth/` — needs SSO providers
- `apps/api/src/modules/audit/` — needs immutability guarantees

---

### 2. Site Management

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Runtime | PM2 (node/python) + php-fpm | Docker + native + static + serverless | No Docker support |
| Source | Manual upload / CLI | Git webhooks + registry push | No Git integration |
| Build Pipeline | None | Dockerfile/buildpack detection | Missing |
| Preview Envs | None | Per-PR staging URLs | Missing |
| Rollbacks | Manual | One-click rollback | Missing |
| Env Vars | None | Encrypted, versioned, per-env | Missing |
| Health Checks | Basic | HTTP + custom script + auto-restart | Missing custom checks |
| Auto-scaling | None | Horizontal + vertical | Missing |
| Deployments | None tracked | Full deployment history | Missing |

**Files affected:**
- `apps/api/src/modules/sites/` — needs deployment tracking
- `apps/api/src/db/schema/sites.ts` — needs runtime type field
- `apps/web/src/pages/sites/` — needs deployment UI

---

### 3. Domain & DNS

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| DNS Hosting | BIND9 zones | Full DNS with API + webhooks | API exists, webhooks missing |
| DNSSEC | None | One-click signing | Missing |
| Wildcard | Basic | `*.example.com` support | Needs testing |
| GeoDNS | None | Route by location/latency | Missing |
| Load Balancing | None | Round-robin, weighted, failover | Missing |

**Files affected:**
- `apps/api/src/modules/dns/` — needs GeoDNS, load balancing
- `apps/api/src/modules/domains/` — needs wildcard SSL logic

---

### 4. SSL/TLS

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Auto SSL | Let's Encrypt (HTTP-01) | Let's Encrypt + Google + ZeroSSL | Limited providers |
| Wildcard | None | DNS-01 wildcard | Missing |
| Custom Certs | Upload only | Upload + auto-renewal reminders | Missing reminders |
| mTLS | None | Client certificate auth | Missing |
| SSL Report | Basic | Grade + remediation | Missing analysis |

**Files affected:**
- `apps/api/src/modules/ssl/` — needs wildcard, mTLS
- `apps/web/src/pages/ssl/` — needs report UI

---

### 5. Databases

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Types | MariaDB, PostgreSQL | + MongoDB, Redis, SQLite | Missing MongoDB, Redis UI |
| Read Replicas | None | PostgreSQL read replicas | Missing |
| PITR | None | Point-in-time recovery | Missing |
| Connection Pooling | None | PgBouncer, ProxySQL | Missing |
| Query Insights | None | Performance dashboard | Missing |
| Branching | None | Copy for staging | Missing |

**Files affected:**
- `apps/api/src/modules/databases/` — needs Redis, MongoDB support
- `apps/web/src/pages/databases/` — needs query analyzer

---

### 6. File Storage

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Object Storage | None | S3-compatible (MinIO) | Missing entirely |
| Volumes | None | Block storage attach/detach | Missing |
| CDN Integration | None | Static asset caching | Missing |

**Files affected:**
- New module: `apps/api/src/modules/storage/`
- New page: `apps/web/src/pages/storage/`

---

### 7. Containers & Orchestration

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Docker Compose | None | Native support, UI editor | Missing |
| Kubernetes | None | K3s/K8s, Helm charts | Missing |
| Registry | None | Private container registry | Missing |
| Service Mesh | None | mTLS, traffic splitting | Missing |
| Serverless | None | Functions-as-a-Service | Missing |

**Files affected:**
- New module: `apps/api/src/modules/containers/`
- New page: `apps/web/src/pages/containers/`

---

### 8. Networking

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| VPC | None | Private networks | Missing |
| VPN | None | WireGuard, OpenVPN | Missing |
| Load Balancer | Basic nginx | HAProxy layer 4/7 | Missing |
| DDoS Protection | Basic rate limit | Challenge pages, filtering | Missing |

**Files affected:**
- New module: `apps/api/src/modules/networking/`

---

### 9. Monitoring & Observability

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Metrics | Basic stats | Prometheus + Grafana | Missing time-series DB |
| Logs | None collected | Loki + structured logging | Missing log aggregation |
| Traces | None | OpenTelemetry + Jaeger | Missing |
| Alerting | None | PagerDuty, Slack, webhook | Missing |
| Uptime Checks | None | Multi-region HTTP/ICMP | Missing |
| AI Analysis | None | Anomaly detection | Missing |

**Files affected:**
- `apps/api/src/modules/stats/` — needs Prometheus export
- New module: `apps/api/src/modules/monitoring/`

---

### 10. Backups & DR

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Incremental | None | Block-level dedup | Missing |
| Offsite | Local only | S3, B2, Wasabi | Missing |
| Cross-region | None | Failover runbooks | Missing |
| Immutable | None | WORM storage | Missing |

**Files affected:**
- `apps/api/src/modules/backup/` — needs cloud storage backends

---

### 11. Security

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| WAF | None | ModSecurity + custom rules | Missing |
| Bot Protection | None | JS challenge, bot scoring | Missing |
| Vulnerability Scan | None | Dependency audit, CVE | Missing |
| Secrets Manager | None | HashiCorp Vault | Missing |
| Compliance | None | SOC2, GDPR helpers | Missing |

**Files affected:**
- New module: `apps/api/src/modules/security/`

---

### 12. Email

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Webmail | None | Roundcube / SnappyMail | Missing |
| Mailing Lists | None | Mailman / Sympa | Missing |
| SMTP Relay | None | SES, Mailgun, SendGrid | Missing |
| DKIM/DMARC/SPF | Manual | Automated + monitoring | Partial |
| Catch-all | None | Wildcard addresses | Missing |

**Files affected:**
- `apps/api/src/modules/mail/` — needs webmail integration
- `apps/web/src/pages/mail/` — needs webmail iframe/link

---

### 13. Automation

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| CI/CD | None | Built-in or GitHub/GitLab | Missing |
| Webhooks | None | Inbound + outbound events | Missing |
| IaC Templates | None | Terraform/Pulumi export | Missing |
| CLI Tool | None | `novapanel` CLI | Missing |

**Files affected:**
- New module: `apps/api/src/modules/webhooks/`
- New package: `packages/cli/`

---

### 14. Billing & Reseller

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Plans | None | Resource-based pricing | Missing entirely |
| Usage Tracking | None | Per-site metering | Missing |
| Invoicing | None | Stripe/PayPal + tax | Missing |
| Reseller | None | White-label, sub-accounts | Missing |
| Quotas | None | Hard + soft limits | Missing |

**Files affected:**
- New module: `apps/api/src/modules/billing/`
- New page: `apps/web/src/pages/billing/`

---

### 15. Marketplace & Plugins

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| App Store | Basic installer | 1-click + categories | Partial |
| Plugins | None | Sandboxed extensions | Missing |
| Themes | None | Custom branding per org | Missing |
| Templates | None | Reusable configurations | Missing |

**Files affected:**
- `apps/api/src/modules/installer/` — needs plugin API
- `apps/web/src/pages/installer/` — needs marketplace UI

---

### 16. AI Features

| Feature | Current | v5 | Gap |
|---------|---------|-----|-----|
| Log Analysis | None | Natural language queries | Missing |
| Security Advisor | None | AI recommendations | Missing |
| Auto-scaling | None | ML-based predictive | Missing |
| Code Assistant | None | Config help (nginx, DNS) | Missing |
| Chat Support | None | AI bot | Missing |

**Files affected:**
- New module: `apps/api/src/modules/ai/`
- New components: Chat widget, AI suggestion panels

---

## Technical Architecture Gaps

### Database

| Current | v5 | Gap |
|---------|-----|-----|
| SQLite (single file) | PostgreSQL (multi-node) | No migration path yet |
| No read replicas | Read replicas | Missing |
| No connection pooling | PgBouncer/ProxySQL | Missing |
| Simple schema | Multi-tenant schema (org/project) | Needs redesign |

### API

| Current | v5 | Gap |
|---------|-----|-----|
| v1 only | Versioned API | Missing versioning |
| No gateway | API Gateway (rate limit, cache) | Missing |
| No rate limiting per key | Granular rate limits | Partial |
| Basic WebSocket | Full WebSocket hub + SSE | Partial |

### Frontend

| Current | v5 | Gap |
|---------|-----|-----|
| SPA only | SPA + Mobile app | Missing mobile |
| No real-time | Live updates everywhere | Partial |
| Basic charts | Full Grafana integration | Missing |
| No PWA | PWA with offline support | Missing |

### Infrastructure

| Current | v5 | Gap |
|---------|-----|-----|
| Single node | Control plane + agents | Missing multi-node |
| systemd service | Kubernetes-native | Missing |
| No service mesh | mTLS between services | Missing |
| Basic reconciler | Event-driven reconciler | Partial |

---

## Priority Matrix

### Must Have (Core Differentiators)

1. **GitOps + Preview Environments** — Most impactful for modern dev workflow
2. **Docker + Container Orchestration** — Industry standard
3. **Multi-tenant Architecture** — Required for SaaS/hosting business
4. **Full Observability Stack** — Required for production reliability
5. **API Gateway + Versioning** — Required for platform maturity

### Should Have (Competitive Parity)

6. **Object Storage (MinIO)** — Standard for modern apps
7. **Advanced DNS (GeoDNS, Load Balancing)** — Cloudflare parity
8. **WAF + Bot Protection** — Security baseline
9. **CI/CD Pipelines** — GitHub Actions alternative
10. **Terraform/Pulumi Export** — IaC compliance

### Nice to Have (Future)

11. **AI Features** — Differentiator but complex
12. **Mobile App** — Convenience, not core
13. **Serverless Functions** — Advanced use case
14. **Service Mesh** — Enterprise feature
15. **Compliance (SOC2)** — Enterprise requirement

---

## Migration Strategy

### Phase 1: Foundation (v4.5)

- Add `organizations` and `projects` tables
- Refactor auth for RBAC
- Introduce API versioning (`/api/v2/`)
- Add basic Docker support

### Phase 2: GitOps (v4.6)

- Git integration for sites
- Preview environment generation
- Deployment history tracking
- Environment variable encryption

### Phase 3: Containers (v4.7)

- Docker Compose support
- Container registry integration
- Service-to-service networking
- Health checks + auto-restart

### Phase 4: Observability (v4.8)

- Prometheus metrics export
- Loki log aggregation
- Basic alerting (email/webhook)
- Uptime monitoring

### Phase 5: Platform (v5.0)

- Multi-tenant billing
- Plugin marketplace
- Advanced security (WAF, bot protection)
- Multi-node support (agents)

---

## Files Requiring Changes

### High Impact

| File | Change |
|------|--------|
| `apps/api/src/db/schema/*.ts` | Add org/project hierarchy |
| `apps/api/src/modules/auth/*.ts` | Add SSO, RBAC, WebAuthn |
| `apps/api/src/routes.ts` | Add API versioning |
| `apps/api/src/server.ts` | Add API gateway middleware |
| `apps/web/src/router.tsx` | Add new routes |
| `apps/web/src/components/layout/Sidebar.tsx` | Add new nav groups |

### New Modules Needed

| Module | Purpose |
|--------|---------|
| `apps/api/src/modules/containers/` | Docker/K8s management |
| `apps/api/src/modules/storage/` | Object storage |
| `apps/api/src/modules/networking/` | VPC, VPN, LB |
| `apps/api/src/modules/monitoring/` | Metrics, logs, alerts |
| `apps/api/src/modules/billing/` | Usage, invoicing |
| `apps/api/src/modules/security/` | WAF, bot protection |
| `apps/api/src/modules/webhooks/` | Event subscriptions |
| `apps/api/src/modules/ai/` | AI-powered features |

### New Frontend Pages Needed

| Page | Route |
|------|-------|
| Containers | `/containers` |
| Storage | `/storage` |
| Networking | `/networks` |
| Monitoring | `/monitoring` (expanded) |
| Billing | `/billing` |
| Security | `/security` |
| Webhooks | `/webhooks` |
| AI Assistant | `/ai` |
