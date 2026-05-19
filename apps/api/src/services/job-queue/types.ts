import { JOB_TYPES } from '../../db/schema/background_jobs.js';

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

// Re-export JOB_TYPES for convenience
export { JOB_TYPES };
export type { BackgroundJob } from '../../db/schema/background_jobs.js';