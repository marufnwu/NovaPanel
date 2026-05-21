import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { storageService } from './storage.service.js';
import { requireAuth } from '../auth/auth.middleware.js';

const createBucketSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  region: z.string().optional(),
  publicAccess: z.boolean().optional(),
  versioning: z.boolean().optional(),
  corsRules: z.array(z.any()).optional(),
});

const updateBucketSchema = z.object({
  name: z.string().min(1).optional(),
  publicAccess: z.boolean().optional(),
  versioning: z.boolean().optional(),
  corsRules: z.array(z.any()).optional(),
});

const createAccessKeySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  permissions: z.array(z.string()).optional(),
});

export default async function storageRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/buckets', async (req) => {
    const projectId = (req.query as { projectId?: string }).projectId;
    const items = await storageService.listBuckets(projectId);
    return { success: true, data: items };
  });

  fastify.post('/buckets', async (req, reply) => {
    const data = createBucketSchema.parse(req.body);
    const bucket = await storageService.createBucket(data);
    return reply.status(201).send({ success: true, data: bucket });
  });

  fastify.get('/buckets/:id', async (req) => {
    const { id } = req.params as { id: string };
    const bucket = await storageService.getBucket(id);
    if (!bucket) return { success: false, error: 'Bucket not found' };
    return { success: true, data: bucket };
  });

  fastify.put('/buckets/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = updateBucketSchema.parse(req.body);
    const bucket = await storageService.updateBucket(id, data);
    return { success: true, data: bucket };
  });

  fastify.delete('/buckets/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await storageService.deleteBucket(id);
    return { success: true, data: result };
  });

  fastify.get('/access-keys', async (req) => {
    const projectId = (req.query as { projectId?: string }).projectId;
    if (!projectId) return { success: false, error: 'projectId required' };
    const items = await storageService.listAccessKeys(projectId);
    return { success: true, data: items };
  });

  fastify.post('/access-keys', async (req, reply) => {
    const data = createAccessKeySchema.parse(req.body);
    const key = await storageService.createAccessKey(data);
    return reply.status(201).send({ success: true, data: key });
  });

  fastify.delete('/access-keys/:id', async (req) => {
    const { id } = req.params as { id: string };
    const result = await storageService.deleteAccessKey(id);
    return { success: true, data: result };
  });
}