import { db } from '../../db/index.js';
import { sites } from '../../db/schema/sites.js';
import { domains } from '../../db/schema/domains.js';
import { containers } from '../../db/schema/containers.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { run } from '../executor.js';

const RECONCILE_INTERVAL_MS = 60000;

interface DesiredState {
  site: any;
  containers: any[];
  domains: any[];
}

interface ActualState {
  nginxStatus: 'ok' | 'missing' | 'invalid' | 'reload_needed' | 'unknown';
  containersStatus: Record<string, 'running' | 'stopped' | 'error' | 'unknown'>;
}

export class Reconciler {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isRunning) {
      logger.warn('Reconciler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Reconciler started');

    this.interval = setInterval(() => {
      this.reconcileAll().catch(err => {
        logger.error({ err }, 'Reconciliation loop error');
      });
    }, RECONCILE_INTERVAL_MS);

    this.reconcileAll().catch(err => {
      logger.error({ err }, 'Initial reconciliation error');
    });
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('Reconciler stopped');
  }

  async reconcileAll(): Promise<void> {
    const allSites = await db.select().from(sites);

    for (const site of allSites) {
      try {
        await this.reconcileSite(site.id);
      } catch (err) {
        logger.error({ err, siteId: site.id }, 'Site reconciliation failed');
      }
    }
  }

  async reconcileSite(siteId: string): Promise<void> {
    const site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1).then(r => r[0]);
    if (!site) return;

    const desired = await this.getDesiredState(siteId);
    const actual = await this.getActualState(siteId);
    const drift = this.detectDrift(desired, actual);

    if (drift.hasDrift && desired) {
      logger.info({ siteId, drift }, 'Drift detected, repairing');
      await this.repairDrift(siteId, desired, drift);
    }

    const durationMs = Date.now();
    await this.updateObservedState(siteId, actual, durationMs);
  }

  private async getDesiredState(siteId: string): Promise<DesiredState | null> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) return null;

    // Filter containers by siteId relationship
    const siteContainers = site.id
      ? await db.select().from(containers).where(eq(containers.orgId, site.id))
      : [];
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));

    return { site, containers: siteContainers, domains: siteDomains };
  }

  private async getActualState(siteId: string): Promise<ActualState> {
    let nginxStatus: ActualState['nginxStatus'] = 'unknown';
    try {
      const result = await run('nginx', ['-t'], { sudo: true });
      nginxStatus = result.exitCode === 0 ? 'ok' : 'invalid';
    } catch {
      nginxStatus = 'missing';
    }

    // Get containers by siteId
    const siteContainers = await db.select().from(containers).where(eq(containers.orgId, siteId));
    const containersStatus: Record<string, 'running' | 'stopped' | 'error' | 'unknown'> = {};

    for (const c of siteContainers) {
      if (!c.containerId) {
        containersStatus[c.id] = 'stopped';
        continue;
      }
      try {
        const { stdout } = await run('docker', ['inspect', '--format', '{{.State.Running}}', c.containerId], { sudo: true });
        containersStatus[c.id] = stdout.trim() === 'true' ? 'running' : 'stopped';
      } catch {
        containersStatus[c.id] = 'error';
      }
    }

    return { nginxStatus, containersStatus };
  }

  private detectDrift(desired: DesiredState | null, actual: ActualState): {
    hasDrift: boolean;
    nginxReloadNeeded?: boolean;
    containerRestartNeeded?: Record<string, boolean>;
  } {
    if (!desired) return { hasDrift: false };

    const containerRestartNeeded: Record<string, boolean> = {};
    let hasDrift = false;

    if (actual.nginxStatus === 'reload_needed' || actual.nginxStatus === 'invalid') {
      hasDrift = true;
    }

    for (const c of desired.containers) {
      const status = actual.containersStatus[c.id];
      if (c.status === 'running' && (status === 'stopped' || status === 'error' || status === 'unknown')) {
        containerRestartNeeded[c.id] = true;
        hasDrift = true;
      }
    }

    return { hasDrift, containerRestartNeeded };
  }

  private async repairDrift(
    siteId: string,
    desired: DesiredState,
    drift: { nginxReloadNeeded?: boolean; containerRestartNeeded?: Record<string, boolean> }
  ): Promise<void> {
    try {
      await run('nginx', ['-s', 'reload'], { sudo: true });
    } catch {
      await run('systemctl', ['reload', 'nginx'], { sudo: true }).catch(() => {});
    }

    if (drift.containerRestartNeeded) {
      for (const [containerId] of Object.entries(drift.containerRestartNeeded)) {
        const [container] = await db.select().from(containers).where(eq(containers.id, containerId)).limit(1);
        if (container?.containerId) {
          try {
            await run('docker', ['restart', container.containerId], { sudo: true });
          } catch (err) {
            logger.warn({ err, containerId }, 'Failed to restart container during reconcile');
          }
        }
      }
    }

    logger.info({ siteId }, 'Drift repaired');
  }

  private async updateObservedState(
    siteId: string,
    actual: ActualState,
    durationMs: number
  ): Promise<void> {
    logger.debug({ siteId, actual, durationMs }, 'Observed state logged');
  }
}

export const reconciler = new Reconciler();