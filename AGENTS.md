# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

- **Build all**: `pnpm build` (builds schemas → api → web via turbo)
- **Build API**: `pnpm --filter api build` (runs tsc + copies migrations)
- **Build Web**: `pnpm --filter web build` (runs tsc -b && vite build)
- **Build Schemas**: `pnpm --filter @serverforge/schemas build` (outputs to packages/schemas/dist)
- **Run tests (local)**: `npx vitest run` in `apps/api/` directory, or `pnpm --filter api test:watch` for watch mode
- **Run tests (server)**: `cd /opt/novapanel/apps/api && npx vitest run` via SSH
- **Server test script**: `scripts/test.sh` (runs tests on server)
- **Database**: `pnpm --filter api db:generate`, `pnpm --filter api db:migrate`, `pnpm --filter api db:seed`
- **API dev**: `pnpm --filter api dev` (runs tsx watch src/index.ts)
- **Web dev**: `pnpm --filter web dev` (runs vite)
- **API start (prod)**: `node apps/api/dist/index.js`
- **Skip migrations on start**: `node apps/api/dist/index.js --skip-migrate`

## Architecture

- **Monorepo**: pnpm workspace + Turbo orchestrator; packages in `apps/*` and `packages/*`
- **Shared schemas**: `packages/schemas/` contains Zod schemas used by both API and web
- **API serves web**: In production, Fastify serves the React SPA from `../web/dist`
- **Module pattern**: Each feature in `apps/api/src/modules/` has `*.routes.ts`, `*.schema.ts`, `*.service.ts`
- **Response wrapper**: API returns `{ success, data?, error? }` - see `apps/web/src/api/client.ts`

## Code Style

- **No ESLint/Prettier**: Despite README mention, no config files exist; project relies on TypeScript strict mode
- **Zod schemas**: Used for API validation (imported from schema files)
- **TanStack Router**: Code-based routing, not file-based; see `apps/web/src/router.tsx`

## Key Conventions

- **Port 8732**: Panel serves on this port (not standard 80/3000)
- **API prefix**: All routes under `/api/v1/` (health at `/api/v1/health`)
- **Node 20**: Required (`.nvmrc` specifies v20, not v22+)
- **Command allowlist**: System uses whitelisted commands only (security pattern in services)
- **Single admin**: No multi-tenant/subscription - one admin per installation
- **Migrations**: Auto-run on API startup; use `--skip-migrate` to disable

## Deploy

- **Local build**: `pnpm build` then deploy `apps/api/dist/` and `apps/web/dist/` to server
- **Server deploy script**: `scripts/rebuild-and-deploy.sh` (git pull + schemas + api + web + restart)
- **Install script**: `scripts/install.sh` (fresh server setup with all dependencies)