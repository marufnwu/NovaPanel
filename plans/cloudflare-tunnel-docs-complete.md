# Cloudflare Tunnel Documentation - Complete Reference

## Official Documentation Path
`/cloudflare-one/networks/connectors/cloudflare-tunnel/`

---

## Documentation Structure (Complete File Tree)

```
cloudflare-tunnel/
├── index.mdx                              # Main concept page (Overview)
├── get-started/
│   ├── index.mdx                          # Get started hub
│   ├── create-remote-tunnel.mdx          # Create via dashboard
│   ├── create-remote-tunnel-api.mdx      # Create via API
│   └── tunnel-useful-terms.mdx           # Terminology reference
├── configure-tunnels/
│   ├── index.mdx
│   ├── run-parameters.mdx                # CLI flags/run parameters
│   ├── origin-parameters.mdx             # Origin connection settings
│   ├── cipher-suites.mdx
│   ├── remote-tunnel-permissions.mdx
│   ├── tunnel-with-firewall.mdx
│   └── tunnel-availability/
│       ├── index.mdx
│       ├── system-requirements.mdx
│       └── deploy-replicas.mdx
├── do-more-with-tunnels/
│   ├── index.mdx
│   ├── trycloudflare.mdx                 # Quick/test tunnels
│   └── local-management/
│       ├── index.mdx
│       ├── configuration-file.mdx         # config.yml reference
│       ├── create-local-tunnel.mdx      # Create locally-managed tunnel
│       ├── local-tunnel-terms.mdx
│       ├── tunnel-permissions.mdx
│       ├── tunnel-useful-commands.mdx    # CLI commands reference
│       └── as-a-service/
│           ├── index.mdx
│           ├── linux.mdx
│           ├── macos.mdx
│           └── windows.mdx
├── downloads/
│   ├── index.mdx                         # Downloads page
│   ├── copyrights.mdx
│   ├── license.mdx
│   └── update-cloudflared.mdx
├── monitor-tunnels/
│   ├── index.mdx
│   ├── logs.mdx                          # Log streams
│   ├── metrics.mdx
│   └── notifications.mdx
├── private-net/
│   ├── index.mdx
│   └── cloudflared/
│       ├── index.mdx                     # Connect with cloudflared
│       ├── connect-cidr.mdx              # IP/CIDR routing
│       ├── connect-private-hostname.mdx
│       ├── private-dns.mdx
│       └── tunnel-virtual-networks.mdx
├── routing-to-tunnel/
│   ├── index.mdx
│   ├── dns.mdx
│   ├── protocols.mdx                     # HTTP/GRPC/Websocket
│   └── public-load-balancers.mdx
├── troubleshoot-tunnels/
│   ├── index.mdx                        # Troubleshoot hub
│   ├── common-errors.mdx                # Common errors reference
│   ├── connectivity-prechecks.mdx
│   ├── diag-logs.mdx                    # Diagnostic logs
│   └── private-networks.mdx
├── use-cases/
│   ├── index.mdx
│   ├── grpc.mdx
│   ├── smb.mdx
│   ├── vnc-browser-rendering.mdx
│   ├── rdp/
│   │   ├── index.mdx
│   │   ├── rdp-browser.mdx
│   │   ├── rdp-cloudflared-authentication.mdx
│   │   └── rdp-device-client.mdx
│   └── ssh/
│       ├── index.mdx
│       ├── ssh-browser-rendering.mdx
│       ├── ssh-cloudflared-authentication.mdx
│       ├── ssh-device-client.mdx
│       └── ssh-infrastructure-access.mdx
└── deployment-guides/
    ├── index.mdx
    ├── ansible.mdx
    ├── aws.mdx
    ├── azure.mdx
    ├── google-cloud-platform.mdx
    ├── kubernetes.mdx
    └── terraform.mdx
```

---

## Core Concepts

### What is Cloudflare Tunnel?

Cloudflare Tunnel provides a secure way to connect your resources to Cloudflare without a publicly routable IP address. With Tunnel, you do not send traffic to an external IP — instead, a lightweight daemon in your infrastructure (`cloudflared`) creates **outbound-only connections** to Cloudflare's global network.

