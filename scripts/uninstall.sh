#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  NovaPanel Uninstaller                                               ║
# ║                                                                      ║
# ║  Safely removes NovaPanel from a server.                             ║
# ║  Default: preserves user data (/var/www/) and databases              ║
# ║  Use --purge to remove all data                                      ║
# ║                                                                      ║
# ║  Usage:                                                              ║
# ║    sudo bash scripts/uninstall.sh                                    ║
# ║    sudo bash scripts/uninstall.sh --confirm                          ║
# ║    sudo bash scripts/uninstall.sh --confirm --purge                  ║
# ║    sudo bash scripts/uninstall.sh --confirm --purge --remove-packages║
# ║                                                                      ║
# ║  Flags:                                                              ║
# ║    --confirm        Skip confirmation prompts                        ║
# ║    --purge          Remove databases and all website data            ║
# ║    --remove-packages Remove system packages (nginx, php, etc.)       ║
# ║    --help           Show this help message                           ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────
readonly PANEL_USER="novapanel"
readonly PANEL_HOME="/opt/novapanel"
readonly PANEL_SERVICE="novapanel"

# ─── Arguments ───────────────────────────────────────────────────────────
CONFIRM=false
PURGE=false
REMOVE_PACKAGES=false

show_help() {
    head -32 "$0" | tail -27
    exit 0
}

for arg in "$@"; do
    case $arg in
        --confirm) CONFIRM=true ;;
        --purge) PURGE=true ;;
        --remove-packages) REMOVE_PACKAGES=true ;;
        --help) show_help ;;
    esac
done

# ─── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()   { echo -e "${BLUE}[UNINSTALL]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[⚠]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*" >&2; }
section(){ echo ""; echo -e "${CYAN}━━━ $* ━━━${NC}"; }

die() {
    fail "$@"
    exit 1
}

# ─── Check: Root ──────────────────────────────────────────────────────────
check_root() {
    if [ "$EUID" -ne 0 ]; then
        die "This script must be run as root. Use: sudo bash $0"
    fi
}

# ─── Check: Panel installed ───────────────────────────────────────────────
check_installed() {
    if [ ! -d "$PANEL_HOME" ] && [ ! -f "/etc/systemd/system/${PANEL_SERVICE}.service" ]; then
        warn "NovaPanel does not appear to be installed."
        warn "No panel files found at ${PANEL_HOME} and no systemd service found."
        log "If you want to clean up anyway, you can remove files manually:"
        log "  rm -rf /opt/novapanel /etc/novapanel /var/lib/novapanel"
        log "  rm -f /etc/systemd/system/novapanel.service"
        log "  userdel -r novapanel 2>/dev/null || true"
        exit 0
    fi
}

# ─── Show what will be removed ───────────────────────────────────────────
show_changes() {
    section "Removal Summary"

    echo -e "  ${GREEN}Will be removed:${NC}"
    echo -e "    • ${BOLD}${PANEL_SERVICE}${NC} systemd service (stopped & disabled)"
    echo -e "    • ${BOLD}/etc/systemd/system/${PANEL_SERVICE}.service${NC}"
    echo -e "    • ${BOLD}${PANEL_HOME}${NC} (panel application files)"
    echo -e "    • ${BOLD}${PANEL_USER}${NC} user and home directory"
    echo -e "    • ${BOLD}/etc/sudoers.d/novapanel${NC}"
    echo -e "    • ${BOLD}/etc/nginx/sites-available/novapanel${NC}"
    echo -e "    • ${BOLD}/etc/nginx/sites-enabled/novapanel${NC}"
    echo -e "    • ${BOLD}/etc/novapanel/${NC} (configuration)"
    echo -e "    • ${BOLD}/var/log/novapanel/${NC}"
    echo -e "    • ${BOLD}/var/lib/novapanel/${NC} (SQLite database)"
    echo -e "    • ${BOLD}/root/novapanel-credentials.txt${NC}"

    if systemctl list-unit-files | grep -q "ufw.service"; then
        echo -e "    • ${BOLD}UFW rule for port 8732${NC}"
    fi

    if [ "$PURGE" = true ]; then
        echo ""
        echo -e "  ${RED}PURGE MODE — Additional data will be removed:${NC}"
        echo -e "    • ${RED}MariaDB 'novapanel' database${NC}"
        echo -e "    • ${RED}PostgreSQL 'novapanel' database${NC}"
        echo -e "    • ${RED}/var/www/vhosts/${NC} (all website data)"
        echo -e "    • ${RED}/var/www/html/${NC} (web root)"
        echo -e "    • ${RED}PHP-FPM pool configs created by NovaPanel${NC}"
        echo -e "    • ${RED}Nginx vhost configs created by NovaPanel${NC}"
        echo -e "    • ${RED}Apache vhost configs created by NovaPanel${NC}"
        echo -e "    • ${RED}BIND9 zone files created by NovaPanel${NC}"
    fi

    if [ "$REMOVE_PACKAGES" = true ]; then
        echo ""
        echo -e "  ${RED}PACKAGE REMOVAL — System packages will be uninstalled:${NC}"
        echo -e "    • nginx, php-*-fpm, mariadb-server, postgresql-*, redis-server"
        echo -e "    • apache2, bind9, postfix, dovecot-core, proftpd-basic"
        echo -e "    • This may break other services using these packages!"
    fi

    echo ""
    echo -e "  ${YELLOW}PRESERVED (by default):${NC}"
    echo -e "    • Website data in ${BOLD}/var/www/${NC}"
    echo -e "    • Databases (MariaDB/PostgreSQL)"
    echo -e "    • System packages"
    echo ""
}

