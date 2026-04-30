# ServerForge — Phases 1-3: Detailed Implementation Guide

> **Supplement to:** `plans/implementation-plan.md`
> **Scope:** Monorepo Scaffold, Database Layer, Auth Module
> **Purpose:** File-level code structure, exact interfaces, API contracts, and component hierarchy

---

## Phase 1 — Monorepo Scaffold: Detailed Specification

### 1.1 Root Configuration Files

#### `package.json` (root)
```json
{
  "name": "serverforge",
  "version": "1.0.0",
  "private": true,
  "description": "Self-hosted server control panel",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:generate": "pnpm --filter api db:generate",
    "db:migrate": "pnpm --filter api db:migrate",
    "db:seed": "pnpm --filter api db:seed"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

#### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
```

#### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

#### `.gitignore`
```
node_modules/
dist/
.env
*.sqlite
*.sqlite-journal
.turbo/
*.log
.DS_Store
coverage/
.vite/
```

#### `.nvmrc`
```
20
```

---

### 1.2 API App — Complete File Structure

#### `apps/api/package.json`
```json
{
  "name": "@serverforge/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/csrf-protection": "^7.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/websocket": "^11.0.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/swagger": "^9.0.0",
    "@fastify/swagger-ui": "^5.0.0",
    "drizzle-orm": "^0.38.0",
    "@libsql/client": "^0.14.0",
    "lucia": "^3.2.0",
    "@lucia/adapter-sqlite": "^1.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0",
    "execa": "^9.5.0",
    "node-ssh": "^13.2.0",
    "node-pty": "^1.0.0",
    "zod": "^3.24.0",
    "handlebars": "^4.7.0",
    "nanoid": "^5.0.0",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "@node-rs/argon2": "^2.0.0",
    "otpauth": "^9.3.0",
    "qrcode": "^1.5.0",
    "systeminformation": "^5.23.0",
    "archiver": "^7.0.0",
    "decompress": "^4.2.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "drizzle-kit": "^0.30.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0",
    "@types/qrcode": "^1.5.0"
  }
}
```

#### `apps/api/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### `apps/api/src/index.ts` — Entry Point
```typescript
import { createServer } from './server.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function main() {
  const server = await createServer();

  await server.listen({ port: env.PORT, host: env.HOST });
  logger.info(`ServerForge API running on ${env.HOST}:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

#### `apps/api/src/server.ts` — Fastify Factory
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import { registerRoutes } from './routes.js';
import { errorHandler } from './errors.js';
import path from 'node:path';

export async function createServer() {
  const fastify = Fastify({
    logger: false, // We use our own pino logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ignoreTrailingSlash: true,
  });

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  });

  await fastify.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : env.PANEL_URL,
    credentials: true,
  });

  await fastify.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10,
    },
  });

  await fastify.register(websocket);

  // Serve React SPA in production
  if (env.NODE_ENV === 'production') {
    const webDist = path.resolve(import.meta.dirname, '../../web/dist');
    await fastify.register(staticPlugin, {
      root: webDist,
      prefix: '/',
      wildcard: false,
    });
  }

  // Global error handler
  fastify.setErrorHandler(errorHandler);

  // Register all API routes
  await registerRoutes(fastify);

  // SPA fallback — serve index.html for non-API routes
  if (env.NODE_ENV === 'production') {
    fastify.setNotFoundHandler(async (req, reply) => {
      if (!req.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    });
  }

  return fastify;
}
```

#### `apps/api/src/config/env.ts` — Zod-Validated Config
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8443),
  HOST: z.string().default('0.0.0.0'),
  PANEL_URL: z.string().url().default('https://localhost:8443'),

  DB_PATH: z.string().default('./data/db.sqlite'),

  SESSION_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  SF_ENCRYPTION_KEY: z.string().length(64),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  ADMIN_EMAIL: z.string().email().default('admin@localhost'),
  ADMIN_PASSWORD: z.string().min(8).default('changeme123'),

  VHOSTS_ROOT: z.string().default('/var/www/vhosts'),
  NGINX_SITES_AVAILABLE: z.string().default('/etc/nginx/sites-available'),
  NGINX_SITES_ENABLED: z.string().default('/etc/nginx/sites-enabled'),
  APACHE_SITES_AVAILABLE: z.string().default('/etc/apache2/sites-available'),
  BIND_ZONES_DIR: z.string().default('/etc/bind/zones'),
  PHP_FPM_POOL_DIR: z.string().default('/etc/php/{version}/fpm/pool.d'),
  CLOUDFLARED_CONFIG: z.string().default('/etc/cloudflared/config.yml'),
  BACKUP_DIR: z.string().default('/var/backups/serverforge'),

  CF_API_TOKEN: z.string().optional(),
  CF_ACCOUNT_ID: z.string().optional(),
  CF_ZONE_ID: z.string().optional(),

  MAIL_HOSTNAME: z.string().default('mail.localhost'),
  LE_EMAIL: z.string().email().default('admin@localhost'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_DIR: z.string().default('./logs'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // In dev, load from .env file
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
```

