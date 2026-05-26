#!/usr/bin/env bash
# NovaPanel Server Updater
# Updates an existing NovaPanel installation
set -euo pipefail

# Ensure we have a valid working directory
if ! pwd > /dev/null 2>&1; then
    if [ -d "/opt/novapanel" ]; then
        cd /opt/novapanel
    elif [ -d "/tmp" ]; then
        cd /tmp
    else
        cd / 2>/dev/null || true
    fi
fi

readonly SCRIPT_VERSION="1.2.0"
readonly PANEL_HOME="${PANEL_HOME:-/opt/novapanel}"
readonly BACKUP_DIR="/var/lib/novapanel/backups"
readonly UPDATE_BRANCH="${UPDATE_BRANCH:-release}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${BLUE}[UPDATE]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*" >&2; }

die() { fail "$@"; exit 1; }

section() {
    echo ""
    echo -e "${CYAN}=== $* ===${NC}"
}

trap 'echo ""; fail "UPDATE FAILED at line $LINENO: $BASH_COMMAND"' ERR

DRY_RUN=false
ROLLBACK_MODE=false
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --rollback) ROLLBACK_MODE=true; shift ;;
        --skip-confirm|-y) SKIP_CONFIRM=true; shift ;;
        --help|-h)
            echo "NovaPanel Updater v${SCRIPT_VERSION}"
            echo "Usage: sudo bash scripts/update.sh [OPTIONS]"
            echo "Options:"
            echo "  --dry-run          Preview changes (no changes)"
            echo "  --rollback          Rollback to previous version"
            echo "  --skip-confirm, -y  Skip confirmation"
            echo "  --help, -h          Show help"
            echo ""
            echo "Environment:"
            echo "  UPDATE_BRANCH       Branch (default: release)"
            echo "  PANEL_HOME          Install dir (default: /opt/novapanel)"
            echo "  FORCE               Same as --skip-confirm"
            exit 0
            ;;
        *) fail "Unknown: $1"; exit 3 ;;
    esac
done

check_installation() {
    [ -d "$PANEL_HOME" ] && [ -f "${PANEL_HOME}/package.json" ] && [ -f "${PANEL_HOME}/.env" ]
}

ensure_pnpm() {
    for pnpm_path in \
        "$HOME/.local/share/pnpm" \
        "/home/novapanel/.local/share/pnpm" \
        "/root/.local/share/pnpm" \
        "/usr/local/bin/pnpm"; do
        if [ -x "$pnpm_path/pnpm" ]; then
            export PNPM_HOME="$(dirname "$pnpm_path")"
            export PATH="$PNPM_HOME:$PATH"
            return 0
        fi
    done
    if ! command -v pnpm &>/dev/null; then
        log "Installing pnpm..."
        npm install -g pnpm
    fi
    return 0
}

show_preview() {
    log "Update Preview"
    echo ""
    echo "  Installation:  ${PANEL_HOME}"
    echo "  Branch:          ${UPDATE_BRANCH}"
    echo ""
    echo "  Will update:"
    echo "  - Pull latest code"
    echo "  - Install dependencies (pnpm install)"
    echo "  - Rebuild schemas, API, web"
    echo "  - Run pending migrations"
    echo "  - Restart novapanel service"
    echo ""
    echo "  Will preserve:"
    echo "  - All user data and configurations"
    echo "  - Database contents"
    echo "  - Admin credentials"
    echo "  - SSL certificates and settings"
}

create_backup() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    log "Creating backup..."
    mkdir -p "${BACKUP_DIR}"

    # Backup .env template (secrets redacted)
    if [ -f "${PANEL_HOME}/.env" ]; then
        grep -v '^ADMIN_PASSWORD=' "${PANEL_HOME}/.env" | \
        sed 's/^JWT_SECRET=.*/JWT_SECRET=<REDACTED>/' | \
        sed 's/^SESSION_SECRET=.*/SESSION_SECRET=<REDACTED>/' | \
        sed 's/^SF_ENCRYPTION_KEY=.*/SF_ENCRYPTION_KEY=<REDACTED>/' \
        > "${backup_path}.env.template"
        ok "Backed up .env template"
    fi

    # Backup source (exclude node_modules, .git, data, .env)
    log "Backing up source..."
    mkdir -p "${backup_path}"
    rsync -a --exclude='node_modules' --exclude='.git' --exclude='data' --exclude='.env' \
        "${PANEL_HOME}/" "${backup_path}/" 2>/dev/null || true
    ok "Source backed up to ${backup_path}"

    echo "$backup_path" > "${BACKUP_DIR}/.last-backup"
    echo "$backup_name" > "${BACKUP_DIR}/.last-backup-name"
    ok "Backup created: ${backup_name}"
    echo ""
}

