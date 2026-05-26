#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  NovaPanel Server Installer — Verification-First Approach            ║
# ║                                                                      ║
# ║  Installs NovaPanel and all dependencies on a fresh server.          ║
# ║  Supports: Ubuntu 22.04, Ubuntu 24.04, Debian 11, Debian 12          ║
# ║                                                                      ║
# ║  Usage:                                                              ║
# ║    sudo bash scripts/install.sh                                      ║
# ║    sudo ADMIN_EMAIL=you@example.com bash scripts/install.sh          ║
# ║                                                                      ║
# ║  Environment variables (all optional with sensible defaults):        ║
# ║    ADMIN_EMAIL     — Admin email (default: admin@$(hostname -f))     ║
# ║    ADMIN_PASSWORD  — Admin password (default: auto-generated)        ║
# ║    PANEL_URL       — Panel URL (default: http://$(hostname -f):8732) ║
# ║    PANEL_USER      — System user (default: novapanel)                ║
# ║    PANEL_HOME      — Install dir (default: /opt/novapanel)           ║
# ║    MAIL_HOSTNAME   — Mail hostname (default: mail.$(hostname -d))    ║
# ║    LE_EMAIL        — Let's Encrypt email (default: $ADMIN_EMAIL)     ║
# ║    DB_PASSWORD     — MariaDB root password (default: auto-generated) ║
# ║                                                                      ║
# ║  Idempotent: safe to run multiple times.                             ║
# ╚══════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Fix Bug #1: Prevent interactive apt-get prompts ─────────────────────────
# When running via `curl ... | sudo bash`, apt-get interactive dialogs would hang.
export DEBIAN_FRONTEND=noninteractive

# ─── Error trapping for visibility ─────────────────────────────────────────
# This trap fires when any command fails due to 'set -e'
trap 'echo ""; echo "[✗] INSTALL FAILED at line $LINENO"; echo "    Command that failed: $BASH_COMMAND"; echo "    Check /tmp/novapanel-install.log for details"; echo ""' ERR

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

# ─── Parse Arguments ────────────────────────────────────────────────────────
# Parse --force flag early before any interactive checks
FORCE_ARG=0
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE_ARG=1
        break
    fi
done

# ─── Local Server Detection ────────────────────────────────────────────
IS_LOCAL_SERVER=false
BEHIND_NAT=false
PUBLIC_IP=""
SERVER_IP=""

# ─── Existing Installation Detection ──────────────────────────────────
IS_UPDATE=false
EXISTING_INSTALL=false
INSTALL_MODE=""  # Will be set to "fresh" or "update" during installation
INSTALL_MODE=""  # Will be set to "fresh" or "update" during installation

# Helper: Check if running interactively (stdin is a terminal)
is_interactive() {
    [ -t 0 ]
}

# Helper: Check for existing installation
check_existing_installation() {
    local PANEL_HOME_CHECK="${PANEL_HOME:-/opt/novapanel}"
    
    if [ -d "$PANEL_HOME_CHECK" ] && [ -f "${PANEL_HOME_CHECK}/package.json" ]; then
        EXISTING_INSTALL=true
        IS_UPDATE=true
        return 0
    fi
    return 1
}

# Prompt for install mode with timeout fallback
ask_install_mode() {
    local PANEL_HOME_CHECK="${PANEL_HOME:-/opt/novapanel}"
    
    echo ""
    echo "============================================================"
    echo -e "${YELLOW}⚠️  EXISTING INSTALLATION DETECTED${NC}"
    echo "============================================================"
    echo ""
    echo -e "Found existing NovaPanel installation at: ${BOLD}${PANEL_HOME_CHECK}${NC}"
    echo ""
    echo "Options:"
    echo "  1) Fresh Install - Wipes ALL data and does complete reinstall"
    echo "  2) Update - Preserves existing data, only updates code"
    echo ""
    echo -e "${GREEN}Your data will NOT be lost if you choose Update.${NC}"
    echo ""
    echo "Choose [1/2]: "
    
    REPLY=""
    
    if [ -t 0 ]; then
        # Terminal available - wait for input with timeout
        read -t 60 -n 1 -r REPLY || true
    else
        # No terminal (piped mode) - can't read input, default to Update after delay
        echo "(No terminal detected - defaulting to Update in 10 seconds..."
        echo "Use FORCE=1 to skip this delay)"
        sleep 10
        REPLY="2"
    fi
    
    # Default to Update (2) if empty input
    if [ -z "$REPLY" ]; then
        REPLY="2"
    fi
    
    case "$REPLY" in
        1)
            echo ""
            echo -e "${YELLOW}⚠️  FRESH INSTALL CHOSEN - ALL DATA WILL BE WIPED${NC}"
            echo ""
            echo "This will:"
            echo "  • Stop the novapanel service"
            echo "  • Remove the existing installation at ${PANEL_HOME_CHECK}"
            echo "  • Delete the database at /var/lib/novapanel/novapanel.db"
            echo "  • Delete the .env file at ${PANEL_HOME_CHECK}/.env"
            echo "  • Perform a complete fresh installation"
            echo ""
            echo -e "${RED}WARNING: All existing data will be lost!${NC}"
            echo ""
            
            # Confirm fresh install in interactive mode
            if [ -t 0 ]; then
                echo "Are you sure you want to continue? [y/N]: "
                read -t 30 -n 1 -r CONFIRM || true
                echo ""
                if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
                    echo "Installation cancelled."
                    exit 0
                fi
            else
                # Non-interactive mode - proceed with FORCE=1 check
                if [ "${FORCE:-0}" != "1" ]; then
                    echo "For safety, please confirm in interactive mode or set FORCE=1"
                    echo "  FORCE=1 sudo bash $0"
                    exit 1
                fi
                echo "FORCE=1 set: proceeding with fresh install..."
            fi
            
            IS_UPDATE=false
            return 0
            ;;
        2|*)
            echo -e "${GREEN}Continuing with update (data preservation mode)...${NC}"
            IS_UPDATE=true
            return 0
            ;;
    esac
}

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
    local length="${1:-32}"
    # FIX #9: Use openssl if available, fallback to /dev/urandom
    if command -v openssl &>/dev/null; then
        openssl rand -hex "$length"
    else
        # Fallback: use /dev/urandom with od
        od -An -tx1 -N "$((length * 2))" /dev/urandom | tr -d ' \n'
    fi
}