#### `apps/api/src/config/logger.ts`
```typescript
import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
```

#### `apps/api/src/errors.ts` — Error Handler
```typescript
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from './config/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  req: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        field: error.field,
      },
    });
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    const field = error.validation[0]?.instancePath?.replace('/', '') || undefined;
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        field,
      },
    });
  }

  // Rate limit errors
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });
  }

  // Unexpected errors
  logger.error({ error, url: req.url, method: req.method }, 'Unhandled error');
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
```

#### `apps/api/src/routes.ts` — Route Registry
```typescript
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/v1/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // Modules will be registered here as they are built:
  await fastify.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/v1/auth' });
  await fastify.register(import('./modules/users/users.routes.js'), { prefix: '/api/v1/users' });
  await fastify.register(import('./modules/subscriptions/subscriptions.routes.js'), { prefix: '/api/v1' });
  // ... more modules added in later phases
}
```

---

### 1.3 Web App — Complete File Structure

#### `apps/web/package.json`
```json
{
  "name": "@serverforge/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.95.0",
    "@tanstack/react-query": "^5.62.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.24.0",
    "recharts": "^2.15.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "lucide-react": "^0.469.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-accordion": "^1.2.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tailwindcss/forms": "^0.5.0"
  }
}
```

#### `apps/web/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8443',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8443',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

#### `apps/web/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

#### `apps/web/src/api/client.ts` — API Client
```typescript
const API_BASE = import.meta.env.DEV ? '' : ''; // Proxy handles dev, same origin in prod

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: { page: number; perPage: number; total: number };
  error?: { code: string; message: string; field?: string };
}

export async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Send cookies for session auth
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    const error = data.error || { code: 'UNKNOWN', message: 'Unknown error' };
    throw new ApiError(response.status, error.code, error.message, error.field);
  }

  return data.data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Typed request helpers
export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),
};
```

---

## Phase 2 — Database Layer: Detailed Specification

### 2.1 Drizzle Client Setup

#### `apps/api/src/db/index.ts`
```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const libsql = createClient({
  url: `file:${env.DB_PATH}`,
});

export const db = drizzle(libsql, { schema });
export type Database = typeof db;
```

#### `apps/api/drizzle.config.ts`
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./data/db.sqlite',
  },
});
```

### 2.2 Schema Files — Exact Table Definitions

#### `apps/api/src/db/schema/users.ts`
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // nanoid
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'reseller', 'customer'] }).notNull().default('customer'),
  parentId: text('parent_id').references((): any => users.id), // self-ref for reseller->customer
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false).notNull(),
  apiTokenHash: text('api_token_hash'), // SHA256 of sf_ token
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

#### `apps/api/src/db/schema/subscriptions.ts`
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  maxDomains: integer('max_domains').default(-1).notNull(),
  maxDiskMb: integer('max_disk_mb').default(-1).notNull(),
  maxBandwidthMb: integer('max_bandwidth_mb').default(-1).notNull(),
  maxDatabases: integer('max_databases').default(-1).notNull(),
  maxEmailAccounts: integer('max_email_accounts').default(-1).notNull(),
  maxFtpAccounts: integer('max_ftp_accounts').default(-1).notNull(),
  phpVersions: text('php_versions'), // JSON array: '["8.1","8.2","8.3","8.4"]'
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(true).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  systemUser: text('system_user').notNull().unique(),
  homeDir: text('home_dir').notNull(),
  diskUsedMb: integer('disk_used_mb').default(0).notNull(),
  bandwidthUsedMb: integer('bandwidth_used_mb').default(0).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
```

