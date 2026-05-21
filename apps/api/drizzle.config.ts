import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/drizzle-schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./data/db.sqlite',
  },
});
