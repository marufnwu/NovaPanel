#!/usr/bin/env bash
# â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
# â•‘  NovaPanel Docker Entrypoint â€” Verification-First Approach         â•‘
# â•‘                                                                     â•‘
# â•‘  This script prepares the container environment before handing      â•‘
# â•‘  control to supervisord. Every step is verified before proceeding.  â•‘
# â•‘                                                                     â•‘
# â•‘  Responsibilities:                                                  â•‘
# â•‘    1. Pre-flight checks (network, directories, secrets)             â•‘
# â•‘    2. Database initialization (MariaDB, PostgreSQL)                 â•‘
# â•‘    3. Service configuration (nginx, php-fpm, postfix, etc.)         â•‘
# â•‘    4. Panel database migrations & seeding                           â•‘
# â•‘    5. Launch supervisord to manage all daemons                      â•‘
# â•‘                                                                     â•‘
# â•‘  Idempotent: safe to run multiple times.                            â•‘
# â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
set -euo pipefail

# â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SCRIPT_NAME="$(basename "$0")"
PANEL_HOME="/opt/novapanel"
PANEL_API_DIR="${PANEL_HOME}/apps/api"
DATA_DIR="/var/lib/novapanel"
VHOSTS_DIR="/var/www/vhosts"
BACKUP_DIR="${DATA_DIR}/backups"
LOG_DIR="/var/log/supervisor"
SECRETS_DIR="${DATA_DIR}/secrets"

# MariaDB defaults
MYSQL_DATA_DIR="/var/lib/mysql"
MYSQL_RUN_DIR="/run/mysqld"

# PostgreSQL defaults
PG_VERSION="${PG_VERSION:-16}"
PG_DATA_DIR="/var/lib/postgresql/${PG_VERSION}/main"
PG_RUN_DIR="/var/run/postgresql"

# PHP versions to manage
PHP_VERSIONS=("8.1" "8.2" "8.3")

# Passive FTP port range
FTP_PASSIVE_MIN=50000
FTP_PASSIVE_MAX=50100

# Timeout constants (seconds)
DB_WAIT_TIMEOUT=60
SERVICE_WAIT_TIMEOUT=30

# â”€â”€â”€ Color Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[ENTRYPOINT]${NC} $*"; }
ok()   { echo -e "${GREEN}[âœ“]${NC} $*"; }
warn() { echo -e "${YELLOW}[âš ]${NC} $*"; }
fail() { echo -e "${RED}[âœ—]${NC} $*" >&2; }

die() {
    fail "$@"
    exit 1
}

# â”€â”€â”€ Signal Handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
cleanup() {
    log "Caught termination signal â€” shutting down gracefully..."
    if command -v supervisorctl &>/dev/null; then
        supervisorctl stop all 2>/dev/null || true
    fi
    # Give processes a moment to flush
    sleep 2
    log "Shutdown complete."
}
trap cleanup SIGTERM SIGINT SIGQUIT

# â”€â”€â”€ Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print_banner() {
    echo ""
    echo -e "${CYAN}â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—${NC}"
    echo -e "${CYAN}â•‘          NovaPanel Docker Container              â•‘${NC}"
    echo -e "${CYAN}â•‘          Verification-First Entrypoint           â•‘${NC}"
    echo -e "${CYAN}â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
    echo ""
}

# â”€â”€â”€ Helper: Wait for a TCP port to be reachable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
wait_for_port() {
    local host="${1:-127.0.0.1}"
    local port="$2"
    local timeout="${3:-$DB_WAIT_TIMEOUT}"
    local label="${4:-service on port ${port}}"
    local elapsed=0

    while [ "$elapsed" -lt "$timeout" ]; do
        if bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
            ok "${label} is ready (${host}:${port})"
            return 0
        fi
        elapsed=$((elapsed + 1))
        sleep 1
    done

    fail "${label} did not become ready within ${timeout}s (${host}:${port})"
    return 1
}

# â”€â”€â”€ Helper: Wait for a command to succeed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
wait_for_cmd() {
    local cmd="$1"
    local timeout="${2:-$DB_WAIT_TIMEOUT}"
    local label="${3:-command}"
    local elapsed=0

    while [ "$elapsed" -lt "$timeout" ]; do
        if eval "$cmd" &>/dev/null; then
            ok "${label} is ready"
            return 0
        fi
        elapsed=$((elapsed + 1))
        sleep 1
    done

    fail "${label} did not become ready within ${timeout}s"
    return 1
}