#### `apps/api/src/db/schema/domains.ts`
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { subscriptions } from './subscriptions.js';

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  name: text('name').notNull().unique(),
  documentRoot: text('document_root').notNull(),
  phpVersion: text('php_version').default('8.2').notNull(),
  phpHandler: text('php_handler', { enum: ['php-fpm', 'cgi', 'disabled'] }).default('php-fpm').notNull(),
  webServer: text('web_server', { enum: ['nginx', 'apache', 'nginx+apache'] }).default('nginx+apache').notNull(),
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(false).notNull(),
  sslCertId: text('ssl_cert_id'),
  redirectHttpToHttps: integer('redirect_http_to_https', { mode: 'boolean' }).default(false).notNull(),
  hsts: integer('hsts', { mode: 'boolean' }).default(false).notNull(),
  status: text('status', { enum: ['active', 'suspended', 'pending'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const subdomains = sqliteTable('subdomains', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  documentRoot: text('document_root').notNull(),
  phpVersion: text('php_version'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const domainAliases = sqliteTable('domain_aliases', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const domainRedirects = sqliteTable('domain_redirects', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  sourcePath: text('source_path').notNull(),
  targetUrl: text('target_url').notNull(),
  type: text('type', { enum: ['301', '302'] }).default('301').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Domain = typeof domains.$inferSelect;
export type Subdomain = typeof subdomains.$inferSelect;
```

#### `apps/api/src/db/schema/index.ts` — Barrel Export
```typescript
export * from './users.js';
export * from './subscriptions.js';
export * from './domains.js';
export * from './ssl.js';
export * from './databases.js';
export * from './email.js';
export * from './dns.js';
export * from './ftp.js';
export * from './cron.js';
export * from './tunnels.js';
export * from './audit.js';
export * from './stats.js';
export * from './backups.js';
```

### 2.3 Seed Script

#### `apps/api/src/db/seed.ts`
```typescript
import { db } from './index.js';
import { users, plans, subscriptions } from './schema/index.js';
import { hashPassword } from '../utils/crypto.js';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function seed() {
  logger.info('Seeding database...');

  // 1. Create default plan
  const planId = nanoid();
  await db.insert(plans).values({
    id: planId,
    name: 'Unlimited',
    description: 'Default plan with unlimited resources',
    maxDomains: -1,
    maxDiskMb: -1,
    maxBandwidthMb: -1,
    maxDatabases: -1,
    maxEmailAccounts: -1,
    maxFtpAccounts: -1,
    phpVersions: JSON.stringify(['8.1', '8.2', '8.3', '8.4']),
    sslEnabled: true,
    isDefault: true,
  });

  // 2. Create admin user
  const adminId = nanoid();
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await db.insert(users).values({
    id: adminId,
    username: 'admin',
    email: env.ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    isActive: true,
    twoFactorEnabled: false,
  });

  // 3. Create admin subscription
  const subId = nanoid();
  await db.insert(subscriptions).values({
    id: subId,
    userId: adminId,
    planId,
    systemUser: 'admin',
    homeDir: '/var/www/vhosts/admin',
    isActive: true,
  });

  logger.info('Seed complete: admin user, default plan, admin subscription created');
}

seed().catch(console.error);
```

### 2.4 Migration Runner

#### `apps/api/src/db/migrate.ts`
```typescript
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function runMigrations() {
  const client = createClient({ url: `file:${env.DB_PATH}` });
  logger.info('Running migrations...');
  await migrate(client, { migrationsFolder: './src/db/migrations' });
  logger.info('Migrations complete');
}

runMigrations().catch(console.error);
```

---

## Phase 3 — Auth Module: Detailed Specification

### 3.1 Auth Schemas

#### `apps/api/src/modules/auth/auth.schema.ts`
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().length(6).optional(),
});

export const enable2faResponseSchema = z.object({
  secret: z.string(),
  qrCodeUri: z.string(), // otpauth://totp/...
  backupCodes: z.array(z.string()), // 8 single-use codes
});

export const verify2faSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const generateApiTokenSchema = z.object({
  name: z.string().min(1).max(50),
  expiresAt: z.string().datetime().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type GenerateApiTokenInput = z.infer<typeof generateApiTokenSchema>;
```

### 3.2 Auth Service — Full Implementation

#### `apps/api/src/modules/auth/auth.service.ts`
```typescript
import { db } from '../../db/index.js';
import { users, sessions } from '../../db/schema/index.js';
import { eq, and, gt } from 'drizzle-orm';
import { verifyPassword, hashPassword, generateToken, hashToken, encrypt, decrypt } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { TOTP, Secret } from 'otpauth';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const SESSION_DURATION_HOURS = 24;

export class AuthService {
  // --- Login ---
  async login(username: string, password: string, twoFactorCode?: string) {
    // 1. Find user
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }

    // 2. Check active
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }

    // 3. Verify password
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }

    // 4. Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return { requiresTwoFactor: true, userId: user.id };
      }
      const secret = decrypt(user.twoFactorSecret!);
      const totp = new TOTP({ secret: Secret.fromBase32(secret) });
      const delta = totp.validate({ token: twoFactorCode, window: 1 });
      if (delta === null) {
        throw new AppError(401, 'INVALID_2FA_CODE', 'Invalid 2FA code');
      }
    }

    // 5. Create session
    const sessionId = nanoid(32);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
    });

    // 6. Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    logger.info({ userId: user.id, username: user.username }, 'User logged in');

    return {
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  // --- Logout ---
  async logout(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  // --- Validate Session ---
  async validateSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!session) return null;

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || !user.isActive) return null;

    return { session, user };
  }

  // --- Enable 2FA ---
  async enable2FA(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    // Generate TOTP secret
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'ServerForge',
      label: user.username,
      secret,
    });

    // Generate 8 backup codes
    const backupCodes = Array.from({ length: 8 }, () => nanoid(8));

    // Store encrypted secret (not enabled yet — must verify first)
    const encryptedSecret = encrypt(secret.base32);

    return {
      secret: encryptedSecret,
      qrCodeUri: totp.toString(),
      backupCodes,
      manualEntryKey: secret.base32,
    };
  }

  // --- Verify and Activate 2FA ---
  async verifyAndEnable2FA(userId: string, encryptedSecret: string, code: string) {
    const secret = decrypt(encryptedSecret);
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });
    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      throw new AppError(400, 'INVALID_2FA_CODE', 'Invalid 2FA code');
    }

    await db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: true,
      })
      .where(eq(users.id, userId));

    logger.info({ userId }, '2FA enabled');
  }

  // --- Generate API Token ---
  async generateApiToken(userId: string, name: string, expiresAt?: Date) {
    const rawToken = generateToken('sf_');
    const tokenHash = hashToken(rawToken);

    // Store hash in user record (for v1, one token per user)
    // In v2, create a separate api_tokens table
    await db
      .update(users)
      .set({ apiTokenHash: tokenHash })
      .where(eq(users.id, userId));

    logger.info({ userId, tokenName: name }, 'API token generated');

    return {
      token: rawToken, // Only shown once!
      name,
      expiresAt,
    };
  }

  // --- Validate API Token ---
  async validateApiToken(token: string) {
    const tokenHash = hashToken(token);
    // Look up user by token hash
    const [user] = await db.select().from(users).where(eq(users.apiTokenHash, tokenHash)).limit(1);
    if (!user || !user.isActive) return null;
    return user;
  }

  // --- Get Current User ---
  async getMe(userId: string) {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      twoFactorEnabled: users.twoFactorEnabled,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return user;
  }
}

export const authService = new AuthService();
```

### 3.3 Auth Middleware

#### `apps/api/src/modules/auth/auth.middleware.ts`
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { AppError } from '../../errors.js';
import type { User } from '../../db/schema/users.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    sessionId: string;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  let user: User | null = null;
  let sessionId: string | null = null;

  // 1. Try session cookie
  const sessionCookie = req.cookies.sf_session;
  if (sessionCookie) {
    const result = await authService.validateSession(sessionCookie);
    if (result) {
      user = result.user;
      sessionId = result.session.id;
    }
  }

  // 2. Try Bearer token
  if (!user) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      user = await authService.validateApiToken(token);
    }
  }

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  req.user = user;
  if (sessionId) req.sessionId = sessionId;
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
  };
}

export async function optionalAuth(req: FastifyRequest) {
  try {
    await requireAuth(req, req.reply!);
  } catch {
    // Ignore — user is optional
  }
}
```

### 3.4 Auth Routes

#### `apps/api/src/modules/auth/auth.routes.ts`
```typescript
import type { FastifyInstance } from 'fastify';
import { loginSchema, verify2faSchema, generateApiTokenSchema } from './auth.schema.js';
import { authService } from './auth.service.js';
import { requireAuth, requireRole } from './auth.middleware.js';
import { AppError } from '../../errors.js';

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    handler: async (req, reply) => {
      const { username, password, twoFactorCode } = loginSchema.parse(req.body);
      const result = await authService.login(username, password, twoFactorCode);

      if ('requiresTwoFactor' in result) {
        return reply.send({
          success: true,
          data: { requiresTwoFactor: true, userId: result.userId },
        });
      }

      // Set session cookie
      reply.setCookie('sf_session', result.sessionId, {
        httpOnly: true,
        secure: req.protocol === 'https',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours
      });

      return reply.send({ success: true, data: result });
    },
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: async (req, reply) => {
      const sessionId = req.cookies.sf_session;
      if (sessionId) await authService.logout(sessionId);
      reply.clearCookie('sf_session', { path: '/' });
      return reply.send({ success: true, data: null });
    },
  });

  // GET /api/v1/auth/me
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const user = await authService.getMe(req.user.id);
      return { success: true, data: user };
    },
  });

  // POST /api/v1/auth/2fa/enable
  fastify.post('/2fa/enable', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const result = await authService.enable2FA(req.user.id);
      return { success: true, data: result };
    },
  });

  // POST /api/v1/auth/2fa/verify
  fastify.post('/2fa/verify', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { code } = verify2faSchema.parse(req.body);
      const { secret } = req.body as { secret: string };
      await authService.verifyAndEnable2FA(req.user.id, secret, code);
      return { success: true, data: { enabled: true } };
    },
  });

  // POST /api/v1/auth/token
  fastify.post('/token', {
    preHandler: [requireAuth],
    handler: async (req) => {
      const { name, expiresAt } = generateApiTokenSchema.parse(req.body);
      const result = await authService.generateApiToken(
        req.user.id,
        name,
        expiresAt ? new Date(expiresAt) : undefined
      );
      return { success: true, data: result };
    },
  });
}
```

### 3.5 Auth API Contracts

#### `POST /api/v1/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "changeme123"
}
```

**Response (200 — no 2FA):**
```json
{
  "success": true,
  "data": {
    "sessionId": "V1StGXR8_Z5jdHi6B-myT",
    "user": {
      "id": "V1StGXR8_Z",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "twoFactorEnabled": false
    }
  }
}
```

**Response (200 — 2FA required):**
```json
{
  "success": true,
  "data": {
    "requiresTwoFactor": true,
    "userId": "V1StGXR8_Z"
  }
}
```

**Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

#### `GET /api/v1/auth/me`

**Request:**
```
Cookie: sf_session=V1StGXR8_Z5jdHi6B-myT
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "V1StGXR8_Z",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "twoFactorEnabled": false,
    "lastLoginAt": "2026-04-23T16:00:00.000Z",
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

