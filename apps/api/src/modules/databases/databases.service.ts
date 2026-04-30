import { db } from '../../db/index.js';
import { databases, databaseUsers } from '../../db/schema/databases.js';
import { eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { mariadbService } from '../../services/mariadb.service.js';
import { postgresService } from '../../services/postgres.service.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

export class DatabasesService {
  /**
   * List all databases (optionally filtered by domainId)
   */
  async list(domainId?: string, page: number = 1, perPage: number = 20) {
    const offset = (page - 1) * perPage;

    const query = db.select().from(databases);
    const countQuery = db.select({ total: count() }).from(databases);

    if (domainId) {
      const items = await query.where(eq(databases.domainId, domainId)).limit(perPage).offset(offset);
      const [{ total }] = await countQuery.where(eq(databases.domainId, domainId));
      return { items, meta: { page, perPage, total } };
    }

    const items = await query.limit(perPage).offset(offset);
    const [{ total }] = await countQuery;
    return { items, meta: { page, perPage, total } };
  }

  /**
   * Create a database
   */
  async create(data: { domainId?: string; name: string; engine: 'mariadb' | 'postgresql'; charset?: string }, userId?: string, ipAddress?: string) {
    const dbId = nanoid();
    const dbName = `sf_${data.name.replace(/[^a-z0-9_]/gi, '_')}`;

    // Create in actual DB engine
    if (data.engine === 'mariadb') {
      await mariadbService.createDatabase(dbName);
    } else {
      await postgresService.createDatabase(dbName);
    }

    // Store in panel DB
    await db.insert(databases).values({
      id: dbId,
      domainId: data.domainId || null,
      name: dbName,
      engine: data.engine,
      charset: data.charset || 'utf8mb4',
    });

    logger.info({ name: dbName, engine: data.engine }, 'Database created');

    auditService.log({
      userId,
      action: 'database.create',
      resource: `database:${dbName}`,
      details: JSON.stringify({ engine: data.engine, charset: data.charset }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: dbId, name: dbName, engine: data.engine };
  }

  /**
   * Delete a database
   */
  async delete(databaseId: string, userId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    // Drop in actual engine
    if (database.engine === 'mariadb') {
      await mariadbService.dropDatabase(database.name);
    } else {
      await postgresService.dropDatabase(database.name);
    }

    // Delete all users
    const users = await db.select().from(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
    for (const user of users) {
      if (database.engine === 'mariadb') {
        await mariadbService.dropUser(user.username, user.host || 'localhost');
      } else {
        await postgresService.dropUser(user.username);
      }
    }

    await db.delete(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
    await db.delete(databases).where(eq(databases.id, databaseId));

    logger.info({ name: database.name }, 'Database deleted');

    auditService.log({
      userId,
      action: 'database.delete',
      resource: `database:${database.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Create a database user
   */
  async createUser(databaseId: string, username: string, password: string, host: string = 'localhost', auditUserId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    const dbUsername = `sf_${username.replace(/[^a-z0-9_]/gi, '_')}`;

    if (database.engine === 'mariadb') {
      await mariadbService.createUser(dbUsername, password, host);
      await mariadbService.grantPrivileges(dbUsername, database.name, host);
    } else {
      await postgresService.createUser(dbUsername, password);
      await postgresService.grantPrivileges(dbUsername, database.name);
    }

    const dbUserId = nanoid();
    await db.insert(databaseUsers).values({
      id: dbUserId,
      databaseId,
      username: dbUsername,
      passwordHash: encrypt(password),
      host,
      privileges: JSON.stringify(['ALL']),
    });

    auditService.log({
      userId: auditUserId,
      action: 'database.user.create',
      resource: `db-user:${dbUsername}`,
      details: JSON.stringify({ databaseId, host }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: dbUserId, username: dbUsername, host };
  }

  /**
   * Delete a database user
   */
  async deleteUser(dbUserId: string, auditUserId?: string, ipAddress?: string) {
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.id, dbUserId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const [database] = await db.select().from(databases).where(eq(databases.id, user.databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      await mariadbService.dropUser(user.username, user.host || 'localhost');
    } else {
      await postgresService.dropUser(user.username);
    }

    await db.delete(databaseUsers).where(eq(databaseUsers.id, dbUserId));

    auditService.log({
      userId: auditUserId,
      action: 'database.user.delete',
      resource: `db-user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Change database user password
   */
  async changeUserPassword(dbUserId: string, newPassword: string, auditUserId?: string, ipAddress?: string) {
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.id, dbUserId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const [database] = await db.select().from(databases).where(eq(databases.id, user.databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      await mariadbService.changePassword(user.username, newPassword, user.host || 'localhost');
    } else {
      await postgresService.changePassword(user.username, newPassword);
    }

    await db.update(databaseUsers).set({ passwordHash: encrypt(newPassword) }).where(eq(databaseUsers.id, dbUserId));

    auditService.log({
      userId: auditUserId,
      action: 'database.user.password-change',
      resource: `db-user:${user.username}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Export database
   */
  async exportDatabase(databaseId: string, userId?: string, ipAddress?: string): Promise<string> {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    let dump: string;
    if (database.engine === 'mariadb') {
      dump = await mariadbService.exportDatabase(database.name);
    } else {
      dump = await postgresService.exportDatabase(database.name);
    }

    auditService.log({
      userId,
      action: 'database.export',
      resource: `database:${database.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return dump;
  }

  /**
   * Import database
   */
  async importDatabase(databaseId: string, sql: string, userId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      await mariadbService.importDatabase(database.name, sql);
    } else {
      await postgresService.importDatabase(database.name, sql);
    }

    auditService.log({
      userId,
      action: 'database.import',
      resource: `database:${database.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Get full database info including users and size
   */
  async getDatabaseInfo(databaseId: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    const users = await db.select().from(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
    let sizeBytes = 0;
    if (database.engine === 'mariadb') {
      sizeBytes = await mariadbService.getDatabaseSize(database.name);
    } else {
      sizeBytes = await postgresService.getDatabaseSize(database.name);
    }

    return {
      ...database,
      sizeBytes,
      sizeMb: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        host: u.host,
      })),
    };
  }

  /**
   * Repair MariaDB database tables
   */
  async repairDatabase(databaseId: string, userId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');
    if (database.engine !== 'mariadb') throw new AppError(400, 'ENGINE_NOT_SUPPORTED', 'Repair only available for MariaDB');

    const result = await mariadbService.repairDatabase(database.name);
    logger.info({ database: database.name }, 'Database repaired');

    auditService.log({
      userId,
      action: 'database.repair',
      resource: `database:${database.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return result;
  }

  /**
   * Optimize MariaDB database tables
   */
  async optimizeDatabase(databaseId: string, userId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');
    if (database.engine !== 'mariadb') throw new AppError(400, 'ENGINE_NOT_SUPPORTED', 'Optimize only available for MariaDB');

    const result = await mariadbService.optimizeDatabase(database.name);
    logger.info({ database: database.name }, 'Database optimized');

    auditService.log({
      userId,
      action: 'database.optimize',
      resource: `database:${database.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return result;
  }

  /**
   * Clone database to a new database
   */
  async cloneDatabase(databaseId: string, newName: string, userId?: string, ipAddress?: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    const cleanName = newName.replace(/[^a-z0-9_]/gi, '_');
    const clonedName = `sf_${cleanName}`;

    if (database.engine === 'mariadb') {
      await mariadbService.cloneDatabase(database.name, clonedName);
    } else {
      await postgresService.cloneDatabase(database.name, clonedName);
    }

    const newId = nanoid();
    await db.insert(databases).values({
      id: newId,
      domainId: database.domainId,
      name: clonedName,
      engine: database.engine,
      charset: database.charset,
    });

    logger.info({ original: database.name, clone: clonedName }, 'Database cloned');

    auditService.log({
      userId,
      action: 'database.clone',
      resource: `database:${database.name}`,
      details: JSON.stringify({ cloneName: clonedName }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: newId, name: clonedName, engine: database.engine };
  }

  /**
   * Run an arbitrary SQL query (SELECT only for safety)
   */
  async runQuery(databaseId: string, sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('SHOW') && !trimmed.startsWith('DESCRIBE')) {
      throw new AppError(400, 'QUERY_NOT_ALLOWED', 'Only SELECT, SHOW, and DESCRIBE queries are allowed');
    }

    const [database] = await db.select().from(databases).where(eq(databases.id, databaseId)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');

    if (database.engine === 'mariadb') {
      return mariadbService.runQuery(database.name, sql);
    } else {
      return postgresService.runQuery(database.name, sql);
    }
  }

  /**
   * List databases by websiteId
   */
  async listByWebsite(websiteId: string) {
    return db.select().from(databases).where(eq(databases.websiteId, websiteId));
  }
}
