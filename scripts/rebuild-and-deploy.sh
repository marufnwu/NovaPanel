#!/bin/bash
set -e
cd /opt/novapanel

MODE=${1:-production}

echo "Pulling latest code..."
git pull origin v5

echo "Building schemas..."
sudo TURBO_API=1 pnpm schemas:build

echo "Building API..."
sudo TURBO_API=1 pnpm --filter @serverforge/api build

if [ "$MODE" = "dev" ]; then
    echo "=========================================="
    echo "STARTING IN DEV MODE"
    echo "=========================================="
    echo "Production API stays running on port 8732"
    echo "Vite dev server on port 5173 (proxies /api to 8732)"
    echo "Access: http://192.168.0.211:5173"
    echo "Press Ctrl+C to stop dev server"
    echo "=========================================="
    cd /opt/novapanel/apps/web
    sudo pnpm dev -- --host 0.0.0.0 --port 5173

elif [ "$MODE" = "production" ]; then
    echo "Building web in production mode..."
    sudo TURBO_API=1 pnpm --filter @serverforge/web build
    echo "Restarting novapanel service..."
    sudo systemctl restart novapanel
else
    echo "Unknown mode: $MODE"
    echo "Usage: ./rebuild-and-deploy.sh [dev|production]"
    exit 1
fi