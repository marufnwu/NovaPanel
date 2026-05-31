import type { FastifyInstance } from 'fastify';
import { sitesService } from './sites.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { createSiteSchema, updateSiteSchema, attachDomainToSiteSchema, detachDomainFromSiteSchema, type CreateSiteInput } from './sites.schema.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../../errors.js';
import { domainsService } from '../domains/domains.service.js';

export default async function siteRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (req) => {
    const { search } = req.query as { search?: string };
    const items = await sitesService.list({ search });
    return { success: true, data: items };
  });

  fastify.post('/', async (req, reply) => {
    const data: CreateSiteInput = createSiteSchema.parse(req.body);
    const site = await sitesService.create(data, req.user.id, req.ip);
    return reply.status(201).send({ success: true, data: site });
  });

  fastify.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.get(id);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }
    return { success: true, data: site };
  });

  fastify.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateSiteSchema.parse(req.body);
    const site = await sitesService.update(id, data, req.user.id, req.ip);
    return { success: true, data: site };
  });

  fastify.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.delete(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/:id/suspend', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.suspend(id, req.user.id, req.ip);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Site not found');
    return { success: true, data: result };
  });

  fastify.post('/:id/activate', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.activate(id, req.user.id, req.ip);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Site not found');
    return { success: true, data: result };
  });

  fastify.post('/:id/domains/attach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = attachDomainToSiteSchema.parse(req.body);
    const result = await sitesService.attachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/:id/domains/detach', async (req) => {
    const { id } = req.params as { id: string };
    const { domainId } = detachDomainFromSiteSchema.parse(req.body);
    const result = await sitesService.detachDomain(id, domainId, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/:id/domains', async (req) => {
    const { id } = req.params as { id: string };
    const domains = await domainsService.listBySite(id);
    return { success: true, data: domains };
  });

  fastify.get('/:id/stats', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.get(id);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }
    // Get stats from nginx/apache status or docker stats if site is containerized
    const stats = await sitesService.getStats(id);
    return { success: true, data: stats };
  });

  fastify.get('/:id/health', async (req) => {
    const { id } = req.params as { id: string };
    const health = await sitesService.getHealth(id);
    return { success: true, data: health };
  });

  // Site build/deploy
  fastify.post('/:id/build', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.build(id);
    return reply.status(202).send({ success: true, data: result });
  });

  fastify.post('/:id/deploy', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.deploy(id);
    return reply.status(202).send({ success: true, data: result });
  });

  fastify.get('/:id/deployments', async (req) => {
    const { id } = req.params as { id: string };
    const deployments = await deploymentsService.listBySite(id);
    return { success: true, data: deployments };
  });

  fastify.post('/:id/deployments/:deploymentId/rollback', async (req, reply) => {
    const { id, deploymentId } = req.params as { id: string; deploymentId: string };
    const result = await sitesService.rollbackToDeployment(id, deploymentId);
    return reply.status(202).send({ success: true, data: result });
  });

  // Site info
  fastify.get('/:id/logs', async (req) => {
    const { id } = req.params as { id: string };
    const logs = await sitesService.getLogs(id);
    return { success: true, data: logs };
  });

  fastify.get('/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const status = await sitesService.getStatus(id);
    return { success: true, data: status };
  });

  fastify.post('/:id/stop', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.stop(id);
    return { success: true, data: result };
  });

  fastify.post('/:id/restart', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.restart(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.post('/:id/clear-cache', async (req) => {
    const { id } = req.params as { id: string };
    const result = await sitesService.clearCache(id, req.user.id, req.ip);
    return { success: true, data: result };
  });

  fastify.get('/:id/deployment-settings', async (req) => {
    const { id } = req.params as { id: string };
    const site = await sitesService.get(id);
    if (!site) throw new AppError(404, 'NOT_FOUND', 'Site not found');
    return {
      success: true,
      data: {
        id: site.id,
        siteId: site.id,
        gitRepo: site.gitRepo,
        gitBranch: site.gitBranch,
        gitCredentials: site.gitCredentials ? JSON.parse(site.gitCredentials as string) : null,
        autoDeploy: site.autoDeploy,
        deployOnPush: site.deployOnPush,
        deployOnPr: site.deployOnPr,
        buildCommand: site.buildCommand,
        installCommand: site.installCommand,
        outputDirectory: site.outputDirectory,
        deployPath: site.deployPath,
        preDeployHook: site.preDeployHook,
        postDeployHook: site.postDeployHook,
        healthCheckPath: site.healthCheckPath,
        autoRollback: site.autoRollback,
        createdAt: site.createdAt?.toISOString(),
        updatedAt: site.updatedAt?.toISOString(),
      },
    };
  });

  fastify.put('/:id/deployment-settings', async (req) => {
    const { id } = req.params as { id: string };
    const data = req.body as {
      gitRepo?: string;
      gitBranch?: string;
      gitCredentials?: { username?: string; password?: string; sshKey?: string } | null;
      autoDeploy?: boolean;
      deployOnPush?: boolean;
      deployOnPr?: boolean;
      buildCommand?: string;
      installCommand?: string;
      outputDirectory?: string;
      deployPath?: string;
      preDeployHook?: string;
      postDeployHook?: string;
      healthCheckPath?: string;
      autoRollback?: boolean;
    };
    const updated = await sitesService.update(id, {
      gitRepo: data.gitRepo ?? null,
      gitBranch: data.gitBranch ?? 'main',
      gitCredentials: data.gitCredentials ? JSON.stringify(data.gitCredentials) : null,
      autoDeploy: data.autoDeploy ?? false,
      deployOnPush: data.deployOnPush ?? false,
      deployOnPr: data.deployOnPr ?? false,
      buildCommand: data.buildCommand ?? null,
      installCommand: data.installCommand ?? null,
      outputDirectory: data.outputDirectory ?? 'dist',
      deployPath: data.deployPath ?? '/var/www/html',
      preDeployHook: data.preDeployHook ?? null,
      postDeployHook: data.postDeployHook ?? null,
      healthCheckPath: data.healthCheckPath ?? '/health',
      autoRollback: data.autoRollback ?? true,
    }, req.user.id, req.ip);
    return { success: true, data: updated };
  });

  // Configuration endpoints
  fastify.get('/:id/dockerfile', async (req) => {
    const { id } = req.params as { id: string };
    const dockerfile = await sitesService.getDockerfile(id);
    return { success: true, data: dockerfile };
  });

  fastify.get('/:id/cron', async (req) => {
    const { id } = req.params as { id: string };
    const cronJobs = await sitesService.getCronJobs(id);
    return { success: true, data: cronJobs };
  });

  fastify.get('/:id/database', async (req) => {
    const { id } = req.params as { id: string };
    const database = await sitesService.getDatabase(id);
    if (!database) return { success: false, error: 'No database attached to this site' };
    return { success: true, data: database };
  });

  fastify.get('/:id/ssl', async (req) => {
    const { id } = req.params as { id: string };
    const ssl = await sitesService.getSsl(id);
    if (!ssl) return { success: false, error: 'No SSL certificate configured' };
    return { success: true, data: ssl };
  });

  fastify.get('/:id/dns', async (req) => {
    const { id } = req.params as { id: string };
    const dns = await sitesService.getDns(id);
    return { success: true, data: dns };
  });

  fastify.get('/:id/php', async (req) => {
    const { id } = req.params as { id: string };
    const php = await sitesService.getPhp(id);
    return { success: true, data: php };
  });

  fastify.get('/:id/webserver', async (req) => {
    const { id } = req.params as { id: string };
    const config = await sitesService.getWebserver(id);
    return { success: true, data: config };
  });

  // Environment Variables
  fastify.get('/:id/env', async (req) => {
    const { id } = req.params as { id: string };
    const envVars = await sitesService.getEnvVars(id);
    return { success: true, data: envVars };
  });

  fastify.post('/:id/env', async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as { key: string; value: string; isSecret?: boolean };
    const envVar = await sitesService.createEnvVar(id, data);
    return reply.status(201).send({ success: true, data: envVar });
  });

  fastify.put('/:id/env/:envId', async (req) => {
    const { id, envId } = req.params as { id: string; envId: string };
    const data = req.body as { key?: string; value?: string; isSecret?: boolean };
    const envVar = await sitesService.updateEnvVar(id, envId, data);
    return { success: true, data: envVar };
  });

  fastify.delete('/:id/env/:envId', async (req) => {
    const { id, envId } = req.params as { id: string; envId: string };
    await sitesService.deleteEnvVar(id, envId);
    return { success: true, data: { id: envId } };
  });

  // Site Activity Feed
  fastify.get('/:id/activities', async (req) => {
    const { id } = req.params as { id: string };
    const { type, limit: limitStr, offset: offsetStr, page: pageStr } = req.query as Record<string, string | undefined>;
    
    const limit = Math.min(parseInt(limitStr || '20'), 100);
    const offset = parseInt(offsetStr || '0');
    const page = Math.max(1, parseInt(pageStr || '1'));
    
    const activities = await sitesService.getActivities(id, { type, limit, offset });
    return { 
      success: true, 
      data: {
        items: activities.items,
        total: activities.total,
        page,
        perPage: limit,
        totalPages: Math.ceil(activities.total / limit),
      }
    };
  });

  fastify.get('/:id/activities/recent', async (req) => {
    const { id } = req.params as { id: string };
    const activities = await sitesService.getRecentActivities(id, 10);
    return { success: true, data: activities };
  });
}