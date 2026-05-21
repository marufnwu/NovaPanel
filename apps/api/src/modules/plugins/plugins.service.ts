import { db } from '../../db/index.js';
import { plugins, type Plugin, type NewPlugin } from '../../db/schema/plugins.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class PluginsService {
  async list(): Promise<Plugin[]> {
    return db.select().from(plugins).orderBy(desc(plugins.createdAt));
  }

  async get(id: string): Promise<Plugin | null> {
    const [p] = await db.select().from(plugins).where(eq(plugins.id, id)).limit(1);
    return p ?? null;
  }

  async create(data: Omit<NewPlugin, 'id' | 'createdAt'>): Promise<Plugin> {
    const plugin: NewPlugin = {
      id: nanoid(),
      name: data.name,
      version: data.version,
      description: data.description,
      author: data.author,
      manifest: data.manifest ?? {},
      enabled: data.enabled ?? false,
      config: data.config ?? {},
      createdAt: new Date(),
    };
    await db.insert(plugins).values(plugin);
    const [created] = await db.select().from(plugins).where(eq(plugins.id, plugin.id)).limit(1);
    return created;
  }

  async update(id: string, data: Partial<Pick<Plugin, 'name' | 'version' | 'description' | 'author' | 'manifest' | 'enabled' | 'config'>>): Promise<Plugin> {
    await db.update(plugins).set({ ...data, updatedAt: new Date() }).where(eq(plugins.id, id));
    const [updated] = await db.select().from(plugins).where(eq(plugins.id, id)).limit(1);
    if (!updated) throw new Error('Plugin not found');
    return updated;
  }

  async delete(id: string): Promise<void> {
    await db.delete(plugins).where(eq(plugins.id, id));
  }

  async toggle(id: string): Promise<Plugin> {
    const plugin = await this.get(id);
    if (!plugin) throw new Error('Plugin not found');
    return this.update(id, { enabled: !plugin.enabled });
  }

  async updateConfig(id: string, config: Record<string, unknown>): Promise<Plugin> {
    return this.update(id, { config });
  }
}

export const pluginsService = new PluginsService();