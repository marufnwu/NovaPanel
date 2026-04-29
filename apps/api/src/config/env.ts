import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8443),
  HOST: z.string().default('0.0.0.0'),
  PANEL_URL: z.string().default('https://localhost:8443'),

  DB_PATH: z.string().default('./data/db.sqlite'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SF_ENCRYPTION_KEY: z.string().length(64, 'SF_ENCRYPTION_KEY must be exactly 64 hex characters'),

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

  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().min(1).default(30),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
