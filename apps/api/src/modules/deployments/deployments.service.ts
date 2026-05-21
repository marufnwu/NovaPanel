import { db } from '../../db/index.js';
import { deployments, sites } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../../errors.js';

export class DeploymentsService {
  async listBySite(siteId: string): Promise<typeof deployments.$inferSelect[]> {
    return db
      .select()
      .from(deployments)
      .where(eq(deployments.siteId, siteId))
      .orderBy(desc(deployments.sequence));
  }

  async get(id: string) {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    return deployment || null;
  }

  async create(data: {
    siteId: string;
    sourceType: 'git' | 'docker_registry' | 'upload' | 'rollback';
    gitRef?: string;
    commitSha?: string;
    commitMessage?: string;
    gitWebhookSecret?: string;
  }) {
    const existing = await db
      .select()
      .from(deployments)
      .where(eq(deployments.siteId, data.siteId));

    const nextSequence = existing.length > 0
      ? Math.max(...existing.map(d => d.sequence)) + 1
      : 1;

    const [deployment] = await db.insert(deployments).values({
      id: nanoid(),
      siteId: data.siteId,
      sequence: nextSequence,
      sourceType: data.sourceType,
      gitRef: data.gitRef || null,
      commitSha: data.commitSha || null,
      commitMessage: data.commitMessage || null,
      status: 'pending',
    }).returning();

    return deployment;
  }

  async updateStatus(id: string, status: 'pending' | 'building' | 'testing' | 'deploying' | 'success' | 'failed' | 'cancelled', errorMessage?: string) {
    const updateData: Record<string, unknown> = { status };
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (status === 'success') updateData.deployedAt = new Date();

    const [updated] = await db.update(deployments).set(updateData).where(eq(deployments.id, id)).returning();
    return updated;
  }

  async appendBuildLog(id: string, logChunk: string) {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    if (!deployment) return null;

    const existingLogs = deployment.buildLogs || '';
    const [updated] = await db.update(deployments).set({ buildLogs: existingLogs + logChunk }).where(eq(deployments.id, id)).returning();
    return updated;
  }

  async appendDeployLog(id: string, logChunk: string) {
    const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
    if (!deployment) return null;

    const existingLogs = deployment.deployLogs || '';
    const [updated] = await db.update(deployments).set({ deployLogs: existingLogs + logChunk }).where(eq(deployments.id, id)).returning();
    return updated;
  }

  async setDuration(id: string, durationMs: number) {
    const [updated] = await db.update(deployments).set({ durationMs }).where(eq(deployments.id, id)).returning();
    return updated;
  }

  async cancel(id: string) {
    const [updated] = await db.update(deployments).set({ status: 'cancelled' }).where(eq(deployments.id, id)).returning();
    return updated;
  }

  async rollback(siteId: string, targetDeploymentId: string) {
    const [targetDeployment] = await db.select().from(deployments).where(eq(deployments.id, targetDeploymentId)).limit(1);
    if (!targetDeployment) throw new AppError(404, 'NOT_FOUND', 'Target deployment not found');
    if (targetDeployment.siteId !== siteId) throw new AppError(400, 'MISMATCH', 'Deployment does not belong to this site');

    const rollbackImage = `novapanel/site-${siteId}:${targetDeploymentId}`;
    const { dockerService } = await import('../docker/docker.service.js');
    await dockerService.stopSite(siteId);
    await dockerService.deploySite(siteId, '', rollbackImage);

    await db.update(sites).set({ status: 'active', lastDeploymentId: targetDeploymentId }).where(eq(sites.id, siteId)).returning();
    return targetDeployment;
  }
}

export const deploymentsService = new DeploymentsService();