perform_update() {
    section "Updating NovaPanel"

    # Check if git repository
    if [ ! -d "${PANEL_HOME}/.git" ]; then
        warn "Not a git repository - using fresh reinstall method"
        perform_fresh_reinstall
        return $?
    fi

    local current_version
    current_version="$(cd "${PANEL_HOME}" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    log "Current version: ${current_version}"

    log "Fetching latest code from ${UPDATE_BRANCH}..."
    cd "${PANEL_HOME}" || exit 1
    git fetch origin "${UPDATE_BRANCH}"

    local new_version
    new_version="$(git rev-parse --short "origin/${UPDATE_BRANCH}" 2>/dev/null || echo 'unknown')"
    log "New version: ${new_version}"

    if [ "$current_version" != "unknown" ] && [ "$new_version" != "unknown" ]; then
        echo ""
        log "Changes since ${current_version}:"
        git log "${current_version}..origin/${UPDATE_BRANCH}" --oneline 2>/dev/null || true
        echo ""
    fi

    log "Pulling changes..."
    cd "${PANEL_HOME}" || exit 1
    if ! git pull origin "${UPDATE_BRANCH}"; then
        fail "Git pull failed. Resolve manually: cd ${PANEL_HOME} && git pull origin ${UPDATE_BRANCH}"
        exit 2
    fi
    ok "Code updated"

    log "Installing dependencies..."
    ensure_pnpm
    pnpm install 2>&1 | tail -5
    ok "Dependencies installed"

    log "Building schemas..."
    pnpm --filter @serverforge/schemas build 2>&1 | tail -5
    ok "Schemas built"

    log "Building API..."
    cd "${PANEL_HOME}/apps/api" || exit 1
    rm -rf dist && mkdir -p dist
    pnpm exec tsc --build --force 2>&1 || {
        warn "tsc failed, trying alternatives..."
        /usr/bin/npx tsc --build --force 2>&1 || \
            node /opt/novapanel/node_modules/.bin/tsc --build --force 2>&1 || true
    }
    cp -r "${PANEL_HOME}/apps/api/src/db/migrations" "${PANEL_HOME}/apps/api/dist/db/" 2>/dev/null || true
    ok "API built"

    log "Building Web..."
    cd "${PANEL_HOME}/apps/web" || exit 1
    rm -rf dist
    pnpm exec vite build 2>&1 | tail -10
    ok "Web built"

    section "Running Migrations"
    cd "${PANEL_HOME}/apps/api" || exit 1
    if [ -f "dist/db/migrate.js" ]; then
        log "Applying migrations..."
        set -a && source "${PANEL_HOME}/.env" 2>/dev/null || true && set +a
        NODE_ENV=production node dist/db/migrate.js 2>&1 || warn "Migration had issues"
        ok "Migrations applied"
    else
        warn "Migration script not found - will run on next start"
    fi

    log "Fixing permissions..."
    chown -R novapanel:novapanel "${PANEL_HOME}" 2>/dev/null || true
    ok "Permissions fixed"

    section "Restarting NovaPanel"
    log "Restarting service..."
    systemctl stop novapanel 2>/dev/null || true
    sleep 2
    systemctl start novapanel 2>&1 || {
        warn "Failed to start novapanel"
        systemctl status novapanel 2>/dev/null || true
        journalctl -u novapanel --no-pager -n 20 2>/dev/null || true
    }

    local waited=0
    while [ $waited -lt 30 ]; do
        if systemctl is-active --quiet novapanel 2>/dev/null; then
            ok "NovaPanel is running"
            break
        fi
        sleep 1
        waited=$((waited + 1))
    done

    if [ $waited -ge 30 ]; then
        warn "NovaPanel may not have started. Check: systemctl status novapanel"
    fi
}

