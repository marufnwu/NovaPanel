import { JobHandler, JobResult, JobPayload, JOB_TYPES } from './types.js';
import { run } from '../executor.js';
import { logger } from '../../config/logger.js';
import { nginxService } from '../nginx.service.js';
import { env } from '../../config/env.js';
import { dockerService } from '../../modules/docker/docker.service.js';
import { deploymentsService } from '../../modules/deployments/deployments.service.js';
import { monitoringService } from '../../modules/monitoring/monitoring.service.js';
import { db } from '../../db/index.js';
import { sites, deployments } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { jobEventBus } from '../job-events.js';

// Nginx reload handler
export const nginxReloadHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  try {
    // Validate nginx config first
    const { stdout, stderr, success } = await run('nginx', ['-t'], { sudo: true });
    
    if (!success) {
      logger.error({ stderr }, 'Nginx config validation failed');
      return { success: false, error: `nginx -t failed: ${stderr}` };
    }
    
    // Reload nginx
    const reloadResult = await run('systemctl', ['reload', 'nginx'], { sudo: true });
    
    if (!reloadResult.success) {
      return { success: false, error: `nginx reload failed: ${reloadResult.stderr}` };
    }
    
    logger.info('Nginx reloaded successfully via job queue');
    return { success: true, data: { reloaded: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error }, 'Nginx reload job failed');
    return { success: false, error: message };
  }
};

