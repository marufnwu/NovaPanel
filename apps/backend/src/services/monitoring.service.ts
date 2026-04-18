import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

// ─── Uptime Checking ───

export interface CheckResult {
  up: boolean;
  responseTimeMs: number | null;
  statusCode: number | null;
  error: string | null;
}

export async function performUptimeCheck(url: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    return {
      up: res.status < 500,
      responseTimeMs: Date.now() - start,
      statusCode: res.status,
      error: res.status >= 500 ? `HTTP ${res.status}` : null,
    };
  } catch (err) {
    return {
      up: false,
      responseTimeMs: null,
      statusCode: null,
      error: err instanceof Error ? err.message : 'Request failed',
    };
  }
}

export async function recordUptimeCheck(
  siteId: string,
  checkId: string,
  result: CheckResult,
): Promise<void> {
  const wasUp = await getCurrentStatus(checkId);

  await prisma.uptimeCheck.update({
    where: { id: checkId },
    data: {
      status: result.up ? 'up' : 'down',
      lastCheckedAt: new Date(),
      responseTimeMs: result.responseTimeMs,
    },
  });

  // Record incident on status change
  if (wasUp && !result.up) {
    await prisma.uptimeIncident.create({
      data: { checkId, startedAt: new Date() },
    });
  } else if (!wasUp && result.up) {
    // Resolve latest open incident
    const incident = await prisma.uptimeIncident.findFirst({
      where: { checkId, resolvedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (incident) {
      await prisma.uptimeIncident.update({
        where: { id: incident.id },
        data: {
          resolvedAt: new Date(),
          durationSeconds: Math.floor((Date.now() - incident.startedAt.getTime()) / 1000),
        },
      });
    }
  }

  // Cache latest check result
  await redis.set(
    `uptime:${siteId}`,
    JSON.stringify({ ...result, checkedAt: new Date().toISOString() }),
    'EX',
    300,
  );
}

async function getCurrentStatus(checkId: string): Promise<boolean> {
  const check = await prisma.uptimeCheck.findUnique({ where: { id: checkId } });
  return check?.status === 'up';
}

// ─── Alert Evaluation ───

export async function evaluateAlerts(serverId: string, siteId: string | null): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: {
      active: true,
      OR: [{ serverId }, { siteId }],
    },
  });

  for (const rule of rules) {
    let triggered = false;
    let message = '';

    switch (rule.type) {
      case 'site_down': {
        if (siteId) {
          const cached = await redis.get(`uptime:${siteId}`);
          if (cached) {
            const result = JSON.parse(cached);
            triggered = !result.up;
            message = `Site ${siteId} is down: ${result.error || 'HTTP error'}`;
          }
        }
        break;
      }
      case 'cpu':
      case 'ram':
      case 'disk': {
        const latest = await redis.get(`metrics:latest:${serverId}`);
        if (latest) {
          const metrics = JSON.parse(latest);
          const value = rule.type === 'cpu' ? metrics.cpuPercent
            : rule.type === 'ram' ? (metrics.ramUsed / metrics.ramTotal) * 100
            : metrics.diskUsed && metrics.diskTotal ? (metrics.diskUsed / metrics.diskTotal) * 100 : 0;

          if (value >= (rule.threshold || 90)) {
            triggered = true;
            message = `${rule.type.toUpperCase()} alert: ${value.toFixed(1)}% (threshold: ${rule.threshold}%)`;
          }
        }
        break;
      }
    }

    if (triggered) {
      await sendAlert(rule, message);
    }
  }
}

async function sendAlert(rule: any, message: string): Promise<void> {
  // Check cooldown
  const cooldownKey = `alert-cooldown:${rule.id}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) return;

  const config = rule.channelConfig as Record<string, string>;

  switch (rule.channel) {
    case 'webhook':
      if (config.webhookUrl) {
        try {
          await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message, rule: rule.type, timestamp: new Date().toISOString() }),
          });
        } catch { /* ignore */ }
      }
      break;
    case 'telegram':
      if (config.botToken && config.chatId) {
        try {
          await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: config.chatId, text: `🚨 ${message}` }),
          });
        } catch { /* ignore */ }
      }
      break;
    case 'email':
      // Email sending requires SMTP config — store in notification channels
      break;
  }

  // Set cooldown
  await redis.set(cooldownKey, '1', 'EX', (rule.cooldownMinutes || 15) * 60);

  // Log alert
  await redis.lpush('alert-history', JSON.stringify({
    ruleId: rule.id,
    type: rule.type,
    message,
    sentAt: new Date().toISOString(),
  }));
}
