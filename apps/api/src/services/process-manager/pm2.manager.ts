import { run } from '../executor.js';
import { logger } from '../../config/logger.js';
import { ProcessManager, ProcessStatus, ProcessConfig } from './types.js';

export class Pm2Manager implements ProcessManager {
  private readonly name = 'pm2';

  async isAvailable(): Promise<boolean> {
    try {
      const result = await run('which', ['pm2'], { sudo: false });
      return result.success;
    } catch {
      return false;
    }
  }

  async start(config: ProcessConfig): Promise<void> {
    const { name, command, cwd, env, logFile, errorFile } = config;

    const args = [
      'start',
      '--name', name,
      '--cwd', cwd || '/var/www',
    ];

    if (logFile) {
      args.push('--log', logFile);
    }
    if (errorFile) {
      args.push('--err', errorFile);
    }

    // Add environment variables
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        args.push(`--env`, `${key}=${value}`);
      }
    }

    // Add the command
    args.push('--', command);

    const result = await run('pm2', args, { sudo: true });

    if (!result.success) {
      logger.error({ name, stderr: result.stderr }, 'PM2 start failed');
      throw new Error(`PM2 start failed: ${result.stderr}`);
    }

    logger.info({ name, command }, 'PM2 process started');
  }

  async stop(name: string): Promise<void> {
    const result = await run('pm2', ['stop', name], { sudo: true });

    if (!result.success) {
      logger.warn({ name, stderr: result.stderr }, 'PM2 stop failed (process may not exist)');
    }
  }

  async restart(name: string): Promise<void> {
    const result = await run('pm2', ['restart', name], { sudo: true });

    if (!result.success) {
      throw new Error(`PM2 restart failed: ${result.stderr}`);
    }

    logger.info({ name }, 'PM2 process restarted');
  }

  async getStatus(name: string): Promise<ProcessStatus> {
    const result = await run('pm2', ['jlist'], { sudo: true });

    if (!result.success) {
      return { running: false, restartCount: 0, status: 'stopped' };
    }

    try {
      const processes = JSON.parse(result.stdout) as Array<{
        name: string;
        pm_id: number;
        pid: number;
        monit: { memory: number; cpu: number };
        pm2_env: { status: string; restart_time: number; uptime: number };
      }>;

      const proc = processes.find(p => p.name === name);

      if (!proc) {
        return { running: false, restartCount: 0, status: 'stopped' };
      }

      return {
        running: proc.pm2_env.status === 'online',
        pid: proc.pid,
        uptime: proc.pm2_env.uptime,
        memoryMb: Math.round(proc.monit.memory / 1024 / 1024),
        cpuPercent: proc.monit.cpu,
        restartCount: proc.pm2_env.restart_time,
        status: proc.pm2_env.status as ProcessStatus['status'],
      };
    } catch {
      return { running: false, restartCount: 0, status: 'errored' };
    }
  }

  async logs(name: string, lines = 100): Promise<string> {
    const result = await run('pm2', ['logs', name, '--lines', String(lines), '--nostream'], { sudo: true });
    return result.stdout || result.stderr;
  }

  async delete(name: string): Promise<void> {
    await this.stop(name);
    const result = await run('pm2', ['delete', name], { sudo: true });

    if (!result.success) {
      logger.warn({ name, stderr: result.stderr }, 'PM2 delete failed (process may not exist)');
    }
  }
}

// Singleton instance
export const pm2Manager = new Pm2Manager();