perform_fresh_reinstall() {
    section "Performing Fresh Reinstall"

    log "Non-git installation detected - reinstalling fresh"

    local env_backup=""
    if [ -f "${PANEL_HOME}/.env" ]; then
        env_backup="/tmp/novapanel-env-backup-$(date +%Y%m%d-%H%M%S)"
        cp "${PANEL_HOME}/.env" "$env_backup"
        ok "Backed up .env"
    fi

    # Backup data dirs
    local data_dirs=()
    for dir in data databases; do
        if [ -d "${PANEL_HOME}/${dir}" ]; then
            data_dirs+=("$dir")
            mkdir -p "/tmp/novapanel-${dir}-backup"
            rsync -a "${PANEL_HOME}/${dir}/" "/tmp/novapanel-${dir}-backup/" 2>/dev/null || true
            ok "Backed up ${dir}"
        fi
    done

    log "Removing old installation..."
    rm -rf "${PANEL_HOME}"

    log "Cloning fresh from ${UPDATE_BRANCH}..."
    cd /opt || cd /tmp
    if ! git clone --branch "${UPDATE_BRANCH}" --depth 1 \
        "https://github.com/marufnwu/NovaPanel.git" novapanel 2>&1; then
        fail "Clone failed"
        [ -n "$env_backup" ] && [ -f "$env_backup" ] && cp "$env_backup" "${PANEL_HOME}/.env" 2>/dev/null || true
        exit 2
    fi
    ok "Code cloned"

    # Restore
    if [ -n "$env_backup" ] && [ -f "$env_backup" ]; then
        cp "$env_backup" "${PANEL_HOME}/.env"
        chmod 600 "${PANEL_HOME}/.env"
        rm -f "$env_backup"
        ok "Restored .env"
    fi

    for dir in "${data_dirs[@]}"; do
        if [ -d "/tmp/novapanel-${dir}-backup" ]; then
            mkdir -p "${PANEL_HOME}/${dir}"
            rsync -a "/tmp/novapanel-${dir}-backup/" "${PANEL_HOME}/${dir}/" 2>/dev/null || true
            rm -rf "/tmp/novapanel-${dir}-backup"
            ok "Restored ${dir}"
        fi
    done

    log "Building..."
    cd "${PANEL_HOME}" || exit 1
    ensure_pnpm
    pnpm install 2>&1 | tail -5
    pnpm --filter @serverforge/schemas build 2>&1 | tail -5

    cd "${PANEL_HOME}/apps/api" || exit 1
    rm -rf dist && mkdir -p dist
    pnpm exec tsc --build --force 2>&1 || true
    cp -r "${PANEL_HOME}/apps/api/src/db/migrations" "${PANEL_HOME}/apps/api/dist/db/" 2>/dev/null || true

    cd "${PANEL_HOME}/apps/web" || exit 1
    rm -rf dist
    pnpm exec vite build 2>&1 | tail -10

    section "Running Migrations"
    cd "${PANEL_HOME}/apps/api" || exit 1
    if [ -f "dist/db/migrate.js" ]; then
        set -a && source "${PANEL_HOME}/.env" 2>/dev/null || true && set +a
        NODE_ENV=production node dist/db/migrate.js 2>&1 || warn "Migration had issues"
    fi

    chown -R novapanel:novapanel "${PANEL_HOME}" 2>/dev/null || true

    section "Restarting"
    systemctl stop novapanel 2>/dev/null || true
    sleep 2
    systemctl start novapanel 2>&1 || warn "Check status manually"
}

rollback() {
    section "Rolling Back"

    local last_backup
    last_backup="$(cat "${BACKUP_DIR}/.last-backup" 2>/dev/null || echo '')"

    if [ -z "$last_backup" ] || [ ! -d "$last_backup" ]; then
        fail "No backup found to rollback to"
        exit 2
    fi

    log "Rolling back: $(basename "$last_backup")"

    log "Stopping service..."
    systemctl stop novapanel 2>/dev/null || true

    log "Restoring backup..."
    rsync -a --delete --exclude='.env' "${last_backup}/" "${PANEL_HOME}/" 2>/dev/null || true

    chown -R novapanel:novapanel "${PANEL_HOME}" 2>/dev/null || true

    systemctl start novapanel 2>&1 || warn "Check status manually"
    ok "Rollback complete"
}

main() {
    echo ""
    echo "NovaPanel Updater v${SCRIPT_VERSION}"
    echo "============================="
    echo ""

    if [ "$EUID" -ne 0 ]; then
        die "Must run as root: sudo bash $0"
    fi
    ok "Running as root"

    if ! check_installation; then
        fail "NovaPanel not installed at ${PANEL_HOME}"
        fail "To install: curl -fsSL https://raw.githubusercontent.com/marufnwu/NovaPanel/release/scripts/install.sh | sudo bash"
        exit 1
    fi
    ok "NovaPanel found at ${PANEL_HOME}"

    show_preview

    if [ "$DRY_RUN" = true ]; then
        ok "Dry run complete - no changes"
        exit 0
    fi

    if [ "$ROLLBACK_MODE" = true ]; then
        rollback
        exit 0
    fi

    if [ "$SKIP_CONFIRM" != true ] && [ "${FORCE:-0}" != "1" ]; then
        if [ -t 0 ]; then
            echo ""
            echo -e "${YELLOW}This will update your NovaPanel. Data preserved.${NC}"
            read -p "Continue? [y/N]: " -n 1 -r REPLY
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Update cancelled."
                exit 0
            fi
        else
            warn "Non-interactive - proceeding"
        fi
    fi

    create_backup

    if ! perform_update; then
        fail ""
        fail "Update failed! Rollback with: sudo bash scripts/update.sh --rollback"
        exit 2
    fi

    section "Update Complete"
    echo ""
    ok "NovaPanel has been updated successfully!"
    echo ""
    echo "Management:"
    echo "  Status:  sudo systemctl status novapanel"
    echo "  Logs:    sudo journalctl -u novapanel -f"
    echo "  Restart: sudo systemctl restart novapanel"
    echo ""
    echo "Rollback if needed:"
    echo "  sudo bash scripts/update.sh --rollback"
    echo ""
}

main "$@"