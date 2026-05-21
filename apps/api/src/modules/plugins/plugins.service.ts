import { db } from '../../db/index.js';
import { plugins, type Plugin, type NewPlugin } from '../../db/schema/plugins.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { VM } from 'vm2';

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

    if (created.enabled) {
      this.executeHook(created.id, 'onEnable').catch(() => {});
    }
    this.executeHook(created.id, 'onInstall').catch(() => {});

    return created;
  }

  async update(id: string, data: Partial<Pick<Plugin, 'name' | 'version' | 'description' | 'author' | 'manifest' | 'enabled' | 'config'>>): Promise<Plugin> {
    await db.update(plugins).set({ ...data, updatedAt: new Date() }).where(eq(plugins.id, id));
    const [updated] = await db.select().from(plugins).where(eq(plugins.id, id)).limit(1);
    if (!updated) throw new Error('Plugin not found');
    return updated;
  }

  async delete(id: string): Promise<void> {
    const plugin = await this.get(id);
    if (plugin) {
      this.executeHook(id, 'onUninstall').catch(() => {});
    }
    await db.delete(plugins).where(eq(plugins.id, id));
  }

  async toggle(id: string): Promise<Plugin> {
    const plugin = await this.get(id);
    if (!plugin) throw new Error('Plugin not found');
    const wasEnabled = plugin.enabled;
    const updated = await this.update(id, { enabled: !plugin.enabled });

    if (!wasEnabled && updated.enabled) {
      this.executeHook(updated.id, 'onEnable').catch(() => {});
    } else if (wasEnabled && !updated.enabled) {
      this.executeHook(updated.id, 'onDisable').catch(() => {});
    }

    return updated;
  }

  async updateConfig(id: string, config: Record<string, unknown>): Promise<Plugin> {
    const updated = await this.update(id, { config });
    this.executeHook(id, 'onConfigChange', { config }).catch(() => {});
    return updated;
  }

  async executeHook(pluginId: string, hookName: string, hookData: Record<string, unknown> = {}): Promise<unknown> {
    const plugin = await this.get(pluginId);
    if (!plugin) throw new Error('Plugin not found');
    if (!plugin.enabled) throw new Error('Plugin is disabled');

    const manifest = plugin.manifest as Record<string, { code: string; language: string } | undefined>;
    const hook = manifest[hookName];
    if (!hook) return undefined;
    if (hook.language !== 'javascript') throw new Error(`Unsupported hook language: ${hook.language}`);

    const vm = new VM({
      timeout: 5000,
      eval: false,
      wasm: false,
      sandbox: { hookData },
    });

    return vm.run(hook.code);
  }
}

export const pluginsService = new PluginsService();