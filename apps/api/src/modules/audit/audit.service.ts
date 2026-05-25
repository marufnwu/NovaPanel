import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface AuditLogInput {
  orgId?: string;
  actorType?: 'user' | 'api_key' | 'system';
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  resource?: string;
  details?: string;
}

export class AuditService {
  async log(data: AuditLogInput) {
    await db.insert(auditLogs).values({
      id: nanoid(),
      orgId: data.orgId || data.actorId || '',
      actorType: data.actorType || 'user',
      actorId: data.actorId || data.userId || '',
      action: data.action,
      resourceType: data.resourceType || data.resource || '',
      resourceId: data.resourceId || null,
      metadata: data.metadata || data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  }

  async list(filters: {
    orgId?: string;
    actorType?: string;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const conditions = [];
    if (filters.orgId) {
      conditions.push(eq(auditLogs.orgId, filters.orgId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

export const auditService = new AuditService();