**Key capabilities:**
- HTTP web servers
- SSH servers
- Remote desktops (RDP)
- Other protocols safely to Cloudflare

### Architecture

```
User → Cloudflare Edge → cloudflared (outbound only) → Internal Service
```

**Key point:** `cloudflared` initiates outbound connections through your firewall. Once established, traffic flows bidirectionally over the tunnel.

---

## Key Terminology

| Term | Definition |
|------|------------|
| **Tunnel** | Persistent object (UUID) linking origin to Cloudflare |
| **Tunnel UUID** | Alphanumeric unique ID for a tunnel |
| **Tunnel Name** | User-friendly identifier (not necessarily hostname) |
| **Connector** | `cloudflared` process - creates 4 connections to 2+ Cloudflare DCs |
| **Replica** | Additional `cloudflared` instance running same tunnel on different host |
| **Remotely-managed tunnel** | Created in dashboard, config stored in Cloudflare |
| **Locally-managed tunnel** | Created via CLI (`cloudflared tunnel create`), config stored locally |
| **Quick Tunnel** | Temporary tunnel via `cloudflared tunnel --url` for testing |
| **Virtual Network** | Software abstraction to segregate private network resources |

---

## Getting Started

### Prerequisites

1. Cloudflare account
2. Website added to Cloudflare (for published apps)
3. For private networks: Zero Trust organization

### 1. Install cloudflared

**Linux/macOS:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

**Windows:** Download from dashboard or downloads page

### 2. Authenticate

```bash
cloudflared tunnel login
```

### 3. Create Tunnel (Dashboard)

1. Go to **Zero Trust** → **Networks** → **Connectors** → **Cloudflare Tunnels**
2. Select **Create a tunnel**
3. Choose **Cloudflared** as the connector
4. Name tunnel → Save
5. Install connector on server
6. Configure routes (published app or private network)

### 4. Create Tunnel (API)

```bash
# Create API token with permissions:
# Account > Cloudflare Tunnel: Edit
# Zone > DNS: Edit

# Create tunnel
POST /accounts/{account_id}/cfd_tunnel
{
  "name": "my-tunnel",
  "config_src": "cloudflare"
}

# Response includes:
# - id (tunnel UUID)
# - token (for running tunnel)
```

### 5. Configure and Run

**Remotely-managed (token):**
```bash
cloudflared service install <TOKEN>
```

**Locally-managed (config.yml):**
```yaml
tunnel: <UUID>
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: app.example.com
    service: https://localhost:8443
  - service: http://localhost:80
```

```bash
cloudflared tunnel run my-tunnel
```

---

## Tunnel Configuration

### config.yml Structure

```yaml
# Basic structure
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: app.example.com
    service: https://localhost:8080
    originRequest:
      originServerName: internal.example.com
      caPool: /etc/ssl/certs/ca.pem
      noTLSVerify: false
  - hostname: ssh.example.com
    service: ssh://localhost:22
  - service: http_status:404

# Optional settings
protocol: auto  # h2mux, http2, http3/auto
loglevel: info  # debug, info, warn, error
metrics: 127.0.0.1:9090
grace-period: 30s
transport-loglevel: info
```

### Run Parameters (CLI Flags)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--protocol` | Tunnel protocol (h2mux, http2, http3, auto) | `--protocol auto` |
| `--loglevel` | Log verbosity | `--loglevel debug` |
| `--grace-period` | Wait before force close | `--grace-period 30s` |
| `--metrics` | Metrics server address | `--metrics 127.0.0.1:9090` |
| `--ingress` | Ingress rules | See config.yml |
| `--transport-loglevel` | Connection logs | `--transport-loglevel info` |
| `--logfile` | Log file path | `--logfile /var/log/cloudflared.log` |
| `--pidfile` | PID file path | `--pidfile /var/run/cloudflared.pid` |

### Origin Parameters

| Parameter | Description |
|-----------|-------------|
| `originUrl` | URL to origin service |
| `hostname` | TLS hostname verification |
| `caPool` | Custom CA certificate |
| `noTLSVerify` | Disable TLS verification |
| `tlsClientCert` | Client certificate for mTLS |
| `tlsClientKey` | Client key for mTLS |

### Protocol Options

