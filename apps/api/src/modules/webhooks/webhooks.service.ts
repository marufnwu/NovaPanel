import { db } from '../../db/index.js';
import { webhooks, webhookDeliveries, type Webhook, type NewWebhook, type WebhookDelivery, type NewWebhookDelivery } from '../../db/schema/webhooks.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export class WebhooksService {
  async list(orgId: string): Promise<Webhook[]> {
    return db.select().from(webhooks).where(eq(webhooks.orgId, orgId)).orderBy(desc(webhooks.createdAt));
  }

  async create(orgId: string, data: Omit<NewWebhook, 'id' | 'orgId' | 'createdAt'>): Promise<Webhook> {
    const secret = data.secret ?? crypto.randomBytes(32).toString('hex');
    const webhook: NewWebhook = {
      id: nanoid(),
      orgId,
      name: data.name,
      url: data.url,
      secret,
      events: data.events ?? [],
      enabled: data.enabled ?? true,
      headers: data.headers ?? {},
      createdAt: new Date(),
    };
    await db.insert(webhooks).values(webhook);
    const [created] = await db.select().from(webhooks).where(eq(webhooks.id, webhook.id)).limit(1);
    return created;
  }

  async get(id: string): Promise<Webhook | null> {
    const [w] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    return w ?? null;
  }

  async update(id: string, data: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'enabled' | 'headers'>>): Promise<Webhook> {
    await db.update(webhooks).set({ ...data, updatedAt: new Date() }).where(eq(webhooks.id, id));
    const [updated] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!updated) throw new Error('Webhook not found');
    return updated;
  }

  async delete(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async regenerateSecret(id: string): Promise<string> {
    const newSecret = crypto.randomBytes(32).toString('hex');
    await db.update(webhooks).set({ secret: newSecret, updatedAt: new Date() }).where(eq(webhooks.id, id));
    return newSecret;
  }

  async listDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    return db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }

  async recordDelivery(data: Omit<NewWebhookDelivery, 'id' | 'createdAt'>): Promise<WebhookDelivery> {
    const delivery: NewWebhookDelivery = {
      id: nanoid(),
      ...data,
      createdAt: new Date(),
    };
    await db.insert(webhookDeliveries).values(delivery);
    const [created] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, delivery.id)).limit(1);
    return created;
  }

  async triggerEvent(orgId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const hooks = await db.select().from(webhooks).where(eq(webhooks.orgId, orgId));
    for (const hook of hooks) {
      if (!hook.enabled) continue;
      if (!Array.isArray(hook.events) || !hook.events.includes(event)) continue;

      try {
        const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
        const signature = hook.secret ? crypto.createHmac('sha256', hook.secret).update(body).digest('hex') : '';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': signature,
          ...(typeof hook.headers === 'object' ? hook.headers as Record<string, string> : {}),
        };

        const response = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
        });

        await this.recordDelivery({
          webhookId: hook.id,
          event,
          payload,
          responseStatus: response.status,
          responseBody: await response.text().catch(() => ''),
          success: response.ok,
          deliveredAt: new Date(),
        });
      } catch (err) {
        await this.recordDelivery({
          webhookId: hook.id,
          event,
          payload,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          deliveredAt: new Date(),
        });
      }
    }
  }
}

export const webhooksService = new WebhooksService();