#### `POST /api/v1/auth/2fa/enable`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "secret": "encrypted:...",
    "qrCodeUri": "otpauth://totp/ServerForge:admin?secret=JBSWY3DPEHPK3PXP&issuer=ServerForge",
    "backupCodes": ["a1b2c3d4", "e5f6g7h8", "i9j0k1l2", "m3n4o5p6", "q7r8s9t0", "u1v2w3x4", "y5z6a7b8", "c9d0e1f2"],
    "manualEntryKey": "JBSWY3DPEHPK3PXP"
  }
}
```

#### `POST /api/v1/auth/token`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "sf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "name": "CI/CD Pipeline",
    "expiresAt": null
  }
}
```

---

### 3.6 Frontend Auth — Component Hierarchy

```
src/
├── router.tsx                          # TanStack Router config
├── main.tsx                            # React root + providers
├── App.tsx                             # QueryClientProvider + RouterProvider
├── store/
│   └── auth.store.ts                   # Zustand auth state
├── api/
│   ├── client.ts                       # Fetch wrapper (already defined above)
│   └── hooks/
│       └── auth.ts                     # TanStack Query hooks
├── pages/
│   └── login/
│       ├── LoginPage.tsx               # Main login page
│       ├── LoginForm.tsx               # Username/password form
│       └── TwoFactorForm.tsx           # 2FA code input
├── components/
│   └── auth/
│       ├── AuthGuard.tsx               # Protected route wrapper
│       └── UserMenu.tsx                # Topbar user dropdown
└── lib/
    ├── utils.ts                        # cn() helper
    └── constants.ts                    # API routes, etc.
```