| Protocol | Use Case | Notes |
|----------|----------|-------|
| `h2mux` | Legacy default | HTTP/2 multiplexing |
| `http2` | Modern, recommended | HTTP/2 without multiplexing |
| `http3` / `auto` | Best performance | QUIC-based, lower latency |
| `faq` | HTTP/3 fallback | HTTP/3 with fallback |

---

## Tunnel Management Commands

### Core Commands

```bash
# Create tunnel (locally-managed)
cloudflared tunnel create <NAME>

# List tunnels
cloudflared tunnel list

# Run tunnel
cloudflared tunnel run <NAME or UUID>

# Delete tunnel
cloudflared tunnel delete <NAME or UUID>

# Inspect tunnel
cloudflared tunnel inspect <NAME or UUID>

# Validate config
cloudflared tunnel ingress validate

# Quick test tunnel
cloudflared tunnel --url localhost:8080

# Update tunnel config (for locally-managed)
cloudflared tunnel update <NAME or UUID>
```

### Service Installation

```bash
# Linux (systemd)
cloudflared service install

# Linux (sysvinit)
cloudflared service install sysvinit

# macOS (launchd)
cloudflared service install launchd

# Windows
cloudflared service install
```

### Private Network Commands

```bash
# Add IP/CIDR route
cloudflared tunnel route ip add <IP/CIDR> <TUNNEL_NAME>

# List routes
cloudflared tunnel route ip show

# Delete route
cloudflared tunnel route ip delete <IP/CIDR>

# Check route for IP
cloudflared tunnel route ip get <IP>

# Manage virtual networks
cloudflared tunnel vnet add <NAME>
cloudflared tunnel vnet delete <NAME>
cloudflared tunnel vnet list
```

---

## Tunnel Availability

### High Availability

- **Replicas:** Multiple `cloudflared` instances for same tunnel
- **Health Checks:** Built-in connectivity monitoring
- **Automatic Failover:** Cloudflare routes to healthy connectors
- **Geographic Distribution:** Connectors send to nearest Cloudflare DC

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| Memory | 512MB | 2GB+ |
| Disk | Minimal | SSD for logs |
| Network | Outbound HTTPS/QUIC | Stable high-speed connection |

### Connection Details

- Each `cloudflared` creates **4 connections** to **2+ distinct data centers**
- Built-in redundancy if connection/server/DC goes down

---

## Monitoring & Logging

### Log Streams

**On the server:**
```bash
# View logs
journalctl -u cloudflared -f

# With specific log level
cloudflared tunnel run <TUNNEL> --loglevel debug
```

**Remote streaming (CLI):**
```bash
# Stream logs
cloudflared tail <UUID>

# Filter logs
cloudflared tail <UUID> --filter "GET /api"

# Stream specific replica
cloudflared tail --connector-id <CONNECTOR_ID> <UUID>
```

**Dashboard:**
- Go to **Networks** > **Connectors** > **Cloudflare Tunnels** > select tunnel
- View real-time logs

**Performance note:**
- Logging session held open for 1 hour max
- High throughput tunnels may drop logs
- Server-side logging more reliable than streaming

### Metrics

Enable metrics:
```yaml
metrics: 127.0.0.1:9090
```

Available metrics:
- Tunnel connection status
- Requests proxied
- Bytes transferred
- Latency histograms
- Error counts

### Diagnostic Logs

```bash
# Generate diagnostic bundle
cloudflared tunnel diag <TUNNEL_NAME>

# Output: cloudflared-diag-YYYY-MM-DDThh-mm-ss.zip
```

---

## Troubleshooting

### Tunnel Status

| Status | Meaning |
|--------|---------|
| `Healthy` | Connected and working |
| `Degraded` | Some connections failing |
| `Down` | No connections |
| `Inactive` | Tunnel created but not running |
| `Unknown` | Cannot determine status |

**Note:** Tunnel status reflects `cloudflared` to Cloudflare connection. Does NOT indicate if `cloudflared` can reach internal services.

### Common Errors

1. **`websocket: bad handshake`**
   - Cause: Super Bot Fight Mode blocking tunnel
   - Solution: Allow tunnel in Bot settings

2. **`connection refused`**
   - Cause: Origin not reachable
   - Solution: Check firewall, service status

