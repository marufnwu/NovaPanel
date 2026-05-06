# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

- **Single test**: `pnpm --filter api test:watch` (runs vitest in watch mode for API tests)
- **Database**: `pnpm --filter api db:generate`, `pnpm --filter api db:migrate`, `pnpm --filter api db:seed`
- **API dev**: `pnpm --filter api dev` (runs tsx watch src/index.ts)
- **Web dev**: `pnpm --filter web dev` (runs vite)

## Architecture

- **Monorepo**: pnpm workspace + Turbo orchestrator; packages in `apps/*`
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