# ─── Confirm action ──────────────────────────────────────────────────────
confirm() {
    if [ "$CONFIRM" = true ]; then
        log "Running in non-interactive mode (--confirm passed)"
        return 0
    fi

    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║        WARNING: This will remove NovaPanel!                  ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}DO NOT interrupt this script once it begins.${NC}"
    echo ""

    read -r -p "Are you sure you want to uninstall NovaPanel? [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            echo "Aborted."
            exit 0
            ;;
    esac
}

# ═════════════════════════════════════════════════════════════════════════
# REMOVAL FUNCTIONS
# ═════════════════════════════════════════════════════════════════════════

remove_service() {
    section "Stopping Services"

    log "Stopping ${PANEL_SERVICE} service..."
    if systemctl is-active --quiet "$PANEL_SERVICE" 2>/dev/null; then
        systemctl stop "$PANEL_SERVICE" 2>/dev/null || warn "Failed to stop ${PANEL_SERVICE}"
    fi
    ok "${PANEL_SERVICE} stopped"

    log "Disabling ${PANEL_SERVICE} service..."
    if systemctl is-enabled --quiet "$PANEL_SERVICE" 2>/dev/null; then
        systemctl disable "$PANEL_SERVICE" 2>/dev/null || warn "Failed to disable ${PANEL_SERVICE}"
    fi
    ok "${PANEL_SERVICE} disabled"

    log "Removing systemd service file..."
    rm -f "/etc/systemd/system/${PANEL_SERVICE}.service"
    systemctl daemon-reload 2>/dev/null || true
    ok "Systemd service removed"
}

remove_panel_files() {
    section "Removing Panel Files"

    log "Removing ${PANEL_HOME}..."
    if [ -d "$PANEL_HOME" ]; then
        rm -rf "$PANEL_HOME"
        ok "Panel home directory removed"
    else
        ok "Panel home directory not found (already removed?)"
    fi
}

remove_user() {
    section "Removing Panel User"

    log "Removing user ${PANEL_USER}..."
    if id "$PANEL_USER" &>/dev/null; then
        userdel -r "$PANEL_USER" 2>/dev/null || {
            warn "userdel failed, trying manual cleanup..."
            # Fallback: remove home directory manually
            rm -rf "/home/${PANEL_USER}" 2>/dev/null || true
            # Remove from shadow/group files manually if needed
            sed -i "/^${PANEL_USER}:/d" /etc/passwd 2>/dev/null || true
            sed -i "/^${PANEL_USER}:/d" /etc/shadow 2>/dev/null || true
            sed -i "/^${PANEL_USER}:/d" /etc/group 2>/dev/null || true
        }
        ok "User ${PANEL_USER} removed"
    else
        ok "User ${PANEL_USER} does not exist"
    fi

    log "Removing sudoers entry..."
    rm -f /etc/sudoers.d/novapanel
    # Validate sudoers
    if command -v visudo &>/dev/null; then
        visudo -c 2>/dev/null || warn "sudoers validation failed"
    fi
    ok "Sudoers entry removed"
}

