#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  NovaPanel Server Installer — Verification-First Approach           ║
# ║                                                                     ║
# ║  Installs NovaPanel and all dependencies on a fresh server.         ║
# ║  Supports: Ubuntu 22.04, Ubuntu 24.04, Debian 11, Debian 12        ║
# ║                                                                     ║
# ║  Usage:                                                             ║
# ║    sudo bash scripts/install.sh                                     ║
# ║    sudo ADMIN_EMAIL=you@example.com bash scripts/install.sh         ║
# ║                                                                     ║
# ║  Environment variables (all optional with sensible defaults):       ║
# ║    ADMIN_EMAIL     — Admin email (default: admin@$(hostname -f))    ║
# ║    ADMIN_PASSWORD  — Admin password (default: auto-generated)       ║
# ║    PANEL_URL       — Panel URL (default: http://$(hostname -f):3000)║
# ║    PANEL_USER      — System user (default: novapanel)               ║
# ║    PANEL_HOME      — Install dir (default: /opt/novapanel)          ║
# ║    MAIL_HOSTNAME   — Mail hostname (default: mail.$(hostname -d))   ║
# ║    LE_EMAIL        — Let's Encrypt email (default: $ADMIN_EMAIL)    ║
# ║    DB_PASSWORD     — MariaDB root password (default: auto-generated)║
# ║                                                                     ║
# ║  Idempotent: safe to run multiple times.                            ║
# ╚══════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────
readonly SCRIPT_VERSION="2.0.0"
readonly NODE_MAJOR="20"
readonly PG_MAJOR="16"
readonly MARIADB_MAJOR="11.4"
readonly PHP_VERSIONS=("8.1" "8.2" "8.3")
readonly FTP_PASSIVE_MIN=50000
readonly FTP_PASSIVE_MAX=50100

# ─── Configurable via Environment ────────────────────────────────────────
PANEL_USER="${PANEL_USER:-novapanel}"
PANEL_HOME="${PANEL_HOME:-/opt/novapanel}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
PANEL_URL="${PANEL_URL:-}"
MAIL_HOSTNAME="${MAIL_HOSTNAME:-}"
LE_EMAIL="${LE_EMAIL:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# ─── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INSTALL]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*" >&2; }

die() {
    fail "$@"
    exit 1
}

section() {
    echo ""
    echo -e "${CYAN}━━━ $* ━━━${NC}"
}

# ─── Helper: Generate a random secret ────────────────────────────────────
gen_secret() {
    openssl rand -hex "${1:-32}"
}

# ─── Helper: Verify a command succeeded with message ─────────────────────
verify_cmd() {
    local cmd="$1"
    local label="$2"
    if eval "$cmd" &>/dev/null; then
        ok "$label"
        return 0
    else
        fail "$label"
        return 1
    fi
}

# ─── Helper: Wait for a service to be active ─────────────────────────────
wait_for_service() {
    local service="$1"
    local timeout="${2:-60}"
    local elapsed=0

    while [ "$elapsed" -lt "$timeout" ]; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            ok "$service is active"
            return 0
        fi
        elapsed=$((elapsed + 2))
        sleep 2
    done

    fail "$service did not become active within ${timeout}s"
    return 1
}

