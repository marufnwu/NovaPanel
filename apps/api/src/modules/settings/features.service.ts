import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';

export interface ServerFeatures {
  nginx: boolean;
  apache: boolean;
  mysql: boolean;
  postgresql: boolean;
  postfix: boolean;
  ftp: boolean;
  docker: boolean;
}

/**
 * Detect which server features are available by checking if binaries exist in PATH.
 */
export async function detectServerFeatures(): Promise<ServerFeatures> {
  const checks: Array<{ name: keyof ServerFeatures; cmd: string }> = [
    { name: 'nginx', cmd: 'nginx' },
    { name: 'apache', cmd: 'apache2ctl' },
    { name: 'mysql', cmd: 'mysqld' },
    { name: 'postgresql', cmd: 'postgres' },
    { name: 'postfix', cmd: 'postfix' },
    { name: 'ftp', cmd: 'proftpd' },
    { name: 'docker', cmd: 'docker' },
  ];

  const features: ServerFeatures = {
    nginx: false,
    apache: false,
    mysql: false,
    postgresql: false,
    postfix: false,
    ftp: false,
    docker: false,
  };

  for (const check of checks) {
    try {
      const result = await run('which', [check.cmd], { timeout: 5000 });
      if (result.success && result.stdout.trim()) {
        (features as any)[check.name] = true;
      }
    } catch {
      // Binary not found — feature not available
    }
  }

  logger.info({ features }, 'Server features detected');
  return features;
}