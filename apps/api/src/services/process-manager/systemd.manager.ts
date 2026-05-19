import { run } from '../executor.js';
import { logger } from '../../config/logger.js';
import { ProcessManager, ProcessStatus, ProcessConfig } from './types.js';

export class SystemdManager implements ProcessManager {
  private getServiceName(name: string): string {
    return `novapanel-${name}.service`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await run('which', ['systemctl'], { sudo: false });
      return result.success;
    } catch {
      return false;
    }
  }

  async start(config: ProcessConfig): Promise<void> {
    const serviceName = this.getServiceName(config.name);
    
    // Create systemd unit file
    const unitContent = `
[Unit]
Description=NovaPanel Site: ${config.name}
After=network.target

[Service]
Type=simple
WorkingDirectory=${config.cwd || '/var/www'}
ExecStart=${config.command}
${config.env ? Object.entries(config.env).map(([k, v]) => `Environment="${k}=${v}"`).join('\n') : ''}
Restart=always
RestartSec=5

${config.logFile ? `StandardOutput=file:${config.logFile}` : ''}
${config.errorFile ? `StandardError=file:${config.errorFile}` : ''}

[Install]
WantedBy=multi-user.target
`.trim();

    const unitPath = `/etc/systemd/system/${serviceName}`;
    await run('tee', [unitPath], { input: unitContent, sudo: true });
    await run('systemctl', ['daemon-reload'], { sudo: true });
    await run('systemctl', ['enable', serviceName], { sudo: true });
    
    const result = await run('systemctl', ['start', serviceName], { sudo: true });

    if (!result.success) {
      throw new Error(`Systemd start failed: ${result.stderr}`);
    }

    logger.info({ name: config.name }, 'Systemd service started');
  }

  async stop(name: string): Promise<void> {
    const serviceName = this.getServiceName(name);
    const result = await run('systemctl', ['stop', serviceName], { sudo: true });
    
    if (!result.success) {
      logger.warn({ name, stderr: result.stderr }, 'Systemd stop failed');
    }
  }

  async restart(name: string): Promise<void> {
    const serviceName = this.getServiceName(name);
    const result = await run('systemctl', ['restart', serviceName], { sudo: true });

    if (!result.success) {
      throw new Error(`Systemd restart failed: ${result.stderr}`);
    }
  }

  async getStatus(name: string): Promise<ProcessStatus> {
    const serviceName = this.getServiceName(name);
    const result = await run('systemctl', ['status', serviceName], { sudo: true });

    if (!result.success) {
      return { running: false, restartCount: 0, status: 'stopped' };
    }

    // Parse systemctl status output
    const output = result.stdout;
    const running = output.includes('Active: active');
    const pidMatch = output.match(/Main PID: (\d+)/);
    const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

    return {
      running,
      pid,
      restartCount: 0,
      status: running ? 'online' : 'stopped',
    };
  }

  async logs(name: string, lines = 100): Promise<string> {
    const serviceName = this.getServiceName(name);
    const result = await run('journalctl', ['-u', serviceName, '-n', String(lines)], { sudo: true });
    return result.stdout;
  }

  async delete(name: string): Promise<void> {
    const serviceName = this.getServiceName(name);
    await run('systemctl', ['stop', serviceName], { sudo: true });
    await run('systemctl', ['disable', serviceName], { sudo: true });
    await run('rm', ['-f', `/etc/systemd/system/${serviceName}`], { sudo: true });
    await run('systemctl', ['daemon-reload'], { sudo: true });
  }
}

export const systemdManager = new SystemdManager();