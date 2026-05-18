import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface JobEvent {
  jobId: string;
  type: string;
  status: JobStatus;
  message: string;
  progress?: number;
  timestamp: string;
  userId?: string;
}

/**
 * Global singleton event emitter for background job lifecycle events.
 * Services emit events here; the WebSocket handler broadcasts to connected clients.
 */
class JobEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Emit a job lifecycle event.
   */
  emitJob(event: JobEvent) {
    this.emit('job', event);
    logger.debug({ jobId: event.jobId, status: event.status }, 'Job event emitted');
  }

  /**
   * Subscribe to job events. Returns an unsubscribe function.
   */
  onJob(handler: (event: JobEvent) => void): () => void {
    this.on('job', handler);
    return () => this.off('job', handler);
  }
}

export const jobEventBus = new JobEventBus();

/**
 * Helper to create and emit a job-queued event.
 */
export function emitJobQueued(jobId: string, type: string, message: string, userId?: string) {
  jobEventBus.emitJob({
    jobId,
    type,
    status: 'queued',
    message,
    timestamp: new Date().toISOString(),
    userId,
  });
}

/**
 * Helper to create and emit a job-running event.
 */
export function emitJobRunning(jobId: string, type: string, message: string, progress = 0, userId?: string) {
  jobEventBus.emitJob({
    jobId,
    type,
    status: 'running',
    message,
    progress,
    timestamp: new Date().toISOString(),
    userId,
  });
}

/**
 * Helper to create and emit a job-done event.
 */
export function emitJobDone(jobId: string, type: string, message: string, userId?: string) {
  jobEventBus.emitJob({
    jobId,
    type,
    status: 'done',
    message,
    timestamp: new Date().toISOString(),
    userId,
  });
}

/**
 * Helper to create and emit a job-failed event.
 */
export function emitJobFailed(jobId: string, type: string, message: string, userId?: string) {
  jobEventBus.emitJob({
    jobId,
    type,
    status: 'failed',
    message,
    timestamp: new Date().toISOString(),
    userId,
  });
}