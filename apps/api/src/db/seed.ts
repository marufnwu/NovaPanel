import { db } from './index.js';
import { users } from './schema/index.js';
import { hashPassword } from '../utils/crypto.js';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function seed() {
  logger.info('Seeding database...');

  // Check if admin user already exists
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    logger.info('Database already seeded — skipping');
    return;
  }

  // Create admin user (single admin — no plans, no subscriptions)
  const adminId = nanoid();
  // NOTE: ADMIN_PASSWORD in .env is PLAINTEXT. This function reads the plaintext password
  // from env and stores only the HASH in the database. The .env file always retains the
  // plaintext password so the user can see it and login. Hashing happens only at
  // seed time (first install) and at login verification time.
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await db.insert(users).values({
    id: adminId,
    username: 'admin',
    email: env.ADMIN_EMAIL,
    displayName: 'Administrator',
    passwordHash,
    role: 'admin',
    isActive: true,
    twoFactorEnabled: false,
    mustChangePassword: true, // Force password change on first login
  });

  logger.info('Seed complete: admin user created (must change password on first login)');
}

seed().catch(console.error);
