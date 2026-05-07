#!/bin/bash
cd /opt/novapanel
git pull origin master
sudo TURBO_API=1 pnpm --filter @serverforge/web build
sudo systemctl restart novapanel