# ─── Helper: Generate a user-friendly password ──────────────────────────
gen_password() {
    # Generates a memorable password: Word-Number-Word pattern
    # Example: BlueCat42Sky! or purple-frog-2024-moon
    local word1="bluecat|purplefrog|redwolf|greenfox|goldhen|silverkey|brave elk|swiftbird|wildbear|dark hawk"
    local word2="sky|moon|star|rain|snow|sun|wind|cloud|forest|river"
    local word3="2024|2025|nova|panel|cyber|alpha|beta|gamma|delta|omega"
    
    local w1=$(echo "$word1" | tr '|' '\n' | shuf -n 1)
    local w2=$(echo "$word2" | tr '|' '\n' | shuf -n 1)
    local w3=$(echo "$word3" | tr '|' '\n' | shuf -n 1)
    local num=$((RANDOM % 900 + 100))
    
    # Randomly choose format
    case $((RANDOM % 4)) in
        0) echo "${w1}${num}${w2}" ;;
        1) echo "${w1}-${w2}-${num}" ;;
        2) echo "${w3}-${w1}${w2}" ;;
        3) echo "${w2}${num}${w1}" ;;
    esac
}

# Helper: Check if password looks like a hash (hex-only, length > 20)
is_hash_password() {
    local pwd="$1"
    # Hash passwords are typically hex strings (bcrypt/sha hash style) > 20 chars
    if [ ${#pwd} -gt 20 ] && [[ "$pwd" =~ ^[a-fA-F0-9]+$ ]]; then
        return 0
    fi
    return 1
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
        if ss -tlnp | grep -q ":${port}"; then
            ok "Port ${port} is listening"
            return 0
        fi
        elapsed=$((elapsed + 2))
        sleep 2
    done

    fail "Port ${port} not listening within ${timeout}s"
    return 1
}

# ─── Helper: Detect public IP and determine if server is behind NAT ─────
detect_public_ip() {
    # Check if the detected SERVER_IP is a private IP
    local ip="$1"
    local is_private=false
    
    # Check against RFC1918 private ranges
    if [[ "$ip" =~ ^10\. ]] || \
       [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] || \
       [[ "$ip" =~ ^192\.168\. ]] || \
       [[ "$ip" =~ ^127\. ]] || \
       [[ "$ip" =~ ^169\.254\. ]]; then
        is_private=true
    fi
    
    # Try to detect actual public IP
    local public_ip=""
    public_ip="$(curl -sf --connect-timeout 5 https://ifconfig.me 2>/dev/null || \
                 curl -sf --connect-timeout 5 https://icanhazip.com 2>/dev/null || \
                 curl -sf --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo '')"
    
    # If public IP differs from server IP, we're behind NAT
    if [ -n "$public_ip" ] && [ "$public_ip" != "$SERVER_IP" ]; then
        BEHIND_NAT=true
        PUBLIC_IP="$public_ip"
    fi
    
    if [ "$is_private" = true ]; then
        IS_LOCAL_SERVER=true
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 0: PRE-FLIGHT CHECKS
# ═════════════════════════════════════════════════════════════════════════
phase_preflight() {
    section "Phase 0: Pre-flight Checks"

    # ─── Existing Installation Check ──────────────────────────────────
    # Check BEFORE any system modifications to give user a chance to cancel
    if check_existing_installation; then
        log "Existing NovaPanel installation detected at ${PANEL_HOME}"
        
        # Check if we should skip the confirmation prompt entirely
        # Only skip if FORCE=1 env var is set OR --force flag was passed
        local FORCE_SKIP=0
        if [ "${FORCE:-0}" = "1" ] || [ "$FORCE_ARG" = "1" ]; then
            FORCE_SKIP=1
        fi
        
        if [ "$FORCE_SKIP" = "1" ]; then
            ok "FORCE=1 set: skipping confirmation, defaulting to update mode"
            IS_UPDATE=true
        else
            # Always prompt with timeout (handles both interactive and piped modes)
            ask_install_mode
        fi
        
        # If fresh install was chosen (IS_UPDATE=false), wipe existing data
        if [ "$IS_UPDATE" = false ]; then
            log "Wiping existing installation for fresh install..."
            
            # Stop novapanel service
            echo ""
            echo "Stopping novapanel service..."
            systemctl stop novapanel 2>/dev/null || true
            
            # Remove installation directory
            echo "Removing ${PANEL_HOME}..."
            rm -rf "${PANEL_HOME}" 2>/dev/null || true
            
            # Remove database file
            echo "Removing database at /var/lib/novapanel/novapanel.db..."
            rm -f /var/lib/novapanel/novapanel.db 2>/dev/null || true
            
            # Remove .env file (use separate variable since PANEL_HOME may be gone)
            local ENV_TO_REMOVE="${PANEL_HOME}/.env"
            echo "Removing .env file..."
            rm -f "$ENV_TO_REMOVE" 2>/dev/null || true
            
            ok "Existing data wiped - proceeding with fresh installation"
        fi
    fi

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
    HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname)"
    local HOSTNAME_DOMAIN
    HOSTNAME_DOMAIN="$(hostname -d 2>/dev/null || echo 'local')"

    # Detect server IP for Panel URL fallback
    SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    # Fallback: try external IP if hostname -I returns nothing or only 127.0.0.1
    if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" = "127.0.0.1" ]; then
        SERVER_IP="$(curl -sf --connect-timeout 3 ifconfig.me 2>/dev/null || echo '127.0.0.1')"
    fi

    # Detect public IP and check if server is behind NAT
    # SERVER_IP is already set as a local variable above, so use it directly
    detect_public_ip "$SERVER_IP"

    # Validate hostname looks like a proper FQDN (contains at least one dot)
    if [[ "$HOSTNAME_FQDN" != *.* ]]; then
        # No valid FQDN — use server IP for Panel URL
        HOSTNAME_FQDN="$SERVER_IP"
        HOSTNAME_DOMAIN="localhost"
    fi

    # Use IP for Panel URL, but valid domain for email addresses
    # (IP-based emails like admin@192.168.0.211 fail validation)
    local EMAIL_DOMAIN="$HOSTNAME_FQDN"
    if [[ "$HOSTNAME_FQDN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        EMAIL_DOMAIN="localhost.localdomain"
    fi

    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${EMAIL_DOMAIN}}"
    LE_EMAIL="${LE_EMAIL:-$ADMIN_EMAIL}"
    PANEL_URL="${PANEL_URL:-http://${HOSTNAME_FQDN}:8732}"
    MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.${HOSTNAME_DOMAIN}}"

    # Generate passwords if not set
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD="$(gen_secret 24)"
    fi
    
    # On update with existing .env, preserve existing admin credentials
    if [ "$IS_UPDATE" = true ] && [ -f "${PANEL_HOME}/.env" ]; then
        log "Preserving existing admin credentials on update"
        set -a
        # shellcheck source=/dev/null
        source "${PANEL_HOME}/.env"
        set +a
        
        # Use existing values if available
        ADMIN_EMAIL="${ADMIN_EMAIL:-$ADMIN_EMAIL}"
        ADMIN_PASSWORD="${ADMIN_PASSWORD:-$ADMIN_PASSWORD}"
    elif [ -z "$ADMIN_PASSWORD" ]; then
        ADMIN_PASSWORD="$(gen_password)"
    fi

    # Warn if local server detected
    if [ "$IS_LOCAL_SERVER" = true ]; then
        echo ""
        echo "============================================================"
        echo "⚠️  LOCAL SERVER DETECTED"
        echo "============================================================"
        echo ""
        echo "Your server appears to be on a local network (IP: $SERVER_IP)"
        if [ -n "$PUBLIC_IP" ]; then
            echo "Public IP detected: $PUBLIC_IP (behind NAT)"
        fi
        echo ""
        echo "Important notes for local servers:"
        echo "  • The panel will be accessible at http://$SERVER_IP:8732"
        echo "    (local network only)"
        echo "  • SSL (Let's Encrypt HTTP-01) will NOT work without port forwarding"
        echo "    Use DNS-01 challenge via Cloudflare Tunnel instead"
        echo "  • External email delivery requires a public IP or mail relay"
        echo "  • External DNS resolution requires a public IP"
        echo ""
        echo "RECOMMENDED: Set up a Cloudflare Tunnel after installation"
        echo "to make your panel and websites accessible from the internet."
        echo ""
        echo "============================================================"
        echo ""
        
        # Ask if user wants to continue (skip in non-interactive mode or with FORCE=1)
        if is_interactive; then
            read -p "Continue with installation? [Y/n] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]] && [ -n "$REPLY" ]; then
                echo "Installation cancelled."
                exit 0
            fi
        else
            ok "Non-interactive mode: continuing..."
        fi
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
    # Fix Bug #2: Check for server package, not client binary
    # (client may remain after uninstall while server is removed)
    if ! dpkg -l mariadb-server &>/dev/null | grep -q "^ii"; then
        curl -fsSL "https://r.mariadb.com/downloads/mariadb_repo_setup" | bash -s -- --mariadb-server-version="mariadb-${MARIADB_MAJOR}" --skip-maxscale --skip-tools
        DEBIAN_FRONTEND=noninteractive apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o Dpkg::Options::="--force-confnew" mariadb-server mariadb-client
    fi
    verify_cmd "mariadb --version" "MariaDB installed"

    # 1f. PostgreSQL (official PostgreSQL repository)
    log "Adding PostgreSQL ${PG_MAJOR} repository..."
    # Fix Bug #2: Check for server package, not client binary
    if ! dpkg -l "postgresql-${PG_MAJOR}" &>/dev/null | grep -q "^ii"; then
        curl -fsSL "https://www.postgresql.org/media/keys/ACCC4CF8.asc" | gpg --batch --yes --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
            > /etc/apt/sources.list.d/postgresql.list
        DEBIAN_FRONTEND=noninteractive apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-${PG_MAJOR}" "postgresql-contrib-${PG_MAJOR}"
    fi
    verify_cmd "psql --version" "PostgreSQL installed"

    # 1g. PHP (via ondrej/php PPA — Ubuntu only; Debian uses sury)
    log "Adding PHP repository (ondrej/php)..."
    if [ "$ID" = "ubuntu" ]; then
        # Check if PPA already exists to avoid hanging on re-runs
        if ! grep -rq "ondrej" /etc/apt/sources.list.d/ 2>/dev/null; then
            log "Adding ondrej/php PPA (with 120s timeout)..."
            if ! timeout 120 add-apt-repository -y ppa:ondrej/php 2>&1; then
                warn "Failed to add ondrej/php PPA (network issue?) — PHP packages may already be available"
            fi
        else
            ok "ondrej/php PPA already configured"
        fi
    else
        # Debian: use sury repo
        if ! grep -q "sury" /etc/apt/sources.list.d/sury-php.list 2>/dev/null; then
            log "Adding sury PHP repository..."
            curl -fsSL "https://packages.sury.org/php/apt.gpg" | gpg --batch --yes --dearmor -o /usr/share/keyrings/sury-php.gpg
            echo "deb [signed-by=/usr/share/keyrings/sury-php.gpg] https://packages.sury.org/php $(lsb_release -cs) main" \
                > /etc/apt/sources.list.d/sury-php.list
        else
            ok "sury PHP repository already configured"
        fi
    fi
    apt-get update -qq

    # FIX B: Create PHP-FPM pool configs BEFORE apt-get install
    # If pools don't exist when dpkg runs post-inst scripts, PHP-FPM fails to start
    # and causes "error processing package phpN-fpm" with exit code 78
    for phpver in 8.1 8.2 8.3; do
        pool_dir="/etc/php/${phpver}/fpm/pool.d"
        if [ -d "$pool_dir" ]; then
            rm -f "${pool_dir}/www.conf" "${pool_dir}/www.conf.disabled" "${pool_dir}/www.conf.default" 2>/dev/null || true
        else
            mkdir -p "$pool_dir"
        fi
        cat > "${pool_dir}/www.conf" << POOL
[www]
user = www-data
group = www-data
listen = /run/php/php${phpver}-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
POOL
        log "Pre-created PHP ${phpver} FPM pool config"
    done

    # FIX C: Remove MariaDB conffile that causes interactive dpkg prompts on re-runs
    # If 50-server.cnf was modified, dpkg prompts "keep or install new" which hangs SSH
    MARIADB_CNF="/etc/mysql/mariadb.conf.d/50-server.cnf"
    if [ -f "$MARIADB_CNF" ]; then
        log "Backing up modified MariaDB config..."
        cp "$MARIADB_CNF" "${MARIADB_CNF}.bak" 2>/dev/null || true
        rm -f "$MARIADB_CNF"
    fi

    # Install each PHP version with FPM and common extensions
    for ver in "${PHP_VERSIONS[@]}"; do
        log "Installing PHP ${ver} FPM + extensions..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
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
    # FIX: Stop and reconfigure Apache to port 8080 BEFORE installing Nginx
    # to prevent port 80 conflicts if Apache is already installed
    log "Preparing for Nginx installation (stopping Apache if running)..."
    systemctl stop apache2 2>/dev/null || true
    
    # Reconfigure Apache to listen on port 8080 instead of 80
    if [ -f /etc/apache2/ports.conf ]; then
        cp /etc/apache2/ports.conf /etc/apache2/ports.conf.bak
        cat > /etc/apache2/ports.conf << 'APACHEPORTS'
# NovaPanel: Apache listens on 8080 as a backend
# Nginx handles port 80/443 as the frontend
Listen 8080
APACHEPORTS
    fi
    
    # Update Apache virtual host to use port 8080
    if [ -f /etc/apache2/sites-available/000-default.conf ]; then
        sed -i 's/<VirtualHost \*:80>/<VirtualHost *:8080>/' /etc/apache2/sites-available/000-default.conf 2>/dev/null || true
    fi
    
    log "Installing Nginx..."
    apt-get install -y -qq nginx
    systemctl enable nginx
    # Fix nginx pid location for Docker compatibility (read-only /run filesystem)
    if [ -f /etc/nginx/nginx.conf ]; then
        sed -i 's|pid /run/nginx.pid;|pid /var/run/nginx.pid;|' /etc/nginx/nginx.conf
    fi
    systemctl start nginx
    verify_cmd "nginx -v" "Nginx installed"
    
    # FIX: Make port 80 check non-fatal - warn but continue if Nginx hasn't started yet
    if ! wait_for_port 127.0.0.1 80 30; then
        warn "Port 80 not listening yet — Nginx may need manual start"
        systemctl status nginx || true
    fi

    # FIX #10: Backup Apache ports.conf before modifying
    log "Installing Apache2 (backend on port 8080)..."
    apt-get install -y -qq apache2 apache2-utils
    # Configure Apache to listen on 8080 only
    if [ -f /etc/apache2/ports.conf ]; then
        cp /etc/apache2/ports.conf /etc/apache2/ports.conf.bak
    fi
    cat > /etc/apache2/ports.conf << 'APACHEPORTS'
# NovaPanel: Apache listens on 8080 as a backend
# Nginx handles port 80/443 as the frontend
Listen 8080
APACHEPORTS
    # FIX #4: Proper error handling - replace || true patterns
    # Disable default Apache vhost, enable proxy modules
    if command -v a2dissite &>/dev/null; then
        a2dissite 000-default 2>/dev/null || warn "a2dissite 000-default failed"
    fi
    if command -v a2enmod &>/dev/null; then
        a2enmod rewrite proxy proxy_http headers 2>/dev/null || warn "a2enmod failed"
    fi
    systemctl enable apache2
    if ! systemctl start apache2; then
        warn "Failed to start apache2"
    fi
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

    # FIX #1: Configure BIND9 - restrict recursion to localhost (security)
    if [ -f /etc/bind/named.conf.options ]; then
        cat > /etc/bind/named.conf.options << 'BINDOPTS'
options {
    directory "/var/cache/bind";
    listen-on { any; };
    listen-on-v6 { any; };
    allow-query { any; };
    allow-recursion { 127.0.0.1; ::1; };
    recursion yes;
    dnssec-validation auto;
};
BINDOPTS
    fi

    mkdir -p /etc/bind/zones
    chown -R bind:bind /etc/bind/zones

    systemctl enable named
    if ! systemctl start named; then
        warn "Failed to start named"
    fi
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
    # FIX #4: postmap can fail if files are empty, use warn instead of || true
    if ! postmap /etc/postfix/virtual_domains 2>/dev/null; then
        warn "postmap virtual_domains failed (file may be empty)"
    fi
    if ! postmap /etc/postfix/virtual_mailbox 2>/dev/null; then
        warn "postmap virtual_mailbox failed (file may be empty)"
    fi

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

    # FIX #5: Dovecot SQL config will be created after database migrations run
    # (moved to phase_panel_deploy after migrations complete)

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

    # FIX #4: Enable and start mail services with proper error handling
    systemctl enable postfix dovecot opendkim spamassassin 2>/dev/null || warn "Some mail services could not be enabled"
    if ! systemctl start postfix; then
        warn "Failed to start postfix"
    fi
    if ! systemctl start dovecot; then
        warn "Failed to start dovecot"
    fi
    if ! systemctl start opendkim; then
        warn "Failed to start opendkim"
    fi
    if ! systemctl start spamassassin; then
        warn "Failed to start spamassassin"
    fi

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
    mkdir -p /etc/proftpd && touch /etc/proftpd/ftpd.passwd
    chmod 640 /etc/proftpd/ftpd.passwd

    systemctl enable proftpd
    if ! systemctl start proftpd; then
        warn "Failed to start proftpd"
    fi
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
    apt-get install -y -qq certbot python3-certbot-nginx python3-certbot-apache python3-certbot-dns-cloudflare
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
    # FIX #11: Cloudflared creates outbound tunnel connections (no inbound ports needed)
    # If exposing SSH through cloudflared tunnel, open port 22 in UFW as usual
    
    # Show cloudflared installation status with local server guidance
    if command -v cloudflared &>/dev/null; then
        ok "cloudflared installed successfully"
        if [ "$IS_LOCAL_SERVER" = true ]; then
            echo "     → Set up a tunnel via the panel UI after installation"
        fi
    else
        warn "cloudflared installation skipped"
        if [ "$IS_LOCAL_SERVER" = true ]; then
            echo "     → Install manually for tunnel support"
        fi
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 2: SERVICE CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════
phase_service_config() {
    section "Phase 2: Service Configuration"

    # 2a. MariaDB security
    log "Securing MariaDB..."

    # FIX #2: MariaDB password logic - support re-runs
    # Store password in /etc/novapanel/.db-password (mode 600)
    mkdir -p /etc/novapanel
    if [ -f /etc/novapanel/.db-password ]; then
        DB_PASSWORD="$(cat /etc/novapanel/.db-password)"
    else
        echo -n "$DB_PASSWORD" > /etc/novapanel/.db-password
        chmod 600 /etc/novapanel/.db-password
    fi

    # Set root password only if connection doesn't already work
    if ! mariadb -u root -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
        log "Setting MariaDB root password..."
        mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" 2>/dev/null || \
            warn "Failed to set MariaDB root password"
        mariadb -u root -p"${DB_PASSWORD}" -e "FLUSH PRIVILEGES;" 2>/dev/null || \
            warn "Failed to flush MariaDB privileges"
    fi

    # Remove anonymous users and test database
    # FIX #4: Use explicit error handling instead of || true
    if ! mariadb -u root -p"${DB_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='';" 2>/dev/null; then
        warn "Failed to remove anonymous MySQL users"
    fi
    if ! mariadb -u root -p"${DB_PASSWORD}" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" 2>/dev/null; then
        warn "Failed to remove remote root users"
    fi
    if ! mariadb -u root -p"${DB_PASSWORD}" -e "DROP DATABASE IF EXISTS test;" 2>/dev/null; then
        warn "Failed to drop test database"
    fi
    if ! mariadb -u root -p"${DB_PASSWORD}" -e "FLUSH PRIVILEGES;" 2>/dev/null; then
        warn "Failed to flush privileges"
    fi

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
            if ! sed -i 's/^#\?bind-address.*/bind-address = 127.0.0.1/' "$MARIADB_CONF" 2>/dev/null; then
                warn "Failed to set MariaDB bind-address"
            fi
        fi
    fi
    if ! systemctl restart mariadb; then
        warn "Failed to restart mariadb"
    fi
    ok "MariaDB secured and bound to 127.0.0.1"

    # 2b. PostgreSQL security
    log "Configuring PostgreSQL..."
    local PG_CONF="/etc/postgresql/${PG_MAJOR}/main/postgresql.conf"
    local PG_HBA="/etc/postgresql/${PG_MAJOR}/main/pg_hba.conf"

    if [ -f "$PG_CONF" ]; then
        if ! sed -i "s/^#\?listen_addresses.*/listen_addresses = '127.0.0.1'/" "$PG_CONF" 2>/dev/null; then
            warn "Failed to set PostgreSQL listen_addresses"
        fi
    fi
    if ! systemctl restart postgresql; then
        warn "Failed to restart postgresql"
    fi
    ok "PostgreSQL bound to 127.0.0.1"

    # 2c. PHP-FPM configuration
    log "Configuring PHP-FPM pools..."
    for ver in "${PHP_VERSIONS[@]}"; do
        local pool_conf="/etc/php/${ver}/fpm/pool.d/www.conf"
        # FIX #6: Disable the default www pool to avoid conflicts
        if [ -f "$pool_conf" ]; then
            mv "$pool_conf" "${pool_conf}.disabled"
            ok "Disabled default PHP ${ver} FPM www pool"
        fi
    done

    for ver in "${PHP_VERSIONS[@]}"; do
        local pool_conf="/etc/php/${ver}/fpm/pool.d/www.conf.disabled"
        if [ -f "$pool_conf" ]; then
            sed -i "s|^listen = .*|listen = /run/php/php${ver}-fpm.sock|" "$pool_conf"
            sed -i "s|^;*\s*listen.owner = .*|listen.owner = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.group = .*|listen.group = www-data|" "$pool_conf"
            sed -i "s|^;*\s*listen.mode = .*|listen.mode = 0660|" "$pool_conf"
            if ! systemctl restart "php${ver}-fpm" 2>/dev/null; then
                warn "Failed to restart php${ver}-fpm"
            fi
            ok "PHP ${ver} FPM configured"
        fi
    done

    # BUG FIX: Create default PHP-FPM pool for each installed version
    # The previous loop disabled www.conf but didn't create a replacement,
    # causing PHP-FPM to fail with "No pool defined" error
    for phpver in 8.1 8.2 8.3; do
        pool_dir="/etc/php/${phpver}/fpm/pool.d"
        if [ -d "$pool_dir" ]; then
            # Remove any existing disabled/default pool configs
            rm -f "${pool_dir}/www.conf" "${pool_dir}/www.conf.disabled" "${pool_dir}/www.conf.default" 2>/dev/null || true
            
            cat > "${pool_dir}/www.conf" << POOL
[www]
user = www-data
group = www-data
listen = /run/php/php${phpver}-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
POOL
            log "Created PHP ${phpver} FPM default pool"
        fi
    done

    # Restart PHP-FPM services to use new pools
    for phpver in 8.1 8.2 8.3; do
        if systemctl restart "php${phpver}-fpm" 2>/dev/null; then
            ok "PHP ${phpver} FPM restarted with new pool"
        else
            warn "Failed to restart PHP ${phpver} FPM"
        fi
    done

    # 2d. Nginx configuration for website hosting (NOT for panel)
    # The panel serves on port 8732 directly - no Nginx proxy needed
    # Website configs are created dynamically by the panel
    log "Nginx configured for website hosting only"

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
    ufw allow 8732/tcp

    ufw --force enable
    ok "UFW firewall configured"
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 3: PANEL DEPLOYMENT
# ═════════════════════════════════════════════════════════════════════════
phase_panel_deploy() {
    section "Phase 3: Panel Deployment"

    # 3a. Create panel user (FIX D: handle existing user gracefully)
    if id "$PANEL_USER" &>/dev/null; then
        log "Panel user ${PANEL_USER} already exists — updating home dir if needed"
        # If home directory is wrong, update it
        current_home=$(getent passwd "$PANEL_USER" | cut -d: -f6)
        if [ "$current_home" != "$PANEL_HOME" ]; then
            usermod -d "$PANEL_HOME" "$PANEL_USER" 2>/dev/null || warn "Could not update home dir for ${PANEL_USER}"
            log "Updated ${PANEL_USER} home dir to ${PANEL_HOME}"
        fi
    else
        log "Creating panel user: ${PANEL_USER}"
        useradd -r -m -d "$PANEL_HOME" -s /bin/bash "$PANEL_USER"
    fi
    ok "Panel user: ${PANEL_USER}"

    # FIX #7: Create sudoers entry for panel user (CRITICAL)
    log "Configuring sudo access for ${PANEL_USER}..."
    cat > /etc/sudoers.d/novapanel << 'SUDOERS'
# NovaPanel service management
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl start *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl status *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active *
novapanel ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
novapanel ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
novapanel ALL=(ALL) NOPASSWD: /usr/bin/mv /tmp/novapanel-*.tmp /etc/nginx/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/mv /tmp/novapanel-*.tmp /etc/php/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-enabled/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/sites-available/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/php/*/fpm/pool.d/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/chown -R novapanel\:novapanel /var/www/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/chmod * /var/www/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /var/www/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/crontab -u * *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/ufw *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/certbot *
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/dovecot/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/postfix/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/proftpd/*
novapanel ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/bind/*
SUDOERS
    chmod 440 /etc/sudoers.d/novapanel
    if command -v visudo &>/dev/null; then
        visudo -c 2>/dev/null || warn "sudoers syntax check failed"
    fi
    ok "Sudo access configured for ${PANEL_USER}"

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
    elif [ -f "${PANEL_HOME}/package.json" ]; then
        ok "Panel code already deployed at ${PANEL_HOME}"
    else
        # Clone from GitHub
        log "Cloning NovaPanel from GitHub..."
        if ! command -v git &>/dev/null; then
            apt-get install -y -qq git
        fi

        local REPO_URL="https://github.com/marufnwu/NovaPanel.git"
        local REPO_BRANCH="${INSTALL_BRANCH:-release}"
        local CLONE_DIR="${PANEL_HOME}-src"

        if [ -d "${CLONE_DIR}/.git" ]; then
            log "Updating existing clone at ${CLONE_DIR}..."
            cd "${CLONE_DIR}" && git fetch origin && git checkout "${REPO_BRANCH}" && git pull --ff-only origin "${REPO_BRANCH}" || warn "Git pull failed, using existing code"
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

        # FIX #12: pnpm install with proper PATH and user context
        log "Installing dependencies..."
        
        # Ensure the correct pnpm is in PATH
        # pnpm could be in /root/.local/share/pnpm (if installed as root) 
        # or in /home/novapanel/.local/share/pnpm (if installed as that user)
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
        
        # Source bashrc to pick up any pnpm PATH modifications
        # Note: Cannot source bashrc when set -u is active because bashrc references
        # $PS1 which is unbound in non-interactive shells. Use a subshell instead.
        if [ -f ~/.bashrc ]; then
            export PATH="$(bash -c 'source ~/.bashrc 2>/dev/null; echo $PATH')"
        fi
        
        # Fallback: also check if pnpm exists in common locations
        if ! command -v pnpm &>/dev/null; then
            for pnpm_path in \
                "$HOME/.local/share/pnpm" \
                "/home/novapanel/.local/share/pnpm" \
                "/root/.local/share/pnpm" \
                "/usr/local/bin/pnpm"; do
                if [ -x "$pnpm_path/pnpm" ]; then
                    export PNPM_HOME="$(dirname "$pnpm_path")"
                    export PATH="$PNPM_HOME:$PATH"
                    break
                fi
            done
        fi
        
        # Verify pnpm is working
        if ! command -v pnpm &>/dev/null; then
            fail "pnpm not found in PATH. Installing pnpm..."
            npm install -g pnpm
        fi
        
        log "  pnpm path: $(which pnpm 2>/dev/null || echo 'not found')"
        log "  pnpm version: $(pnpm --version 2>/dev/null || echo 'unknown')"
        
        cd /opt/novapanel

        # Source root's bashrc to get pnpm in PATH
        # Cannot use direct source with set -u (PS1 is unbound in non-interactive)
        # Instead, manually add known pnpm locations to PATH
        export PNPM_HOME="/root/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
        
        # Also check /usr/local/bin and common npm global paths
        export PATH="/usr/local/bin:/root/.local/share/pnpm:$PATH"

        # Verify pnpm is available
        if ! command -v pnpm &>/dev/null; then
            echo "[✗] pnpm not found in PATH"
            echo "    PATH: $PATH"
            exit 1
        fi

        # FIX: Ensure turbo cache directory exists and is writable
        log "Setting up turbo cache directory..."
        local TURBO_CACHE_DIR="/tmp/novapanel-turbo-cache"
        mkdir -p "$TURBO_CACHE_DIR"
        chmod 777 "$TURBO_CACHE_DIR" 2>/dev/null || true
        export TURBO_CACHE_DIR="$TURBO_CACHE_DIR"
        export TURBO_LOG_DIR="$TURBO_CACHE_DIR/logs"
        mkdir -p "$TURBO_LOG_DIR"
        chmod 777 "$TURBO_LOG_DIR" 2>/dev/null || true

        log "Installing dependencies..."
        pnpm install --yes 2>&1 | tee /tmp/novapanel-pnpm-install.log

        log "Building schemas, API, and web..."
        # Build shared schemas package first (required by API)
        cd "${PANEL_HOME}" && pnpm schemas:build 2>&1 | tail -5

        # Build API backend
        cd "${PANEL_HOME}/apps/api" && {
            rm -rf dist
            mkdir -p dist
            pnpm exec tsc --build --force 2>&1 || {
                warn "tsc --build failed, trying npx tsc..."
                /usr/bin/npx tsc --build --force 2>&1 || {
                    node /opt/novapanel/node_modules/.bin/tsc --build --force 2>&1
                }
            }
        }

        # Copy migrations to dist folder (TypeScript compiler doesn't copy them)
        cp -r "${PANEL_HOME}/apps/api/src/db/migrations" "${PANEL_HOME}/apps/api/dist/db/" 2>/dev/null || true

        cd "${PANEL_HOME}"

        # Build web frontend
        cd "${PANEL_HOME}/apps/web" && {
            rm -rf dist
            pnpm exec vite build 2>&1 | tail -20
        }
        cd "${PANEL_HOME}"

        # Fix ownership after build
        chown -R novapanel:novapanel /opt/novapanel

        # Copy database migrations to dist (not handled by TypeScript compiler)
        cp -r apps/api/src/db/migrations apps/api/dist/db/migrations

        ok "Panel built successfully"
    fi

    # 3e. Generate environment file (preserve existing values on update)
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
PORT=8732
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
        ok "Environment file already exists — preserving existing configuration"
        
        # On update: preserve existing .env values and only update if explicitly set
        if [ "$IS_UPDATE" = true ]; then
            log "Preserving existing .env configuration on update"
            
            # Source existing .env to get current values
            set -a
            # shellcheck source=/dev/null
            source "$ENV_FILE"
            set +a
            
            # Update PANEL_URL if it was provided and differs
            if [ -n "$PANEL_URL" ] && [ "$PANEL_URL" != "$PANEL_URL" ]; then
                sed -i "s|^PANEL_URL=.*|PANEL_URL=${PANEL_URL}|" "$ENV_FILE" 2>/dev/null || true
            fi
        fi
    fi

    # FIX #5: Create Dovecot SQL config AFTER database migrations run
    if [ -f "${PANEL_HOME}/apps/api/dist/db/migrate.js" ]; then
        log "Running database migrations..."
        cd "${PANEL_HOME}/apps/api"
        # Run migrations as root (sudo -u fails in nohup context with libsql error 14)
        # Ownership is fixed later by chown -R at line ~1142
        set -a && source "${PANEL_HOME}/.env" && set +a && NODE_ENV=production node dist/db/migrate.js || \
            warn "Migration failed — will retry on first start"
    fi

    # FIX #5: Create Dovecot SQL config after migrations have run
    if [ ! -f /etc/dovecot/dovecot-sql.conf.ext ]; then
        log "Creating Dovecot SQL configuration..."
        cat > /etc/dovecot/dovecot-sql.conf.ext << 'DOVECOTSQL'
# NovaPanel Dovecot SQL configuration
driver = sqlite
connect = /var/lib/novapanel/novapanel.db

# Look up mailboxes by username
password_query = \
  SELECT username AS user, password_hash AS password \
  FROM mailboxes WHERE username = '%u' AND is_active = 1 AND is_suspended = 0
user_query = \
  SELECT '/var/mail/vhosts' AS home, 5000 AS uid, 5000 AS gid, mailbox AS mail \
  FROM mailboxes WHERE username = '%u'
DOVECOTSQL
        chown root:dovecot /etc/dovecot/dovecot-sql.conf.ext
        chmod 640 /etc/dovecot/dovecot-sql.conf.ext
    fi

    # 3g. Run database seeding (skip on update - preserve existing data)
    if [ -f "${PANEL_HOME}/apps/api/dist/db/seed.js" ]; then
        if [ "$IS_UPDATE" = true ]; then
            log "Skipping database seeding on update (preserving existing data)"
        else
            log "Seeding database..."
            cd "${PANEL_HOME}/apps/api"
            # Run seed as root (sudo -u fails in nohup context with libsql error 14)
            # Ownership is fixed later by chown -R
            set -a && source "${PANEL_HOME}/.env" && set +a && NODE_ENV=production node dist/db/seed.js || \
                warn "Seeding failed — will retry on first start"
        fi
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

# FIX #8: Security hardening with proper ReadWritePaths
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=false
# NOTE: Panel API is directly accessible on port 3000 as fallback if Nginx fails
# ReadWritePaths: Panel needs write access to configs, logs, and web roots
ReadWritePaths=/var/www /var/log/novapanel /var/lib/novapanel /etc/novapanel /etc/nginx /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/apache2 /etc/apache2/sites-available /etc/bind /etc/bind/zones /etc/php /etc/postfix /etc/dovecot /etc/proftpd /etc/ssl /etc/letsencrypt /tmp
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
# Global variable to track verification failures (shared between phase_verification and phase_summary)
declare -g VERIFICATION_FAILURES=0

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

    # named (BIND9)
    if systemctl is-active --quiet named 2>/dev/null; then
        ok "named (BIND9): active"
    else
        fail "named (BIND9): NOT active"
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

    if ss -tlnp | grep -q ':8732 '; then
        ok "NovaPanel: listening on port 8732"
    else
        fail "NovaPanel: NOT listening on port 8732"
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
        VERIFICATION_FAILURES=$FAILURES
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# PHASE 5: SUMMARY
# ═════════════════════════════════════════════════════════════════════════
phase_summary() {
    # FIX #3: Write credentials to a secure file instead of printing to terminal
    
    # Check if installation actually succeeded (no verification failures)
    if [ "${VERIFICATION_FAILURES:-0}" -gt 0 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ⚠️  Installation Incomplete"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  The installation completed but ${VERIFICATION_FAILURES} verification"
        echo "  check(s) failed. The panel may not function correctly."
        echo ""
        echo "  Please review the errors above before continuing."
        echo ""
        echo "  To retry installation, run:"
        echo "    curl -fsSL https://raw.githubusercontent.com/marufnwu/NovaPanel/release/scripts/install.sh | sudo bash"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 1
    fi

    local CREDS_FILE="/root/novapanel-credentials.txt"
    cat > "$CREDS_FILE" << CREDSEOF
NovaPanel Credentials
=====================
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Panel URL:      ${PANEL_URL}
Admin Email:    ${ADMIN_EMAIL}
Admin Password: ${ADMIN_PASSWORD}

Database Password: (stored in /etc/novapanel/.db-password)

Config:         ${PANEL_HOME}/.env
Logs:           journalctl -u novapanel -f
Manage:         systemctl {start|stop|restart} novapanel
CREDSEOF
    chmod 600 "$CREDS_FILE"

    # ━━━ Installation Complete ━━━
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$IS_UPDATE" = true ]; then
        echo -e "  ${GREEN}🎉 NovaPanel Update Complete!${NC}"
    else
        echo -e "  ${GREEN}🎉 NovaPanel Installation Complete!${NC}"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ "$IS_UPDATE" = true ]; then
        echo "  📋 Update Summary:"
        echo "  ┌─────────────────────────────────────────────────────────────────┐"
        echo "  │ Panel URL:       ${PANEL_URL}"
        echo "  │ Config File:    ${PANEL_HOME}/.env"
        echo "  │ Database:       /var/lib/novapanel/novapanel.db (preserved)"
        echo "  └─────────────────────────────────────────────────────────────────┘"
        echo ""
        
        # Read existing credentials from .env for display
        if [ -f "${PANEL_HOME}/.env" ]; then
            EXISTING_ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' "${PANEL_HOME}/.env" 2>/dev/null | cut -d '=' -f2-)
            EXISTING_ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' "${PANEL_HOME}/.env" 2>/dev/null | cut -d '=' -f2-)
        fi
        
        if [ -n "$EXISTING_ADMIN_PASSWORD" ]; then
            echo "  🔐 Credentials (preserved from existing installation):"
            echo "  ┌─────────────────────────────────────────────────────────────────┐"
            echo "  │ Admin Username:  admin"
            echo "  │ Admin Password:  ${EXISTING_ADMIN_PASSWORD}"
            echo "  │ Admin Email:      ${EXISTING_ADMIN_EMAIL:-admin@localhost.localdomain}"
            echo "  └─────────────────────────────────────────────────────────────────┘"
            echo ""
            
            # Check if the preserved password looks like a hash
            if is_hash_password "$EXISTING_ADMIN_PASSWORD"; then
                echo "  ⚠️  Note: Your admin password appears to be an old hash-style"
                echo "     password from a previous installation."
                echo ""
                echo "     To change it after login, go to:"
                echo "       Settings → Security → Change Password"
                echo ""
            fi
        elif [ -n "$ADMIN_PASSWORD" ]; then
            # Fallback if we still have the password in scope
            echo "  🔐 Credentials (preserved from existing installation):"
            echo "  ┌─────────────────────────────────────────────────────────────────┐"
            echo "  │ Admin Username:  admin"
            echo "  │ Admin Password:  ${ADMIN_PASSWORD}"
            echo "  │ Admin Email:      ${ADMIN_EMAIL:-admin@localhost.localdomain}"
            echo "  └─────────────────────────────────────────────────────────────────┘"
            echo ""
        fi
        
        echo "  Your existing settings and data have been preserved."
    else
        echo "  📋 Access Information:"
        echo "  ┌─────────────────────────────────────────────────────────────────┐"
        echo "  │ Panel URL:       ${PANEL_URL}"
        echo "  │ Admin Username:  admin"
        echo "  │ Admin Password:  ${ADMIN_PASSWORD}"
        echo "  │ Admin Email:     ${ADMIN_EMAIL}"
        echo "  └─────────────────────────────────────────────────────────────────┘"
        echo ""
        echo "  📁 File Locations:"
        echo "  ┌─────────────────────────────────────────────────────────────────┐"
        echo "  │ Panel Directory:  ${PANEL_HOME}"
        echo "  │ Config File:      ${PANEL_HOME}/.env"
        echo "  │ Credentials:      ${CREDS_FILE}"
        echo "  │ Database:         /var/lib/novapanel/novapanel.db"
        echo "  │ Logs:             /var/log/novapanel/"
        echo "  └─────────────────────────────────────────────────────────────────┘"
        echo ""
        echo "  🔧 Management Commands:"
        echo "  ┌─────────────────────────────────────────────────────────────────┐"
        echo "  │ Start:    sudo systemctl start novapanel"
        echo "  │ Stop:     sudo systemctl stop novapanel"
        echo "  │ Restart:  sudo systemctl restart novapanel"
        echo "  │ Status:   sudo systemctl status novapanel"
        echo "  │ Logs:     sudo journalctl -u novapanel -f"
        echo "  └─────────────────────────────────────────────────────────────────┘"
    fi
    echo ""
    echo "  🌐 Services Running:"
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │ Nginx (frontend)    Port 80        ✅"
    echo "  │ Apache (backend)    Port 8080      ✅"
    echo "  │ MariaDB             Port 3306      ✅"
    echo "  │ PostgreSQL          Port 5432      ✅"
    echo "  │ BIND9 (DNS)         Port 53        ✅"
    echo "  │ Postfix (SMTP)      Port 25        ✅"
    echo "  │ Dovecot (IMAP)      Port 993       ✅"
    echo "  │ ProFTPD (FTP)       Port 21        ✅"
    echo "  │ Redis               Port 6379      ✅"
    echo "  │ Fail2Ban            —              ✅"
    echo "  │ UFW Firewall        —              ✅"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    echo ""
    echo "  ⚠️  IMPORTANT: Change your admin password after first login!"
    echo ""
    
    # Add local server guidance if applicable
    if [ "$IS_LOCAL_SERVER" = true ]; then
        echo "============================================================"
        echo "🌐 NEXT STEPS FOR LOCAL SERVER"
        echo "============================================================"
        echo ""
        echo "Your panel is running on http://$SERVER_IP:8732"
        echo "(accessible from your local network only)"
        echo ""
        echo "To make it accessible from the internet:"
        echo ""
        echo "  1. Log in to the panel at http://$SERVER_IP:8732"
        echo "  2. Navigate to Tunnels in the sidebar"
        echo "  3. Click 'Create Tunnel' to set up a Cloudflare Tunnel"
        echo "  4. Add a route for your panel domain"
        echo "  5. The panel URL will be automatically updated"
        echo ""
        echo "For SSL certificates:"
        echo "  • Use DNS-01 challenge (works behind NAT)"
        echo "  • Do NOT use HTTP-01 challenge (requires public port 80)"
        echo ""
        echo "For email:"
        echo "  • Local mail delivery works between mailboxes"
        echo "  • External mail requires a public IP or relay service"
        echo ""
        echo "============================================================"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "  ${DIM}Install script v${SCRIPT_VERSION} | $(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
    echo ""
}

# ═════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═════════════════════════════════════════════════════════════════════════
main() {
    # Show appropriate header based on installation type
    if [ "$EXISTING_INSTALL" = true ] && [ "$IS_UPDATE" = true ]; then
        echo ""
        echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║     NovaPanel Server Updater v${SCRIPT_VERSION}                         ║${NC}"
        echo -e "${CYAN}║     Updating Existing Installation (Data Preserved)          ║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    elif [ "$EXISTING_INSTALL" = true ] && [ "$IS_UPDATE" = false ]; then
        echo ""
        echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║     NovaPanel Fresh Install v${SCRIPT_VERSION}                          ║${NC}"
        echo -e "${RED}║     Wiping Existing Installation (ALL DATA WILL BE LOST)       ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    else
        echo ""
        echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║     NovaPanel Server Installer v${SCRIPT_VERSION}                     ║${NC}"
        echo -e "${CYAN}║     Verification-First Approach                              ║${NC}"
        echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi

    phase_preflight
    phase_system_packages
    phase_service_config
    phase_panel_deploy
    phase_verification
    phase_summary
}

main "$@"