#### `apps/web/src/store/auth.store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'reseller' | 'customer';
  twoFactorEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  pendingTwoFactor: boolean;
  pendingUserId: string | null;
  setUser: (user: AuthUser) => void;
  setPendingTwoFactor: (userId: string) => void;
  clearPendingTwoFactor: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      pendingTwoFactor: false,
      pendingUserId: null,
      setUser: (user) => set({ user, isAuthenticated: true, pendingTwoFactor: false }),
      setPendingTwoFactor: (userId) =>
        set({ pendingTwoFactor: true, pendingUserId: userId, isAuthenticated: false }),
      clearPendingTwoFactor: () =>
        set({ pendingTwoFactor: false, pendingUserId: null }),
      logout: () =>
        set({ user: null, isAuthenticated: false, pendingTwoFactor: false, pendingUserId: null }),
    }),
    { name: 'sf-auth' }
  )
);
```

#### `apps/web/src/api/hooks/auth.ts`
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../client';
import { useAuthStore } from '../../store/auth.store';

interface LoginResponse {
  sessionId?: string;
  user: { id: string; username: string; email: string; role: string; twoFactorEnabled: boolean };
  requiresTwoFactor?: boolean;
  userId?: string;
}

export function useLogin() {
  const { setUser, setPendingTwoFactor } = useAuthStore();
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api.post<LoginResponse>('/api/v1/auth/login', data),
    onSuccess: (data) => {
      if (data.requiresTwoFactor && data.userId) {
        setPendingTwoFactor(data.userId);
      } else if (data.user) {
        setUser(data.user as any);
      }
    },
  });
}

export function useLogin2FA() {
  const { setUser, clearPendingTwoFactor } = useAuthStore();
  return useMutation({
    mutationFn: (data: { username: string; password: string; twoFactorCode: string }) =>
      api.post<LoginResponse>('/api/v1/auth/login', data),
    onSuccess: (data) => {
      if (data.user) {
        setUser(data.user as any);
        clearPendingTwoFactor();
      }
    },
  });
}

export function useLogout() {
  const { logout: storeLogout } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/v1/auth/logout'),
    onSuccess: () => {
      storeLogout();
      queryClient.clear();
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<{ id: string; username: string; email: string; role: string }>('/api/v1/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
```

