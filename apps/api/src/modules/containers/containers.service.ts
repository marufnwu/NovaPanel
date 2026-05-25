import { db } from '../../db/index.js';
import { containers } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../../errors.js';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { logger } from '../../config/logger.js';
import { auditService } from '../audit/audit.service.js';

function containerName(name: string) {
  return `novapanel-container-${name}`;
}

export class ContainersService {
  async list(orgId?: string) {
    return db.select().from(containers).where(orgId ? eq(containers.orgId, orgId) : undefined);
  }

  async get(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return container || null;
  }

  async create(data: {
    orgId: string;
    name: string;
    type: 'compose' | 'dockerfile' | 'image';
    composeFile?: string;
    dockerfile?: string;
    image?: string;
    env?: Record<string, string>;
    secrets?: string[];
    networkMode?: string;
    exposedPorts?: number[];
    cpuLimit?: number;
    memoryLimit?: number;
    replicas?: number;
  }) {
    const [container] = await db.insert(containers).values({
      id: nanoid(),
      orgId: data.orgId,
      name: data.name,
      type: data.type,
      composeFile: data.composeFile || null,
      dockerfile: data.dockerfile || null,
      image: data.image || null,
      env: JSON.stringify(data.env || {}),
      secrets: JSON.stringify(data.secrets || []),
      networkMode: data.networkMode || 'bridge',
      exposedPorts: JSON.stringify(data.exposedPorts || []),
      cpuLimit: data.cpuLimit || null,
      memoryLimit: data.memoryLimit || null,
      replicas: data.replicas ?? 1,
      status: 'stopped',
    }).returning();
    return container;
  }

  async update(id: string, data: Partial<{
    name: string;
    composeFile: string;
    dockerfile: string;
    image: string;
    env: Record<string, string>;
    secrets: string[];
    networkMode: string;
    exposedPorts: number[];
    cpuLimit: number;
    memoryLimit: number;
    replicas: number;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.composeFile !== undefined) updateData.composeFile = data.composeFile;
    if (data.dockerfile !== undefined) updateData.dockerfile = data.dockerfile;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.env !== undefined) updateData.env = JSON.stringify(data.env);
    if (data.secrets !== undefined) updateData.secrets = JSON.stringify(data.secrets);
    if (data.networkMode !== undefined) updateData.networkMode = data.networkMode;
    if (data.exposedPorts !== undefined) updateData.exposedPorts = JSON.stringify(data.exposedPorts);
    if (data.cpuLimit !== undefined) updateData.cpuLimit = data.cpuLimit;
    if (data.memoryLimit !== undefined) updateData.memoryLimit = data.memoryLimit;
    if (data.replicas !== undefined) updateData.replicas = data.replicas;
    updateData.updatedAt = new Date();

