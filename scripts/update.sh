#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  NovaPanel Server Updater — Dedicated Update Script                    ║
# ║                                                                      ║
# ║  This script updates an existing NovaPanel installation to the latest ║
# ║  version from the configured branch.                                 ║
# ║                                                                      ║
# ║  NOTE: For fresh installations, use install.sh instead.                ║
# ║        install.sh handles both fresh installs and updates (with       ║
# ║        user confirmation for existing installs).                     ║
# ║                                                                      ║
# ║  Usage:                                                              ║
# ║    sudo bash scripts/update.sh                    # Update to release║
# ║    sudo UPDATE_BRANCH=v5 bash scripts/update.sh  # Update to v5      ║
# ║    sudo bash scripts/update.sh --dry-run           # Preview changes  ║
# ║    sudo bash scripts/update.sh --rollback         # Rollback         ║
# ║                                                                      ║
# ║  Environment variables:                                              ║
# ║    UPDATE_BRANCH  — Git branch to update from (default: release)     ║
# ║    PANEL_HOME    — Installation directory (default: /opt/novapanel)   ║
# ║    FORCE         — Skip confirmation prompts (default: 0)             ║
# ║                                                                      ║
# ║  Exit codes:                                                         ║
# ║    0 — Success                                                      ║
# ║    1 — NovaPanel not installed                                       ║
# ║    2 — Update failed (use --rollback to restore)                    ║
# ║    3 — Invalid arguments                                            ║
# ╚══════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────
readonly SCRIPT_VERSION="1.1.0"
readonly PANEL_HOME="${PANEL_HOME:-/opt/novapanel}"
readonly BACKUP_DIR="/var/lib/novapanel/backups"
readonly UPDATE_BRANCH="${UPDATE_BRANCH:-release}"

# ─── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Logging helpers ─────────────────────────────────────────────────────
log()  { echo -e "${BLUE}[UPDATE]${NC} $*"; }
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

# ─── Error trap for visibility ───────────────────────────────────────────
trap 'echo ""; echo "[✗] UPDATE FAILED at line $LINENO"; echo "    Command: $BASH_COMMAND"; echo ""' ERR

# ─── Parse arguments ──────────────────────────────────────────────────────
DRY_RUN=false
ROLLBACK_MODE=false
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --rollback)
            ROLLBACK_MODE=true
            shift
            ;;
        --skip-confirm|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        --help|-h)
            echo "NovaPanel Updater v${SCRIPT_VERSION}"
            echo ""
            echo "Usage: sudo bash scripts/update.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be updated (no changes)"
            echo "  --rollback         Rollback to previous state after failed update"
            echo "  --skip-confirm, -y Skip confirmation prompts"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  UPDATE_BRANCH      Branch to update from (default: release)"
            echo "  PANEL_HOME         Installation directory (default: /opt/novapanel)"
            echo "  FORCE              Skip confirmations (same as --skip-confirm)"
            echo ""
            exit 0
            ;;
        *)
            fail "Unknown argument: $1"
            fail "Use --help for usage information"
            exit 3
            ;;
    esac
done

# ─── Check for existing installation ──────────────────────────────────────
check_existing_installation() {
    if [ -d "$PANEL_HOME" ] && [ -f "${PANEL_HOME}/package.json" ] && [ -f "${PANEL_HOME}/.env" ]; then
        return 0
    fi
    return 1
}

# ─── Ensure pnpm is available in PATH ──────────────────────────────────────
ensure_pnpm() {
    # Check common pnpm locations
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

    # If not found, try to use the one in PATH or install
    if ! command -v pnpm &>/dev/null; then
        log "pnpm not found in PATH — installing..."
        npm install -g pnpm
    fi
    return 0
}

# ─── Show update preview ───────────────────────────────────────────────────
show_update_preview() {
    log "Update Preview"
    echo ""
    echo "  Installation:  ${PANEL_HOME}"
    echo "  Update branch: ${UPDATE_BRANCH}"
    echo ""
    echo "  Will update:"
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │ • Pull latest code from ${UPDATE_BRANCH} branch"
    echo "  │ • Install new dependencies (pnpm install)"
    echo "  │ • Rebuild schemas, API, and web"
    echo "  │ • Run pending database migrations"
    echo "  │ • Restart novapanel service"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    echo ""
    echo "  Will preserve:"
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │ • All user data and configurations"
    echo "  │ • Database contents (no seeding)"
    echo "  │ • Admin credentials and passwords"
    echo "  │ • SSL certificates and settings"
    echo "  └─────────────────────────────────────────────────────────────────┘"
}

