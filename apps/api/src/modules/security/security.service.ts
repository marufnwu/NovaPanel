import { db } from '../../db/index.js';
import { wafRules, ipAllowlists, type WafRule, type NewWafRule, type IpAllowlist, type NewIpAllowlist } from '../../db/schema/security.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { nginxService } from '../../services/nginx.service.js';
import { logger } from '../../config/logger.js';

export class SecurityService {
  async listWafRules(orgId: string): Promise<WafRule[]> {
    return db.select().from(wafRules).where(eq(wafRules.orgId, orgId)).orderBy(wafRules.priority);
  }

  async createWafRule(orgId: string, data: Omit<NewWafRule, 'id' | 'orgId' | 'createdAt'>): Promise<WafRule> {
    const rule: NewWafRule = {
      id: nanoid(),
      orgId,
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? true,
      priority: data.priority ?? 100,
      config: data.config ?? {},
      createdAt: new Date(),
    };
    await db.insert(wafRules).values(rule);
    const [created] = await db.select().from(wafRules).where(eq(wafRules.id, rule.id)).limit(1);
    await nginxService.applySecurityRules(orgId).catch((err) => logger.warn({ err, orgId }, 'Failed to apply nginx security rules'));
    return created;
  }

  async updateWafRule(id: string, orgId: string, data: Partial<Pick<WafRule, 'name' | 'type' | 'enabled' | 'priority' | 'config'>>): Promise<WafRule> {
    await db.update(wafRules).set({ ...data, updatedAt: new Date() }).where(eq(wafRules.id, id));
    const [updated] = await db.select().from(wafRules).where(eq(wafRules.id, id)).limit(1);
    if (!updated) throw new Error('WAF rule not found');
    await nginxService.applySecurityRules(orgId).catch(() => {});
    return updated;
  }

  async deleteWafRule(id: string, orgId: string): Promise<void> {
    await db.delete(wafRules).where(eq(wafRules.id, id));
    await nginxService.applySecurityRules(orgId).catch(() => {});
  }

  async listIpAllowlists(orgId: string): Promise<IpAllowlist[]> {
    return db.select().from(ipAllowlists).where(eq(ipAllowlists.orgId, orgId)).orderBy(ipAllowlists.createdAt);
  }

  async createIpAllowlist(orgId: string, data: Omit<NewIpAllowlist, 'id' | 'orgId' | 'createdAt'>): Promise<IpAllowlist> {
    const allowlist: NewIpAllowlist = {
      id: nanoid(),
      orgId,
      name: data.name,
      ips: data.ips ?? [],
      type: data.type,
      createdAt: new Date(),
    };
    await db.insert(ipAllowlists).values(allowlist);
    const [created] = await db.select().from(ipAllowlists).where(eq(ipAllowlists.id, allowlist.id)).limit(1);
    await nginxService.applySecurityRules(orgId).catch((err) => logger.warn({ err, orgId }, 'Failed to apply nginx security rules'));
    return created;
  }

  async updateIpAllowlist(id: string, orgId: string, data: Partial<Pick<IpAllowlist, 'name' | 'ips' | 'type'>>): Promise<IpAllowlist> {
    await db.update(ipAllowlists).set({ ...data, updatedAt: new Date() }).where(eq(ipAllowlists.id, id));
    const [updated] = await db.select().from(ipAllowlists).where(eq(ipAllowlists.id, id)).limit(1);
    if (!updated) throw new Error('IP allowlist not found');
    await nginxService.applySecurityRules(orgId).catch(() => {});
    return updated;
  }

  async deleteIpAllowlist(id: string, orgId: string): Promise<void> {
    await db.delete(ipAllowlists).where(eq(ipAllowlists.id, id));
    await nginxService.applySecurityRules(orgId).catch(() => {});
  }
}

export const securityService = new SecurityService();
