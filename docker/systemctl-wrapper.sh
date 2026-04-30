#!/bin/bash
# â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
# â•‘  Fake systemctl â€” Maps to supervisorctl inside Docker               â•‘
# â•‘                                                                     â•‘
# â•‘  This allows NovaPanel's service management code (which calls       â•‘
# â•‘  systemctl) to work seamlessly inside a Docker container where      â•‘
# â•‘  supervisord manages all processes instead of systemd.              â•‘
# â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ACTION="${1:-}"
SERVICE="${2:-}"

# Supervisord config path (must match the CMD in Dockerfile)
SUP_CONF="/etc/supervisor/conf.d/novapanel.conf"

# Map systemd service names to supervisord program names
map_service() {
    case "$1" in
        nginx)                    echo "nginx" ;;
        apache2|httpd)            echo "apache2" ;;
        mariadb|mysql)            echo "mariadb" ;;
        postgresql)               echo "postgresql" ;;
        php8.1-fpm|php8.1fpm)     echo "php8.1-fpm" ;;
        php8.2-fpm|php8.2fpm)     echo "php8.2-fpm" ;;
        php8.3-fpm|php8.3fpm)     echo "php8.3-fpm" ;;
        php*fpm*)                 echo "php8.2-fpm" ;;
        bind9|named)              echo "bind9" ;;
        postfix)                  echo "postfix" ;;
        dovecot)                  echo "dovecot" ;;
        proftpd)                  echo "proftpd" ;;
        redis*|redis-server)      echo "redis" ;;
        fail2ban)                 echo "fail2ban" ;;
        novapanel)                echo "novapanel" ;;
        cron)                     echo "cron" ;;
        opendkim)                 echo "opendkim" ;;
        spamassassin)             echo "spamassassin" ;;
        *)                        echo "$1" ;;
    esac
}

# Check if a service is managed by supervisord
is_supervised() {
    local prog="$1"
    supervisorctl -c "$SUP_CONF" status "$prog" >/dev/null 2>&1
}

# For services NOT in supervisord, check if the process is running via pgrep
check_process_running() {
    local svc="$1"
    case "$svc" in
        ufw|ufw.service)
            # UFW is a firewall, not a daemon â€” check via iptables/ufw status
            if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "active"; then
                return 0
            fi
            return 1
            ;;
        cloudflared|cloudflared.service)
            pgrep -x cloudflared >/dev/null 2>&1
            return $?
            ;;
        *)
            # Use -x for exact process name match to avoid matching
            # the wrapper script's own command line (which contains the service name)
            pgrep -x "$svc" >/dev/null 2>&1
            return $?
            ;;
    esac
}

case "$ACTION" in
    is-active)
        if [ -z "$SERVICE" ]; then
            echo "unknown"
            exit 1
        fi
        PROG="$(map_service "$SERVICE")"
        RESULT=$(supervisorctl -c "$SUP_CONF" status "$PROG" 2>/dev/null)
        if echo "$RESULT" | grep -q "RUNNING"; then
            echo "active"
            exit 0
        elif echo "$RESULT" | grep -q "STOPPED\|FATAL\|BACKOFF\|EXITED\|STARTING"; then
            # Service exists in supervisord but is not running
            echo "inactive"
            exit 3
        else
            # Service not found in supervisord â€” try process check
            if check_process_running "$SERVICE"; then
                echo "active"
                exit 0
            else
                echo "inactive"
                exit 3
            fi
        fi
        ;;

    is-enabled)
        # Always report "enabled" inside Docker
        echo "enabled"
        exit 0
        ;;

    is-failed)
        if [ -z "$SERVICE" ]; then
            echo "unknown"
            exit 1
        fi
        PROG="$(map_service "$SERVICE")"
        RESULT=$(supervisorctl -c "$SUP_CONF" status "$PROG" 2>/dev/null)
        if echo "$RESULT" | grep -q "FATAL\|BACKOFF"; then
            echo "failed"
            exit 0
        else
            echo "active"
            exit 0
        fi
        ;;

    start)
        if [ -n "$SERVICE" ]; then
            PROG="$(map_service "$SERVICE")"
            supervisorctl -c "$SUP_CONF" start "$PROG" >/dev/null 2>&1
        fi
        ;;

    stop)
        if [ -n "$SERVICE" ]; then
            PROG="$(map_service "$SERVICE")"
            supervisorctl -c "$SUP_CONF" stop "$PROG" >/dev/null 2>&1
        fi
        ;;

    restart)
        if [ -n "$SERVICE" ]; then
            PROG="$(map_service "$SERVICE")"
            supervisorctl -c "$SUP_CONF" restart "$PROG" >/dev/null 2>&1
        fi
        ;;

    reload)
        if [ -n "$SERVICE" ]; then
            case "$SERVICE" in
                nginx)
                    # Test config before reload (ISSUE-09)
                    if ! nginx -t >/dev/null 2>&1; then
                        echo "nginx: configuration test failed" >&2
                        exit 1
                    fi
                    # Use nginx -s reload to avoid dropping connections
                    nginx -s reload >/dev/null 2>&1
                    ;;
                php8.1-fpm)
                    kill -USR2 "$(cat /run/php/php8.1-fpm.pid 2>/dev/null)" >/dev/null 2>&1
                    ;;
                php8.2-fpm)
                    kill -USR2 "$(cat /run/php/php8.2-fpm.pid 2>/dev/null)" >/dev/null 2>&1
                    ;;
                php8.3-fpm)
                    kill -USR2 "$(cat /run/php/php8.3-fpm.pid 2>/dev/null)" >/dev/null 2>&1
                    ;;
                postfix)
                    postfix reload >/dev/null 2>&1
                    ;;
                dovecot)
                    doveadm reload >/dev/null 2>&1
                    ;;
                bind9|named)
                    rndc reload >/dev/null 2>&1
                    ;;
                *)
                    # For other services, use restart
                    PROG="$(map_service "$SERVICE")"
                    supervisorctl -c "$SUP_CONF" restart "$PROG" >/dev/null 2>&1
                    ;;
            esac
        fi
        ;;

    status)
        if [ -n "$SERVICE" ]; then
            PROG="$(map_service "$SERVICE")"
            RESULT=$(supervisorctl -c "$SUP_CONF" status "$PROG" 2>/dev/null)
            if echo "$RESULT" | grep -q "RUNNING"; then
                echo "â— ${SERVICE} is running"
            else
                echo "â— ${SERVICE} is not running"
            fi
        else
            supervisorctl -c "$SUP_CONF" status
        fi
        ;;

    enable|disable)
        # Silently ignore â€” supervisord doesn't have enable/disable
        exit 0
        ;;

    daemon-reload|list-units|list-unit-files|show|cat|edit|set-property|reset-failed)
        # Silently ignore systemd-specific commands
        exit 0
        ;;

    "")
        echo "Usage: systemctl {start|stop|restart|reload|status|is-active} SERVICE" >&2
        exit 1
        ;;

    *)
        echo "Unknown systemctl command: $ACTION" >&2
        exit 1
        ;;
esac