remove_webserver_configs() {
    section "Cleaning Web Server Configurations"

    log "Removing Nginx site configuration..."
    rm -f /etc/nginx/sites-available/novapanel
    rm -f /etc/nginx/sites-enabled/novapanel

    log "Reloading Nginx..."
    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || warn "Failed to reload nginx"
        ok "Nginx reloaded"
    else
        warn "Nginx config test failed, skipping reload"
    fi

    # Remove panel-created nginx configs
    if [ -d /etc/nginx/sites-enabled ]; then
        for f in /etc/nginx/sites-enabled/novapanel-*; do
            [ -f "$f" ] && rm -f "$f" && log "Removed nginx config: $f"
        done
    fi

    # Remove panel-created PHP-FPM pool configs
    for pool_dir in /etc/php/*/fpm/pool.d; do
        if [ -d "$pool_dir" ]; then
            for f in "$pool_dir"/novapanel-*; do
                [ -f "$f" ] && rm -f "$f" && log "Removed PHP-FPM pool: $f"
            done
        fi
    done

    # Remove panel-created Apache configs
    if [ -d /etc/apache2/sites-available ]; then
        for f in /etc/apache2/sites-available/novapanel-*; do
            [ -f "$f" ] && rm -f "$f" && log "Removed Apache config: $f"
        done
    fi
    if [ -d /etc/apache2/sites-enabled ]; then
        for f in /etc/apache2/sites-enabled/novapanel-*; do
            [ -f "$f" ] && rm -f "$f" && log "Removed Apache enabled: $f"
        done
    fi

    # Restart web services
    systemctl reload nginx 2>/dev/null || true
    if systemctl is-active --quiet apache2 2>/dev/null; then
        systemctl restart apache2 2>/dev/null || true
    fi

    ok "Web server configs cleaned"
}

remove_dns_configs() {
    section "Cleaning DNS Configurations"

    # Remove panel-created BIND9 zone files
    if [ -d /etc/bind/zones ]; then
        for f in /etc/bind/zones/novapanel-*; do
            [ -f "$f" ] && rm -f "$f" && log "Removed BIND zone: $f"
        done
    fi

    # Remove panel-created named.conf entries
    if [ -f /etc/bind/named.conf.local ]; then
        # Remove include lines for novapanel zones
        sed -i '/novapanel-/d' /etc/bind/named.conf.local 2>/dev/null || true
    fi

    if systemctl is-active --quiet named 2>/dev/null; then
        named-checkconf 2>/dev/null && systemctl reload named 2>/dev/null || true
    fi

    ok "DNS configs cleaned"
}

remove_panel_data() {
    section "Removing Panel Data"

    log "Removing /etc/novapanel/..."
    rm -rf /etc/novapanel/
    ok "/etc/novapanel/ removed"

    log "Removing /var/log/novapanel/..."
    rm -rf /var/log/novapanel/
    ok "/var/log/novapanel/ removed"

    log "Removing /var/lib/novapanel/..."
    rm -rf /var/lib/novapanel/
    ok "/var/lib/novapanel/ removed"

    log "Removing credentials file..."
    rm -f /root/novapanel-credentials.txt
    ok "Credentials file removed"

    log "Removing UFW rule for port 8732..."
    if command -v ufw &>/dev/null; then
        ufw delete allow 8732/tcp 2>/dev/null || true
    fi
    ok "UFW rule removed"
}

remove_databases() {
    section "Removing Databases (PURGE)"

    # MariaDB
    log "Dropping MariaDB 'novapanel' database..."
    if command -v mariadb &>/dev/null; then
        # Try to connect with existing credentials
        if [ -f /etc/novapanel/.db-password ]; then
            local DB_PASS
            DB_PASS="$(cat /etc/novapanel/.db-password 2>/dev/null || echo '')"
            if [ -n "$DB_PASS" ]; then
                mariadb -u root -p"$DB_PASS" -e "DROP DATABASE IF EXISTS novapanel;" 2>/dev/null && \
                    ok "MariaDB database dropped" || warn "Could not drop MariaDB database"
            fi
        else
            mariadb -u root -e "DROP DATABASE IF EXISTS novapanel;" 2>/dev/null && \
                ok "MariaDB database dropped" || warn "Could not drop MariaDB database (no password)"
        fi
    else
        warn "MariaDB not installed"
    fi

    # PostgreSQL
    log "Dropping PostgreSQL 'novapanel' database..."
    if command -v psql &>/dev/null; then
        if [ -f /etc/novapanel/.pg-password ]; then
            local PG_PASS
            PG_PASS="$(cat /etc/novapanel/.pg-password 2>/dev/null || echo '')"
            if [ -n "$PG_PASS" ]; then
                su - postgres -c "psql -U postgres -c \"DROP DATABASE IF EXISTS novapanel;\"" 2>/dev/null && \
                    ok "PostgreSQL database dropped" || warn "Could not drop PostgreSQL database"
            fi
        else
            su - postgres -c "psql -U postgres -c \"DROP DATABASE IF EXISTS novapanel;\"" 2>/dev/null && \
                ok "PostgreSQL database dropped" || warn "Could not drop PostgreSQL database (no password)"
        fi
    else
        warn "PostgreSQL not installed"
    fi
}

remove_website_data() {
    section "Removing Website Data (PURGE)"

    log "Removing /var/www/vhosts/..."
    if [ -d /var/www/vhosts ]; then
        rm -rf /var/www/vhosts/*
        ok "Website data removed"
    else
        ok "No vhosts directory found"
    fi

    log "Removing /var/www/html/..."
    if [ -d /var/www/html ]; then
        rm -rf /var/www/html/*
        ok "Web root cleared"
    else
        ok "No html directory found"
    fi
}

remove_packages() {
    section "Removing System Packages"

    # Prevent interactive configuration dialogs
    export DEBIAN_FRONTEND=noninteractive

    warn "Removing packages may break other services!"
    log "Press Ctrl+C to cancel, or wait 5 seconds to continue..."

    sleep 5

    local packages=(
        nginx nginx-common
        php8.1-fpm php8.2-fpm php8.3-fpm
        php8.1-cli php8.2-cli php8.3-cli
        php8.1-common php8.2-common php8.3-common
        php8.1-mysql php8.2-mysql php8.3-mysql
        php8.1-pgsql php8.2-pgsql php8.3-pgsql
        php8.1-sqlite3 php8.2-sqlite3 php8.3-sqlite3
        php8.1-gd php8.2-gd php8.3-gd
        php8.1-curl php8.2-curl php8.3-curl
        php8.1-mbstring php8.2-mbstring php8.3-mbstring
        php8.1-xml php8.2-xml php8.3-xml
        php8.1-zip php8.2-zip php8.3-zip
        php8.1-bcmath php8.2-bcmath php8.3-bcmath
        php8.1-intl php8.2-intl php8.3-intl
        mariadb-server mariadb-client
        postgresql-16 postgresql-contrib-16
        redis-server
        apache2 apache2-utils apache2-bin
        bind9 bind9utils dnsutils
        postfix dovecot-core dovecot-imapd dovecot-pop3d
        proftpd-basic
        certbot python3-certbot-nginx python3-certbot-apache
        fail2ban
    )

    # Only remove packages that are installed
    local to_remove=()
    for pkg in "${packages[@]}"; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            to_remove+=("$pkg")
        fi
    done

    if [ ${#to_remove[@]} -gt 0 ]; then
        log "Removing ${#to_remove[@]} packages..."
        DEBIAN_FRONTEND=noninteractive apt-get remove -y --purge "${to_remove[@]}" 2>/dev/null || warn "Some packages could not be removed"
        DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
        ok "Packages removed"
    else
        ok "No NovaPanel packages found to remove"
    fi
}

# ═════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           NovaPanel Uninstaller                             ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    check_installed
    show_changes
    confirm

    remove_service
    remove_panel_files
    remove_user
    remove_webserver_configs
    remove_dns_configs
    remove_panel_data

    if [ "$PURGE" = true ]; then
        remove_databases
        remove_website_data
    fi

    if [ "$REMOVE_PACKAGES" = true ]; then
        remove_packages
    fi

    section "Uninstall Complete"

    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║         NovaPanel has been removed                          ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$PURGE" = false ]; then
        echo -e "  ${YELLOW}Note:${NC} Website data in /var/www/ was preserved."
        echo -e "  ${YELLOW}Note:${NC} Databases were preserved."
        echo "  To remove all data, run with --purge flag:"
        echo "    sudo bash scripts/uninstall.sh --confirm --purge"
    fi

    echo ""
    echo -e "  ${DIM}Uninstall completed at $(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
    echo ""
}

main "$@"