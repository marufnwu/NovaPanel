import { db } from '../../db/index.js';
import { databases, databaseUsers } from '../../db/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';
import { mariadbService } from '../../services/mariadb.service.js';
import { postgresService } from '../../services/postgres.service.js';
import { logger } from '../../config/logger.js';

export class DatabasesService {
  async list(orgId?: string): Promise<{ items: typeof databases.$inferSelect[]; total: number }> {
    const items = await db.select().from(databases).where(orgId ? eq(databases.orgId, orgId) : undefined);
    return { items, total: items.length };
  }

  async get(id: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, id)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');
    return database;
  }

  async create(data: {
    orgId: string;
    name: string;
    type: 'postgresql' | 'mysql' | 'mariadb' | 'mongodb' | 'redis' | 'sqlite';
    version?: string;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
    backupsEnabled?: boolean;
    backupSchedule?: string;
    publicAccess?: boolean;
  }) {
    const [database] = await db.insert(databases).values({
      id: nanoid(),
      orgId: data.orgId,
      name: data.name,
      type: data.type as 'postgresql' | 'mysql' | 'mariadb' | 'mongodb' | 'redis' | 'sqlite',
      version: data.version || null,
      host: data.host || 'localhost',
      port: data.port || null,
      databaseName: data.databaseName || null,
      username: data.username || null,
      password: data.password || null,
      backupsEnabled: data.backupsEnabled ?? true,
      backupSchedule: data.backupSchedule || '0 2 * * *',
      publicAccess: data.publicAccess ?? false,
      status: 'creating',
    }).returning();
    return database;
  }

  async update(id: string, data: Partial<{
    name: string;
    backupsEnabled: boolean;
    backupSchedule: string;
    publicAccess: boolean;
    status: 'running' | 'stopped' | 'error';
  }>) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.backupsEnabled !== undefined) updateData.backupsEnabled = data.backupsEnabled;
    if (data.backupSchedule !== undefined) updateData.backupSchedule = data.backupSchedule;
    if (data.publicAccess !== undefined) updateData.publicAccess = data.publicAccess;
    if (data.status !== undefined) updateData.status = data.status;

    const [updated] = await db.update(databases).set(updateData).where(eq(databases.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Database not found');
    return updated;
  }

  async delete(id: string) {
    await db.delete(databaseUsers).where(eq(databaseUsers.databaseId, id));
    await db.delete(databases).where(eq(databases.id, id));
    return { success: true };
  }

  async start(id: string) {
    const [updated] = await db.update(databases).set({ status: 'running', updatedAt: new Date() }).where(eq(databases.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Database not found');
    return updated;
  }

  async stop(id: string) {
    const [updated] = await db.update(databases).set({ status: 'stopped', updatedAt: new Date() }).where(eq(databases.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Database not found');
    return updated;
  }

  async restart(id: string) {
    const [updated] = await db.update(databases).set({ status: 'running', updatedAt: new Date() }).where(eq(databases.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Database not found');
    return updated;
  }

  async listUsers(databaseId: string) {
    return db.select().from(databaseUsers).where(eq(databaseUsers.databaseId, databaseId));
  }

  async createUser(data: { databaseId: string; username: string; password?: string; privileges?: string[] }) {
    const [user] = await db.insert(databaseUsers).values({
      id: nanoid(),
      databaseId: data.databaseId,
      username: data.username,
      password: data.password || null,
      privileges: JSON.stringify(data.privileges || []),
    }).returning();
    return user;
  }

  async deleteUser(id: string) {
    await db.delete(databaseUsers).where(eq(databaseUsers.id, id));
    return { success: true };
  }

  async updateUserPrivileges(id: string, privileges: string[]) {
    const [updated] = await db.update(databaseUsers).set({ privileges: JSON.stringify(privileges) }).where(eq(databaseUsers.id, id)).returning();
    return updated;
  }

  /**
   * Get database service based on database type
   */
  private getDbService(type: string) {
    switch (type) {
      case 'postgresql':
        return postgresService;
      case 'mariadb':
      case 'mysql':
        return mariadbService;
      default:
        throw new AppError(400, 'UNSUPPORTED_DATABASE_TYPE', `Database type ${type} is not supported`);
    }
  }

  /**
   * Change password for database user
   */
  async changePassword(databaseId: string, password: string) {
    const database = await this.get(databaseId);
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.databaseId, databaseId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const service = this.getDbService(database.type);
    await service.changePassword(user.username, password);
    logger.info({ databaseId, username: user.username }, 'Database user password changed');
    return { success: true };
  }

  /**
   * Change password for a specific database user
   */
  async changeUserPassword(databaseId: string, userId: string, password: string) {
    const database = await this.get(databaseId);
    const [user] = await db.select().from(databaseUsers).where(eq(databaseUsers.id, userId)).limit(1);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Database user not found');

    const service = this.getDbService(database.type);
    await service.changePassword(user.username, password);
    logger.info({ databaseId, userId, username: user.username }, 'Database user password changed');
    return { success: true };
  }

  /**
   * Export database to SQL
   */
  async exportDatabase(databaseId: string, outputPath?: string) {
    const database = await this.get(databaseId);
    const service = this.getDbService(database.type);
    const sql = await service.exportDatabase(database.databaseName!);

    // If output path specified, write to file
    if (outputPath) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outputPath, sql, 'utf-8');
      logger.info({ databaseId, outputPath }, 'Database exported to file');
    }

    return { success: true, data: sql };
  }

  /**
   * Import SQL into database
   */
  async importDatabase(databaseId: string, sql: string) {
    const database = await this.get(databaseId);
    const service = this.getDbService(database.type);
    await service.importDatabase(database.databaseName!, sql);
    logger.info({ databaseId }, 'Database imported');
    return { success: true };
  }

  /**
   * Repair database tables
   */
  async repairDatabase(databaseId: string) {
    const database = await this.get(databaseId);
    const service = this.getDbService(database.type);
    const result = await service.repairDatabase(database.databaseName!);
    logger.info({ databaseId }, 'Database repaired');
    return { success: result.success, output: result.output };
  }

  /**
   * Optimize database tables
   */
  async optimizeDatabase(databaseId: string) {
    const database = await this.get(databaseId);
    const service = this.getDbService(database.type);
    const result = await service.optimizeDatabase(database.databaseName!);
    logger.info({ databaseId }, 'Database optimized');
    return { success: result.success, output: result.output };
  }

  /**
   * Clone/duplicate database
   */
  async cloneDatabase(databaseId: string, targetName: string) {
    const database = await this.get(databaseId);
    const service = this.getDbService(database.type);
    await service.cloneDatabase(database.databaseName!, targetName);
    logger.info({ databaseId, targetName }, 'Database cloned');
    return { success: true };
  }

  /**
   * Run SQL query (with safety restrictions)
   * [P3-3] Security note: LIMIT is applied in the query itself to prevent fetching
   * excessive rows from the database when only a subset is needed.
   */
  async runQuery(databaseId: string, sql: string, limit: number = 1000) {
    const database = await this.get(databaseId);

    // Security: only allow SELECT statements for raw queries
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT') && !trimmedSql.startsWith('SHOW') && !trimmedSql.startsWith('DESCRIBE') && !trimmedSql.startsWith('EXPLAIN')) {
      throw new AppError(400, 'INVALID_QUERY', 'Only SELECT, SHOW, DESCRIBE, or EXPLAIN queries are allowed');
    }

    // [P3-3] Apply LIMIT directly in the query for efficiency
    // Append LIMIT clause only if not already present in the query
    let querySql = sql.trim();
    const hasLimit = /LIMIT\s+\d+/i.test(querySql);
    if (!hasLimit) {
      // Remove any trailing semicolon and append LIMIT
      querySql = querySql.replace(/;?\s*$/, '') + ` LIMIT ${limit}`;
    }

    const service = this.getDbService(database.type);
    const result = await service.runQuery(database.databaseName!, querySql);

    logger.info({ databaseId, rowCount: result.rows.length }, 'Query executed');
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rows.length,
      totalRows: result.rowCount,
      truncated: hasLimit || result.rowCount > limit,
    };
  }
}

export const databasesService = new DatabasesService();