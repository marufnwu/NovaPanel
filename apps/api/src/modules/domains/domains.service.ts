import { db } from '../../db/index.js';
import { domains, sites, siteRuntimes } from '../../db/schema/index.js';
import { eq, and, like, count, sql } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { run } from '../../services/executor.js';
import { nginxService } from '../../services/nginx.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { nanoid } from 'nanoid';
import { auditService } from '../audit/audit.service.js';
import { TunnelService } from '../tunnel/tunnel.service.js';

interface ListOptions {
  page?: number;
  perPage?: number;
  search?: string;
  siteId?: string;
  type?: string;
  isSubdomain?: boolean;
}

interface ListResult {
  items: any[];
  total: number;
  page: number;
  perPage: number;
}

export class DomainsService {
  async list(options: ListOptions = {}): Promise<ListResult> {
    const page = options.page || 1;
    const perPage = options.perPage || 20;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (options.search) conditions.push(like(domains.name, `%${options.search}%`));
    if (options.siteId) conditions.push(eq(domains.siteId, options.siteId));
    if (options.type) conditions.push(eq(domains.type, options.type as any));
    if (options.isSubdomain !== undefined) conditions.push(eq(domains.isSubdomain, options.isSubdomain));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select().from(domains).where(where).limit(perPage).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(domains).where(where);

    return { items, total, page, perPage };
  }

  async get(id: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    return domain;
  }

