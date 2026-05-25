import { db } from '../../db/index.js';
import { buckets, storageAccessKeys } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { randomBytes, createHash } from 'node:crypto';

export class StorageService {
  async listBuckets(orgId?: string) {
    return db.select().from(buckets).where(orgId ? eq(buckets.orgId, orgId) : undefined);
  }

  async getBucket(id: string) {
    const [bucket] = await db.select().from(buckets).where(eq(buckets.id, id)).limit(1);
    return bucket || null;
  }

  async createBucket(data: {
    orgId: string;
    name: string;
    region?: string;
    publicAccess?: boolean;
    versioning?: boolean;
    corsRules?: unknown[];
  }) {
    const [bucket] = await db.insert(buckets).values({
      id: nanoid(),
      orgId: data.orgId,
      name: data.name,
      region: data.region || 'default',
      publicAccess: data.publicAccess ?? false,
      versioning: data.versioning ?? false,
      corsRules: data.corsRules ? JSON.stringify(data.corsRules) : null,
    }).returning();
    return bucket;
  }

  async updateBucket(id: string, data: Partial<{
    name: string;
    publicAccess: boolean;
    versioning: boolean;
    corsRules: unknown[];
  }>) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.publicAccess !== undefined) updateData.publicAccess = data.publicAccess;
    if (data.versioning !== undefined) updateData.versioning = data.versioning;
    if (data.corsRules !== undefined) updateData.corsRules = JSON.stringify(data.corsRules);

    const [updated] = await db.update(buckets).set(updateData).where(eq(buckets.id, id)).returning();
    return updated;
  }

  async deleteBucket(id: string) {
    await db.delete(storageAccessKeys).where(eq(storageAccessKeys.orgId, id));
    await db.delete(buckets).where(eq(buckets.id, id));
    return { success: true };
  }

  async listAccessKeys(orgId: string) {
    const keys = await db.select().from(storageAccessKeys).where(eq(storageAccessKeys.orgId, orgId));
    return keys.map(k => ({ ...k, secretKeyHash: undefined }));
  }

  async createAccessKey(data: { orgId: string; name: string; permissions?: string[] }) {
    const accessKeyId = `np_${randomBytes(16).toString('hex')}`;
    const secretKey = randomBytes(32).toString('hex');
    const secretKeyHash = createHash('sha256').update(secretKey).digest('hex');

    const [key] = await db.insert(storageAccessKeys).values({
      id: nanoid(),
      orgId: data.orgId,
      name: data.name,
      accessKeyId,
      secretKeyHash,
      permissions: JSON.stringify(data.permissions || []),
    }).returning();

    return { ...key, secretKey };
  }

  async deleteAccessKey(id: string) {
    await db.delete(storageAccessKeys).where(eq(storageAccessKeys.id, id));
    return { success: true };
  }
}

export const storageService = new StorageService();
