# ─── Stage 1: Dependencies ───
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───
FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

RUN pnpm --filter @novadash/shared build
RUN pnpm --filter @novadash/backend db:generate
RUN pnpm --filter @novadash/backend build

# ─── Stage 3: Run ───
FROM node:20-alpine AS run
WORKDIR /app

COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

EXPOSE 4000

CMD ["node", "dist/index.js"]