#### `apps/web/src/pages/login/LoginPage.tsx`
```typescript
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLogin, useLogin2FA } from '../../api/hooks/auth';
import { useAuthStore } from '../../store/auth.store';
import { LoginForm } from './LoginForm';
import { TwoFactorForm } from './TwoFactorForm';

export function LoginPage() {
  const navigate = useNavigate({ from: '/login' });
  const { isAuthenticated, pendingTwoFactor } = useAuthStore();
  const loginMutation = useLogin();
  const login2FAMutation = useLogin2FA();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate({ to: '/' });
    return null;
  }

  if (pendingTwoFactor) {
    return (
      <TwoFactorForm
        onSubmit={(code) =>
          login2FAMutation.mutate({ username, password, twoFactorCode: code })
        }
        isLoading={login2FAMutation.isPending}
        error={login2FAMutation.error as any}
      />
    );
  }

  return (
    <LoginForm
      onSubmit={(u, p) => {
        setUsername(u);
        setPassword(p);
        loginMutation.mutate({ username: u, password: p });
      }}
      isLoading={loginMutation.isPending}
      error={loginMutation.error as any}
    />
  );
}
```

#### `apps/web/src/components/auth/AuthGuard.tsx`
```typescript
import { Outlet, Navigate } from '@tanstack/react-router';
import { useAuthStore } from '../../store/auth.store';

export function AuthGuard() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}
```

