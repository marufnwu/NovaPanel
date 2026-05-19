import { db } from '../db/index.js';
import { deployments, sites, siteProcesses, siteEnvVars, type Deployment, type NewDeployment } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { run } from './executor.js';
import { logger } from '../config/logger.js';
import { nanoid } from 'nanoid';
import * as sudoFs from './sudo-fs.js';
import { jobQueue, JOB_TYPES } from './job-queue/index.js';

const DEPLOYMENTS_ROOT = '/var/www/sites';

export class DeploymentService {
  /**
   * Get deployments for a site
   */
  async getDeployments(siteId: string): Promise<Deployment[]> {
    return db.select()
      .from(deployments)
      .where(eq(deployments.siteId, siteId))
      .orderBy(desc(deployments.sequence));
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(id: string): Promise<Deployment | null> {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    return deployment || null;
  }

  /**
   * Get current active deployment for a site
   */
  async getCurrentDeployment(siteId: string): Promise<Deployment | null> {
    const [deployment] = await db.select()
      .from(deployments)
      .where(and(eq(deployments.siteId, siteId), eq(deployments.deployStatus, 'success')))
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    return deployment || null;
  }

  /**
   * Create a new deployment
   */
  async create(data: {
    siteId: string;
    sourceType: 'git' | 'archive' | 'empty';
    gitRepo?: string;
    gitBranch?: string;
    archivePath?: string;
    userId?: string;
    ipAddress?: string;
  }): Promise<Deployment> {
    const { siteId, sourceType, gitRepo, gitBranch = 'main', archivePath, userId, ipAddress } = data;

    // Get site to find next sequence number
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw new Error('Site not found');

    const existingDeployments = await db.select()
      .from(deployments)
      .where(eq(deployments.siteId, siteId));

    const nextSequence = existingDeployments.length + 1;
    const deploymentId = nanoid();
    const deploymentPath = `${site.homeDir}/deployments/deploy_${String(nextSequence).padStart(3, '0')}`;

    const [deployment] = await db.insert(deployments).values({
      id: deploymentId,
      siteId,
      sequence: nextSequence,
      sourceType,
      gitRepo,
      gitBranch,
      archivePath,
      deploymentPath,
      buildStatus: 'pending',
      deployStatus: 'pending',
    }).returning();

    // Enqueue build job
    await jobQueue.enqueue(JOB_TYPES.DEPLOYMENT_BUILD, {
      deploymentId,
      siteId,
      sourceType,
      gitRepo,
      gitBranch,
      archivePath,
    });

    logger.info({ deploymentId, siteId, sourceType }, 'Deployment created');

    return deployment;
  }

  /**
   * Build a deployment (called by job worker)
   */
  async build(data: {
    deploymentId: string;
    siteId: string;
    sourceType: string;
    gitRepo?: string;
    gitBranch?: string;
    archivePath?: string;
  }): Promise<void> {
    const { deploymentId, siteId, sourceType, gitRepo, gitBranch, archivePath } = data;

    // Update status to building
    await db.update(deployments)
      .set({ 
        buildStatus: sourceType === 'git' ? 'cloning' : 'installing',
        startedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);

    try {
      // Create deployment directory
      await sudoFs.mkdir(deployment.deploymentPath);

      if (sourceType === 'git' && gitRepo) {
        // Clone git repository
        await run('git', ['clone', '--branch', gitBranch || 'main', gitRepo, deployment.deploymentPath], { sudo: true, cwd: '/tmp' });
        await db.update(deployments).set({ buildStatus: 'installing' }).where(eq(deployments.id, deploymentId));

        // Install dependencies
        const [process] = await db.select().from(siteProcesses).where(eq(siteProcesses.siteId, siteId)).limit(1);
        if (process) {
          const runtimeConfig = { /* get from site_runtimes */ };
          // Run npm install / pip install based on runtime
          await run('npm', ['install'], { sudo: false, cwd: deployment.deploymentPath });
        }

        await db.update(deployments).set({ buildStatus: 'success' }).where(eq(deployments.id, deploymentId));
      } else if (sourceType === 'archive' && archivePath) {
        // Extract archive
        await run('tar', ['-xzf', archivePath, '-C', deployment.deploymentPath], { sudo: true });
        await db.update(deployments).set({ buildStatus: 'success' }).where(eq(deployments.id, deploymentId));
      } else {
        // Empty deployment - just create directory structure
        await sudoFs.mkdir(`${deployment.deploymentPath}/httpdocs`);
        await db.update(deployments).set({ buildStatus: 'success' }).where(eq(deployments.id, deploymentId));
      }

      logger.info({ deploymentId }, 'Deployment build completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Build failed';
      await db.update(deployments)
        .set({ 
          buildStatus: 'failed',
          errorMessage: message,
        })
        .where(eq(deployments.id, deploymentId));
      throw error;
    }
  }

  /**
   * Deploy (switch symlink to new deployment)
   */
  async deploy(deploymentId: string): Promise<void> {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
    if (!deployment) throw new Error('Deployment not found');

    const [site] = await db.select().from(sites).where(eq(sites.id, deployment.siteId)).limit(1);
    if (!site) throw new Error('Site not found');

    await db.update(deployments)
      .set({ deployStatus: 'deploying' })
      .where(eq(deployments.id, deploymentId));

    try {
      // Update current symlink
      const httpdocsSymlink = `${site.homeDir}/httpdocs`;
      const currentLink = `${site.homeDir}/releases/current`;
      const newLink = `${site.homeDir}/releases/deploy_${String(deployment.sequence).padStart(3, '0')}`;

      // Create releases directory if not exists
      await sudoFs.mkdir(`${site.homeDir}/releases`).catch(() => {});

      // Remove old current symlink if exists
      await run('rm', ['-f', currentLink], { sudo: true }).catch(() => {});
      await run('rm', ['-f', httpdocsSymlink], { sudo: true }).catch(() => {});

      // Create new symlinks
      await run('ln', ['-s', deployment.deploymentPath, currentLink], { sudo: true });
      await run('ln', ['-s', `${deployment.deploymentPath}/httpdocs`, httpdocsSymlink], { sudo: true });

      // Restart process
      await jobQueue.enqueue(JOB_TYPES.PM2_RESTART, { siteId: site.id, processName: `site-${site.id}` });

      // Update deployment status
      await db.update(deployments)
        .set({ 
          deployStatus: 'success',
          deployedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(deployments.id, deploymentId));

      logger.info({ deploymentId, siteId: site.id }, 'Deployment completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deploy failed';
      await db.update(deployments)
        .set({ 
          deployStatus: 'failed',
          errorMessage: message,
        })
        .where(eq(deployments.id, deploymentId));
      throw error;
    }
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(siteId: string, userId?: string, ipAddress?: string): Promise<Deployment> {
    const siteDeployments = await db.select()
      .from(deployments)
      .where(and(eq(deployments.siteId, siteId), eq(deployments.deployStatus, 'success')))
      .orderBy(desc(deployments.sequence))
      .limit(2);

    if (siteDeployments.length < 2) {
      throw new Error('No previous deployment to rollback to');
    }

    const [, previousDeployment] = siteDeployments;

    // Create a new rollback deployment
    const [newDeployment] = await db.insert(deployments).values({
      id: nanoid(),
      siteId,
      sequence: siteDeployments[0].sequence + 1,
      sourceType: 'rollback',
      deploymentPath: previousDeployment.deploymentPath,
      buildStatus: 'success',
      deployStatus: 'pending',
    }).returning();

    // Enqueue rollback deployment
    await jobQueue.enqueue(JOB_TYPES.DEPLOYMENT_ROLLBACK, {
      deploymentId: newDeployment.id,
      siteId,
    });

    logger.info({ siteId, rollbackTo: previousDeployment.id }, 'Rollback initiated');

    return newDeployment;
  }

  /**
   * Delete old deployment (cleanup)
   */
  async deleteDeployment(id: string): Promise<void> {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    if (!deployment) return;

    // Don't delete if it's the current deployment
    const current = await this.getCurrentDeployment(deployment.siteId);
    if (current && current.id === id) return;

    // Delete files
    await run('rm', ['-rf', deployment.deploymentPath], { sudo: true }).catch(() => {});

    // Delete record
    await db.delete(deployments).where(eq(deployments.id, id));

    logger.info({ deploymentId: id }, 'Deployment deleted');
  }
}

export const deploymentService = new DeploymentService();
