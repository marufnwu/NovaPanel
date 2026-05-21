#!/bin/bash
cd /opt/novapanel
git pull origin v5
sudo TURBO_API=1 pnpm schemas:build
sudo TURBO_API=1 pnpm --filter @serverforge/api build
sudo TURBO_API=1 pnpm --filter @serverforge/web build
sudo systemctl restart novapanel