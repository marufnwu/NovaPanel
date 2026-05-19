import { db } from '../../db/index.js';
import { sites } from '../../db/schema/sites.js';
import { siteStates } from '../../db/schema/site_states.js';
import { siteRuntimes } from '../../db/schema/site_runtimes.js';
import { siteProcesses } from '../../db/schema/site_processes.js';
import { domains } from '../../db/schema/domains.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { nginxRenderer } from '../nginx-renderer/index.js';
import { jobQueue, JOB_TYPES } from '../job-queue/index.js';
import { getProcessManager } from '../process-manager/index.js';
import { runtimeManager } from '../runtime-manager/index.js';
import { run } from '../executor.js';

const RECONCILE_INTERVAL_MS = 60000; // 60 seconds

interface DesiredState {
  site: any;
  runtime: any;
  process: any;
  domains: any[];
}

interface ActualState {
  nginxStatus: 'ok' | 'missing' | 'invalid' | 'reload_needed' | 'unknown';
  processStatus: 'running' | 'stopped' | 'error' | 'restarting' | 'unknown';
  processPid?: number;
  processRunning?: boolean;
  portCorrect?: boolean;
}

export class Reconciler {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  /**
   * Start the reconciler loop
   */
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

    // Run immediately on start
    this.reconcileAll().catch(err => {
      logger.error({ err }, 'Initial reconciliation error');
    });
  }

  /**
   * Stop the reconciler loop
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('Reconciler stopped');
  }

  /**
   * Reconcile all sites
   */
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

  /**
   * Reconcile a single site
   */
  async reconcileSite(siteId: string): Promise<void> {
    const startTime = Date.now();

    // Get desired state from DB
    const desiredState = await this.getDesiredState(siteId);
    if (!desiredState) {
      logger.warn({ siteId }, 'Site not found for reconciliation');
      return;
    }

    // Get actual state from infrastructure
    const actualState = await this.getActualState(siteId);

    // Compare and repair drift
    const drift = this.detectDrift(desiredState, actualState);

    if (drift.hasDrift) {
      logger.info({ siteId, drift }, 'Drift detected, initiating repair');
      await this.repairDrift(siteId, desiredState, drift);
    }

    // Update observed state
    await this.updateObservedState(siteId, actualState, Date.now() - startTime);

    logger.debug({ siteId, duration: Date.now() - startTime }, 'Site reconciliation completed');
  }

  /**
   * Get desired state from database
   */
  private async getDesiredState(siteId: string): Promise<DesiredState | null> {
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) return null;

    const [runtime] = await db.select().from(siteRuntimes).where(eq(siteRuntimes.siteId, siteId)).limit(1);
    const [process] = await db.select().from(siteProcesses).where(eq(siteProcesses.siteId, siteId)).limit(1);
    const siteDomains = await db.select().from(domains).where(eq(domains.siteId, siteId));

    return { site, runtime, process, domains: siteDomains };
  }

  /**
   * Get actual state from infrastructure
   */
  private async getActualState(siteId: string): Promise<ActualState> {
    const state: ActualState = {
      nginxStatus: 'unknown',
      processStatus: 'unknown',
    };

    // Check nginx config
    const configPath = nginxRenderer.getConfigPath(siteId);
    try {
      const { success } = await run('test', ['-f', configPath], { sudo: true });
      if (!success) {
        state.nginxStatus = 'missing';
      } else {
        // Validate nginx config
        const validateResult = await run('nginx', ['-t', '-c', configPath], { sudo: true });
        state.nginxStatus = validateResult.success ? 'ok' : 'invalid';
      }
    } catch {
      state.nginxStatus = 'missing';
    }

    // Check process
    try {
      const processManager = await getProcessManager();
      const status = await processManager.getStatus(`site-${siteId}`);
      state.processRunning = status.running;
      state.processPid = status.pid;
      state.processStatus = status.status === 'online' ? 'running' :
                           status.status === 'stopped' ? 'stopped' : 'error';
    } catch {
      state.processStatus = 'unknown';
    }

    return state;
  }

  /**
   * Detect drift between desired and actual state
   */
  private detectDrift(desired: DesiredState, actual: ActualState): {
    hasDrift: boolean;
    nginxReloadNeeded?: boolean;
    processRestartNeeded?: boolean;
    configRegenNeeded?: boolean;
  } {
    const drift: {
      hasDrift: boolean;
      nginxReloadNeeded?: boolean;
      processRestartNeeded?: boolean;
      configRegenNeeded?: boolean;
    } = { hasDrift: false };

    // Nginx drift
    if (actual.nginxStatus === 'missing' || actual.nginxStatus === 'invalid') {
      drift.hasDrift = true;
      drift.configRegenNeeded = true;
    } else if (actual.nginxStatus === 'ok' && desired.site.status === 'suspended') {
      // Site is suspended but nginx is OK - needs reload
      drift.hasDrift = true;
      drift.nginxReloadNeeded = true;
    }

    // Process drift
    if (desired.process && !actual.processRunning && desired.site.status === 'active') {
      drift.hasDrift = true;
      drift.processRestartNeeded = true;
    }

    return drift;
  }

  /**
   * Repair drift by enqueueing appropriate jobs
   */
  private async repairDrift(
    siteId: string,
    desired: DesiredState,
    drift: { nginxReloadNeeded?: boolean; processRestartNeeded?: boolean; configRegenNeeded?: boolean }
  ): Promise<void> {
    if (drift.configRegenNeeded) {
      await jobQueue.enqueue(JOB_TYPES.NGINX_CONFIG_REGENERATE, { siteId });
    }

    if (drift.nginxReloadNeeded) {
      await jobQueue.enqueue(JOB_TYPES.NGINX_RELOAD, { siteId });
    }

    if (drift.processRestartNeeded && desired.process) {
      await jobQueue.enqueue(JOB_TYPES.PM2_RESTART, {
        siteId,
        processName: `site-${siteId}`
      });
    }
  }

  /**
   * Update observed state in database
   */
  private async updateObservedState(
    siteId: string,
    actual: ActualState,
    durationMs: number
  ): Promise<void> {
    const [existing] = await db.select()
      .from(siteStates)
      .where(eq(siteStates.siteId, siteId))
      .limit(1);

    const updateData = {
      nginxStatus: actual.nginxStatus,
      nginxConfigValid: actual.nginxStatus === 'ok',
      nginxReloadNeeded: false, // Reset after handling
      processStatus: actual.processStatus,
      processRunning: actual.processRunning,
      processPid: actual.processPid,
      lastReconcileAt: new Date(),
      observedAt: new Date(),
    };

    if (existing) {
      await db.update(siteStates)
        .set(updateData)
        .where(eq(siteStates.siteId, siteId));
    } else {
      await db.insert(siteStates).values({
        id: `state_${siteId.substring(4)}`,
        siteId,
        ...updateData,
        lastDeploymentStatus: 'unknown',
        sslProvisioned: false,
        sslAutoRenew: true,
        dnsResolving: null,
        dnsPointsToServer: null,
      });
    }
  }
}

export const reconciler = new Reconciler();