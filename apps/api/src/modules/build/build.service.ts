import { db } from '../../db/index.js';
import { sites } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { dockerService } from '../docker/docker.service.js';
import { deploymentsService } from '../deployments/deployments.service.js';
import { AppError } from '../../errors.js';
import fs from 'node:fs';

const RUNTIME_AUTO_DETECT: Record<string, { files: string[]; buildCmd: string; startCmd: string }> = {
  node: { files: ['package.json', 'package-lock.json'], buildCmd: 'npm run build', startCmd: 'npm start' },
  python: { files: ['requirements.txt', 'Pipfile', 'pyproject.toml'], buildCmd: 'pip install -r requirements.txt', startCmd: 'python app.py' },
  go: { files: ['go.mod'], buildCmd: 'go build -o main', startCmd: './main' },
  ruby: { files: ['Gemfile'], buildCmd: 'bundle install', startCmd: 'bundle exec rails server' },
  php: { files: ['index.php', 'composer.json'], buildCmd: '', startCmd: '' },
};

export class BuildService {
  async runBuild(siteId: string, deploymentId: string): Promise<void> {
    return dockerService.buildSite(siteId, deploymentId);
  }

  detectRuntime(homeDir: string): { runtime: string; buildCommand?: string; startCommand?: string } {
    if (!fs.existsSync(homeDir)) {
      return { runtime: 'static' };
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(homeDir);
    } catch {
      return { runtime: 'static' };
    }

    for (const [runtime, config] of Object.entries(RUNTIME_AUTO_DETECT)) {
      if (config.files.some((f) => files.includes(f))) {
        return { runtime, buildCommand: config.buildCmd, startCommand: config.startCmd };
      }
    }

    return { runtime: 'static' };
  }

  async generateDockerfile(siteId: string): Promise<string> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    return dockerService.generateDockerfileForRuntime(site.runtime, site.runtimeVersion || undefined, site.startCommand || undefined, site.port || undefined);
  }

  async runFullDeployPipeline(siteId: string): Promise<{ deploymentId: string }> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');

    const deployment = await deploymentsService.create({
      siteId,
      sourceType: site.sourceType as 'git' | 'docker_registry' | 'upload' | 'rollback',
      gitRef: site.gitBranch || undefined,
    });

    await db.update(sites).set({ status: 'building' }).where(eq(sites.id, siteId)).returning();

    try {
      const imageName = `novapanel/site-${siteId}:${deployment.id}`;
      await dockerService.buildSite(siteId, deployment.id);
      await dockerService.deploySite(siteId, site.projectId, imageName, site.port || undefined);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Pipeline failed';
      await deploymentsService.updateStatus(deployment.id, 'failed', error);
      await db.update(sites).set({ status: 'error' }).where(eq(sites.id, siteId)).returning();
    }

    return { deploymentId: deployment.id };
  }
}

export const buildService = new BuildService();