  async create(data: {
    name: string;
    type?: 'primary' | 'addon' | 'parked' | 'subdomain' | 'redirect' | 'mail-only';
    siteId?: string | null;
    parentDomainId?: string | null;
    redirectTarget?: string | null;
    documentRoot?: string | null;
    sslEnabled?: boolean;
    status?: string;
    userId?: string;
    ipAddress?: string;
  }) {
    const {
      name,
      type = 'primary',
      siteId = null,
      parentDomainId = null,
      redirectTarget = null,
      documentRoot = null,
      sslEnabled = false,
      status = 'active',
    } = data;

    const [existing] = await db.select().from(domains).where(eq(domains.name, name)).limit(1);
    if (existing) throw new AppError(409, 'DOMAIN_EXISTS', 'Domain already exists on this server');

    if (parentDomainId) {
      const [parent] = await db.select().from(domains).where(eq(domains.id, parentDomainId)).limit(1);
      if (!parent) throw new AppError(404, 'PARENT_DOMAIN_NOT_FOUND', 'Parent domain not found');
    }

    const isSubdomain = this.checkIsSubdomain(name);

    const domainId = nanoid();
    await db.insert(domains).values({
      id: domainId,
      name,
      type: type as any,
      siteId,
      parentDomainId,
      redirectTarget,
      documentRoot,
      sslEnabled,
      status: status as any,
      isSubdomain,
    });

    logger.info({ domainId, name, type }, 'Domain created successfully');

    auditService.log({
      userId: data.userId,
      action: 'domain.create',
      resource: `domain:${name}`,
      details: JSON.stringify({ domainId, name, type, siteId, parentDomainId }),
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [created] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    return created;
  }

  async update(id: string, data: {
    documentRoot?: string | null;
    redirectTarget?: string | null;
    type?: 'primary' | 'addon' | 'parked' | 'subdomain' | 'redirect' | 'mail-only';
    sslEnabled?: boolean;
    status?: string;
    userId?: string;
    ipAddress?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const updateData: Record<string, any> = {};
    if (data.documentRoot !== undefined) updateData.documentRoot = data.documentRoot;
    if (data.redirectTarget !== undefined) updateData.redirectTarget = data.redirectTarget;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.sslEnabled !== undefined) updateData.sslEnabled = data.sslEnabled;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      await db.update(domains).set(updateData).where(eq(domains.id, id));
    }

    logger.info({ domainId: id }, 'Domain updated');

    auditService.log({
      userId: data.userId,
      action: 'domain.update',
      resource: `domain:${domain.name}`,
      details: JSON.stringify(data),
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [updated] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    return updated;
  }

  async delete(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.delete(domains).where(eq(domains.id, id));
    logger.info({ domainId: id, name: domain.name }, 'Domain deleted');

    auditService.log({
      userId,
      action: 'domain.delete',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ domainId: id }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async suspend(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ status: 'suspended' }).where(eq(domains.id, id));
    logger.info({ domainId: id }, 'Domain suspended');

    auditService.log({
      userId,
      action: 'domain.suspend',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async activate(id: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    await db.update(domains).set({ status: 'active' }).where(eq(domains.id, id));
    logger.info({ domainId: id }, 'Domain activated');

    auditService.log({
      userId,
      action: 'domain.activate',
      resource: `domain:${domain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async makePrimary(domainId: string, userId?: string, ipAddress?: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    if (!['addon', 'parked'].includes(domain.type)) {
      throw new AppError(422, 'INVALID_DOMAIN_TYPE', 'Only addon or parked domains can be promoted to primary');
    }

    const currentPrimary = domain.siteId
      ? await db.select().from(domains)
          .where(and(eq(domains.siteId, domain.siteId), eq(domains.isPrimary, true)))
          .limit(1)
          .then(rows => rows[0] || null)
      : null;

    if (currentPrimary) {
      await db.update(domains).set({ isPrimary: false, type: 'addon' }).where(eq(domains.id, currentPrimary.id));
    }

    await db.update(domains).set({ isPrimary: true, type: 'primary' }).where(eq(domains.id, domainId));

    logger.info({ domainId, domain: domain.name, siteId: domain.siteId }, 'Domain promoted to primary');

    auditService.log({
      userId,
      action: 'domain.makePrimary',
      resource: `domain:${domain.name}`,
      details: JSON.stringify({ domainId, previousPrimaryId: currentPrimary?.id }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async listSubdomains(domainId: string) {
    return db.select().from(domains)
      .where(and(eq(domains.parentDomainId, domainId), eq(domains.isSubdomain, true)));
  }

  async createSubdomain(domainId: string, data: {
    name: string;
    documentRoot?: string;
    sslEnabled?: boolean;
    userId?: string;
    ipAddress?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const subdomainName = `${data.name}.${domain.name}`;
    const subdomainId = nanoid();
    const isSubdomain = true;

    await db.insert(domains).values({
      id: subdomainId,
      name: subdomainName,
      type: 'subdomain',
      siteId: domain.siteId,
      parentDomainId: domainId,
      documentRoot: data.documentRoot || null,
      sslEnabled: data.sslEnabled || false,
      status: 'active',
      isSubdomain,
    });

    logger.info({ subdomainId, name: subdomainName, parentDomainId: domainId }, 'Subdomain created');

    auditService.log({
      userId: data.userId,
      action: 'domain.subdomain.create',
      resource: `subdomain:${subdomainName}`,
      details: JSON.stringify({ domainId, subdomainId, name: subdomainName }),
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [created] = await db.select().from(domains).where(eq(domains.id, subdomainId)).limit(1);
    return created;
  }

  async deleteSubdomain(domainId: string, subdomainId: string, userId?: string, ipAddress?: string) {
    const [subdomain] = await db.select().from(domains).where(eq(domains.id, subdomainId)).limit(1);
    if (!subdomain) throw new AppError(404, 'SUBDOMAIN_NOT_FOUND', 'Subdomain not found');

    await db.delete(domains).where(eq(domains.id, subdomainId));
    logger.info({ subdomainId }, 'Subdomain deleted');

    auditService.log({
      userId,
      action: 'domain.subdomain.delete',
      resource: `subdomain:${subdomain.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async listAliases(domainId: string) {
    return db.select().from(domains)
      .where(and(eq(domains.parentDomainId, domainId), eq(domains.type, 'addon')));
  }

  async createAlias(domainId: string, data: {
    alias: string;
    documentRoot?: string;
    sslEnabled?: boolean;
    userId?: string;
    ipAddress?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const aliasId = nanoid();

    await db.insert(domains).values({
      id: aliasId,
      name: data.alias,
      type: 'addon',
      siteId: domain.siteId,
      parentDomainId: domainId,
      documentRoot: data.documentRoot || domain.documentRoot,
      sslEnabled: data.sslEnabled || false,
      status: 'active',
      isSubdomain: this.checkIsSubdomain(data.alias),
    });

    logger.info({ aliasId, alias: data.alias, parentDomainId: domainId }, 'Alias created');

    auditService.log({
      userId: data.userId,
      action: 'domain.alias.create',
      resource: `alias:${data.alias}`,
      details: JSON.stringify({ domainId, aliasId, alias: data.alias }),
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [created] = await db.select().from(domains).where(eq(domains.id, aliasId)).limit(1);
    return created;
  }

  async deleteAlias(domainId: string, aliasId: string, userId?: string, ipAddress?: string) {
    const [alias] = await db.select().from(domains).where(eq(domains.id, aliasId)).limit(1);
    if (!alias) throw new AppError(404, 'ALIAS_NOT_FOUND', 'Alias not found');

    await db.delete(domains).where(eq(domains.id, aliasId));
    logger.info({ aliasId }, 'Alias deleted');

    auditService.log({
      userId,
      action: 'domain.alias.delete',
      resource: `alias:${alias.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async listRedirects(domainId: string) {
    return db.select().from(domains)
      .where(and(eq(domains.parentDomainId, domainId), eq(domains.type, 'redirect')));
  }

  async createRedirect(domainId: string, data: {
    name: string;
    redirectTarget: string;
    userId?: string;
    ipAddress?: string;
  }) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    const redirectId = nanoid();

    await db.insert(domains).values({
      id: redirectId,
      name: data.name,
      type: 'redirect',
      siteId: domain.siteId,
      parentDomainId: domainId,
      redirectTarget: data.redirectTarget,
      status: 'active',
      isSubdomain: this.checkIsSubdomain(data.name),
    });

    logger.info({ redirectId, name: data.name, redirectTarget: data.redirectTarget }, 'Redirect created');

    auditService.log({
      userId: data.userId,
      action: 'domain.redirect.create',
      resource: `redirect:${data.name}`,
      details: JSON.stringify({ domainId, redirectId, name: data.name, redirectTarget: data.redirectTarget }),
      ipAddress: data.ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    const [created] = await db.select().from(domains).where(eq(domains.id, redirectId)).limit(1);
    return created;
  }

  async deleteRedirect(domainId: string, redirectId: string, userId?: string, ipAddress?: string) {
    const [redirect] = await db.select().from(domains).where(eq(domains.id, redirectId)).limit(1);
    if (!redirect) throw new AppError(404, 'REDIRECT_NOT_FOUND', 'Redirect not found');

    await db.delete(domains).where(eq(domains.id, redirectId));
    logger.info({ redirectId }, 'Redirect deleted');

    auditService.log({
      userId,
      action: 'domain.redirect.delete',
      resource: `redirect:${redirect.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  async getLogStats(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logDir = `${env.VHOSTS_ROOT}/${domain.name}/logs`;
      const accessLogPath = `${logDir}/access.log`;
      const errorLogPath = `${logDir}/error.log`;

      let totalRequests = 0;
      try {
        const wcResult = await run('wc', ['-l', accessLogPath], { sudo: true });
        totalRequests = parseInt(wcResult.stdout.trim().split(' ')[0], 10) || 0;
      } catch { }

      let errorCount = 0;
      try {
        const wcResult = await run('wc', ['-l', errorLogPath], { sudo: true });
        errorCount = parseInt(wcResult.stdout.trim().split(' ')[0], 10) || 0;
      } catch { }

      const errorRate = totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) / 100 : 0;

      return { totalRequests, errorCount, errorRate, topUrls: [] };
    } catch {
      return { totalRequests: 0, errorCount: 0, errorRate: 0, topUrls: [] };
    }
  }

  async getAccessLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logPath = `${env.VHOSTS_ROOT}/${domain.name}/logs/access.log`;
      const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
      return result.stdout;
    } catch {
      return '';
    }
  }

  async getErrorLog(domainId: string, lines: number = 100): Promise<string> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    try {
      const logPath = `${env.VHOSTS_ROOT}/${domain.name}/logs/error.log`;
      const result = await run('tail', ['-n', String(lines), logPath], { sudo: true });
      return result.stdout;
    } catch {
      return '';
    }
  }

  async getCloudflareStatus(domainId: string) {
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');

    return {
      hasSsl: !!domain.sslEnabled,
      overall: domain.status === 'suspended' ? 'suspended' : 'local',
    };
  }

  private checkIsSubdomain(name: string): boolean {
    const parts = name.split('.');
    return parts.length > 2 || (parts.length === 2 && parts[0] !== 'www');
  }
}