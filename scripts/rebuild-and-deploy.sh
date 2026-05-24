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
    echo "STARTING IN DEV MODE (port 8732)"
    echo "=========================================="
    echo "Stopping production service..."
    sudo systemctl stop novapanel

    echo "Starting API on port 8733..."
    sudo node apps/api/dist/index.js &
    API_PID=$!
    sleep 3

    echo "Starting Vite dev server on port 8732 (proxies /api to 8733)..."
    cd /opt/novapanel/apps/web
    sudo VITE_API_PORT=8733 pnpm dev -- --host 0.0.0.0 --port 8732 &

    echo "=========================================="
    echo "DEV MODE RUNNING"
    echo "App: http://192.168.0.211:8732"
    echo "API: http://192.168.0.211:8733"
    echo "Press Ctrl+C to stop everything"
    echo "=========================================="

    wait

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