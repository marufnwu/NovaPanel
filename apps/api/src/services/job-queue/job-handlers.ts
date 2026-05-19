import { JobHandler, JobResult, JobPayload, JOB_TYPES } from './types.js';
import { run } from '../executor.js';
import { logger } from '../../config/logger.js';
import { nginxService } from '../nginx.service.js';
import { env } from '../../config/env.js';

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

// Default job handlers map
export const jobHandlers: Record<string, JobHandler> = {
  [JOB_TYPES.NGINX_RELOAD]: nginxReloadHandler,
  [JOB_TYPES.NGINX_CONFIG_REGENERATE]: nginxConfigRegenerateHandler,
  [JOB_TYPES.PM2_RESTART]: pm2RestartHandler,
  [JOB_TYPES.PM2_STOP]: pm2StopHandler,
};