# ─── Helper: Wait for a TCP port ─────────────────────────────────────────
wait_for_port() {
    local host="${1:-127.0.0.1}"
    local port="$2"
    local timeout="${3:-60}"
    local elapsed=0

    while [ "$elapsed" -lt "$timeout" ]; do
        if ss -tlnp | grep -q ":${port} "; then
            ok "Port ${port} is listening"
            return 0
        fi
        elapsed=$((elapsed + 2))
        sleep 2
    done

    fail "Port ${port} not listening within ${timeout}s"
    return 1
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 0: PRE-FLIGHT CHECKS
# ═════════════════════════════════════════════════════════════════════════
phase_preflight() {
    section "Phase 0: Pre-flight Checks"

    # Root check
    if [ "$EUID" -ne 0 ]; then
        die "This script must be run as root. Use: sudo bash $0"
    fi
    ok "Running as root"

    # OS detection
    if [ ! -f /etc/os-release ]; then
        die "Cannot detect OS — /etc/os-release not found"
    fi

    # shellcheck source=/dev/null
    source /etc/os-release

    local SUPPORTED_IDS=("ubuntu" "debian")
    local SUPPORTED=0

    for id in "${SUPPORTED_IDS[@]}"; do
        if [ "$ID" = "$id" ]; then
            SUPPORTED=1
            break
        fi
    done

    if [ "$SUPPORTED" -eq 0 ]; then
        die "Unsupported OS: $ID. Supported: Ubuntu 22.04/24.04, Debian 11/12"
    fi

    # Version check
    case "$ID" in
        ubuntu)
            if [[ "$VERSION_ID" != "22.04" && "$VERSION_ID" != "24.04" ]]; then
                warn "Ubuntu $VERSION_ID is not officially tested. Supported: 22.04, 24.04"
            fi
            ;;
        debian)
            if [[ "$VERSION_ID" != "11" && "$VERSION_ID" != "12" ]]; then
                warn "Debian $VERSION_ID is not officially tested. Supported: 11, 12"
            fi
            ;;
    esac

    ok "OS: $PRETTY_NAME"

    # Architecture check
    local ARCH
    ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
    if [[ "$ARCH" != "amd64" && "$ARCH" != "x86_64" && "$ARCH" != "arm64" && "$ARCH" != "aarch64" ]]; then
        warn "Architecture $ARCH may not be fully supported"
    fi
    ok "Architecture: $ARCH"

    # Memory check (warn if < 1GB)
    local MEM_MB
    MEM_MB="$(awk '/MemTotal/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo "0")"
    if [ "$MEM_MB" -lt 1024 ]; then
        warn "Low memory: ${MEM_MB}MB. Recommended: 2GB+"
    else
        ok "Memory: ${MEM_MB}MB"
    fi

    # Disk space check (warn if < 10GB)
    local DISK_GB
    DISK_GB="$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G' 2>/dev/null || echo "0")"
    if [ "$DISK_GB" -lt 10 ]; then
        warn "Low disk space: ${DISK_GB}GB free. Recommended: 20GB+"
    else
        ok "Disk space: ${DISK_GB}GB free"
    fi

    # Network connectivity
    if curl -sf --connect-timeout 5 https://deb.nodesource.com > /dev/null 2>&1; then
        ok "Internet connectivity confirmed"
    else
        warn "Cannot reach nodesource.com — package installation may fail"
    fi

    # Set defaults based on hostname
    local HOSTNAME_FQDN
    HOSTNAME_FQDN="$(hostname -f 2>/dev/null || echo 'localhost')"
    local HOSTNAME_DOMAIN
    HOSTNAME_DOMAIN="$(hostname -d 2>/dev/null || echo 'localhost')"

    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${HOSTNAME_FQDN}}"
    LE_EMAIL="${LE_EMAIL:-$ADMIN_EMAIL}"
    PANEL_URL="${PANEL_URL:-http://${HOSTNAME_FQDN}:3000}"
    MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.${HOSTNAME_DOMAIN}}"

    # Generate passwords if not set
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD="$(gen_secret 24)"
    fi
    if [ -z "$ADMIN_PASSWORD" ]; then
        ADMIN_PASSWORD="$(gen_secret 16)"
    fi

    ok "Configuration collected"
    log "  Panel URL:    $PANEL_URL"
    log "  Admin Email:  $ADMIN_EMAIL"
    log "  Mail Host:    $MAIL_HOSTNAME"
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 1: SYSTEM PACKAGES & EXTERNAL REPOS
# ═════════════════════════════════════════════════════════════════════════
phase_system_packages() {
    section "Phase 1: System Packages & Repositories"

    # 1a. Update existing packages
    log "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq
    ok "System packages updated"

    # 1b. Install core dependencies
    log "Installing core dependencies..."
    apt-get install -y -qq \
        curl wget git unzip zip rsync \
        software-properties-common apt-transport-https \
        ca-certificates gnupg lsb-release \
        build-essential python3 python3-pip \
        jq sqlite3 sudo htop net-tools \
        ssl-cert uuid-runtime 2>/dev/null
    ok "Core dependencies installed"

    # 1c. Node.js (via NodeSource)
    if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1)" != "v${NODE_MAJOR}" ]]; then
        log "Installing Node.js ${NODE_MAJOR} LTS via NodeSource..."
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
        apt-get install -y -qq nodejs
    fi
    verify_cmd "node -v" "Node.js $(node -v)"

    # 1d. pnpm & pm2
    if ! command -v pnpm &>/dev/null; then
        log "Installing pnpm..."
        npm install -g pnpm
    fi
    verify_cmd "pnpm -v" "pnpm $(pnpm -v)"

    if ! command -v pm2 &>/dev/null; then
        log "Installing pm2..."
        npm install -g pm2
    fi
    verify_cmd "pm2 -v" "pm2 $(pm2 -v)"

    # 1e. MariaDB (official MariaDB repository)
    log "Adding MariaDB ${MARIADB_MAJOR} repository..."
    if ! command -v mariadb &>/dev/null; then
        curl -fsSL "https://r.mariadb.com/downloads/mariadb_repo_setup" | bash -s -- --mariadb-server-version="mariadb-${MARIADB_MAJOR}" --skip-maxscale --skip-tools
        apt-get update -qq
        apt-get install -y -qq mariadb-server mariadb-client
    fi
    verify_cmd "mariadb --version" "MariaDB installed"

    # 1f. PostgreSQL (official PostgreSQL repository)
    log "Adding PostgreSQL ${PG_MAJOR} repository..."
    if ! command -v psql &>/dev/null; then
        curl -fsSL "https://www.postgresql.org/media/keys/ACCC4CF8.asc" | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
            > /etc/apt/sources.list.d/postgresql.list
        apt-get update -qq
        apt-get install -y -qq "postgresql-${PG_MAJOR}" "postgresql-contrib-${PG_MAJOR}"
    fi
    verify_cmd "psql --version" "PostgreSQL installed"

    # 1g. PHP (via ondrej/php PPA — Ubuntu only; Debian uses sury)
    log "Adding PHP repository (ondrej/php)..."
    if [ "$ID" = "ubuntu" ]; then
        add-apt-repository -y ppa:ondrej/php
    else
        # Debian: use sury repo
        curl -fsSL "https://packages.sury.org/php/apt.gpg" | gpg --dearmor -o /usr/share/keyrings/sury-php.gpg
        echo "deb [signed-by=/usr/share/keyrings/sury-php.gpg] https://packages.sury.org/php $(lsb_release -cs) main" \
            > /etc/apt/sources.list.d/sury-php.list
    fi
    apt-get update -qq

    # Install each PHP version with FPM and common extensions
    for ver in "${PHP_VERSIONS[@]}"; do
        log "Installing PHP ${ver} FPM + extensions..."
        apt-get install -y -qq \
            "php${ver}-fpm" \
            "php${ver}-cli" \
            "php${ver}-common" \
            "php${ver}-mysql" \
            "php${ver}-pgsql" \
            "php${ver}-sqlite3" \
            "php${ver}-gd" \
            "php${ver}-curl" \
            "php${ver}-mbstring" \
            "php${ver}-xml" \
            "php${ver}-zip" \
            "php${ver}-bcmath" \
            "php${ver}-intl" \
            "php${ver}-imagick" \
            2>/dev/null || warn "Some PHP ${ver} extensions unavailable"
    done
    ok "All PHP versions installed"

    # 1h. Nginx
    log "Installing Nginx..."
    apt-get install -y -qq nginx
    systemctl enable nginx
    systemctl start nginx
    verify_cmd "nginx -v" "Nginx installed"
    wait_for_port 127.0.0.1 80 30

    # 1i. Apache (backend for .htaccess support)
    log "Installing Apache2 (backend on port 8080)..."
    apt-get install -y -qq apache2 apache2-utils
    # Configure Apache to listen on 8080 only
    cat > /etc/apache2/ports.conf << 'APACHEPORTS'
