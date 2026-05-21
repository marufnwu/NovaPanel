import { db } from '../../db/index.js';
import { wafRules, ipAllowlists, type WafRule, type NewWafRule, type IpAllowlist, type NewIpAllowlist } from '../../db/schema/security.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { nginxService } from '../../services/nginx.service.js';

export class SecurityService {
  async listWafRules(projectId: string): Promise<WafRule[]> {
    return db.select().from(wafRules).where(eq(wafRules.projectId, projectId)).orderBy(wafRules.priority);
  }

  async createWafRule(projectId: string, data: Omit<NewWafRule, 'id' | 'projectId' | 'createdAt'>): Promise<WafRule> {
    const rule: NewWafRule = {
      id: nanoid(),
      projectId,
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? true,
      priority: data.priority ?? 100,
      config: data.config ?? {},
      createdAt: new Date(),
    };
    await db.insert(wafRules).values(rule);
    const [created] = await db.select().from(wafRules).where(eq(wafRules.id, rule.id)).limit(1);
    await nginxService.applySecurityRules(projectId).catch(() => {});
    return created;
  }

  async updateWafRule(id: string, data: Partial<Pick<WafRule, 'name' | 'type' | 'enabled' | 'priority' | 'config'>>): Promise<WafRule> {
    await db.update(wafRules).set({ ...data, updatedAt: new Date() }).where(eq(wafRules.id, id));
    const [updated] = await db.select().from(wafRules).where(eq(wafRules.id, id)).limit(1);
    if (!updated) throw new Error('WAF rule not found');
    await nginxService.applySecurityRules(updated.projectId).catch(() => {});
    return updated;
  }

  async deleteWafRule(id: string): Promise<void> {
    const [rule] = await db.select().from(wafRules).where(eq(wafRules.id, id)).limit(1);
    await db.delete(wafRules).where(eq(wafRules.id, id));
    if (rule) await nginxService.applySecurityRules(rule.projectId).catch(() => {});
  }

  async listIpAllowlists(projectId: string): Promise<IpAllowlist[]> {
    return db.select().from(ipAllowlists).where(eq(ipAllowlists.projectId, projectId)).orderBy(ipAllowlists.createdAt);
  }

  async createIpAllowlist(projectId: string, data: Omit<NewIpAllowlist, 'id' | 'projectId' | 'createdAt'>): Promise<IpAllowlist> {
    const allowlist: NewIpAllowlist = {
      id: nanoid(),
      projectId,
      name: data.name,
      ips: data.ips ?? [],
      type: data.type,
      createdAt: new Date(),
    };
    await db.insert(ipAllowlists).values(allowlist);
    const [created] = await db.select().from(ipAllowlists).where(eq(ipAllowlists.id, allowlist.id)).limit(1);
    await nginxService.applySecurityRules(projectId).catch(() => {});
    return created;
  }

  async updateIpAllowlist(id: string, data: Partial<Pick<IpAllowlist, 'name' | 'ips' | 'type'>>): Promise<IpAllowlist> {
    await db.update(ipAllowlists).set({ ...data, updatedAt: new Date() }).where(eq(ipAllowlists.id, id));
    const [updated] = await db.select().from(ipAllowlists).where(eq(ipAllowlists.id, id)).limit(1);
    if (!updated) throw new Error('IP allowlist not found');
    await nginxService.applySecurityRules(updated.projectId).catch(() => {});
    return updated;
  }

  async deleteIpAllowlist(id: string): Promise<void> {
    const [list] = await db.select().from(ipAllowlists).where(eq(ipAllowlists.id, id)).limit(1);
    await db.delete(ipAllowlists).where(eq(ipAllowlists.id, id));
    if (list) await nginxService.applySecurityRules(list.projectId).catch(() => {});
  }
}

export const securityService = new SecurityService();