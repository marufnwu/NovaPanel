import { db } from '../../db/index.js';
import { metrics, alertRules, alertHistory, type Metric, type NewMetric, type AlertRule, type NewAlertRule, type AlertHistory, type NewAlertHistory } from '../../db/schema/monitoring.js';
import { organizationMembers } from '../../db/schema/organizations.js';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as si from 'systeminformation';
import { hostname as getHostname } from 'node:os';
import { logger } from '../../config/logger.js';
import { notificationsService } from '../notifications/notifications.service.js';

export class MonitoringService {
  async recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const metric: NewMetric = {
      id: nanoid(),
      name,
      value,
      labels: labels ?? {},
      timestamp: new Date(),
    };
    await db.insert(metrics).values(metric);
  }

  async getMetrics(filters: { name?: string; from?: Date; to?: Date; limit?: number } = {}): Promise<Metric[]> {
    const conditions = [];
    if (filters.name) conditions.push(eq(metrics.name, filters.name));
    if (filters.from || filters.to) {
      conditions.push(and(
        filters.from ? eq(metrics.timestamp, filters.from) : undefined,
        filters.to ? eq(metrics.timestamp, filters.to) : undefined,
      ) as any);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(metrics).where(where).orderBy(desc(metrics.timestamp)).limit(filters.limit ?? 100);
    return items;
  }

  async collectSystemMetrics(): Promise<void> {
    try {
      const [cpu, mem, disk, network] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
      ]);

      const rootDisk = disk.find((d: { mount?: string; use?: number }) => d.mount === '/') || disk[0];
      const defaultNet = network.find((n: { iface?: string; rx_sec?: number; tx_sec?: number }) => n.iface !== 'lo') || network[0];

      await this.recordMetric('cpu_usage_percent', Math.round(cpu.currentLoad), { host: getHostname() });
      await this.recordMetric('memory_usage_percent', Math.round((mem.used / mem.total) * 100), { host: getHostname() });
      await this.recordMetric('disk_usage_percent', Math.round(rootDisk?.use || 0), { mount: rootDisk?.mount || '/' });
      await this.recordMetric('network_rx_sec', Math.round(defaultNet?.rx_sec || 0), { iface: defaultNet?.iface || 'unknown' });
      await this.recordMetric('network_tx_sec', Math.round(defaultNet?.tx_sec || 0), { iface: defaultNet?.iface || 'unknown' });
    } catch (err) {
      logger.error({ err }, 'Failed to collect system metrics');
    }
  }

  async listAlertRules(orgId: string): Promise<AlertRule[]> {
    return db.select().from(alertRules).where(eq(alertRules.orgId, orgId)).orderBy(desc(alertRules.createdAt));
  }

  async createAlertRule(data: Omit<NewAlertRule, 'id' | 'createdAt'>): Promise<AlertRule> {
    const rule: NewAlertRule = {
      id: nanoid(),
      ...data,
      createdAt: new Date(),
    };
    await db.insert(alertRules).values(rule);
    const [created] = await db.select().from(alertRules).where(eq(alertRules.id, rule.id)).limit(1);
    return created;
  }

  async updateAlertRule(id: string, data: Partial<Pick<AlertRule, 'name' | 'description' | 'metric' | 'condition' | 'threshold' | 'duration' | 'channels' | 'enabled'>>): Promise<AlertRule> {
    await db.update(alertRules).set({ ...data, updatedAt: new Date() }).where(eq(alertRules.id, id));
    const [updated] = await db.select().from(alertRules).where(eq(alertRules.id, id)).limit(1);
    if (!updated) throw new Error('Alert rule not found');
    return updated;
  }

  async deleteAlertRule(id: string): Promise<void> {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }

  async evaluateAlertRules(): Promise<void> {
    const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
    const recentMetrics = await db.select().from(metrics).orderBy(desc(metrics.timestamp)).limit(100);

    for (const rule of rules) {
      const metricData = recentMetrics.filter(m => m.name === rule.metric);
      if (metricData.length === 0) continue;

      const latest = metricData[0];
      const triggered = this.checkCondition(latest.value, rule.condition, rule.threshold);

      if (triggered) {
        await this.triggerAlert(rule, latest.value);
      }
    }
  }

  private checkCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const history: NewAlertHistory = {
      id: nanoid(),
      ruleId: rule.id,
      triggeredAt: new Date(),
      value,
      message: `Alert "${rule.name}" triggered: ${rule.metric} ${rule.condition} ${rule.threshold} (current: ${value})`,
    };
    await db.insert(alertHistory).values(history);
    logger.info({ ruleId: rule.id, value }, 'Alert triggered');

    const channels = rule.channels as Array<{ type: 'email' | 'webhook' | 'in_app'; target?: string }> ?? [];

    for (const channel of channels) {
      if (channel.type === 'in_app') {
        const members = await db.select().from(organizationMembers).where(eq(organizationMembers.orgId, rule.orgId));
        for (const member of members) {
          await notificationsService.createNotification(
            member.userId,
            'security_alert',
            `Alert: ${rule.name}`,
            `Metric ${rule.metric} is ${rule.condition} ${rule.threshold} (current: ${value})`,
          );
        }
      }
    }
  }

  async getAlertHistory(ruleId: string, limit = 50): Promise<AlertHistory[]> {
    return db.select().from(alertHistory).where(eq(alertHistory.ruleId, ruleId)).orderBy(desc(alertHistory.triggeredAt)).limit(limit);
  }

  async listAlertHistory(orgId: string, limit = 100): Promise<(AlertHistory & { ruleName: string })[]> {
    const rules = await db.select().from(alertRules).where(eq(alertRules.orgId, orgId));
    const ruleIds = rules.map(r => r.id);
    const history = await db.select().from(alertHistory).orderBy(desc(alertHistory.triggeredAt)).limit(limit);
    return history.map(h => ({
      ...h,
      ruleName: rules.find(r => r.id === h.ruleId)?.name || 'Unknown',
    }));
  }
}

export const monitoringService = new MonitoringService();