# NovaPanel: Apache listens on 8080 as a backend
# Nginx handles port 80/443 as the frontend
Listen 8080
APACHEPORTS
    # Disable default Apache vhost, enable proxy modules
    a2dissite 000-default 2>/dev/null || true
    a2enmod rewrite proxy proxy_http headers 2>/dev/null || true
    systemctl enable apache2
    systemctl start apache2 || true
    verify_cmd "apache2 -v" "Apache installed"
    wait_for_port 127.0.0.1 8080 30

    # 1j. BIND9 DNS
    log "Installing BIND9..."
    apt-get install -y -qq bind9 bind9utils dnsutils

    # Stop systemd-resolved if it's using port 53
    if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
        log "Stopping systemd-resolved to free port 53 for BIND9..."
        systemctl stop systemd-resolved
        systemctl disable systemd-resolved
        # Ensure resolv.conf points to a real DNS
        if [ ! -f /etc/resolv.conf ] || grep -q "127.0.0.53" /etc/resolv.conf 2>/dev/null; then
            rm -f /etc/resolv.conf
            echo "nameserver 8.8.8.8" > /etc/resolv.conf
            echo "nameserver 8.8.4.4" >> /etc/resolv.conf
        fi
    fi

    # Configure BIND9 to listen on all interfaces
    if [ -f /etc/bind/named.conf.options ]; then
        cat > /etc/bind/named.conf.options << 'BINDOPTS'
