import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../services/crypto.service.js';
import * as cf from '../services/cloudflare.service.js';
import type { UserPayload } from '@novadash/shared';

function getUser(request: FastifyRequest): UserPayload {
  return request.user as unknown as UserPayload;
}

async function getZoneWithAccount(zoneId: string, teamId: string) {
  const zone = await prisma.cfZone.findFirst({
    where: { id: zoneId },
    include: { cfAccount: true },
  });
  if (!zone || zone.cfAccount.teamId !== teamId) return null;
  return zone;
}

export async function domainRoutes(app: FastifyInstance) {
  // List all zones
  app.get('/api/v1/domains', async (request) => {
    const user = getUser(request);
    const accounts = await prisma.cfAccount.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true, zones: { select: { id: true, zoneId: true, zoneName: true, sslMode: true, plan: true } } },
    });
    return { ok: true, data: accounts };
  });

  // List DNS records for a zone
  app.get('/api/v1/domains/:zoneId/records', async (request, reply) => {
    const user = getUser(request);
    const { zoneId } = request.params as { zoneId: string };

    const zone = await getZoneWithAccount(zoneId, user.teamId);
    if (!zone) return reply.code(404).send({ ok: false, error: 'Zone not found' });

    // Sync from CF API
    const apiToken = decrypt(zone.cfAccount.apiTokenEncrypted);
    try {
      const cfRecords = await cf.listDnsRecords(zone.zoneId, { apiToken });

      // Upsert records into DB
      for (const record of cfRecords) {
        await prisma.dnsRecord.upsert({
          where: { id: `${zone.id}_${record.id}` },
          update: {
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied,
            ttl: record.ttl,
            syncedAt: new Date(),
          },
          create: {
            id: `${zone.id}_${record.id}`,
            zoneId: zone.id,
            cfRecordId: record.id,
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied,
            ttl: record.ttl,
            managedByPanel: false,
            syncedAt: new Date(),
          },
        });
      }
    } catch {
      // Return cached records if CF API fails
    }

    const records = await prisma.dnsRecord.findMany({
      where: { zoneId: zone.id },
      orderBy: { type: 'asc' },
    });

    return { ok: true, data: records };
  });

  // Create DNS record
  app.post('/api/v1/domains/:zoneId/records', async (request, reply) => {
    const user = getUser(request);
    const { zoneId } = request.params as { zoneId: string };

    const schema = z.object({
      type: z.string(),
      name: z.string(),
      content: z.string(),
      proxied: z.boolean().default(false),
      ttl: z.number().default(1),
    });

    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues.map((i) => i.message).join(', ') });
    }

    const zone = await getZoneWithAccount(zoneId, user.teamId);
    if (!zone) return reply.code(404).send({ ok: false, error: 'Zone not found' });

    const apiToken = decrypt(zone.cfAccount.apiTokenEncrypted);

    let newRecord: cf.CfDnsRecord;
    try {
      newRecord = await cf.createDnsRecord(zone.zoneId, {
        type: body.data.type,
        name: body.data.name,
        content: body.data.content,
        proxied: body.data.proxied,
        ttl: body.data.ttl,
      }, { apiToken });
    } catch (err) {
      return reply.code(502).send({ ok: false, error: `CF API error: ${err instanceof Error ? err.message : 'Failed to create record'}` });
    }

    const record = await prisma.dnsRecord.create({
      data: {
        id: `${zone.id}_${newRecord.id}`,
        zoneId: zone.id,
        cfRecordId: newRecord.id,
        type: newRecord.type,
        name: newRecord.name,
        content: newRecord.content,
        proxied: newRecord.proxied,
        ttl: newRecord.ttl,
        managedByPanel: true,
        syncedAt: new Date(),
      },
    });

    return reply.code(201).send({ ok: true, data: record });
  });

  // Delete DNS record
  app.delete('/api/v1/domains/:zoneId/records/:recordId', async (request, reply) => {
    const user = getUser(request);
    const { zoneId, recordId } = request.params as { zoneId: string; recordId: string };

    const record = await prisma.dnsRecord.findFirst({ where: { id: recordId } });
    if (!record) return reply.code(404).send({ ok: false, error: 'Record not found' });

    const zone = await getZoneWithAccount(zoneId, user.teamId);
    if (!zone) return reply.code(404).send({ ok: false, error: 'Zone not found' });

    if (record.cfRecordId) {
      const apiToken = decrypt(zone.cfAccount.apiTokenEncrypted);
      try {
        await cf.deleteDnsRecord(zone.zoneId, record.cfRecordId, { apiToken });
      } catch (err) {
        return reply.code(502).send({ ok: false, error: `CF API error: ${err instanceof Error ? err.message : 'Failed to delete record'}` });
      }
    }

    await prisma.dnsRecord.delete({ where: { id: recordId } });
    return { ok: true };
  });

  // Sync zone
  app.post('/api/v1/domains/:zoneId/sync', async (request, reply) => {
    const user = getUser(request);
    const { zoneId } = request.params as { zoneId: string };

    const zone = await getZoneWithAccount(zoneId, user.teamId);
    if (!zone) return reply.code(404).send({ ok: false, error: 'Zone not found' });

    // Re-sync handled by the records list endpoint
    return { ok: true, data: { zoneName: zone.zoneName, syncedAt: new Date().toISOString() } };
  });
}
