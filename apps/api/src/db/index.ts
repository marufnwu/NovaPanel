import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const libsql = createClient({
  url: `file:${env.DB_PATH}`,
});

export const db = drizzle(libsql, { schema });
export type Database = typeof db;
