import { db } from '../../db/index.js';
import { sites, domains, sslCertificates, databases } from '../../db/schema/index.js';
import { cronJobs } from '../../db/schema/cron.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { CreateSiteInput } from './sites.schema.js';
import { dockerService } from '../docker/docker.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { AppError } from '../../errors.js';

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
    return site;
  }

  async update(id: string, data: Partial<typeof sites.$inferInsert>, _userId?: string, _ipAddress?: string) {
    // Note: Authorization is handled at the route layer via auth middleware.
    // Single admin installation - site operations are inherently permitted.
    const [updated] = await db.update(sites).set({ ...data, updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) throw new Error('Site not found');
    return updated;
  }

  async delete(id: string, _userId?: string, _ipAddress?: string) {
    // Note: Authorization is handled at the route layer via auth middleware.
    // Single admin installation - site operations are inherently permitted.
    await db.delete(sites).where(eq(sites.id, id));
    return { success: true };
  }

  async suspend(id: string, _userId?: string, _ipAddress?: string) {
    // Note: Authorization is handled at the route layer via auth middleware.
    const [updated] = await db.update(sites).set({ status: 'suspended', updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) return null;
    return { success: true };
  }

  async activate(id: string, _userId?: string, _ipAddress?: string) {
    // Note: Authorization is handled at the route layer via auth middleware.
    const [updated] = await db.update(sites).set({ status: 'active', updatedAt: new Date() }).where(eq(sites.id, id)).returning();
    if (!updated) return null;
    return { success: true };
  }

  async attachDomain(siteId: string, domainId: string, _userId?: string, _ipAddress?: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
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

    // TODO [P3-11]: Site statistics require nginx metrics pipeline integration.
    // Currently returns placeholder data - production needs:
    // - nginx stub_status for traffic metrics
    // - docker stats API for container-based sites
    // - systemd metrics for system services
    // Deferred until metrics infrastructure is implemented.
    const uptimeSeconds = site.createdAt ? Math.floor((Date.now() - new Date(site.createdAt).getTime()) / 1000) : 0;
    return {
      visitorsToday: Math.floor(Math.random() * 500),
      bandwidthToday: Math.floor(Math.random() * 1000) + ' MB',
      diskUsage: Math.floor(Math.random() * 5000) + ' MB',
      cpuUsage: Math.floor(Math.random() * 30),
      memoryUsage: Math.floor(Math.random() * 50),
      requestsPerMinute: Math.floor(Math.random() * 200),
      avgResponseTime: Math.floor(Math.random() * 500) + ' ms',
      uptime: this.formatUptime(uptimeSeconds || 0),
    };
  }

  async getHealth(id: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    if (!site) throw new Error('Site not found');

    // In a real implementation, this would check:
    // - Web server status (nginx/apache)
    // - PHP-FPM status
    // - Database connectivity
    // - DNS resolution
    const isHealthy = site.status === 'active';
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      webServer: 'running',
      phpFpm: site.runtime?.includes('php') ? 'running' : 'not_applicable',
      database: 'connected',
      lastCheck: new Date().toISOString(),
      issues: [] as string[],
    };
  }

  async build(siteId: string): Promise<{ deploymentId: string }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const deployment = await deploymentsService.create({
      siteId,
      sourceType: (site.sourceType || 'git') as 'git' | 'docker_registry' | 'upload' | 'rollback',
    });

    // Run build in background
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

    // Run full deploy pipeline in background
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
    // Query cron jobs associated with this site using the siteId field
    const jobs = await db.select().from(cronJobs).where(eq(cronJobs.siteId, siteId));
    return jobs;
  }

  async getDatabase(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // Look up database by orgId in the databases table
    if (!site.orgId) return null;
    const [database] = await db.select().from(databases).where(eq(databases.orgId, site.orgId)).limit(1);
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

    return {
      domain: primaryDomain.name,
      expiresAt: cert.expiresAt,
      validFrom: cert.createdAt,
      autoRenew: true,
      status: cert.status,
    };
  }

  async getDns(siteId: string) {
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));
    // Return DNS records for the site's domains
    return { items: siteDomains.map(d => ({ id: d.id, name: d.name, type: 'A', value: '...', proxied: d.proxyEnabled })) };
  }

  async getPhp(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    return {
      version: site.runtimeVersion || '8.3',
      configPath: `/etc/php/${site.runtimeVersion || '8.3'}/fpm/php.ini`,
      poolPath: `/etc/php/${site.runtimeVersion || '8.3'}/fpm/pool.d/${site.name}.conf`,
    };
  }

  async getWebserver(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    return {
      type: 'nginx',
      configPath: `/etc/nginx/sites-available/${site.name}.conf`,
      enabledPath: `/etc/nginx/sites-enabled/${site.name}.conf`,
      documentRoot: `/var/www/${site.orgId}/${site.name}`,
    };
  }

  // Built-in environment variables based on runtime
  private getBuiltInEnvVars(site: typeof sites.$inferSelect): Array<{ key: string; value: string; isSecret: boolean; source: 'builtin' }> {
    const builtins: Array<{ key: string; value: string; isSecret: boolean; source: 'builtin' }> = [
      { key: 'NODE_ENV', value: 'production', isSecret: false, source: 'builtin' },
      { key: 'APP_ENV', value: 'production', isSecret: false, source: 'builtin' },
      { key: 'PORT', value: String(site.port || 3000), isSecret: false, source: 'builtin' },
    ];

    if (site.runtime?.includes('php')) {
      builtins.push(
        { key: 'PHP_VERSION', value: site.runtimeVersion || '8.3', isSecret: false, source: 'builtin' },
        { key: 'PHP_FPM_MODE', value: 'socket', isSecret: false, source: 'builtin' }
      );
    }

    return builtins;
  }

  async getEnvVars(siteId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // Return built-in env vars plus any database-stored custom env vars
    // In a real implementation, there would be a site_env_vars table
    // For now, return built-in env vars as examples
    const builtins = this.getBuiltInEnvVars(site);

    return builtins.map((b, i) => ({
      id: `builtin-${i}`,
      key: b.key,
      value: b.value,
      isSecret: b.isSecret,
      source: b.source as 'builtin',
      createdAt: site.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: site.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async createEnvVar(siteId: string, data: { key: string; value: string; isSecret?: boolean }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // In a real implementation, would insert into site_env_vars table
    // Currently returns mock data
    const envVar = {
      id: `env-${Date.now()}`,
      key: data.key,
      value: data.value,
      isSecret: data.isSecret ?? false,
      source: 'database' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return envVar;
  }

  async updateEnvVar(siteId: string, envId: string, data: { key?: string; value?: string; isSecret?: boolean }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // In a real implementation, would update in site_env_vars table
    const envVar = {
      id: envId,
      key: data.key || '',
      value: data.value || '',
      isSecret: data.isSecret ?? false,
      source: 'database' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return envVar;
  }

  async deleteEnvVar(siteId: string, envId: string) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    // In a real implementation, would delete from site_env_vars table
    // Built-in vars cannot be deleted, but we allow the API call for custom vars
    if (envId.startsWith('builtin-')) {
      throw new AppError(400, 'CANNOT_DELETE_BUILTIN', 'Cannot delete built-in environment variables');
    }

    return { success: true };
  }

  async getActivities(siteId: string, options?: { type?: string; limit?: number; offset?: number }) {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // Aggregate activities from multiple sources:
    // 1. Deployments (from deployments table in sites schema)
    // 2. Cron jobs (from cron_jobs table)
    // 3. Site events (builds, deploys, restarts, etc.)
    // For now, generate mock activities based on site state
    // Real implementation would query actual activity_logs table
    
    const activities: Array<{
      id: string;
      siteId: string;
      type: string;
      action: string;
      description: string;
      details?: Record<string, any>;
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

    // Add deployment activities if we have deployment history
    if ((site as any).lastDeploymentId) {
      activities.push({
        id: `activity-${Date.now()}-1`,
        siteId,
        type: 'deployment',
        action: 'site.deployment.completed',
        description: `Deployment completed successfully`,
        details: { deploymentId: (site as any).lastDeploymentId },
        timestamp: new Date().toISOString(),
        metadata: { resourceType: 'deployment', resourceId: (site as any).lastDeploymentId },
      });
    }

    // Add site status activity
    activities.push({
      id: `activity-${Date.now()}-2`,
      siteId,
      type: 'system',
      action: 'site.status',
      description: `Site is ${site.status}`,
      details: { status: site.status },
      timestamp: new Date(site.updatedAt || site.createdAt).toISOString(),
    });

    // Sort by timestamp descending and apply pagination
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