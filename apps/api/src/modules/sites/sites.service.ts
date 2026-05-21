import { db } from '../../db/index.js';
import { sites, domains } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { CreateSiteInput } from './sites.schema.js';

export class SitesService {
  async list(_options?: { includeRuntime?: boolean }): Promise<typeof sites.$inferSelect[]> {
    return db.select().from(sites);
  }

  async get(id: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) return null;
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, id));
    return { ...site, domains: siteDomains };
  }

  async create(data: CreateSiteInput, _userId?: string, _ipAddress?: string) {
    const siteId = nanoid();
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');
    const runtimeValue = data.runtime?.runtime || 'static';
    const [site] = await db.insert(sites).values({
      id: siteId,
      projectId: data.projectId || '',
      name: data.name,
      slug,
      runtime: runtimeValue as any,
      sourceType: (data.sourceType || 'empty') as any,
      gitRepo: data.gitRepo || null,
      gitBranch: data.gitBranch || 'main',
      buildCommand: data.buildCommand || null,
      startCommand: data.startCommand || null,
      status: 'active',
    }).returning();
    return site;
  }

  async update(id: string, data: Partial<typeof sites.$inferInsert>, _userId?: string, _ipAddress?: string) {
    const [updated] = await db.update(sites).set({ ...data, updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    return updated;
  }

  async delete(id: string, _userId?: string, _ipAddress?: string) {
    await db.delete(sites).where(eq(sites.id, id));
    return { success: true };
  }

  async suspend(id: string, _userId?: string, _ipAddress?: string) {
    const [updated] = await db.update(sites).set({ status: 'suspended', updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) return null;
    return { success: true };
  }

  async activate(id: string, _userId?: string, _ipAddress?: string) {
    const [updated] = await db.update(sites).set({ status: 'active', updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) return null;
    return { success: true };
  }

  async attachDomain(siteId: string, domainId: string, _userId?: string, _ipAddress?: string) {
    await db.update(domains).set({ siteId }).where(eq(domains.id, domainId));
    return { success: true };
  }

  async detachDomain(siteId: string, domainId: string, _userId?: string, _ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (domain?.siteId !== siteId) return { success: false };
    await db.update(domains).set({ siteId: null }).where(eq(domains.id, domainId));
    return { success: true };
  }
}

export const sitesService = new SitesService();