// Nginx config regenerate handler
export const nginxConfigRegenerateHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  const { siteId } = payload as { siteId: string };
  
  try {
    // Validate nginx config before writing
    const configPath = `${env.NGINX_SITES_AVAILABLE}/site-${siteId}.conf`;
    const testResult = await run('nginx', ['-t', '-c', configPath], { sudo: true });
    
    if (!testResult.success) {
      return { success: false, error: `Nginx config invalid: ${testResult.stderr}` };
    }
    
    // Regenerate config (calls the nginx service)
    await nginxService.generateSiteConfig(siteId);
    
    return { success: true, data: { siteId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
};

// PM2 restart handler
export const pm2RestartHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  const { siteId, processName } = payload as { siteId: string; processName: string };
  
  try {
    const name = processName || `site-${siteId}`;
    const result = await run('pm2', ['restart', name], { sudo: true });
    
    if (!result.success) {
      return { success: false, error: `PM2 restart failed: ${result.stderr}` };
    }
    
    logger.info({ siteId, processName: name }, 'PM2 process restarted via job queue');
    return { success: true, data: { processName: name } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
};

// PM2 stop handler
export const pm2StopHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  const { siteId, processName } = payload as { siteId: string; processName: string };
  
  try {
    const name = processName || `site-${siteId}`;
    const result = await run('pm2', ['stop', name], { sudo: true });
    
    if (!result.success) {
      return { success: false, error: `PM2 stop failed: ${result.stderr}` };
    }
    
    return { success: true, data: { processName: name } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
};

// Deployment build handler
export const deploymentBuildHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  const { siteId, deploymentId } = payload as { siteId: string; deploymentId: string };

  try {
    jobEventBus.emitJob({
      jobId: deploymentId,
      type: 'deployment_build',
      status: 'running',
      message: 'Starting build...',
      progress: 10,
      timestamp: new Date().toISOString(),
    });

    await deploymentsService.updateStatus(deploymentId, 'building');

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) {
      jobEventBus.emitJob({
        jobId: deploymentId,
        type: 'deployment_build',
        status: 'failed',
        message: 'Site not found',
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: 'Site not found' };
    }

    jobEventBus.emitJob({
      jobId: deploymentId,
      type: 'deployment_build',
      status: 'running',
      message: 'Building Docker image...',
      progress: 30,
      timestamp: new Date().toISOString(),
    });

    const imageName = `novapanel/site-${siteId}:${deploymentId}`;
    await dockerService.buildSite(siteId, deploymentId);

    jobEventBus.emitJob({
      jobId: deploymentId,
      type: 'deployment_build',
      status: 'running',
      message: 'Deploying container...',
      progress: 70,
      timestamp: new Date().toISOString(),
    });

    await deploymentsService.updateStatus(deploymentId, 'deploying');
    await dockerService.deploySite(siteId, site.projectId, imageName, site.port || undefined);
    await deploymentsService.updateStatus(deploymentId, 'success');
    await db.update(sites).set({ status: 'active', lastDeploymentId: deploymentId }).where(eq(sites.id, siteId)).returning();

    jobEventBus.emitJob({
      jobId: deploymentId,
      type: 'deployment_build',
      status: 'done',
      message: 'Deployment successful',
      progress: 100,
      timestamp: new Date().toISOString(),
    });

    logger.info({ siteId, deploymentId }, 'Deployment build and deploy completed');
    return { success: true, data: { deploymentId, imageName } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Build/deploy failed';
    await deploymentsService.updateStatus(deploymentId, 'failed', message);
    await db.update(sites).set({ status: 'error' }).where(eq(sites.id, siteId)).returning();

    jobEventBus.emitJob({
      jobId: deploymentId,
      type: 'deployment_build',
      status: 'failed',
      message: `Build failed: ${message}`,
      timestamp: new Date().toISOString(),
    });

    logger.error({ err: error, siteId, deploymentId }, 'Deployment build failed');
    return { success: false, error: message };
  }
};

// Deployment rollback handler
export const deploymentRollbackHandler: JobHandler = async (payload: JobPayload): Promise<JobResult> => {
  const { siteId, targetDeploymentId } = payload as { siteId: string; targetDeploymentId: string };

  try {
    jobEventBus.emitJob({
      jobId: targetDeploymentId,
      type: 'deployment_rollback',
      status: 'running',
      message: 'Starting rollback...',
      progress: 10,
      timestamp: new Date().toISOString(),
    });

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) {
      jobEventBus.emitJob({
        jobId: targetDeploymentId,
        type: 'deployment_rollback',
        status: 'failed',
        message: 'Site not found',
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: 'Site not found' };
    }

    const [targetDeployment] = await db.select().from(deployments).where(eq(deployments.id, targetDeploymentId)).limit(1);
    if (!targetDeployment) {
      jobEventBus.emitJob({
        jobId: targetDeploymentId,
        type: 'deployment_rollback',
        status: 'failed',
        message: 'Target deployment not found',
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: 'Target deployment not found' };
    }

    jobEventBus.emitJob({
      jobId: targetDeploymentId,
      type: 'deployment_rollback',
      status: 'running',
      message: 'Stopping current container...',
      progress: 30,
      timestamp: new Date().toISOString(),
    });

    await dockerService.stopSite(siteId);

    jobEventBus.emitJob({
      jobId: targetDeploymentId,
      type: 'deployment_rollback',
      status: 'running',
      message: 'Deploying previous version...',
      progress: 70,
      timestamp: new Date().toISOString(),
    });

    const rollbackImage = `novapanel/site-${siteId}:${targetDeploymentId}`;
    await dockerService.deploySite(siteId, site.projectId, rollbackImage, site.port || undefined);
    await db.update(sites).set({ status: 'active', lastDeploymentId: targetDeploymentId }).where(eq(sites.id, siteId)).returning();

    jobEventBus.emitJob({
      jobId: targetDeploymentId,
      type: 'deployment_rollback',
      status: 'done',
      message: 'Rollback successful',
      progress: 100,
      timestamp: new Date().toISOString(),
    });

    logger.info({ siteId, targetDeploymentId }, 'Deployment rollback completed');
    return { success: true, data: { rolledBackTo: targetDeploymentId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rollback failed';

    jobEventBus.emitJob({
      jobId: targetDeploymentId,
      type: 'deployment_rollback',
      status: 'failed',
      message: `Rollback failed: ${message}`,
      timestamp: new Date().toISOString(),
    });

    logger.error({ err: error, siteId, targetDeploymentId }, 'Deployment rollback failed');
    return { success: false, error: message };
  }
};

// Metric collect handler
export const metricCollectHandler: JobHandler = async (_payload: JobPayload): Promise<JobResult> => {
  try {
    await monitoringService.collectSystemMetrics();
    logger.debug('System metrics collected');
    return { success: true, data: { collected: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error }, 'Metric collection failed');
    return { success: false, error: message };
  }
};

// Alert evaluate handler
export const alertEvaluateHandler: JobHandler = async (_payload: JobPayload): Promise<JobResult> => {
  try {
    await monitoringService.evaluateAlertRules();
    logger.debug('Alert rules evaluated');
    return { success: true, data: { evaluated: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error }, 'Alert evaluation failed');
    return { success: false, error: message };
  }
};

// Default job handlers map
export const jobHandlers: Record<string, JobHandler> = {
  [JOB_TYPES.NGINX_RELOAD]: nginxReloadHandler,
  [JOB_TYPES.NGINX_CONFIG_REGENERATE]: nginxConfigRegenerateHandler,
  [JOB_TYPES.PM2_RESTART]: pm2RestartHandler,
  [JOB_TYPES.PM2_STOP]: pm2StopHandler,
  [JOB_TYPES.DEPLOYMENT_BUILD]: deploymentBuildHandler,
  [JOB_TYPES.DEPLOYMENT_ROLLBACK]: deploymentRollbackHandler,
  [JOB_TYPES.METRIC_COLLECT]: metricCollectHandler,
  [JOB_TYPES.ALERT_EVALUATE]: alertEvaluateHandler,
};