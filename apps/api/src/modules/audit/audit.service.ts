import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class AuditService {
  /**
   * Log an audit event
   */
  async log(data: {
    userId?: string;
    action: string;
    resource?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: data.userId || null,
      action: data.action,
      resource: data.resource || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  }

  /**
   * List audit logs with optional filtering
   */
  async list(filters: {
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    if (filters.userId) {
      return db.select().from(auditLogs)
        .where(eq(auditLogs.userId, filters.userId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

export const auditService = new AuditService();