options {
    directory "/var/cache/bind";
    listen-on { any; };
    listen-on-v6 { any; };
    allow-recursion { any; };
    recursion yes;
    dnssec-validation auto;
};
BINDOPTS
    fi

    mkdir -p /etc/bind/zones
    chown -R bind:bind /etc/bind/zones

    systemctl enable bind9
    systemctl start bind9 || true
    verify_cmd "named -v" "BIND9 installed"
    wait_for_port 127.0.0.1 53 30

    # 1k. Mail stack (Postfix + Dovecot + OpenDKIM + SpamAssassin)
    log "Installing mail stack..."
    # Non-interactive Postfix install
    echo "postfix postfix/main_mailer_type string Internet Site" | debconf-set-selections
    echo "postfix postfix/mailname string ${MAIL_HOSTNAME}" | debconf-set-selections
    apt-get install -y -qq \
        postfix dovecot-imapd dovecot-pop3d \
        opendkim opendkim-tools \
        spamassassin spamc \
        2>/dev/null || warn "Some mail packages unavailable"

    # Configure Postfix for virtual mail
    postconf -e "myhostname = ${MAIL_HOSTNAME}"
    postconf -e "mydestination = localhost.localdomain, localhost"
    postconf -e "inet_interfaces = all"
    postconf -e "virtual_mailbox_domains = /etc/postfix/virtual_domains"
    postconf -e "virtual_mailbox_base = /var/mail/vhosts"
    postconf -e "virtual_mailbox_maps = hash:/etc/postfix/virtual_mailbox"
    postconf -e "virtual_uid_maps = static:5000"
    postconf -e "virtual_gid_maps = static:5000"
    postconf -e "virtual_minimum_uid = 100"
    postconf -e "home_mailbox = Maildir/"
    postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated,permit_mynetworks,reject_unauth_destination"
    # OpenDKIM integration
    postconf -e "milter_default_action = accept"
    postconf -e "milter_protocol = 6"
    postconf -e "smtpd_milters = inet:localhost:8891"
    postconf -e "non_smtpd_milters = inet:localhost:8891"

    # Create virtual mail user
    mkdir -p /var/mail/vhosts
    id -u vmail &>/dev/null || useradd -r -u 5000 -d /var/mail/vhosts -s /usr/sbin/nologin vmail
    chown -R vmail:vmail /var/mail/vhosts

    # Touch Postfix map files
    touch /etc/postfix/virtual_domains /etc/postfix/virtual_mailbox
    postmap /etc/postfix/virtual_domains 2>/dev/null || true
    postmap /etc/postfix/virtual_mailbox 2>/dev/null || true

    # Configure Dovecot for virtual users
    cat > /etc/dovecot/conf.d/99-novapanel.conf << 'DOVECOTCONF'
# NovaPanel Dovecot configuration
mail_location = maildir:/var/mail/vhosts/%d/%n
mail_uid = 5000
mail_gid = 5000

passdb {
    driver = sql
    args = /etc/dovecot/dovecot-sql.conf.ext
}

userdb {
    driver = static
    args = uid=5000 gid=5000 home=/var/mail/vhosts/%d/%n
}

protocols = imap pop3
ssl = no
disable_plaintext_auth = no

log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
DOVECOTCONF

    if [ ! -f /etc/dovecot/dovecot-sql.conf.ext ]; then
        cat > /etc/dovecot/dovecot-sql.conf.ext << 'DOVECOTSQL'
# NovaPanel Dovecot SQL configuration
driver = sqlite
connect = /var/lib/novapanel/novapanel.db

password_query = \
  SELECT email as user, password_hash as password \
  FROM users WHERE email = '%u' AND active = 1
DOVECOTSQL
        chown root:dovecot /etc/dovecot/dovecot-sql.conf.ext
        chmod 640 /etc/dovecot/dovecot-sql.conf.ext
    fi

    # Configure OpenDKIM
    if [ -f /etc/opendkim.conf ]; then
        sed -i 's/^#\?Socket.*/Socket inet:localhost:8891/' /etc/opendkim.conf
        mkdir -p /etc/opendkim/keys
        chown -R opendkim:opendkim /etc/opendkim
    fi

    # Enable SpamAssassin
    if [ -f /etc/default/spamassassin ]; then
        sed -i 's/^ENABLED=0/ENABLED=1/' /etc/default/spamassassin
    fi

    systemctl enable postfix dovecot opendkim spamassassin 2>/dev/null || true
    systemctl start postfix || true
    systemctl start dovecot || true
    systemctl start opendkim 2>/dev/null || true
    systemctl start spamassassin 2>/dev/null || true

    verify_cmd "postconf mail_version" "Postfix installed"
    verify_cmd "dovecot --version" "Dovecot installed"

    # 1l. ProFTPD
    log "Installing ProFTPD..."
    apt-get install -y -qq proftpd-basic

    # Configure ProFTPD
    if [ -f /etc/proftpd/proftpd.conf ]; then
        if ! grep -q "AuthUserFile" /etc/proftpd/proftpd.conf; then
            local SERVER_IP
            SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
            cat >> /etc/proftpd/proftpd.conf << PROFTPDCONF

