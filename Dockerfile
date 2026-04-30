# ╔══════════════════════════════════════════════════════════════════════╗
# ║  NovaPanel Docker Image — Multi-Stage Build                        ║
# ║                                                                     ║
# ║  Usage:                                                             ║
# ║    pnpm build                          # Build the app first        ║
# ║    docker compose build                # Build the image            ║
# ║    docker compose up -d                # Start all services         ║
# ║                                                                     ║
# ║  The image contains ALL services NovaPanel manages:                 ║
# ║    Nginx, Apache2, PHP-FPM (8.1/8.2/8.3), MariaDB, PostgreSQL,     ║
# ║    Redis, BIND9, Postfix, Dovecot, ProFTPD, Fail2Ban, Certbot      ║
# ╚══════════════════════════════════════════════════════════════════════╝

# ─── Stage 1: Install Node.js dependencies ──────────────────────────────
FROM node:20-bookworm AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /build

# Copy workspace config for proper dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install production dependencies only
RUN pnpm install --prod --ignore-scripts

# ─── Stage 2: Runtime image with all services ───────────────────────────
FROM ubuntu:24.04

LABEL maintainer="NovaPanel"
LABEL description="NovaPanel - All-in-one server management panel"
LABEL org.opencontainers.image.source="https://github.com/novapanel/novapanel"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV PG_VERSION=16

# ─── Configure non-interactive package installs ─────────────────────────
RUN echo "postfix postfix/main_mailer_type string Internet Site" | debconf-set-selections && \
    echo "postfix postfix/mailname string localhost" | debconf-set-selections && \
    echo "proftpd-basic shared/proftpd/inetd_or_standalone select standalone" | debconf-set-selections

