import { db } from '../../db/index.js';
import { databases, databaseUsers } from '../../db/schema/index.js';
import { eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';

export class DatabasesService {
  async list(projectId?: string): Promise<{ items: typeof databases.$inferSelect[]; total: number }> {
    const items = await db.select().from(databases).where(projectId ? eq(databases.projectId, projectId) : undefined);
    return { items, total: items.length };
  }

  async get(id: string) {
    const [database] = await db.select().from(databases).where(eq(databases.id, id)).limit(1);
    if (!database) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Database not found');
    return database;
  }

  async create(data: {
    projectId: string;
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
      projectId: data.projectId,
      name: data.name,
      type: data.type,
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
}

export const databasesService = new DatabasesService();