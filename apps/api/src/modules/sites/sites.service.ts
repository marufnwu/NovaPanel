import { db } from '../../db/index.js';
import { sites, domains, sslCertificates, databases, siteEnvVars } from '../../db/schema/index.js';
import { cronJobs, cronHistory } from '../../db/schema/cron.js';
import { deployments } from '../../db/schema/sites.js';
import { eq, desc, and, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { CreateSiteInput } from './sites.schema.js';
import { dockerService } from '../docker/docker.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { AppError } from '../../errors.js';
import { auditService } from '../audit/audit.service.js';

export class SitesService {
  async list(options?: { search?: string }): Promise<typeof sites.$inferSelect[]> {
    if (options?.search) {
      return db.select().from(sites).where(like(sites.name, `%${options.search}%`));
    }
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
      orgId: undefined,
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

    if (data.primaryDomain) {
      await this.attachDomain(siteId, data.primaryDomain, _userId, _ipAddress);
    }

    return site;
  }

  async update(id: string, data: Partial<typeof sites.$inferInsert>, _userId?: string, _ipAddress?: string) {
    const [updated] = await db.update(sites).set({ ...data, updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) throw new Error('Site not found');
    return updated;
  }

  async delete(id: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // Cascade delete site-related records
    await db.delete(siteEnvVars).where(eq(siteEnvVars.siteId, id));
    await db.delete(deployments).where(eq(deployments.siteId, id));
    await db.delete(cronJobs).where(eq(cronJobs.siteId, id));

    // Detach domains from this site (don't delete the domains themselves)
    await db.update(domains).set({ siteId: null }).where(eq(domains.siteId, id));

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

  async restart(id: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    await dockerService.restartSite(id);
    return { success: true };
  }

  async clearCache(id: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    await dockerService.clearCache(id);
    return { success: true };
  }

  async attachDomain(siteId: string, domainId: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new AppError(404, 'DOMAIN_NOT_FOUND', 'Domain not found');
    await db.update(domains).set({ siteId }).where(eq(domains.id, domainId));
    return { success: true };
  }

  async detachDomain(siteId: string, domainId: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (domain?.siteId !== siteId) return { success: false };
    await db.update(domains).set({ siteId: null }).where(eq(domains.id, domainId));
    return { success: true };
  }

  async getStats(id: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new Error('Site not found');

    const uptimeSeconds = site.createdAt ? Math.floor((Date.now() - new Date(site.createdAt).getTime()) / 1000) : 0;
    const formattedUptime = this.formatUptime(uptimeSeconds || 0);
    return {
      visitorsToday: 0,
      bandwidthToday: '0 MB',
      diskUsage: '0 MB',
      cpuUsage: 0,
      memoryUsage: 0,
      requestsPerMinute: 0,
      avgResponseTime: '0 ms',
      uptime: formattedUptime,
    };
  }

  async getHealth(id: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new Error('Site not found');

    const isHealthy = site.status === 'active';
    const uptimeSeconds = site.createdAt ? Math.floor((Date.now() - new Date(site.createdAt).getTime()) / 1000) : 0;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      webServer: 'running',
      phpFpm: site.runtime?.includes('php') ? 'running' : 'not_applicable',
      database: 'connected',
      lastCheck: new Date().toISOString(),
      issues: [] as string[],
      uptime24h: uptimeSeconds > 0 ? 100 : 100,
      uptime7d: uptimeSeconds > 0 ? 100 : 100,
      uptime30d: uptimeSeconds > 0 ? 100 : 100,
      avgResponseTime: 0,
      errorRate4xx: 0,
      errorRate5xx: 0,
      lastSuccessfulCheck: new Date().toISOString(),
      checkInterval: 60,
      healthCheckUrl: site.healthCheckPath || '/health',
      consecutiveFailures: 0,
      failures: [],
    };
  }

  async build(siteId: string): Promise<{ deploymentId: string }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const deployment = await deploymentsService.create({
      siteId,
      sourceType: (site.sourceType || 'git') as 'git' | 'docker_registry' | 'upload' | 'rollback',
    });

    dockerService.buildSite(siteId, deployment.id).catch(err => {
      console.error('Build failed:', err);
    });

    return { deploymentId: deployment.id };
  }

  async deploy(siteId: string): Promise<{ deploymentId: string }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const deployment = await deploymentsService.create({
      siteId,
      sourceType: (site.sourceType || 'git') as 'git' | 'docker_registry' | 'upload' | 'rollback',
    });

    const imageName = `novapanel/site-${siteId}:${deployment.id}`;
    dockerService.buildSite(siteId, deployment.id).then(() => {
      return dockerService.deploySite(siteId, site.orgId, imageName, site.port || undefined);
    }).catch(err => {
      console.error('Deploy failed:', err);
    });

    return { deploymentId: deployment.id };
  }

  async rollbackToDeployment(siteId: string, deploymentId: string): Promise<{ deploymentId: string }> {
    const result = await deploymentsService.rollback(siteId, deploymentId);
    return { deploymentId: result.id };
  }

  async getLogs(siteId: string, lines = 200): Promise<{ logs: string }> {
    const logs = await dockerService.getLogs(siteId, lines);
    return { logs };
  }

  async getStatus(siteId: string): Promise<{ running: boolean; containerId?: string }> {
    return dockerService.getContainerStatus(siteId);
  }

  async stop(id: string): Promise<{ success: boolean }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    await dockerService.stopSite(id);
    await db.update(sites).set({ status: 'stopped', updatedAt: new Date() }).where(eq(sites.id, id));
    return { success: true };
  }

  async getDockerfile(siteId: string): Promise<{ dockerfile: string }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    const dockerfile = dockerService.generateDockerfileForRuntime(
      site.runtime,
      site.runtimeVersion || undefined,
      site.startCommand || undefined,
      site.port || undefined
    );
    return { dockerfile };
  }

  async getCronJobs(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    const jobs = await db.select().from(cronJobs).where(eq(cronJobs.siteId, siteId));
    return jobs;
  }

  async getDatabase(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    if (!site.databaseId) return null;
    const [database] = await db.select().from(databases).where(eq(databases.id, site.databaseId)).limit(1);
    if (!database) return null;

    return {
      id: database.id,
      name: database.name,
      engine: database.type,
      status: database.status,
    };
  }

  async getSsl(siteId: string) {
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));
    if (siteDomains.length === 0) return null;

    const primaryDomain = siteDomains[0];
    const [cert] = await db.select().from(sslCertificates)
      .where(eq(sslCertificates.domainId, primaryDomain.id))
      .limit(1);

    if (!cert) return null;

    const issuedAt = cert.issuedAt ? new Date(cert.issuedAt) : null;
    const expiresAt = cert.expiresAt ? new Date(cert.expiresAt) : null;
    const daysUntilExpiry = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

    const issuerMap: Record<string, string> = {
      letsencrypt: "Let's Encrypt",
      zerossl: "ZeroSSL",
      google: "Google Trust Services",
      custom: "Custom",
      self_signed: "Self-Signed",
    };
    const issuer = issuerMap[cert.type] || cert.type;

    return {
      domainId: primaryDomain.id,
      domain: primaryDomain.name,
      issuer,
      type: cert.type,
      issuedAt: issuedAt?.toISOString() || null,
      expiresAt: expiresAt?.toISOString() || null,
      daysUntilExpiry,
      autoRenew: cert.autoRenew,
      status: cert.status,
      sanDomains: [] as string[],
    };
  }

  async getDns(siteId: string) {
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));
    return { items: siteDomains.map(d => ({ id: d.id, name: d.name, type: 'A', value: '<server_ip>', proxied: d.proxyEnabled })) };
  }

  async getPhp(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    return {
      version: site.runtimeVersion || '8.3',
      memoryLimit: site.memoryLimit ? `${site.memoryLimit}M` : null,
      maxExecutionTime: null,
      configPath: `/etc/php/${site.runtimeVersion || '8.3'}/fpm/php.ini`,
      poolPath: `/etc/php/${site.runtimeVersion || '8.3'}/fpm/pool.d/${site.name}.conf`,
    };
  }

  async getWebserver(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId)).limit(1);
    const primaryDomain = siteDomains[0] || null;

    return {
      type: 'nginx',
      configPath: `/etc/nginx/sites-available/${site.name}.conf`,
      enabledPath: `/etc/nginx/sites-enabled/${site.name}.conf`,
      documentRoot: `/var/www/${site.orgId || 'default'}/${site.name}`,
      forceHttps: primaryDomain?.forceHttps ?? true,
      gzip: true,
      caching: 'none',
    };
  }

  private getBuiltInEnvVars(site: typeof sites.$inferSelect): Array<{ id: string; key: string; value: string; isSecret: boolean; source: 'builtin'; createdAt: string; updatedAt: string }> {
    const builtins: Array<{ id: string; key: string; value: string; isSecret: boolean; source: 'builtin'; createdAt: string; updatedAt: string }> = [
      { id: 'builtin-0', key: 'NODE_ENV', value: 'production', isSecret: false, source: 'builtin', createdAt: site.createdAt?.toISOString() || new Date().toISOString(), updatedAt: site.createdAt?.toISOString() || new Date().toISOString() },
      { id: 'builtin-1', key: 'APP_ENV', value: 'production', isSecret: false, source: 'builtin', createdAt: site.createdAt?.toISOString() || new Date().toISOString(), updatedAt: site.createdAt?.toISOString() || new Date().toISOString() },
      { id: 'builtin-2', key: 'PORT', value: String(site.port || 3000), isSecret: false, source: 'builtin', createdAt: site.createdAt?.toISOString() || new Date().toISOString(), updatedAt: site.createdAt?.toISOString() || new Date().toISOString() },
    ];

    if (site.runtime?.includes('php')) {
      builtins.push(
        { id: 'builtin-3', key: 'PHP_VERSION', value: site.runtimeVersion || '8.3', isSecret: false, source: 'builtin', createdAt: site.createdAt?.toISOString() || new Date().toISOString(), updatedAt: site.createdAt?.toISOString() || new Date().toISOString() },
        { id: 'builtin-4', key: 'PHP_FPM_MODE', value: 'socket', isSecret: false, source: 'builtin', createdAt: site.createdAt?.toISOString() || new Date().toISOString(), updatedAt: site.createdAt?.toISOString() || new Date().toISOString() }
      );
    }

    return builtins;
  }

  async getEnvVars(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const customVars = await db.select().from(siteEnvVars).where(eq(siteEnvVars.siteId, siteId));
    const builtins = this.getBuiltInEnvVars(site);

    return [
      ...customVars.map(v => ({
        id: v.id,
        key: v.key,
        value: v.value,
        isSecret: v.isSystem,
        source: (v.scope === 'secret' ? 'database' : v.scope) as 'env_file' | 'database' | 'builtin',
        createdAt: v.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: v.updatedAt?.toISOString() || new Date().toISOString(),
      })),
      ...builtins,
    ];
  }

  async createEnvVar(siteId: string, data: { key: string; value: string; isSecret?: boolean }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const id = nanoid();
    await db.insert(siteEnvVars).values({
      id,
      siteId,
      key: data.key,
      value: data.value,
      scope: data.isSecret ? 'secret' : 'runtime',
      isSystem: false,
    });

    return {
      id,
      key: data.key,
      value: data.value,
      isSecret: data.isSecret ?? false,
      source: 'database' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateEnvVar(siteId: string, envId: string, data: { key?: string; value?: string; isSecret?: boolean }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const [existing] = await db.select().from(siteEnvVars).where(and(eq(siteEnvVars.id, envId), eq(siteEnvVars.siteId, siteId))).limit(1);
    if (!existing) throw new AppError(404, 'ENV_VAR_NOT_FOUND', 'Environment variable not found');

    await db.update(siteEnvVars).set({
      key: data.key ?? existing.key,
      value: data.value ?? existing.value,
      scope: data.isSecret ? 'secret' : 'runtime',
      updatedAt: new Date(),
    }).where(and(eq(siteEnvVars.id, envId), eq(siteEnvVars.siteId, siteId)));

    return {
      id: envId,
      key: data.key ?? existing.key,
      value: data.value ?? existing.value,
      isSecret: data.isSecret ?? false,
      source: 'database' as const,
      createdAt: existing.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async deleteEnvVar(siteId: string, envId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    if (envId.startsWith('builtin-')) {
      throw new AppError(400, 'CANNOT_DELETE_BUILTIN', 'Cannot delete built-in environment variables');
    }

    await db.delete(siteEnvVars).where(and(eq(siteEnvVars.id, envId), eq(siteEnvVars.siteId, siteId)));
    return { success: true };
  }

  async getActivities(siteId: string, options?: { type?: string; limit?: number; offset?: number }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const activities: Array<{
      id: string;
      siteId: string;
      type: string;
      action: string;
      description: string;
      details?: Record<string, unknown>;
      userId?: string;
      userName?: string;
      timestamp: string;
      metadata?: {
        ipAddress?: string;
        userAgent?: string;
        resourceType?: string;
        resourceId?: string;
      };
    }> = [];

    const siteDeployments = await db.select().from(deployments)
      .where(eq(deployments.siteId, siteId))
      .orderBy(desc(deployments.createdAt))
      .limit(20);

    for (const dep of siteDeployments) {
      activities.push({
        id: `dep-${dep.id}`,
        siteId,
        type: 'deployment',
        action: `site.deployment.${dep.status}`,
        description: dep.status === 'success'
          ? `Deployment #${dep.sequence} completed successfully`
          : dep.status === 'failed'
          ? `Deployment #${dep.sequence} failed${dep.errorMessage ? ': ' + dep.errorMessage : ''}`
          : `Deployment #${dep.sequence} ${dep.status}`,
        details: { deploymentId: dep.id, sequence: dep.sequence, status: dep.status, commitSha: dep.commitSha },
        timestamp: dep.createdAt?.toISOString() || new Date().toISOString(),
        metadata: { resourceType: 'deployment', resourceId: dep.id },
      });
    }

    const siteCronJobs = await db.select().from(cronJobs).where(eq(cronJobs.siteId, siteId));
    for (const job of siteCronJobs) {
      if (job.lastRunAt) {
        activities.push({
          id: `cron-${job.id}`,
          siteId,
          type: 'cron',
          action: 'cron.job.completed',
          description: `Cron job "${job.name}" ran at ${new Date(job.lastRunAt).toLocaleString()}${job.lastExitCode !== 0 ? ' (exit code ' + job.lastExitCode + ')' : ''}`,
          details: { jobId: job.id, jobName: job.name, exitCode: job.lastExitCode },
          timestamp: new Date(job.lastRunAt).toISOString(),
          metadata: { resourceType: 'cron', resourceId: job.id },
        });
      }
    }

    activities.push({
      id: `site-status-${site.id}`,
      siteId,
      type: 'system',
      action: 'site.status',
      description: `Site is ${site.status}`,
      details: { status: site.status },
      timestamp: new Date(site.updatedAt || site.createdAt).toISOString(),
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const filtered = options?.type && options.type !== 'all'
      ? activities.filter(a => a.type === options.type)
      : activities;

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  async getRecentActivities(siteId: string, limit: number = 10) {
    const result = await this.getActivities(siteId, { limit });
    return result.items.slice(0, limit);
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

export const sitesService = new SitesService();