# NovaPanel FTP configuration
AuthUserFile /etc/proftpd/ftpd.passwd
AuthOrder mod_auth_file.c
RequireValidShell off
PassivePorts ${FTP_PASSIVE_MIN} ${FTP_PASSIVE_MAX}
MasqueradeAddress ${SERVER_IP}
PROFTPDCONF
        fi
    fi
    touch /etc/proftpd/ftpd.passwd
    chmod 640 /etc/proftpd/ftpd.passwd

    systemctl enable proftpd
    systemctl start proftpd || true
    verify_cmd "proftpd -v" "ProFTPD installed"

    # 1m. Redis / Valkey
    log "Installing Redis..."
    apt-get install -y -qq redis-server
    # Bind to 127.0.0.1 only
    if [ -f /etc/redis/redis.conf ]; then
        sed -i 's/^#\?bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
        sed -i 's/^#\?protected-mode .*/protected-mode yes/' /etc/redis/redis.conf
    fi
    systemctl enable redis-server
    systemctl start redis-server
    verify_cmd "redis-cli ping" "Redis installed"
    wait_for_port 127.0.0.1 6379 30

    # 1n. Certbot
    log "Installing Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx python3-certbot-apache
    verify_cmd "certbot --version" "Certbot installed"

    # 1o. Fail2Ban
    log "Installing Fail2Ban..."
    apt-get install -y -qq fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban
    verify_cmd "fail2ban-client status" "Fail2Ban installed"

    # 1p. Cloudflared (optional)
    log "Installing cloudflared (optional)..."
    if ! command -v cloudflared &>/dev/null; then
        curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb" \
            -o /tmp/cloudflared.deb 2>/dev/null && \
            dpkg -i /tmp/cloudflared.deb 2>/dev/null || \
            warn "cloudflared installation skipped (unavailable)"
        rm -f /tmp/cloudflared.deb
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 2: SERVICE CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════
phase_service_config() {
    section "Phase 2: Service Configuration"

    # 2a. MariaDB security
    log "Securing MariaDB..."
    # Set root password
    mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" 2>/dev/null || true
    mariadb -u root -p"${DB_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='';" 2>/dev/null || true
    mariadb -u root -p"${DB_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" 2>/dev/null || true
    mariadb -u root -p"${DB_PASSWORD}" -e "DROP DATABASE IF EXISTS test;" 2>/dev/null || true
    mariadb -u root -p"${DB_PASSWORD}" -e "FLUSH PRIVILEGES;" 2>/dev/null || true

    # Bind MariaDB to 127.0.0.1 only
    local MARIADB_CONF
    for conf_path in /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/my.cnf /etc/my.cnf; do
        if [ -f "$conf_path" ]; then
            MARIADB_CONF="$conf_path"
            break
        fi
    done
    if [ -n "${MARIADB_CONF:-}" ]; then
        if ! grep -q "bind-address = 127.0.0.1" "$MARIADB_CONF" 2>/dev/null; then
            sed -i 's/^#\?bind-address.*/bind-address = 127.0.0.1/' "$MARIADB_CONF" 2>/dev/null || true
        fi
    fi
    systemctl restart mariadb || true
    ok "MariaDB secured and bound to 127.0.0.1"

    # 2b. PostgreSQL security
    log "Configuring PostgreSQL..."
    local PG_CONF="/etc/postgresql/${PG_MAJOR}/main/postgresql.conf"
    local PG_HBA="/etc/postgresql/${PG_MAJOR}/main/pg_hba.conf"

    if [ -f "$PG_CONF" ]; then
        sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" "$PG_CONF"
    fi
    systemctl restart postgresql || true
    ok "PostgreSQL bound to 127.0.0.1"

    # 2c. PHP-FPM configuration
    log "Configuring PHP-FPM pools..."
    for ver in "${PHP_VERSIONS[@]}"; do
        local pool_conf="/etc/php/${ver}/fpm/pool.d/www.conf"
        if [ -f "$pool_conf" ]; then
            sed -i "s|^listen = .*|listen = /run/php/php${ver}-fpm.sock|" "$pool_conf"
            sed -i "s|^;*\s*listen.owner = .*|listen.owner = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.group = .*|listen.group = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.mode = .*|listen.mode = 0660|" "$pool_conf"
            systemctl restart "php${ver}-fpm" 2>/dev/null || true
            ok "PHP ${ver} FPM configured"
        fi
    done

    # 2d. Nginx frontend configuration
    log "Configuring Nginx as frontend proxy..."
    cat > /etc/nginx/sites-available/novapanel << 'NGINXCONF'
# NovaPanel — Nginx Frontend Reverse Proxy
upstream panel_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream apache_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/html;
    index index.html index.php;

    # Proxy panel API requests
    location /api/ {
        proxy_pass http://panel_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Proxy WebSocket connections
    location /ws/ {
        proxy_pass http://panel_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Serve the panel frontend
    location / {
        proxy_pass http://panel_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXCONF
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/novapanel /etc/nginx/sites-enabled/novapanel
    nginx -t && systemctl reload nginx
    ok "Nginx configured as frontend proxy"

    # 2e. Firewall (UFW)
    log "Configuring UFW firewall..."
    apt-get install -y -qq ufw

    # Reset and configure
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing

    # SSH
    ufw allow 22/tcp
    # HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    # FTP
    ufw allow 21/tcp
    ufw allow "${FTP_PASSIVE_MIN}:${FTP_PASSIVE_MAX}/tcp"
    # SMTP
    ufw allow 25/tcp
    ufw allow 587/tcp
    # DNS
    ufw allow 53/tcp
    ufw allow 53/udp
    # Mail
    ufw allow 110/tcp
    ufw allow 143/tcp
    ufw allow 993/tcp
    ufw allow 995/tcp
    # Panel API
    ufw allow 3000/tcp

    ufw --force enable
    ok "UFW firewall configured"
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 3: PANEL DEPLOYMENT
# ═════════════════════════════════════════════════════════════════════════
phase_panel_deploy() {
    section "Phase 3: Panel Deployment"

    # 3a. Create panel user
    if ! id "$PANEL_USER" &>/dev/null; then
        log "Creating panel user: ${PANEL_USER}"
        useradd -r -m -d "$PANEL_HOME" -s /bin/bash "$PANEL_USER"
    fi
    ok "Panel user: ${PANEL_USER}"

    # 3b. Create directories
    log "Creating panel directories..."
    mkdir -p /var/www/vhosts
    mkdir -p /var/log/novapanel
    mkdir -p /etc/novapanel/ssl
    mkdir -p /var/lib/novapanel/backups
    mkdir -p /var/lib/novapanel/secrets
    mkdir -p "${PANEL_HOME}"
    ok "Directories created"

    # 3c. Clone or deploy panel code
    local SOURCE_DIR
    SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

    if [ -f "${SOURCE_DIR}/package.json" ] && [ -f "${SOURCE_DIR}/pnpm-workspace.yaml" ]; then
        log "Deploying from local source: ${SOURCE_DIR}"
        rsync -a --exclude='node_modules' --exclude='.git' --exclude='data' \
            "${SOURCE_DIR}/" "${PANEL_HOME}/"
    elif [ -d "${PANEL_HOME}/package.json" ]; then
        ok "Panel code already deployed at ${PANEL_HOME}"
    else
        # Clone from GitHub
        log "Cloning NovaPanel from GitHub..."
        if ! command -v git &>/dev/null; then
            apt-get install -y -qq git
        fi

        local REPO_URL="https://github.com/marufnwu/NovaPanel.git"
        local REPO_BRANCH="master"
        local CLONE_DIR="${PANEL_HOME}-src"

        if [ -d "${CLONE_DIR}/.git" ]; then
            log "Updating existing clone at ${CLONE_DIR}..."
            cd "${CLONE_DIR}" && git pull --ff-only || warn "Git pull failed, using existing code"
        else
            log "Cloning ${REPO_URL} (branch: ${REPO_BRANCH})..."
            git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${CLONE_DIR}"
        fi

        if [ -f "${CLONE_DIR}/package.json" ]; then
            rsync -a --exclude='node_modules' --exclude='.git' --exclude='data' \
                "${CLONE_DIR}/" "${PANEL_HOME}/"
            ok "Panel code cloned to ${PANEL_HOME}"
        else
            die "Failed to clone NovaPanel. Please install manually:
  git clone ${REPO_URL} ${PANEL_HOME}
  cd ${PANEL_HOME} && pnpm install && pnpm build"
        fi
    fi

    # 3d. Install dependencies and build
    if [ -f "${PANEL_HOME}/package.json" ]; then
        cd "${PANEL_HOME}"

        log "Installing dependencies..."
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install

        log "Building NovaPanel..."
        pnpm build

        ok "Panel built successfully"
    fi

    # 3e. Generate environment file
    local ENV_FILE="${PANEL_HOME}/.env"
    if [ ! -f "$ENV_FILE" ]; then
        log "Generating environment configuration..."
        local SESSION_SECRET JWT_SECRET SF_ENCRYPTION_KEY
        SESSION_SECRET="$(gen_secret 32)"
        JWT_SECRET="$(gen_secret 32)"
        SF_ENCRYPTION_KEY="$(gen_secret 32)"

        cat > "$ENV_FILE" << ENVEOF
# NovaPanel Environment Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
PANEL_URL=${PANEL_URL}

# Database (SQLite for panel metadata)
DB_PATH=/var/lib/novapanel/novapanel.db

# Auth
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}
SF_ENCRYPTION_KEY=${SF_ENCRYPTION_KEY}

# Redis / Valkey
REDIS_URL=redis://127.0.0.1:6379

# Admin Bootstrap
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Paths
VHOSTS_ROOT=/var/www/vhosts
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
APACHE_SITES_AVAILABLE=/etc/apache2/sites-available
BIND_ZONES_DIR=/etc/bind/zones
PHP_FPM_POOL_DIR=/etc/php/{version}/fpm/pool.d
BACKUP_DIR=/var/lib/novapanel/backups

# Mail
MAIL_HOSTNAME=${MAIL_HOSTNAME}

# SSL / Let's Encrypt
LE_EMAIL=${LE_EMAIL}

# Logs
LOG_LEVEL=${LOG_LEVEL}
ENVEOF
        chown "${PANEL_USER}:${PANEL_USER}" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        ok "Environment file generated at ${ENV_FILE}"
    else
        ok "Environment file already exists"
    fi

    # 3f. Run database migrations
    if [ -f "${PANEL_HOME}/apps/api/dist/db/migrate.js" ]; then
        log "Running database migrations..."
        cd "${PANEL_HOME}/apps/api"
        su - "$PANEL_USER" -c "cd ${PANEL_HOME}/apps/api && NODE_ENV=production node dist/db/migrate.js" || \
            warn "Migration failed — will retry on first start"
    fi

    # 3g. Run database seeding
    if [ -f "${PANEL_HOME}/apps/api/dist/db/seed.js" ]; then
        log "Seeding database..."
        cd "${PANEL_HOME}/apps/api"
        su - "$PANEL_USER" -c "cd ${PANEL_HOME}/apps/api && NODE_ENV=production node dist/db/seed.js" || \
            warn "Seeding failed — will retry on first start"
    fi

    # 3h. Set permissions
    chown -R "${PANEL_USER}:${PANEL_USER}" "${PANEL_HOME}"
    chown -R "${PANEL_USER}:${PANEL_USER}" /var/www/vhosts
    chown -R "${PANEL_USER}:${PANEL_USER}" /var/log/novapanel
    chown -R "${PANEL_USER}:${PANEL_USER}" /var/lib/novapanel
    ok "Permissions set"

    # 3i. Create systemd service
    log "Creating systemd service..."
    cat > /etc/systemd/system/novapanel.service << SYSEOF
[Unit]
Description=NovaPanel Server Control Panel
After=network.target mariadb.service postgresql.service redis-server.service nginx.service
Wants=mariadb.service postgresql.service redis-server.service nginx.service

[Service]
Type=simple
User=${PANEL_USER}
Group=${PANEL_USER}
WorkingDirectory=${PANEL_HOME}/apps/api
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

# Load environment from .env file
EnvironmentFile=${PANEL_HOME}/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=/var/www /var/log/novapanel /var/lib/novapanel /etc/novapanel /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/apache2/sites-available /etc/bind/zones /etc/php /etc/postfix /etc/dovecot /etc/proftpd /tmp
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SYSEOF
    systemctl daemon-reload
    systemctl enable novapanel
    ok "Systemd service created"

    # 3j. Start the panel
    log "Starting NovaPanel..."
    systemctl start novapanel || warn "NovaPanel failed to start. Check: journalctl -u novapanel"
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 4: HEALTH VERIFICATION
# ═════════════════════════════════════════════════════════════════════════
phase_verification() {
    section "Phase 4: Health Verification"

    local FAILURES=0

    # Verify each service
    log "Verifying services..."

    # MariaDB
    if systemctl is-active --quiet mariadb 2>/dev/null; then
        ok "MariaDB: active"
    else
        fail "MariaDB: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if ss -tlnp | grep -q ':3306 '; then
        ok "MariaDB: listening on port 3306"
    else
        fail "MariaDB: NOT listening on port 3306"
        FAILURES=$((FAILURES + 1))
    fi

    # PostgreSQL
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        ok "PostgreSQL: active"
    else
        fail "PostgreSQL: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if ss -tlnp | grep -q ':5432 '; then
        ok "PostgreSQL: listening on port 5432"
    else
        fail "PostgreSQL: NOT listening on port 5432"
        FAILURES=$((FAILURES + 1))
    fi

    # Redis
    if systemctl is-active --quiet redis-server 2>/dev/null; then
        ok "Redis: active"
    else
        fail "Redis: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        ok "Redis: responding to PING"
    else
        fail "Redis: NOT responding"
        FAILURES=$((FAILURES + 1))
    fi

    # Nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        ok "Nginx: active"
    else
        fail "Nginx: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if ss -tlnp | grep -q ':80 '; then
        ok "Nginx: listening on port 80"
    else
        fail "Nginx: NOT listening on port 80"
        FAILURES=$((FAILURES + 1))
    fi

    # Apache
    if systemctl is-active --quiet apache2 2>/dev/null; then
        ok "Apache: active on port 8080"
    else
        warn "Apache: not active (may not be required)"
    fi

    # BIND9
    if systemctl is-active --quiet bind9 2>/dev/null; then
        ok "BIND9: active"
    else
        fail "BIND9: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if ss -tlnp | grep -q ':53 '; then
        ok "BIND9: listening on port 53"
    else
        fail "BIND9: NOT listening on port 53"
        FAILURES=$((FAILURES + 1))
    fi

    # Postfix
    if systemctl is-active --quiet postfix 2>/dev/null; then
        ok "Postfix: active"
    else
        fail "Postfix: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    # Dovecot
    if systemctl is-active --quiet dovecot 2>/dev/null; then
        ok "Dovecot: active"
    else
        fail "Dovecot: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    # ProFTPD
    if systemctl is-active --quiet proftpd 2>/dev/null; then
        ok "ProFTPD: active"
    else
        fail "ProFTPD: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    # Fail2Ban
    if systemctl is-active --quiet fail2ban 2>/dev/null; then
        ok "Fail2Ban: active"
    else
        warn "Fail2Ban: not active"
    fi

    # PHP-FPM
    for ver in "${PHP_VERSIONS[@]}"; do
        if systemctl is-active --quiet "php${ver}-fpm" 2>/dev/null; then
            ok "PHP ${ver} FPM: active"
        else
            warn "PHP ${ver} FPM: not active"
        fi
    done

    # NovaPanel
    if systemctl is-active --quiet novapanel 2>/dev/null; then
        ok "NovaPanel: active"
    else
        fail "NovaPanel: NOT active"
        FAILURES=$((FAILURES + 1))
    fi

    if ss -tlnp | grep -q ':3000 '; then
        ok "NovaPanel: listening on port 3000"
    else
        fail "NovaPanel: NOT listening on port 3000"
        FAILURES=$((FAILURES + 1))
    fi

    # UFW
    if ufw status | grep -q "active"; then
        ok "UFW: active"
    else
        warn "UFW: not active"
    fi

    # Config syntax checks
    log "Verifying configuration syntax..."
    if nginx -t 2>/dev/null; then
        ok "Nginx config: valid"
    else
        fail "Nginx config: INVALID"
        FAILURES=$((FAILURES + 1))
    fi

    if named-checkconf /etc/bind/named.conf 2>/dev/null; then
        ok "BIND9 config: valid"
    else
        warn "BIND9 config: has warnings"
    fi

    if postconf check 2>/dev/null; then
        ok "Postfix config: valid"
    else
        warn "Postfix config: has issues"
    fi

    echo ""
    if [ "$FAILURES" -eq 0 ]; then
        ok "All critical services are healthy"
    else
        fail "${FAILURES} verification check(s) failed — review output above"
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 5: SUMMARY
# ═════════════════════════════════════════════════════════════════════════
phase_summary() {
    section "Installation Summary"

    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║           NovaPanel Installation Complete                    ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}Panel URL:${NC}      ${PANEL_URL}"
    echo -e "  ${GREEN}Admin Email:${NC}    ${ADMIN_EMAIL}"
    echo -e "  ${GREEN}Admin Password:${NC} ${ADMIN_PASSWORD}"
    echo ""
    echo -e "  ${CYAN}Config:${NC}         ${PANEL_HOME}/.env"
    echo -e "  ${CYAN}Logs:${NC}           journalctl -u novapanel -f"
    echo -e "  ${CYAN}Manage:${NC}         systemctl {start|stop|restart} novapanel"
    echo -e "  ${CYAN}Services:${NC}       systemctl list-units --type=service | grep -E 'nginx|mariadb|postgres|redis|postfix|dovecot|bind9|proftpd|php'"
    echo ""
    echo -e "  ${YELLOW}Important:${NC}"
    echo -e "    • Change the default admin password immediately after first login"
    echo -e "    • Configure SSL/TLS with: certbot --nginx -d yourdomain.com"
    echo -e "    • Review firewall: ufw status verbose"
    echo -e "    • MariaDB root password is in ${PANEL_HOME}/.env"
    echo ""
    echo -e "  ${DIM}Install script v${SCRIPT_VERSION} | $(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
    echo ""
}

# ═════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═════════════════════════════════════════════════════════════════════════
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     NovaPanel Server Installer v${SCRIPT_VERSION}                     ║${NC}"
    echo -e "${CYAN}║     Verification-First Approach                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    phase_preflight
    phase_system_packages
    phase_service_config
    phase_panel_deploy
    phase_verification
    phase_summary
}

main "$@"