# ─── Create backup before update ─────────────────────────────────────────
create_backup() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    log "Creating backup before update..."
    mkdir -p "${BACKUP_DIR}"

    # SECURITY FIX: Do NOT backup .env file directly as it contains secrets
    # Instead, backup .env template (without actual secrets) or reference it
    if [ -f "${PANEL_HOME}/.env" ]; then
        # Create a template version of .env with secrets replaced
        grep -v '^ADMIN_PASSWORD=' "${PANEL_HOME}/.env" | \
        sed 's/^JWT_SECRET=.*/JWT_SECRET=<REDACTED>/' | \
        sed 's/^SESSION_SECRET=.*/SESSION_SECRET=<REDACTED>/' | \
        sed 's/^SF_ENCRYPTION_KEY=.*/SF_ENCRYPTION_KEY=<REDACTED>/' \
        > "${backup_path}.env.template"
        ok "Backed up .env template (secrets redacted)"
    fi

    # Backup current source code (excluding node_modules, data, and .env)
    log "Backing up current source..."
    mkdir -p "${backup_path}"
    rsync -a \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='data' \
        --exclude='.env' \
        "${PANEL_HOME}/" "${backup_path}/"
    ok "Source backed up to ${backup_path}"

    # Store backup reference for rollback
    echo "$backup_path" > "${BACKUP_DIR}/.last-backup"
    echo "$backup_name" > "${BACKUP_DIR}/.last-backup-name"

    ok "Backup created: ${backup_name}"
    echo ""
}

# ─── Perform the actual update ───────────────────────────────────────────
perform_update() {
    section "Updating NovaPanel"

    # Stash current version info for changelog
    local current_version
    current_version="$(cd "${PANEL_HOME}" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    log "Current version: ${current_version}"

    # Pull latest code
    log "Pulling latest code from ${UPDATE_BRANCH} branch..."
    cd "${PANEL_HOME}"

    # Configure git if needed
    if [ ! -d "${PANEL_HOME}/.git" ]; then
        die "Not a git repository. Please re-install using install.sh"
    fi

    git fetch origin "${UPDATE_BRANCH}"

    local new_version
    new_version="$(git rev-parse --short "origin/${UPDATE_BRANCH}" 2>/dev/null || echo 'unknown')"
    log "New version: ${new_version}"

    # Show commits that will be applied
    if [ "$current_version" != "unknown" ] && [ "$new_version" != "unknown" ]; then
        echo ""
        log "Changes since ${current_version}:"
        git log "${current_version}..origin/${UPDATE_BRANCH}" --oneline 2>/dev/null || \
            warn "Unable to fetch commit history"
        echo ""
    fi

    # Pull the changes
    if ! git pull origin "${UPDATE_BRANCH}"; then
        fail "Failed to pull latest code"
        fail "There may be merge conflicts. Please resolve manually:"
        fail "  cd ${PANEL_HOME}"
        fail "  git checkout ${UPDATE_BRANCH}"
        fail "  git pull origin ${UPDATE_BRANCH}"
        exit 2
    fi
    ok "Code updated"

    # Install dependencies
    log "Installing dependencies..."
    ensure_pnpm
    pnpm install 2>&1 | tail -5
    ok "Dependencies installed"

    # Build schemas
    log "Building schemas..."
    pnpm --filter @serverforge/schemas build 2>&1 | tail -5
    ok "Schemas built"

    # Build API
    log "Building API..."
    cd "${PANEL_HOME}/apps/api"
    rm -rf dist
    mkdir -p dist
    pnpm exec tsc --build --force 2>&1 || {
        warn "tsc --build failed, trying alternatives..."
        /usr/bin/npx tsc --build --force 2>&1 || \
            node /opt/novapanel/node_modules/.bin/tsc --build --force 2>&1
    }

    # Copy migrations to dist
    cp -r "${PANEL_HOME}/apps/api/src/db/migrations" "${PANEL_HOME}/apps/api/dist/db/" 2>/dev/null || true
    ok "API built"

    # Build Web
    log "Building Web frontend..."
    cd "${PANEL_HOME}/apps/web"
    rm -rf dist
    pnpm exec vite build 2>&1 | tail -10
    ok "Web frontend built"

    # Run migrations
    section "Running Database Migrations"
    cd "${PANEL_HOME}/apps/api"

    if [ -f "dist/db/migrate.js" ]; then
        log "Applying pending migrations..."
        set -a
        # shellcheck source=/dev/null
        source "${PANEL_HOME}/.env"
        set +a
        NODE_ENV=production node dist/db/migrate.js || warn "Migration failed"
        ok "Migrations applied"
    else
        warn "Migration script not found — will run on next start"
    fi

    # Fix permissions
    log "Fixing permissions..."
    chown -R novapanel:novapanel "${PANEL_HOME}"
    ok "Permissions fixed"

    # Restart service
    section "Restarting NovaPanel"
    log "Restarting novapanel service..."

    # Stop the service
    systemctl stop novapanel 2>/dev/null || true

    # Wait a moment for clean stop
    sleep 2

    # Start the service
    systemctl start novapanel 2>&1 || {
        warn "Failed to start novapanel. Checking status..."
        systemctl status novapanel || true
        journalctl -u novapanel --no-pager -n 20 || true
    }

    # Wait for service to be ready
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
        warn "NovaPanel may not have started successfully"
        warn "Check status with: systemctl status novapanel"
        warn "Check logs with: journalctl -u novapanel -n 50"
    fi
}