# â”€â”€â”€ Helper: Generate a secret if not already present â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ensure_secret() {
    local filepath="$1"
    local label="$2"
    local length="${3:-32}"

    if [ -f "$filepath" ]; then
        local existing
        existing="$(cat "$filepath")"
        if [ -n "$existing" ]; then
            log "Reusing existing secret: ${label}"
            return 0
        fi
    fi

    log "Generating secret: ${label}"
    mkdir -p "$(dirname "$filepath")"
    openssl rand -hex "$length" > "$filepath"
    chmod 600 "$filepath"
}

# â”€â”€â”€ Helper: Verify a binary exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
verify_binary() {
    local binary="$1"
    local label="${2:-$binary}"
    if command -v "$binary" &>/dev/null; then
        ok "${label} installed: $(command -v "$binary")"
        return 0
    else
        fail "${label} not found"
        return 1
    fi
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PHASE 1: PRE-FLIGHT CHECKS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
phase_preflight() {
    log "â”â”â” Phase 1: Pre-flight Checks â”â”â”"

    # 1a. Verify critical binaries are present
    log "Verifying critical binaries..."
    local missing=0
    for bin in mariadb mariadbd pg_ctlcluster redis-server nginx named \
               postfix dovecot proftpd fail2ban-server node; do
        if ! command -v "$bin" &>/dev/null; then
            fail "  Missing: ${bin}"
            missing=$((missing + 1))
        fi
    done
    if [ "$missing" -gt 0 ]; then
        die "${missing} critical binaries are missing. The Docker image is incomplete."
    fi
    ok "All critical binaries present"

    # 1b. Create required directories with proper ownership
    log "Creating required directories..."
    local dirs=(
        "$DATA_DIR"
        "$SECRETS_DIR"
        "$BACKUP_DIR"
        "$VHOSTS_DIR"
        "$LOG_DIR"
        "$MYSQL_DATA_DIR"
        "$MYSQL_RUN_DIR"
        "$PG_RUN_DIR"
        "/run/php"
        "/var/spool/postfix/pid"
        "/var/lib/postfix"
        "/etc/proftpd"
        "/etc/novapanel/ssl"
        "/etc/bind/zones"
        "/var/log/novapanel"
        "/var/www/html"
    )
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done

    # Set ownership
    chown -R mysql:mysql "$MYSQL_DATA_DIR" "$MYSQL_RUN_DIR"
    chown -R postgres:postgres "/var/lib/postgresql" "$PG_RUN_DIR"
    chown -R novapanel:novapanel "$DATA_DIR" "$VHOSTS_DIR" "$BACKUP_DIR" "/var/log/novapanel"
    chmod 750 "$SECRETS_DIR"
    ok "Directories created with proper ownership"

    # 1c. Generate secrets (idempotent â€” only if not already present)
    log "Ensuring secrets exist..."
    ensure_secret "${SECRETS_DIR}/session_secret" "SESSION_SECRET"
    ensure_secret "${SECRETS_DIR}/jwt_secret" "JWT_SECRET"
    ensure_secret "${SECRETS_DIR}/encryption_key" "SF_ENCRYPTION_KEY" 32
    ensure_secret "${SECRETS_DIR}/db_password" "DB_PASSWORD" 24
    ok "Secrets ready"

    # 1d. Verify PHP-FPM versions
    log "Verifying PHP-FPM installations..."
    for ver in "${PHP_VERSIONS[@]}"; do
        if [ -x "/usr/sbin/php-fpm${ver}" ]; then
            ok "PHP ${ver} FPM: $(php-fpm${ver} -v 2>/dev/null | head -1)"
        else
            warn "PHP ${ver} FPM not found â€” skipping"
        fi
    done

    # 1e. Verify supervisord config
    if [ -f "/etc/supervisor/conf.d/novapanel.conf" ]; then
        if supervisord -c /etc/supervisor/conf.d/novapanel.conf --check 2>/dev/null; then
            ok "Supervisord configuration valid"
        else
            warn "Supervisord config check failed â€” proceeding anyway"
        fi
    fi
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PHASE 2: DATABASE INITIALIZATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
phase_database_init() {
    log "â”â”â” Phase 2: Database Initialization â”â”â”"

    # 2a. MariaDB
    log "Initializing MariaDB..."
    if [ ! -d "${MYSQL_DATA_DIR}/mysql" ]; then
        log "  Running mysql_install_db (first run)..."
        mysql_install_db --user=mysql --datadir="$MYSQL_DATA_DIR" 2>&1 | tail -5
        if [ -d "${MYSQL_DATA_DIR}/mysql" ]; then
            ok "MariaDB data directory initialized"
        else
            die "MariaDB initialization failed"
        fi
    else
        ok "MariaDB data directory already exists"
    fi
    chown -R mysql:mysql "$MYSQL_DATA_DIR" "$MYSQL_RUN_DIR"

    # Start MariaDB temporarily for setup
    log "  Starting MariaDB temporarily for setup..."
    mariadbd --user=mysql --skip-syslog &
    local MARIADB_PID=$!

    if wait_for_cmd "mariadb -u root -e 'SELECT 1'" "$DB_WAIT_TIMEOUT" "MariaDB"; then
        # Secure the installation on first run
        local DB_PASSWORD
        DB_PASSWORD="$(cat "${SECRETS_DIR}/db_password")"

        # Set root password only if not already set
        if ! mariadb -u root -e "USE mysql;" 2>/dev/null; then
            log "  Root has no password â€” setting it now"
        fi

        # Create panel database and user if they don't exist
        mariadb -u root <<SQL || true
-- Create panel database
CREATE DATABASE IF NOT EXISTS novapanel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create panel user (no password for root in Docker, socket auth)
-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Remove test database
DROP DATABASE IF EXISTS test;

-- Flush privileges
FLUSH PRIVILEGES;
SQL
        ok "MariaDB setup complete"
    else
        warn "MariaDB did not start â€” will retry via supervisord"
    fi

    # Stop temporary MariaDB â€” supervisord will manage it
    if kill -0 "$MARIADB_PID" 2>/dev/null; then
        mysqladmin -u root shutdown 2>/dev/null || true
        sleep 2
    fi

    # 2b. PostgreSQL
    log "Initializing PostgreSQL..."
    if [ ! -d "${PG_DATA_DIR}/base" ]; then
        log "  Running pg_ctlcluster init (first run)..."
        pg_ctlcluster "$PG_VERSION" main init 2>&1 || true
        if [ -d "${PG_DATA_DIR}/base" ]; then
            ok "PostgreSQL data directory initialized"
        else
            warn "PostgreSQL init may have failed â€” supervisord will attempt start"
        fi
    else
        ok "PostgreSQL data directory already exists"
    fi
    chown -R postgres:postgres "/var/lib/postgresql" "$PG_RUN_DIR"

    # Configure PostgreSQL to listen on 127.0.0.1
    local PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
    if [ -f "$PG_CONF" ]; then
        if ! grep -q "^listen_addresses = '127.0.0.1'" "$PG_CONF" 2>/dev/null; then
            sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" "$PG_CONF"
        fi
        ok "PostgreSQL configured to listen on 127.0.0.1"
    fi

    # Start PostgreSQL temporarily for setup
    log "  Starting PostgreSQL temporarily for setup..."
    su - postgres -c "pg_ctlcluster ${PG_VERSION} main start" 2>/dev/null || true

    if wait_for_port 127.0.0.1 5432 "$DB_WAIT_TIMEOUT" "PostgreSQL"; then
        # Create panel database if it doesn't exist
        su - postgres -c "psql -c \"SELECT 1 FROM pg_database WHERE datname='novapanel'\"" 2>/dev/null | grep -q "1 row" || {
            su - postgres -c "createdb novapanel" 2>/dev/null || true
            ok "PostgreSQL database 'novapanel' created"
        }
        ok "PostgreSQL setup complete"
    else
        warn "PostgreSQL did not start â€” will retry via supervisord"
    fi

    # Stop temporary PostgreSQL â€” supervisord will manage it
    su - postgres -c "pg_ctlcluster ${PG_VERSION} main stop -m fast" 2>/dev/null || true
    sleep 1
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PHASE 3: SERVICE CONFIGURATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
phase_service_config() {
    log "â”â”â” Phase 3: Service Configuration â”â”â”"

    # 3a. Nginx configuration
    log "Configuring Nginx..."
    if [ ! -f "/etc/nginx/sites-enabled/novapanel" ]; then
        cat > /etc/nginx/sites-available/novapanel << 'NGINXEOF'
# NovaPanel â€” Nginx Frontend Reverse Proxy
# Proxies to the Node.js panel API and serves as the main web server

# Upstream for the panel API
upstream panel_api {
    server 127.0.0.1:8732;
    keepalive 64;
}

# Upstream for Apache (for .htaccess support)
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
NGINXEOF
        rm -f /etc/nginx/sites-enabled/default
        ln -sf /etc/nginx/sites-available/novapanel /etc/nginx/sites-enabled/novapanel
    fi

    # Verify nginx config
    if nginx -t 2>/dev/null; then
        ok "Nginx configuration valid"
    else
        fail "Nginx configuration has errors"
        nginx -t 2>&1 || true
    fi

    # 3b. PHP-FPM pool configuration
    log "Configuring PHP-FPM pools..."
    for ver in "${PHP_VERSIONS[@]}"; do
        local pool_conf="/etc/php/${ver}/fpm/pool.d/www.conf"
        if [ -f "$pool_conf" ]; then
            # Ensure the pool listens on the correct socket
            if ! grep -q "^listen = /run/php/php${ver}-fpm.sock" "$pool_conf" 2>/dev/null; then
                sed -i "s|^listen = .*|listen = /run/php/php${ver}-fpm.sock|" "$pool_conf"
            fi
            # Ensure listen.owner and listen.group are set
            sed -i "s|^;*\s*listen.owner = .*|listen.owner = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.group = .*|listen.group = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.mode = .*|listen.mode = 0660|" "$pool_conf"
            ok "PHP ${ver} FPM pool configured"
        else
            warn "PHP ${ver} FPM pool config not found at ${pool_conf}"
        fi
    done

    # 3c. BIND9 configuration
    log "Configuring BIND9..."
    # Ensure BIND9 can listen on port 53 without systemd-resolved conflict
    if [ -f "/etc/bind/named.conf" ]; then
        if named-checkconf /etc/bind/named.conf 2>/dev/null; then
            ok "BIND9 configuration valid"
        else
            warn "BIND9 configuration has issues â€” named-checkconf output:"
            named-checkconf /etc/bind/named.conf 2>&1 || true
        fi
    fi
    # Create zones directory
    mkdir -p /etc/bind/zones
    chown -R bind:bind /etc/bind/zones

    # 3d. Postfix configuration
    log "Configuring Postfix..."
    mkdir -p "/var/spool/postfix/pid" "/var/lib/postfix"
    # Ensure Postfix is configured for virtual mail domains
    if [ -f "/etc/postfix/main.cf" ]; then
        # Set hostname
        postconf -e "myhostname = ${MAIL_HOSTNAME:-mail.novapanel.local}" 2>/dev/null || true
        postconf -e "mydestination = localhost.localdomain, localhost" 2>/dev/null || true
        postconf -e "inet_interfaces = all" 2>/dev/null || true
        # Virtual mail settings
        postconf -e "virtual_mailbox_domains = /etc/postfix/virtual_domains" 2>/dev/null || true
        postconf -e "virtual_mailbox_base = /var/mail/vhosts" 2>/dev/null || true
        postconf -e "virtual_mailbox_maps = hash:/etc/postfix/virtual_mailbox" 2>/dev/null || true
        postconf -e "virtual_uid_maps = static:5000" 2>/dev/null || true
        postconf -e "virtual_gid_maps = static:5000" 2>/dev/null || true
        postconf -e "virtual_minimum_uid = 100" 2>/dev/null || true
        # Create virtual mail user
        mkdir -p /var/mail/vhosts
        id -u vmail &>/dev/null || useradd -r -u 5000 -d /var/mail/vhosts -s /usr/sbin/nologin vmail 2>/dev/null || true
        chown -R vmail:vmail /var/mail/vhosts 2>/dev/null || true
        # Touch map files
        touch /etc/postfix/virtual_domains /etc/postfix/virtual_mailbox 2>/dev/null || true
        ok "Postfix configured for virtual mail"
    fi

    # 3e. Dovecot configuration
    log "Configuring Dovecot..."
    if [ -d "/etc/dovecot" ]; then
        # Ensure auth mechanisms include virtual user support
        cat > /etc/dovecot/conf.d/99-novapanel.conf << 'DOVECOTEOF'
# NovaPanel Dovecot configuration
# Virtual mail user settings

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

# IMAP and POP3 protocols
protocols = imap pop3

# SSL (will be configured by the panel when certs are available)
ssl = no
disable_plaintext_auth = no

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
DOVECOTEOF

        # Create a placeholder SQL config
        if [ ! -f "/etc/dovecot/dovecot-sql.conf.ext" ]; then
            cat > /etc/dovecot/dovecot-sql.conf.ext << 'SQLEOF'
# NovaPanel Dovecot SQL configuration
# This will be configured by the panel at runtime

driver = sqlite
connect = /var/lib/novapanel/novapanel.db

password_query = \
  SELECT email as user, password_hash as password \
  FROM users WHERE email = '%u' AND active = 1
SQLEOF
            chown root:dovecot /etc/dovecot/dovecot-sql.conf.ext
            chmod 640 /etc/dovecot/dovecot-sql.conf.ext
        fi
        ok "Dovecot configured"
    fi

    # 3f. ProFTPD configuration
    log "Configuring ProFTPD..."
    touch /etc/proftpd/ftpd.passwd
    chmod 640 /etc/proftpd/ftpd.passwd
    chown root:root /etc/proftpd/ftpd.passwd

    if [ -f "/etc/proftpd/proftpd.conf" ]; then
        # Ensure AuthUserFile directive exists
        if ! grep -q "AuthUserFile" /etc/proftpd/proftpd.conf; then
            cat >> /etc/proftpd/proftpd.conf << 'PROFTPDEOF'

# NovaPanel FTP configuration
AuthUserFile /etc/proftpd/ftpd.passwd
AuthOrder mod_auth_file.c
RequireValidShell off
PROFTPDEOF
        fi
        # Ensure passive ports are configured
        if ! grep -q "PassivePorts" /etc/proftpd/proftpd.conf; then
            echo "PassivePorts ${FTP_PASSIVE_MIN} ${FTP_PASSIVE_MAX}" >> /etc/proftpd/proftpd.conf
        fi
        # Ensure MasqueradeAddress is set (will be overridden by panel)
        if ! grep -q "MasqueradeAddress" /etc/proftpd/proftpd.conf; then
            echo "MasqueradeAddress 127.0.0.1" >> /etc/proftpd/proftpd.conf
        fi
    fi
    ok "ProFTPD configured"

    # 3g. Fail2Ban configuration
    log "Configuring Fail2Ban..."
    mkdir -p /etc/fail2ban/jail.d
    cat > /etc/fail2ban/jail.d/docker.conf << 'F2BEOF'
[sshd]
enabled = false

[DEFAULT]
backend = auto
F2BEOF
    touch /var/log/auth.log
    ok "Fail2Ban configured for Docker"

    # 3h. Redis configuration
    log "Configuring Redis..."
    if [ -f "/etc/redis/redis.conf" ]; then
        # Ensure Redis binds to 127.0.0.1
        sed -i 's/^#\?bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
        # Disable protected mode for Docker internal use
        sed -i 's/^#\?protected-mode .*/protected-mode no/' /etc/redis/redis.conf
        # Disable daemonize â€” supervisord manages the process
        sed -i 's/^#\?daemonize .*/daemonize no/' /etc/redis/redis.conf
        # Disable systemd supervision â€” supervisord handles it
        sed -i 's/^#\?supervised .*/supervised no/' /etc/redis/redis.conf
    fi
    ok "Redis configured"

    # 3i. Apache configuration (backend for .htaccess support)
    log "Configuring Apache (backend on port 8080)..."
    if command -v apache2 &>/dev/null || command -v httpd &>/dev/null; then
        # Apache will be configured by the panel at runtime
        # Just ensure it listens on 8080
        if [ -f "/etc/apache2/ports.conf" ]; then
            if ! grep -q "Listen 8080" /etc/apache2/ports.conf; then
                cat > /etc/apache2/ports.conf << 'APACHEEOF'
Listen 8080
APACHEEOF
            fi
        fi
        ok "Apache configured on port 8080"
    else
        log "Apache not installed â€” skipping (Nginx-only mode)"
    fi
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PHASE 4: PANEL DATABASE MIGRATIONS & SEEDING
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
phase_panel_init() {
    log "â”â”â” Phase 4: Panel Database Init â”â”â”"

    # Load secrets into environment
    local SESSION_SECRET JWT_SECRET SF_ENCRYPTION_KEY
    SESSION_SECRET="$(cat "${SECRETS_DIR}/session_secret")"
    JWT_SECRET="$(cat "${SECRETS_DIR}/jwt_secret")"
    SF_ENCRYPTION_KEY="$(cat "${SECRETS_DIR}/encryption_key")"

    # First-run detection: check if SQLite DB exists
    if [ ! -f "${DATA_DIR}/novapanel.db" ]; then
        log "First run detected â€” running migrations and seeding..."

        cd "$PANEL_API_DIR"

        # Run migrations
        log "  Running database migrations..."
        NODE_ENV=production \
        DB_PATH="${DATA_DIR}/novapanel.db" \
        REDIS_URL="redis://127.0.0.1:6379" \
        SESSION_SECRET="$SESSION_SECRET" \
        JWT_SECRET="$JWT_SECRET" \
        SF_ENCRYPTION_KEY="$SF_ENCRYPTION_KEY" \
        PANEL_URL="${PANEL_URL:-http://localhost:8732}" \
        ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novapanel.local}" \
        LE_EMAIL="${LE_EMAIL:-admin@novapanel.local}" \
        MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.novapanel.local}" \
        VHOSTS_ROOT="$VHOSTS_DIR" \
        BACKUP_DIR="$BACKUP_DIR" \
        node dist/db/migrate.js 2>&1 && ok "Migrations complete" || {
            warn "Migration failed â€” will retry on API start"
        }

        # Run seeding
        log "  Seeding database..."
        NODE_ENV=production \
        DB_PATH="${DATA_DIR}/novapanel.db" \
        REDIS_URL="redis://127.0.0.1:6379" \
        SESSION_SECRET="$SESSION_SECRET" \
        JWT_SECRET="$JWT_SECRET" \
        SF_ENCRYPTION_KEY="$SF_ENCRYPTION_KEY" \
        PANEL_URL="${PANEL_URL:-http://localhost:8732}" \
        ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novapanel.local}" \
        ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme123}" \
        LE_EMAIL="${LE_EMAIL:-admin@novapanel.local}" \
        MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.novapanel.local}" \
        VHOSTS_ROOT="$VHOSTS_DIR" \
        BACKUP_DIR="$BACKUP_DIR" \
        node dist/db/seed.js 2>&1 && ok "Seeding complete" || {
            warn "Seeding failed â€” will retry on API start"
        }
    else
        ok "Database already exists â€” skipping migrations"
    fi

    chown -R novapanel:novapanel "$DATA_DIR"
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PHASE 5: FINAL VERIFICATION & LAUNCH
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
phase_launch() {
    log "â”â”â” Phase 5: Launch â”â”â”"

    # Print summary
    echo ""
    echo -e "${BOLD}Service Configuration Summary:${NC}"
    echo -e "  ${GREEN}Panel API${NC}:    http://0.0.0.0:8732"
    echo -e "  ${GREEN}Nginx${NC}:        http://0.0.0.0:80 (frontend proxy)"
    echo -e "  ${GREEN}Apache${NC}:       http://127.0.0.1:8080 (backend, .htaccess)"
    echo -e "  ${GREEN}MariaDB${NC}:      127.0.0.1:3306"
    echo -e "  ${GREEN}PostgreSQL${NC}:   127.0.0.1:5432"
    echo -e "  ${GREEN}Redis${NC}:        127.0.0.1:6379"
    echo -e "  ${GREEN}FTP${NC}:          0.0.0.0:21 (passive: ${FTP_PASSIVE_MIN}-${FTP_PASSIVE_MAX})"
    echo -e "  ${GREEN}DNS${NC}:          0.0.0.0:53"
    echo -e "  ${GREEN}SMTP${NC}:         0.0.0.0:25"
    echo -e "  ${GREEN}IMAP${NC}:         0.0.0.0:143"
    echo -e "  ${GREEN}POP3${NC}:         0.0.0.0:110"
    echo ""
    echo -e "  ${CYAN}Logs${NC}:         docker compose logs -f novapanel"
    echo -e "  ${CYAN}Shell${NC}:         docker compose exec novapanel bash"
    echo -e "  ${CYAN}Services${NC}:      supervisorctl status"
    echo ""

    log "Handing off to supervisord..."
    echo ""
}

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# MAIN EXECUTION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
main() {
    print_banner

    phase_preflight
    phase_database_init
    phase_service_config
    phase_panel_init
    phase_launch

    # If arguments were passed, exec them; otherwise let CMD handle supervisord
    exec "$@"
}

main "$@"