3. **`authentication failed`**
   - Cause: Token expired/invalid
   - Solution: Re-authenticate with `cloudflared login`

4. **`dns_error`**
   - Cause: DNS resolution failed
   - Solution: Check DNS config, update cloudflared

5. **`Error: This route's network is inside an existing subnet's network at "100.96.0.0/12"`**
   - Cause: CIDR overlaps with WARP CGNAT IP range
   - Solution: Use different IP/CIDR not overlapping `100.96.0.0/12`

6. **`This site can't provide a secure connection`**
   - Cause: Multi-level subdomain without Advanced Certificate
   - Solution: Order Advanced Certificate for hostname

### Debug Steps

1. Enable debug logging:
   ```bash
   cloudflared tunnel run <TUNNEL> --loglevel debug
   ```

2. Collect diagnostic logs:
   ```bash
   cloudflared tunnel diag <TUNNEL>
   ```

3. Check [Tunnel logs](/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/logs/)

4. Verify connectivity:
   - Can `cloudflared` reach Cloudflare?
   - Can `cloudflared` reach origin service?

### Disconnect Issues

- Long-lived connections (SSH, WebSocket) can last 8 hours
- More frequent disconnects may be caused by:
  - Scheduled maintenance (DC, server, service updates)
  - Network devices timing out UDP idle sessions

**Solutions:**
- Configure application keepalives (e.g., `ServerAliveInterval` for SSH)
- Test with `protocol: http2`
- Review firewalls/NAT for short UDP idle timers

---

## Private Networking

### Connect Private Networks

**Via Dashboard:**
1. Go to tunnel → **CIDR** tab
2. Enter private IP or CIDR range (e.g., `10.0.0.1` or `10.0.0.0/24`)
3. Select **Complete setup**

**Via API:**
```bash
POST /accounts/{account_id}/teamnet/routes
{
  "network": "172.16.0.0/16",
  "tunnel_id": "<TUNNEL_UUID>",
  "comment": "Private network"
}
```

**Via CLI:**
```bash
cloudflared tunnel route ip add 172.16.0.0/16 my-tunnel
```

### Private Hostnames

For hostname-based routing to internal services:
- [Connect a private hostname](/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/connect-private-hostname/)

### Virtual Networks

- Group tunnels for easier routing
- Assign virtual network IDs to routes
- Support for overlapping IP ranges
- Users select virtual network in Cloudflare One Client

### Private DNS

```bash
# Configure DNS resolution through tunnel
cloudflared tunnel vpc add-dns --tunnel-id <ID> --resolver <IP>
```

---

## Use Cases

### SSH Access

| Method | Setup Time | Best For |
|--------|-----------|----------|
| [SSH Cloudflared Auth](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-cloudflared-authentication/) | 15-30 min | Seamless SSH with identity auth, no WARP client needed |
| [SSH Infrastructure Access](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-infrastructure-access/) | 45-60 min | SSH certificates, short-lived creds, command logging |
| [SSH Device Client](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-device-client/) | 30-45 min | Traditional SSH keys, network-level policy |
| [SSH Browser Rendering](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-browser-rendering/) | 20-30 min | Browser-based SSH, no client needed |

### RDP Access

| Method | Description |
|--------|-------------|
| [RDP Browser](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/rdp/rdp-browser/) | Browser-rendered RDP |
| [RDP Cloudflared Auth](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/rdp/rdp-cloudflared-authentication/) | Client-side authentication |
| [RDP Device Client](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/rdp/rdp-device-client/) | WARP client + tunnel |

### Other Protocols

- [SMB](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/smb/) - File sharing
- [gRPC](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/grpc/) - High-performance RPC
- [VNC](/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/vnc-browser-rendering/) - Browser-rendered remote desktop

---

## Deployment Guides

| Platform | Guide Path |
|----------|----------|
| AWS | `/deployment-guides/aws/` |
| Azure | `/deployment-guides/azure/` |
| Google Cloud | `/deployment-guides/google-cloud-platform/` |
| Kubernetes | `/deployment-guides/kubernetes/` |
| Terraform | `/deployment-guides/terraform/` |
| Ansible | `/deployment-guides/ansible/` |

---

## API Reference

### Endpoints