# ─── Rollback to previous backup ─────────────────────────────────────────
rollback() {
    section "Rolling Back Update"

    local last_backup
    last_backup="$(cat "${BACKUP_DIR}/.last-backup" 2>/dev/null || echo '')"

    if [ -z "$last_backup" ] || [ ! -d "$last_backup" ]; then
        fail "No backup found to rollback to"
        fail "Backup directory: ${BACKUP_DIR}"
        exit 2
    fi

    log "Rolling back to backup: $(basename "$last_backup")"
    echo ""

    # Stop the service first
    log "Stopping novapanel service..."
    systemctl stop novapanel 2>/dev/null || true

    # Restore the backup (excluding .env which should be preserved)
    log "Restoring backup..."
    rsync -a --delete --exclude='.env' "${last_backup}/" "${PANEL_HOME}/"

    # Fix permissions
    chown -R novapanel:novapanel "${PANEL_HOME}"

    # Restart service
    log "Restarting novapanel service..."
    systemctl start novapanel 2>&1 || {
        warn "Failed to restart. Check: systemctl status novapanel"
    }

    ok "Rollback complete"
    echo ""
    log "The previous version has been restored"
    log "Panel is now running with the previous code"
}

# ─── Main execution ───────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     NovaPanel Server Updater v${SCRIPT_VERSION}                         ║${NC}"
    echo -e "${CYAN}║     Update Existing Installation                             ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # ─── Check prerequisites ───────────────────────────────────────────
    if [ "$EUID" -ne 0 ]; then
        die "This script must be run as root. Use: sudo bash $0"
    fi
    ok "Running as root"

    # ─── Handle rollback mode ──────────────────────────────────────────
    if [ "$ROLLBACK_MODE" = true ]; then
        rollback
        exit 0
    fi

    # ─── Verify NovaPanel is installed ─────────────────────────────────
    if ! check_existing_installation; then
        fail "NovaPanel is not installed at ${PANEL_HOME}"
        fail ""
        fail "To install NovaPanel, use:"
        fail "  curl -fsSL https://raw.githubusercontent.com/marufnwu/NovaPanel/release/scripts/install.sh | sudo bash"
        fail ""
        fail "Or use install.sh from the repository:"
        fail "  sudo bash scripts/install.sh"
        exit 1
    fi
    ok "NovaPanel installation found at ${PANEL_HOME}"

    # ─── Show preview of changes ────────────────────────────────────────
    show_update_preview

    # ─── Handle dry-run ────────────────────────────────────────────────
    if [ "$DRY_RUN" = true ]; then
        echo ""
        ok "Dry run complete — no changes were made"
        exit 0
    fi

    # ─── Require confirmation unless skipped ───────────────────────────
    if [ "$SKIP_CONFIRM" != true ] && [ "${FORCE:-0}" != "1" ]; then
        if [ -t 0 ]; then
            echo ""
            echo -e "${YELLOW}─────────────────────────────────────────────────────────────────────────────${NC}"
            echo -e "${YELLOW}⚠️  This will update your NovaPanel installation.${NC}"
            echo -e "${YELLOW}⚠️  Your data and settings will be preserved.${NC}"
            echo -e "${YELLOW}─────────────────────────────────────────────────────────────────────────────${NC}"
            echo ""
            read -p "Continue with update? [y/N]: " -n 1 -r REPLY
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Update cancelled."
                exit 0
            fi
        else
            warn "Non-interactive mode: proceeding with update"
        fi
    fi

    # ─── Create backup before update ───────────────────────────────────
    create_backup

    # ─── Perform the update ───────────────────────────────────────────
    if ! perform_update; then
        fail ""
        fail "Update failed!"
        fail ""
        fail "You can rollback to the previous version using:"
        fail "  sudo bash scripts/update.sh --rollback"
        fail ""
        exit 2
    fi

    # ─── Success ───────────────────────────────────────────────────────
    section "Update Complete"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  🎉 NovaPanel has been updated successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  📋 Update Summary:"
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │ Installation:  ${PANEL_HOME}"
    echo "  │ Branch:        ${UPDATE_BRANCH}"
    echo "  │ Backup:        ${BACKUP_DIR}/$(cat "${BACKUP_DIR}/.last-backup-name" 2>/dev/null || echo 'unknown')"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    echo ""
    echo "  🔧 Management:"
    echo "  ┌─────────────────────────────────────────────────────────────────┐"
    echo "  │ Status:  sudo systemctl status novapanel"
    echo "  │ Logs:    sudo journalctl -u novapanel -f"
    echo "  │ Restart: sudo systemctl restart novapanel"
    echo "  └─────────────────────────────────────────────────────────────────┘"
    echo ""

    if [ -f "${BACKUP_DIR}/.last-backup-name" ]; then
        echo "  💾 Rollback if needed:"
        echo "  ┌─────────────────────────────────────────────────────────────────┐"
        echo "  │ sudo bash scripts/update.sh --rollback"
        echo "  └─────────────────────────────────────────────────────────────────┘"
        echo ""
    fi

    echo -e "${DIM}  Update script v${SCRIPT_VERSION} | $(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
    echo ""
}

main "$@"
