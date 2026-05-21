import { db } from '../../db/index.js';
import { registries } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';

export class RegistriesService {
  async list(orgId?: string) {
    return db.select().from(registries).where(orgId ? eq(registries.orgId, orgId) : undefined);
  }

  async get(id: string) {
    const [registry] = await db.select().from(registries).where(eq(registries.id, id)).limit(1);
    return registry || null;
  }

  async create(data: {
    orgId: string;
    name: string;
    provider: 'dockerhub' | 'ghcr' | 'ecr' | 'gcr' | 'selfhosted';
    url?: string;
    username?: string;
    password?: string;
  }) {
    const [registry] = await db.insert(registries).values({
      id: nanoid(),
      orgId: data.orgId,
      name: data.name,
      provider: data.provider,
      url: data.url || null,
      username: data.username || null,
      password: data.password || null,
    }).returning();
    return registry;
  }

  async update(id: string, data: Partial<{
    name: string;
    url: string;
    username: string;
    password: string;
  }>) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password !== undefined) updateData.password = data.password;

    const [updated] = await db.update(registries).set(updateData).where(eq(registries.id, id)).returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(registries).where(eq(registries.id, id));
    return { success: true };
  }
}

export const registriesService = new RegistriesService();