# ─── Add external repositories in a single layer ────────────────────────
# 1. Core tools needed for repo setup
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl wget gnupg lsb-release software-properties-common ca-certificates && \
    \
    # 2. Node.js 20 LTS (NodeSource)
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    \
    # 3. MariaDB official repo
    curl -fsSL https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- \
        --mariadb-server-version="mariadb-11.4" --skip-maxscale --skip-tools && \
    \
    # 4. PostgreSQL official repo
    install -d /usr/share/keyrings && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
        gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/postgresql.list && \
    \
    # 5. PHP PPA (ondrej/php) — works on Ubuntu; sury for Debian-like
    add-apt-repository -y ppa:ondrej/php && \
    \
    rm -rf /var/lib/apt/lists/*

# ─── Install ALL packages in a single layer ─────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    \
    # Build tools (needed for node-pty native compilation)
    build-essential python3 git \
    \
    # Node.js
    nodejs \
    \
    # Supervisord (process manager for Docker)
    supervisor \
    \
    # System utilities
    sudo sqlite3 jq zip unzip rsync htop net-tools ssl-cert \
    uuid-runtime logrotate cron \
    \
    # Web servers
    nginx \
    apache2 apache2-utils \
    \
    # PHP 8.1 FPM + extensions
    php8.1-fpm php8.1-cli php8.1-common php8.1-mysql php8.1-pgsql php8.1-sqlite3 \
    php8.1-gd php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php8.1-bcmath php8.1-intl \
    \
    # PHP 8.2 FPM + extensions
    php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-pgsql php8.2-sqlite3 \
    php8.2-gd php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-bcmath php8.2-intl \
    \
    # PHP 8.3 FPM + extensions
    php8.3-fpm php8.3-cli php8.3-common php8.3-mysql php8.3-pgsql php8.3-sqlite3 \
    php8.3-gd php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-bcmath php8.3-intl \
    \
    # Databases
    mariadb-server mariadb-client \
    postgresql-16 postgresql-contrib-16 \
    \
    # Redis
    redis-server \
    \
    # DNS
    bind9 bind9utils dnsutils \
    \
    # Mail stack
    postfix dovecot-imapd dovecot-pop3d \
    opendkim opendkim-tools \
    spamassassin spamc \
    \
    # FTP
    proftpd-basic \
    \
    # SSL
    certbot python3-certbot-nginx python3-certbot-apache \
    \
    # Security
    fail2ban \
    \
    && rm -rf /var/lib/apt/lists/*

# ─── Install pnpm and pm2 globally ──────────────────────────────────────
RUN npm install -g pnpm pm2

# ─── Create panel user and directories ──────────────────────────────────
RUN useradd -r -m -d /opt/novapanel -s /bin/bash novapanel && \
    usermod -aG www-data novapanel && \
    mkdir -p \
        /var/www/vhosts \
        /var/www/html \
        /var/log/novapanel \
        /var/log/supervisor \
        /etc/novapanel/ssl \
        /var/lib/novapanel/backups \
        /var/lib/novapanel/secrets \
        /var/lib/novapanel \
        /run/php \
        /run/mysqld \
        /var/run/postgresql \
        /var/spool/postfix/pid \
        /var/lib/postfix \
        /etc/proftpd \
        /etc/bind/zones \
        /var/mail/vhosts \
        /etc/opendkim/keys

# ─── Configure sudo for the panel user ──────────────────────────────────
# The panel needs sudo to manage system services (nginx, php-fpm, etc.)
RUN echo "novapanel ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/novapanel && \
    chmod 440 /etc/sudoers.d/novapanel

# ─── Install fake systemctl that maps to supervisorctl ──────────────────
COPY docker/systemctl-wrapper.sh /usr/local/bin/systemctl
RUN chmod +x /usr/local/bin/systemctl

# ─── Configure Apache to listen on 8080 (backend) ──────────────────────
RUN printf '# NovaPanel: Apache listens on 8080 as a backend\nListen 8080\n' > /etc/apache2/ports.conf
RUN a2dissite 000-default 2>/dev/null || true && \
    a2enmod rewrite proxy proxy_http headers 2>/dev/null || true

# ─── Configure Redis for Docker ─────────────────────────────────────────
RUN sed -i 's/^#\?bind .*/bind 127.0.0.1/' /etc/redis/redis.conf && \
    sed -i 's/^#\?protected-mode .*/protected-mode no/' /etc/redis/redis.conf

# ─── Copy pre-built dist (build locally first: pnpm build) ─────────────
COPY apps/api/dist /opt/novapanel/apps/api/dist
COPY apps/api/src/db/migrations /opt/novapanel/apps/api/dist/db/migrations
COPY apps/web/dist /opt/novapanel/apps/web/dist

# Copy production node_modules from deps stage
COPY --from=deps /build/apps/api/node_modules /opt/novapanel/apps/api/node_modules
COPY --from=deps /build/node_modules /opt/novapanel/node_modules

# Rebuild native modules for the runtime platform
RUN cd /opt/novapanel/apps/api && npm rebuild @node-rs/argon2 2>/dev/null || true

# ─── Copy configuration files ───────────────────────────────────────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/novapanel.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/nginx-default.conf /etc/nginx/sites-available/default

RUN chmod +x /entrypoint.sh && \
    chown -R novapanel:novapanel /opt/novapanel /var/www/vhosts \
                                     /var/log/novapanel /var/lib/novapanel

# ─── Expose ports ───────────────────────────────────────────────────────
# 3000  — Panel API
# 80    — Nginx HTTP
# 443   — Nginx HTTPS
# 8080  — Apache HTTP (backend)
# 21    — FTP control
# 53    — DNS (TCP+UDP)
# 25    — SMTP
# 110   — POP3
# 143   — IMAP
# 993   — IMAPS
# 995   — POP3S
EXPOSE 3000 80 443 8080 21 53/tcp 53/udp 25 110 143 993 995

# ─── Health check ───────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# ─── Entrypoint & CMD ───────────────────────────────────────────────────
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/novapanel.conf"]
