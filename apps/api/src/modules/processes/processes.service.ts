import { getProcessManager } from '../../services/process-manager/index.js';
import { ProcessStatus, ProcessConfig } from '../../services/process-manager/types.js';
import { logger } from '../../config/logger.js';

export interface ProcessInfo {
  name: string;
  status: ProcessStatus;
}

export class ProcessesService {
  /**
   * Get all processes managed by the process manager
   */
  async listProcesses(): Promise<ProcessInfo[]> {
    const manager = await getProcessManager();

    // Try to get all processes via PM2 jlist
    const { run } = await import('../../services/executor.js');
    const result = await run('pm2', ['jlist'], { sudo: true });

    if (!result.success) {
      logger.warn({ stderr: result.stderr }, 'Failed to list PM2 processes');
      return [];
    }

    try {
      const processes = JSON.parse(result.stdout) as Array<{
        name: string;
        pm_id: number;
        pid: number;
        monit: { memory: number; cpu: number };
        pm2_env: { status: string; restart_time: number; uptime: number };
      }>;

      return processes.map((proc) => ({
        name: proc.name,
        status: {
          running: proc.pm2_env.status === 'online',
          pid: proc.pid,
          uptime: proc.pm2_env.uptime,
          memoryMb: Math.round(proc.monit.memory / 1024 / 1024),
          cpuPercent: proc.monit.cpu,
          restartCount: proc.pm2_env.restart_time,
          status: proc.pm2_env.status as ProcessStatus['status'],
        } as ProcessStatus,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to parse PM2 process list');
      return [];
    }
  }

  /**
   * Get status of a specific process
   */
  async getProcess(name: string): Promise<ProcessInfo | null> {
    const manager = await getProcessManager();
    const status = await manager.getStatus(name);

    return {
      name,
      status,
    };
  }

  /**
   * Start a process
   */
  async startProcess(config: ProcessConfig): Promise<void> {
    const manager = await getProcessManager();
    await manager.start(config);
    logger.info({ name: config.name }, 'Process started via API');
  }

  /**
   * Stop a process
   */
  async stopProcess(name: string): Promise<void> {
    const manager = await getProcessManager();
    await manager.stop(name);
    logger.info({ name }, 'Process stopped via API');
  }

  /**
   * Restart a process
   */
  async restartProcess(name: string): Promise<void> {
    const manager = await getProcessManager();
    await manager.restart(name);
    logger.info({ name }, 'Process restarted via API');
  }

  /**
   * Delete a process
   */
  async deleteProcess(name: string): Promise<void> {
    const manager = await getProcessManager();
    await manager.delete(name);
    logger.info({ name }, 'Process deleted via API');
  }

  /**
   * Get process logs
   */
  async getProcessLogs(name: string, lines = 100): Promise<string> {
    const manager = await getProcessManager();
    return manager.logs(name, lines);
  }

  /**
   * Check if process manager is available
   */
  async isAvailable(): Promise<boolean> {
    const manager = await getProcessManager();
    return manager.isAvailable();
  }
}

export const processesService = new ProcessesService();