#### `apps/web/src/router.tsx`
```typescript
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { Layout } from './components/layout/Layout';

const rootRoute = createRootRoute({ component: Layout });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// Protected routes
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  component: AuthGuard,
  children: [
    createRoute({
      getParentRoute: () => protectedRoute, // Note: this is a simplification
      path: '/',
      component: DashboardPage,
    }),
    // More protected routes added as modules are built
  ],
});

export const router = createRouter({
  routeTree: rootRoute,
});
```

---

### 3.7 Utility Files

#### `apps/api/src/utils/crypto.ts`
```typescript
import { hash, verify } from '@node-rs/argon2';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

// --- Password Hashing ---
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

// --- Symmetric Encryption (AES-256-GCM) ---
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(env.SF_ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

// --- Token Generation ---
export function generateToken(prefix: string = ''): string {
  return `${prefix}${randomBytes(32).toString('hex')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

---

## Summary of Phase 1-3 Deliverables

| File | Purpose |
|---|---|
| `package.json` | Root monorepo config |
| `pnpm-workspace.yaml` | Workspace definition |
| `turbo.json` | Build pipeline |
| `apps/api/package.json` | API dependencies |
| `apps/api/tsconfig.json` | TypeScript strict config |
| `apps/api/src/index.ts` | Entry point with graceful shutdown |
| `apps/api/src/server.ts` | Fastify factory with all plugins |
| `apps/api/src/config/env.ts` | Zod-validated env config |
| `apps/api/src/config/logger.ts` | Pino logger setup |
| `apps/api/src/errors.ts` | AppError class + global error handler |
| `apps/api/src/routes.ts` | Route registry |
| `apps/api/src/db/index.ts` | Drizzle client |
| `apps/api/src/db/schema/*.ts` | All 19 table schemas |
| `apps/api/src/db/seed.ts` | Admin user + default plan seed |
| `apps/api/src/db/migrate.ts` | Migration runner |
| `apps/api/src/modules/auth/auth.schema.ts` | Zod validation schemas |
| `apps/api/src/modules/auth/auth.service.ts` | Full auth business logic |
| `apps/api/src/modules/auth/auth.middleware.ts` | requireAuth, requireRole |
| `apps/api/src/modules/auth/auth.routes.ts` | All auth endpoints |
| `apps/api/src/utils/crypto.ts` | Password, encryption, token utils |
| `apps/web/package.json` | Frontend dependencies |
| `apps/web/vite.config.ts` | Vite + API proxy |
| `apps/web/tailwind.config.js` | Dark theme design system |
| `apps/web/src/api/client.ts` | Fetch wrapper with error handling |
| `apps/web/src/store/auth.store.ts` | Zustand auth state |
| `apps/web/src/api/hooks/auth.ts` | TanStack Query auth hooks |
| `apps/web/src/pages/login/LoginPage.tsx` | Login + 2FA flow |
| `apps/web/src/components/auth/AuthGuard.tsx` | Route protection |
| `apps/web/src/router.tsx` | TanStack Router config |

**Total: ~30 files for Phases 1-3**

---

*End of Phases 1-3 Detailed Implementation Guide*
