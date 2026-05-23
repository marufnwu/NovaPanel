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
  async list(projectId?: string) {
    return db.select().from(containers).where(projectId ? eq(containers.projectId, projectId) : undefined);
  }

  async get(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return container || null;
  }

  async create(data: {
    projectId: string;
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
      projectId: data.projectId,
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
        logger.warn({ err, containerId: container.containerId }, 'Failed to remove container');
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

  async getLogs(id: string) {
    const [container] = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    if (!container) throw new AppError(404, 'NOT_FOUND', 'Container not found');

    if (!container.containerId) return { logs: '', running: false };

    const result = await run('docker', ['logs', '--tail', '200', container.containerId], { sudo: true }).catch(() => ({ stdout: '', stderr: '' }));
    return { logs: result.stdout + result.stderr, running: container.status === 'running' };
  }
}

export const containersService = new ContainersService();