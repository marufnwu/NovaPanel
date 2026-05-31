import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { db } from '../../db/index.js';
import { sites } from '../../db/schema/sites.js';
import { eq } from 'drizzle-orm';

function execAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || stdout}`));
    });
    child.on('error', reject);
  });
}

const DOCKER_NETWORK_PREFIX = 'novapanel-net';
const DOCKER_CONTAINER_PREFIX = 'novapanel-site';
const DOCKER_VOLUME_PREFIX = 'novapanel-vol';
const BUILD_CACHE_DIR = '/tmp/novapanel-builds';

function containerName(siteId: string) {
  return `${DOCKER_NETWORK_PREFIX}-${siteId}`;
}

function networkName(projectId: string) {
  return `${DOCKER_NETWORK_PREFIX}-${projectId}`;
}

function volumeName(siteId: string) {
  return `${DOCKER_VOLUME_PREFIX}-${siteId}`;
}

export class DockerService {
  async buildSite(siteId: string, deploymentId: string, buildDir?: string): Promise<void> {
    await deploymentsService.updateStatus(deploymentId, 'building');

    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const buildContext = buildDir || `${BUILD_CACHE_DIR}/${siteId}-${deploymentId}`;

    try {
      const dockerfile = this.generateDockerfileForRuntime(site.runtime, site.runtimeVersion || undefined, site.startCommand || undefined, site.port || undefined);

      const tmpDockerfile = path.join(buildContext, 'Dockerfile');
      fs.mkdirSync(buildContext, { recursive: true });
      fs.writeFileSync(tmpDockerfile, dockerfile);

      const imageName = `novapanel/site-${siteId}:${deploymentId}`;
      await execAsync('docker', ['build', '-t', imageName, '-f', tmpDockerfile, buildContext]);
      await deploymentsService.updateStatus(deploymentId, 'success');
      logger.info({ siteId, deploymentId, imageName }, 'Site built successfully');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Build failed';
      await deploymentsService.updateStatus(deploymentId, 'failed', error);
      throw err;
    }
  }

  async deploySite(siteId: string, orgId: string | null | undefined, imageName: string, port?: number): Promise<void> {
    const cName = containerName(siteId);
    const netName = networkName(orgId || 'default');
    const volName = volumeName(siteId);
    const containerPort = port || 3000;

    try {
      await execAsync('docker', ['network', 'create', '--driver', 'bridge', netName]);
    } catch {}

    try {
      await execAsync('docker', ['volume', 'create', volName]);
    } catch {}

    try {
      await execAsync('docker', ['run', '-d',
        '--name', cName,
        '--network', netName,
        '-v', `${volName}:/data`,
        '-p', `${containerPort}:${containerPort}`,
        imageName,
      ]);
    } catch (err) {
      logger.warn({ err, siteId }, 'Container run warning');
    }

    logger.info({ siteId, imageName }, 'Site deployed');
  }

  async stopSite(siteId: string): Promise<void> {
    const cName = containerName(siteId);
    try {
      await execAsync('docker', ['stop', cName]);
      await execAsync('docker', ['rm', '-f', cName]);
    } catch (err) {
      logger.warn({ siteId, err }, 'Stop site container not found or already stopped');
    }
  }

  async getContainerStatus(siteId: string): Promise<{ running: boolean; containerId?: string }> {
    const cName = containerName(siteId);
    try {
      const output = await execAsync('docker', ['inspect', '--format', '{{.State.Running}}:{{.Id}}', cName]);
      const [running, containerId] = output.trim().split(':');
      return { running: running === 'true', containerId };
    } catch {
      return { running: false };
    }
  }

  async getLogs(siteId: string, lines = 200): Promise<string> {
    const cName = containerName(siteId);
    try {
      const logs = await execAsync('docker', ['logs', '--tail', String(lines), cName]);
      return logs;
    } catch {
      return '';
    }
  }

  async streamLogs(siteId: string): Promise<string> {
    return this.getLogs(siteId, 200);
  }

  async removeNetwork(orgId: string): Promise<void> {
    try {
      await execAsync('docker', ['network', 'rm', networkName(orgId)]);
    } catch {}
  }

  async restartSite(siteId: string): Promise<void> {
    const cName = containerName(siteId);
    try {
      await execAsync('docker', ['restart', cName]);
      logger.info({ siteId }, 'Site container restarted');
    } catch (err) {
      logger.warn({ siteId, err }, 'Restart site failed');
      throw new AppError(500, 'RESTART_FAILED', 'Failed to restart site container');
    }
  }

  async clearCache(siteId: string): Promise<void> {
    const cName = containerName(siteId);
    const volName = volumeName(siteId);
    try {
      await execAsync('docker', ['stop', cName]);
      await execAsync('docker', ['rm', '-f', cName]);
    } catch {}
    try {
      await execAsync('docker', ['volume', 'rm', volName]);
    } catch {}
    logger.info({ siteId }, 'Site cache cleared');
  }

  generateDockerfileForRuntime(runtime: string, version?: string, startCommand?: string, port?: number): string {
    const runtimes: Record<string, string> = {
      node: `FROM node:${version || '20-alpine'}\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE ${port || 3000}\nCMD ${startCommand || 'npm start'}`,
      python: `FROM python:${version || '3.12-slim'}\nWORKDIR /app\nCOPY requirements.txt . || true\nRUN pip install -r requirements.txt || true\nCOPY . .\nEXPOSE ${port || 8000}\nCMD ${startCommand || 'python app.py'}`,
      php: `FROM php:${version || '8.3'}-apache\nCOPY . /var/www/html\nEXPOSE ${port || 80}`,
      go: `FROM golang:${version || '1.22'}-alpine\nWORKDIR /app\nCOPY . .\nRUN go build -o main\nEXPOSE ${port || 8080}\nCMD ["./main"]`,
      ruby: `FROM ruby:${version || '3.3'}-alpine\nWORKDIR /app\nCOPY Gemfile* . || true\nRUN bundle install || true\nCOPY . .\nEXPOSE ${port || 3000}\nCMD ${startCommand || 'ruby app.rb'}`,
      rust: `FROM rust:${version || '1.77'}-alpine\nWORKDIR /app\nCOPY . .\nRUN cargo build --release\nEXPOSE ${port || 8080}\nCMD ["./target/release/app"]`,
      static: `FROM nginx:alpine\nCOPY . /usr/share/nginx/html\nEXPOSE ${port || 80}`,
      docker: `FROM alpine:latest\nCOPY . /app\nEXPOSE ${port || 3000}\nCMD ${startCommand || 'echo done'}`,
    };
    return runtimes[runtime] || runtimes['static'];
  }
}

export const dockerService = new DockerService();
export { gitService } from '../git/git.service.js';
export { buildService } from '../build/build.service.js';