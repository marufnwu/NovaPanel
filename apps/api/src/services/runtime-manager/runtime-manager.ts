import { db } from '../../db/index.js';
import { siteRuntimes, type SiteRuntime, type RuntimeConfig } from '../../db/schema/site_runtimes.js';
import { siteProcesses, type SiteProcess } from '../../db/schema/site_processes.js';
import { sites } from '../../db/schema/sites.js';
import { eq } from 'drizzle-orm';
import { run } from '../executor.js';
import { logger } from '../../config/logger.js';
import { getProcessManager, ProcessConfig } from '../process-manager/index.js';
import { nanoid } from 'nanoid';

// Port allocation constants
const EPHEMERAL_PORT_START = 30000;
const EPHEMERAL_PORT_END = 40000;

interface RuntimeInfo {
  runtime: string;
  version: string;
  installCommand?: string;
}

const RUNTIME_INFO: Record<string, RuntimeInfo> = {
  php: {
    runtime: 'php',
    version: '8.2',
  },
  node: {
    runtime: 'node',
    version: '20',
  },
  python: {
    runtime: 'python',
    version: '3.11',
  },
  static: {
    runtime: 'static',
    version: 'n/a',
  },
};

export class RuntimeManager {
  /**
   * Get runtime configuration for a site
   */
  async getRuntime(siteId: string): Promise<SiteRuntime | null> {
    const [runtime] = await db.select()
      .from(siteRuntimes)
      .where(eq(siteRuntimes.siteId, siteId))
      .limit(1);
    return runtime || null;
  }

  /**
   * Create runtime configuration for a site
   */
  async createRuntime(siteId: string, config: RuntimeConfig): Promise<SiteRuntime> {
    const id = nanoid();

    const [runtime] = await db.insert(siteRuntimes).values({
      id,
      siteId,
      runtimeConfig: config as any,
      webServer: 'nginx',
    }).returning();

    logger.info({ siteId, runtime: config.runtime }, 'Runtime created');
    return runtime;
  }

  /**
   * Update runtime configuration
   */
  async updateRuntime(siteId: string, config: Partial<RuntimeConfig>): Promise<SiteRuntime> {
    const [existing] = await db.select()
      .from(siteRuntimes)
      .where(eq(siteRuntimes.siteId, siteId))
      .limit(1);

    if (!existing) {
      throw new Error(`Runtime not found for site ${siteId}`);
    }

    const existingConfig = existing.runtimeConfig as RuntimeConfig;
    const mergedConfig: RuntimeConfig = {
      ...existingConfig,
      ...config,
      schemaVersion: 1, // Always ensure schema version is set
    };

    const [updated] = await db.update(siteRuntimes)
      .set({
        runtimeConfig: mergedConfig as any,
        updatedAt: new Date(),
      })
      .where(eq(siteRuntimes.siteId, siteId))
      .returning();

    logger.info({ siteId, config: mergedConfig }, 'Runtime updated');
    return updated;
  }

  /**
   * Allocate an internal port for a site
   * Ports are auto-assigned from ephemeral range to avoid conflicts
   */
  async allocatePort(siteId: string): Promise<number> {
    const [existing] = await db.select()
      .from(siteProcesses)
      .where(eq(siteProcesses.siteId, siteId))
      .limit(1);

    if (existing?.internalPort) {
      return existing.internalPort;
    }

    // Allocate new port
    // In production, this should check for port conflicts
    const port = Math.floor(Math.random() * (EPHEMERAL_PORT_END - EPHEMERAL_PORT_START)) + EPHEMERAL_PORT_START;

    // Create or update process record with allocated port
    if (existing) {
      await db.update(siteProcesses)
        .set({ internalPort: port, updatedAt: new Date() })
        .where(eq(siteProcesses.siteId, siteId));
    } else {
      const startCommand = this.getDefaultStartCommand({ runtime: 'static', schemaVersion: 1 });

      await db.insert(siteProcesses).values({
        id: nanoid(),
        siteId,
        startCommand,
        internalPort: port,
        processManager: 'pm2',
        replicas: 1,
        autoRestart: true,
        healthCheckPath: '/health',
        restartCount: 0,
      });
    }

    logger.info({ siteId, port }, 'Port allocated');
    return port;
  }

  /**
   * Get default start command based on runtime
   */
  private getDefaultStartCommand(config: RuntimeConfig): string {
    switch (config.runtime) {
      case 'node':
        return config.startCommand || 'npm start';
      case 'python':
        return config.startCommand || 'python -m http.server 8000';
      case 'php':
        return 'php-fpm'; // PHP uses php-fpm, not a start command
      case 'static':
      default:
        return ''; // Static files served by nginx
    }
  }

  /**
   * Install runtime if needed (e.g., install Node.js version)
   */
  async ensureRuntimeInstalled(siteId: string): Promise<boolean> {
    const runtime = await this.getRuntime(siteId);
    if (!runtime) return false;

    const config = runtime.runtimeConfig as RuntimeConfig;

    switch (config.runtime) {
      case 'node':
        return this.ensureNodeInstalled(config.nodeVersion || config.version || '20');
      case 'python':
        return this.ensurePythonInstalled(config.pythonVersion || config.version || '3.11');
      case 'php':
        return this.ensurePhpInstalled(config.phpVersion || config.version || '8.2');
      default:
        return true; // Static doesn't need installation
    }
  }

  private async ensureNodeInstalled(version: string): Promise<boolean> {
    try {
      // Check if nvm/node version is available
      const result = await run('node', ['--version'], { sudo: false });
      return result.success;
    } catch {
      logger.warn({ version }, 'Node version may not be installed');
      return false;
    }
  }

  private async ensurePythonInstalled(version: string): Promise<boolean> {
    try {
      const result = await run('python3', ['--version'], { sudo: false });
      return result.success;
    } catch {
      logger.warn({ version }, 'Python may not be installed');
      return false;
    }
  }

  private async ensurePhpInstalled(version: string): Promise<boolean> {
    try {
      const result = await run('php', ['--version'], { sudo: false });
      return result.success;
    } catch {
      logger.warn({ version }, 'PHP may not be installed');
      return false;
    }
  }

  /**
   * Validate runtime configuration
   */
  validateConfig(config: RuntimeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.schemaVersion) {
      errors.push('Missing schemaVersion');
    }

    if (!config.runtime) {
      errors.push('Missing runtime');
    }

    const validRuntimes = ['php', 'node', 'python', 'static', 'docker'];
    if (config.runtime && !validRuntimes.includes(config.runtime)) {
      errors.push(`Invalid runtime: ${config.runtime}`);
    }

    if (config.runtime === 'node') {
      if (!config.version) errors.push('Node requires version');
      if (!config.startCommand) errors.push('Node requires startCommand');
    }

    if (config.runtime === 'python') {
      if (!config.version) errors.push('Python requires version');
      if (!config.startCommand) errors.push('Python requires startCommand');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get parsed runtime config
   */
  parseRuntimeConfig(runtime: SiteRuntime): RuntimeConfig {
    return runtime.runtimeConfig as RuntimeConfig;
  }
}

export const runtimeManager = new RuntimeManager();