| Operation | Endpoint |
|-----------|----------|
| List tunnels | `GET /accounts/{account_id}/cfd_tunnel` |
| Create tunnel | `POST /accounts/{account_id}/cfd_tunnel` |
| Get tunnel | `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}` |
| Update tunnel | `PATCH /accounts/{account_id}/cfd_tunnel/{tunnel_id}` |
| Delete tunnel | `DELETE /accounts/{account_id}/cfd_tunnel/{tunnel_id}` |
| Get token | `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/token` |
| Update config | `PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` |
| Create route | `POST /accounts/{account_id}/teamnet/routes` |
| List routes | `GET /accounts/{account_id}/teamnet/routes` |

### Token-based Authentication

Use tunnel tokens instead of API keys for remote-managed tunnels:

```bash
cloudflared service install <TOKEN>
```

---

## Update & Maintenance

### Update cloudflared

```bash
# Manual update
cloudflared update

# Verify version
cloudflared --version
```

### Service Commands

```bash
# Start service
systemctl start cloudflared

# Stop service
systemctl stop cloudflared

# Restart service
systemctl restart cloudflared

# View status
systemctl status cloudflared
```

---

## Quick Reference Card

```bash
# ═══════════════════════════════════════════════════════════
# CLOUDFLARE TUNNEL - QUICK REFERENCE
# ═══════════════════════════════════════════════════════════

# INSTALL
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# AUTHENTICATE
cloudflared tunnel login

# CREATE TUNNEL (locally-managed)
cloudflared tunnel create my-tunnel
cloudflared tunnel run my-tunnel

# CREATE TUNNEL (remotely-managed via dashboard)
# Go to: Zero Trust > Networks > Connectors > Cloudflare Tunnels

# QUICK TEST
cloudflared tunnel --url localhost:8080

# VALIDATE CONFIG
cloudflared tunnel ingress validate

# LIST TUNNELS
cloudflared tunnel list

# RUN WITH DEBUG
cloudflared tunnel run my-tunnel --loglevel debug

# VIEW LOGS
journalctl -u cloudflared -f

# STREAM REMOTE LOGS
cloudflared tail <UUID>

# GET DIAGNOSTICS
cloudflared tunnel diag my-tunnel

# UPDATE
cloudflared update

# SERVICE (systemd)
cloudflared service install
systemctl start cloudflared

# PRIVATE NETWORK ROUTING
cloudflared tunnel route ip add 10.0.0.0/24 my-tunnel

# CONFIG LOCATION (locally-managed)
~/.cloudflared/
~/.cloudflared/credentials.json  # Tunnel credentials
~/.cloudflared/config.yml         # Tunnel config

# PORTS NEEDED (outbound)
# 443 TCP  - HTTPS
# 7844 UDP - QUIC (if using http3/auto protocol)

# ═══════════════════════════════════════════════════════════
```

---

## Related Documentation

- [Cloudflare Tunnel FAQ](/cloudflare-one/faq/cloudflare-tunnels-faq/)
- [Cloudflare WAN](/cloudflare-wan/) - Tunnel integration with WAN
- [Workers VPC](/workers-vpc/configuration/tunnel/) - Tunnel for serverless
- [Cloudflare Mesh](/cloudflare-one/networks/connectors/cloudflare-mesh/) - Alternative connector
- [Zero Trust Getting Started](/cloudflare-one/setup/) - Complete setup guide
- [Reference Architecture - SASE](/reference-architecture/architectures/sase/)

---

## Partial Components Used in Docs

The documentation uses `<Render file="..." />` components for:
- `tunnel/create-tunnel`
- `tunnel/add-published-application`
- `tunnel/connectivity-prechecks-note`
- `tunnel/install-and-run-tunnel`
- `tunnel/tunnel-status`
- `tunnel/common-errors`
- `tunnel/origin-parameters`
- `tunnel/run-parameters`
- `tunnel/locally-managed/configuration-file`
- `tunnel/locally-managed/create-local-tunnel`
- `tunnel/locally-managed/useful-commands`
- `tunnel/locally-managed/as-a-service/overview`
- `tunnel/diagnostics/*`
- `tunnel/logs/*`
- `tunnel/downloads`
- And many more...

---

**Document Version:** Based on cloudflare-docs repository (production branch)
**Last Updated:** 2025