    const [updated] = await db.update(containers).set(updateData).where(eq(containers.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Container not found');
    return updated;
  }

  async delete(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (container?.containerId) {
      try {
        await run('docker', ['rm', '-f', container.containerId], { sudo: true });
      } catch (err) {
        // [P3-5] Log the error but still throw AppError for proper error handling
        logger.warn({ err, containerId: container.containerId }, 'Failed to remove container');
        throw new AppError(500, 'CONTAINER_DELETE_FAILED', `Failed to remove container: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    await db.delete(containers).where(eq(containers.id, id));
    return { success: true };
  }

  async start(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    const cName = containerName(container.name);
    let containerId = container.containerId;

    if (!containerId) {
      if (container.type === 'image' && container.image) {
        const { stdout } = await run('docker', ['run', '-d', '--name', cName, container.image]);
        containerId = stdout.trim();
      } else if (container.type === 'dockerfile' && container.dockerfile) {
        const tmpDir = `/tmp/novapanel-container-${container.id}`;
        await run('mkdir', ['-p', tmpDir], { sudo: true });
        await run('sh', ['-c', `echo '${container.dockerfile}' > ${tmpDir}/Dockerfile`], { sudo: true });
        const { stdout } = await run('docker', ['build', '-t', `novapanel/${cName}`, tmpDir], { sudo: true });
        await run('docker', ['rm', '-f', cName], { sudo: true }).catch(() => {});
        const { stdout: runOut } = await run('docker', ['run', '-d', '--name', cName, `novapanel/${cName}`]);
        containerId = runOut.trim();
      } else if (container.type === 'compose' && container.composeFile) {
        const tmpFile = `/tmp/novapanel-compose-${container.id}.yml`;
        await run('sh', ['-c', `echo '${container.composeFile}' > ${tmpFile}`], { sudo: true });
        const { stdout } = await run('docker', ['compose', '-f', tmpFile, 'up', '-d'], { sudo: true });
        containerId = stdout.trim();
      } else {
        throw new AppError(400, 'INVALID_CONFIG', 'Container has no image, dockerfile, or compose file');
      }

      await db.update(containers).set({ containerId, status: 'running', updatedAt: new Date() }).where(eq(containers.id, id));
    } else {
      await run('docker', ['start', containerId], { sudo: true });
      await db.update(containers).set({ status: 'running', updatedAt: new Date() }).where(eq(containers.id, id));
    }

    auditService.log({ action: 'container.start', resource: `container:${container.name}` }).catch(() => {});

    const [updated] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return updated;
  }

  async stop(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (container.containerId) {
      await run('docker', ['stop', container.containerId], { sudo: true }).catch((err) => logger.warn({ err, containerId: container.containerId }, 'Failed to stop container'));
    }

    await db.update(containers).set({ status: 'stopped', updatedAt: new Date() }).where(eq(containers.id, id));

    auditService.log({ action: 'container.stop', resource: `container:${container.name}` }).catch(() => {});

    const [updated] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return updated;
  }

  async restart(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (container.containerId) {
      await run('docker', ['restart', container.containerId], { sudo: true }).catch(() => {});
    } else {
      await this.start(id);
      return db.select().from(containers).where(eq(containers.id, id)).limit(1).then(r => r[0]);
    }

    await db.update(containers).set({ status: 'running', updatedAt: new Date() }).where(eq(containers.id, id));

    auditService.log({ action: 'container.restart', resource: `container:${container.name}` }).catch(() => {});

    const [updated] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return updated;
  }

  async getLogs(id: string, lines: number = 200) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (!container.containerId) return { logs: '', running: false };

    const result = await run('docker', ['logs', '--tail', lines.toString(), container.containerId], { sudo: true }).catch(() => ({ stdout: '', stderr: '' }));
    return { logs: result.stdout + result.stderr, running: container.status === 'running' };
  }

  async getStats(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (!container.containerId || container.status !== 'running') {
      return { cpu: 0, memory: 0, memoryLimit: 0, networkRx: 0, networkTx: 0, blockRead: 0, blockWrite: 0 };
    }

    try {
      // Get CPU and memory stats
      const statsResult = await run('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}', container.containerId], { sudo: true });
      const output = statsResult.stdout.trim();
      
      if (!output) {
        return { cpu: 0, memory: 0, memoryLimit: 0, networkRx: 0, networkTx: 0, blockRead: 0, blockWrite: 0 };
      }

      // Parse output: CPUPerc|MemPerc|NetIO|BlockIO
      // e.g., "0.50%|1.23%|1.5MB / 2MB|10MB / 20MB"
      const parts = output.split('|');
      const cpuStr = parts[0]?.replace('%', '') || '0';
      const memStr = parts[1]?.replace('%', '') || '0';
      
      // Parse network I/O: "1.5MB / 2MB" -> rx: 1.5, tx: 2
      const netParts = (parts[2] || '0 / 0').split('/').map(s => s.trim());
      const networkRx = this.parseSize(netParts[0] || '0');
      const networkTx = this.parseSize(netParts[1] || '0');
      
      // Parse block I/O: "10MB / 20MB" -> read: 10, write: 20
      const blockParts = (parts[3] || '0 / 0').split('/').map(s => s.trim());
      const blockRead = this.parseSize(blockParts[0] || '0');
      const blockWrite = this.parseSize(blockParts[1] || '0');

      return {
        cpu: parseFloat(cpuStr) || 0,
        memory: parseFloat(memStr) || 0,
        memoryLimit: 0,
        networkRx,
        networkTx,
        blockRead,
        blockWrite,
      };
    } catch {
      return { cpu: 0, memory: 0, memoryLimit: 0, networkRx: 0, networkTx: 0, blockRead: 0, blockWrite: 0 };
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B?)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    const multipliers: Record<string, number> = { 'B': 1, 'K': 1024, 'KB': 1024, 'M': 1024 * 1024, 'MB': 1024 * 1024, 'G': 1024 * 1024 * 1024, 'GB': 1024 * 1024 * 1024, 'T': 1024 * 1024 * 1024 * 1024, 'TB': 1024 * 1024 * 1024 * 1024 };
    return Math.round(value * (multipliers[unit] || 1));
  }

  async getPortMappings(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (!container.containerId) return { portMappings: [], exposedPorts: [] };

    try {
      // Get port mappings from docker inspect
      const inspectResult = await run('docker', ['inspect', container.containerId], { sudo: true });
      const inspect = JSON.parse(inspectResult.stdout)[0];
      
      const hostBindings = inspect.HostConfig?.PortBindings || {};
      const exposedPorts = inspect.Config?.ExposedPorts || {};
      
      const portMappings = Object.entries(hostBindings).map(([containerPort, bindings]: [string, any]) => {
        const hostPort = bindings?.[0]?.HostPort || 'not mapped';
        const protocol = containerPort.includes('/tcp') ? 'tcp' : 'udp';
        return {
          containerPort: containerPort.replace(/\/(tcp|udp)/i, ''),
          hostPort,
          protocol,
        };
      });

      const exposedPortsList = Object.keys(exposedPorts).map(port => ({
        port: port.replace(/\/(tcp|udp)/i, ''),
        protocol: port.includes('/tcp') ? 'tcp' : 'udp',
      }));

      return { portMappings, exposedPorts: exposedPortsList };
    } catch {
      return { portMappings: [], exposedPorts: [] };
    }
  }
}

export const containersService = new ContainersService();