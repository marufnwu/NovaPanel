import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function runMigrations() {
  const client = createClient({ url: `file:${env.DB_PATH}` });
  const db = drizzle(client);
  logger.info('Running migrations...');
  await migrate(db, { migrationsFolder: './dist/db/migrations' });
  logger.info('Migrations complete');
}

runMigrations().catch(console.error);
