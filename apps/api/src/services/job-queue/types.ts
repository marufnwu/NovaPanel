export interface JobPayload {
  [key: string]: unknown;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type JobHandler = (payload: JobPayload) => Promise<JobResult>;

export interface JobDefinition {
  type: string;
  handler: JobHandler;
  maxRetries?: number;
}

export const JOB_TYPES = {
  NGINX_CONFIG_REGENERATE: 'nginx_config_regenerate',
  NGINX_RELOAD: 'nginx_reload',
  PM2_RESTART: 'pm2_restart',
  PM2_STOP: 'pm2_stop',
  SSL_PROVISION: 'ssl_provision',
  DEPLOYMENT_BUILD: 'deployment_build',
  DEPLOYMENT_ROLLBACK: 'deployment_rollback',
  METRIC_COLLECT: 'metric_collect',
  ALERT_EVALUATE: 'alert_evaluate',
} as const;

export type { BackgroundJob } from '../../db/schema/background_jobs.js';