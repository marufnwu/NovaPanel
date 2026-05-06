import { db } from '../../db/index.js';
import { cloudflareTunnels, tunnelRoutes } from '../../db/schema/tunnels.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import { auditService } from '../audit/audit.service.js';
import { isPrivateUrl } from '../../utils/network.js';
import { env } from '../../config/env.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTunnelError } from '../../utils/error-messages.js';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface TunnelInfo {
  id: string;
  name: string;
  created_at: string;
  status: string;
  connections: {
    id: string;
    colo: string;
    ip: string;
    client_version: string;
  }[];
}

/**
 * Enhanced tunnel status with connectivity information
 */
export interface TunnelStatus {
  status: 'active' | 'inactive' | 'degraded';
  processRunning: boolean;
  connectedToEdge: boolean;
  connectionCount: number;
  lastConnectedAt: string | null;
  message?: string;
  tunnels: Array<{
    id: string;
    tunnelId: string;
    name: string;
    status: 'active' | 'inactive';
    accountId?: string;
    zoneId?: string;
  }>;
}

export class TunnelService {
  /**
   * Full tunnel setup using Cloudflare API-based (remote config) approach.
   * 
   * This replaces the old CLI-based approach with:
   * 1. POST /accounts/{id}/cfd_tunnel to create tunnel via API
   * 2. Store tunnelToken (not credentials file) for service installation
   * 3. cloudflared service install with tunnel token (no config file needed)
   * 
   * Route configuration is stored remotely on Cloudflare's side and updated via API.
   */
  async setup(name: string, apiToken: string, accountId?: string, zoneId?: string, userId?: string, ipAddress?: string) {
    // 1. Determine account ID if not provided
    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      const accounts = await this.getAccounts(apiToken);
      if (accounts.length === 0) {
        throw new AppError(400, 'NO_ACCOUNTS', 'No Cloudflare accounts found for this API token');
      }
      resolvedAccountId = accounts[0].id;
    }

    // 2. Create tunnel via Cloudflare API
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/cfd_tunnel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          config_src: 'cloudflare',  // Use remote config approach
        }),
      }
    );

    const createData = await createResponse.json() as any;
    
    if (!createData.success) {
      const errorMsg = createData.errors?.[0]?.message || 'Failed to create Cloudflare tunnel';
      throw createTunnelError(errorMsg, 'TUNNEL_CREATE_FAILED');
    }

    const tunnelResult = createData.result;
    const tunnelId = tunnelResult.id;
    const tunnelToken = tunnelResult.token;  // This is different from credentials file!

    // 3. Store in DB
    const tunnelDbId = nanoid();
    await db.insert(cloudflareTunnels).values({
      id: tunnelDbId,
      name,
      tunnelId,
      tunnelToken: encrypt(tunnelToken),
      accountId: resolvedAccountId,
      zoneId: zoneId || null,
      apiToken: encrypt(apiToken),
      credentialsJson: null,  // Not needed for remote config approach
      status: 'inactive',
    });

    // 4. Install cloudflared as systemd service using tunnel token
    // This is the key difference: no config file, just the token
    await run('cloudflared', ['--protocol', 'http2', 'service', 'install', tunnelToken], { sudo: true });
    await run('systemctl', ['enable', 'cloudflared'], { sudo: true });
    await run('systemctl', ['start', 'cloudflared'], { sudo: true });

    logger.info({ name, tunnelId, accountId: resolvedAccountId }, 'Cloudflare tunnel created via API');

    auditService.log({
      userId,
      action: 'tunnel.setup',
      resource: `tunnel:${name}`,
      details: JSON.stringify({ tunnelId, accountId: resolvedAccountId }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { 
      id: tunnelDbId, 
      name, 
      tunnelId, 
      accountId: resolvedAccountId,
      zoneId: zoneId || null,
      status: 'inactive' 
    };
  }

  /**
   * Get list of Cloudflare accounts for a token
   */
  private async getAccounts(apiToken: string): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
    const data = await response.json() as any;
    if (!data.success) return [];
    return data.result.map((a: any) => ({ id: a.id, name: a.name }));
  }

  /**
   * Validate Cloudflare API Token
   * 
   * Handles both token types:
   * - User tokens (cfut_ prefix): Use /user/tokens/verify endpoint
   * - Account tokens (cfat_ prefix): Verify via account-scoped API call
   */
  async validateToken(apiToken: string) {
    const isAccountToken = apiToken.startsWith('cfat_');
    
    if (isAccountToken) {
      return this.validateAccountToken(apiToken);
    } else {
      return this.validateUserToken(apiToken);
    }
  }

  private async validateUserToken(apiToken: string) {
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      const data = await response.json() as any;
      
      if (!data.success) {
        throw new AppError(400, 'INVALID_TOKEN', 'Invalid Cloudflare API token');
      }

      return {
        valid: true,
        status: data.result?.status || 'active',
        type: 'user',
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'VALIDATION_FAILED', 'Failed to validate token with Cloudflare API');
    }
  }

  private async validateAccountToken(apiToken: string) {
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      const data = await response.json() as any;
      
      if (!data.success) {
        const errorCode = data.errors?.[0]?.code;
        const errorMsg = data.errors?.[0]?.message || 'Invalid Cloudflare API token';
        
        if (errorCode === 1000) {
          throw new AppError(400, 'INVALID_TOKEN', errorMsg);
        }
        throw new AppError(400, 'INSUFFICIENT_PERMISSIONS', errorMsg);
      }

      return {
        valid: true,
        status: 'active',
        type: 'account',
        accounts: data.result,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'VALIDATION_FAILED', 'Failed to validate account token with Cloudflare API');
    }
  }

  /**
   * Fetch Cloudflare zones for an account
   */
  async fetchZones(apiToken: string, accountId?: string) {
    try {
      let url = 'https://api.cloudflare.com/client/v4/zones';
      if (accountId) {
        url += `?account.id=${accountId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as any;
      
      if (!data.success) {
        const errorMsg = data.errors?.[0]?.message || data.messages?.[0] || 'Unknown Cloudflare API error';
        throw createTunnelError(errorMsg, 'FETCH_ZONES_FAILED');
      }

      const zones: CloudflareZone[] = data.result.map((z: any) => ({
        id: z.id,
        name: z.name,
        status: z.status,
      }));

      return zones;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'FETCH_ZONES_ERROR', 'Error fetching zones from Cloudflare API');
    }
  }

  /**
   * Get detailed tunnel information via Cloudflare API
   */
  async getTunnelInfo(tunnelDbId: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    if (!tunnel.apiToken || !tunnel.accountId || !tunnel.tunnelId) {
      logger.warn({ tunnelId: tunnel.tunnelId }, 'Missing required tunnel data for API call');
      return {
        id: tunnel.tunnelId || 'unknown',
        name: tunnel.name,
        status: tunnel.status || 'inactive',
        connections: [],
      };
    }

    try {
      const apiToken = decrypt(tunnel.apiToken);
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      const data = await response.json() as any;
      
      if (!data.success) {
        return {
          id: tunnel.tunnelId,
          name: tunnel.name,
          status: tunnel.status,
          connections: [],
        };
      }

      const info = data.result;
      // Map Cloudflare API status to panel status values
      const apiStatus = info.status as string;
      let panelStatus: 'active' | 'inactive' | 'degraded' = 'inactive';
      if (apiStatus === 'healthy') {
        panelStatus = 'active';
      } else if (apiStatus === 'degraded') {
        panelStatus = 'degraded';
      } else if (apiStatus === 'down') {
        panelStatus = 'inactive';
      }
      // else 'inactive' stays 'inactive'
      return {
        id: info.id,
        name: info.name,
        status: panelStatus,
        connections: info.connections || [],
        createdAt: info.created_at,
      };
    } catch (error) {
      logger.warn({ tunnelDbId, error }, 'Failed to get tunnel info from API');
      return {
        id: tunnel.tunnelId,
        name: tunnel.name,
        status: tunnel.status,
        connections: [],
      };
    }
  }

  /**
   * Delete a tunnel using Cloudflare API
   */
  async deleteTunnel(tunnelDbId: string, userId?: string, ipAddress?: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    // Stop the tunnel if running
    await this.stop();

    // Delete from Cloudflare via API
    if (tunnel.apiToken && tunnel.accountId && tunnel.tunnelId) {
      try {
        const apiToken = decrypt(tunnel.apiToken);
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
          }
        );

        const data = await response.json() as any;
        if (!data.success) {
          logger.warn({ tunnelDbId, errors: data.errors }, 'Failed to delete tunnel from Cloudflare API');
        }
      } catch (error) {
        logger.warn({ tunnelDbId, error }, 'Failed to delete tunnel from Cloudflare');
      }
    }

    // Uninstall cloudflared service
    try {
      await run('cloudflared', ['service', 'uninstall'], { sudo: true });
    } catch (error) {
      logger.warn({ tunnelDbId, error }, 'Failed to uninstall cloudflared service');
    }

    // Delete credentials file if it exists
    if (tunnel.tunnelId) {
      try {
        await sudoFs.unlink(`/etc/cloudflared/${tunnel.tunnelId}.json`);
      } catch {
        // May not exist
      }
      try {
        await sudoFs.unlink(`/root/.cloudflared/${tunnel.tunnelId}.json`);
      } catch {
        // May not exist
      }
    }

    // Delete config file
    try {
      await sudoFs.unlink('/etc/cloudflared/config.yml');
    } catch {
      // May not exist
    }

    // Delete DNS CNAME records for all routes before deleting from DB (Fix 7)
    const routes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, tunnelDbId));
    for (const route of routes) {
      if (route.hostname) {
        await this.deleteDnsCname(tunnel, route.hostname).catch(err => {
          logger.warn({ routeId: route.id, hostname: route.hostname, err }, 'Failed to delete DNS CNAME for route');
        });
      }
    }

    // Delete from database
    await db.delete(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));
    await db.delete(cloudflareTunnels).where(eq(cloudflareTunnels.id, tunnelDbId));

    logger.info({ tunnelDbId, tunnelId: tunnel.tunnelId }, 'Cloudflare tunnel deleted');

    auditService.log({
      userId,
      action: 'tunnel.delete',
      resource: `tunnel:${tunnel.name}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { success: true };
  }

  /**
   * Get tunnel configuration as JSON (for display/debugging)
   * With remote config, there's no local config.yml - we return the remote config
   */
  async getTunnelConfig(tunnelDbId: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    // First try to get local routes
    const routes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, tunnelDbId));

    const activeRoutes = routes.filter(r => r.isActive);

    // If we have local routes, return those
    if (activeRoutes.length > 0) {
      return {
        tunnel: tunnel.tunnelId,
        accountId: tunnel.accountId,
        ingress: activeRoutes.map((r) => ({
          hostname: r.hostname,
          service: r.service,
          originRequest: r.noTlsVerify ? { noTLSVerify: true } : undefined,
        })),
        catchAll: { service: 'http_status:404' },
      };
    }

    // No local routes — try to fetch from cloudflared management API first
    for (let port = 20241; port <= 20250; port++) {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/config`, { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data.config?.ingress) {
            return {
              tunnel: tunnel.tunnelId,
              accountId: tunnel.accountId,
              ingress: data.config.ingress
                .filter((i: any) => i.hostname)
                .map((i: any) => ({
                  hostname: i.hostname,
                  service: i.service,
                  originRequest: i.originRequest || undefined,
                })),
              catchAll: data.config.ingress.find((i: any) => !i.hostname) || { service: 'http_status:404' },
              source: 'cloudflared',
            };
          }
        }
      } catch { /* try next port */ }
    }

    // Fallback: Cloudflare API
    if (tunnel.apiToken && tunnel.accountId && tunnel.tunnelId) {
      try {
        const apiToken = decrypt(tunnel.apiToken);
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}/configurations`,
          {
            headers: { Authorization: `Bearer ${apiToken}` },
          }
        );
        const data = await response.json() as any;
        if (data.success && data.result?.config?.ingress) {
          return {
            tunnel: tunnel.tunnelId,
            accountId: tunnel.accountId,
            ingress: data.result.config.ingress
              .filter((i: any) => i.hostname)
              .map((i: any) => ({
                hostname: i.hostname,
                service: i.service,
                originRequest: i.originRequest || undefined,
              })),
            catchAll: data.result.config.ingress.find((i: any) => !i.hostname) || { service: 'http_status:404' },
            source: 'remote',
          };
        }
      } catch {
        // Fall through to empty config
      }
    }

    // Return empty config
    return {
      tunnel: tunnel.tunnelId,
      accountId: tunnel.accountId,
      ingress: activeRoutes.map((r) => ({
        hostname: r.hostname,
        service: r.service,
        originRequest: r.noTlsVerify ? { noTLSVerify: true } : undefined,
      })),
      catchAll: { service: 'http_status:404' },
    };
  }

  /**
   * Get tunnel status with enhanced connectivity information
   * Uses Cloudflare API for health information
   */
  async getStatus(): Promise<TunnelStatus> {
    // Query tunnels first so they're available in all return paths
    const tunnels = await db.select().from(cloudflareTunnels);

    // Check if process is running
    const processResult = await run('systemctl', ['is-active', 'cloudflared']);
    const processRunning = processResult.stdout.trim() === 'active';

    if (!processRunning) {
      return {
        status: 'inactive',
        processRunning: false,
        connectedToEdge: false,
        connectionCount: 0,
        lastConnectedAt: null,
        message: 'Cloudflared process is not running',
        tunnels: tunnels.map(t => ({
          id: t.id,
          tunnelId: t.tunnelId || '',
          name: t.name,
          status: t.status as 'active' | 'inactive',
          accountId: t.accountId || undefined,
          zoneId: t.zoneId || undefined,
        })),
      };
    }

    // Process is running, check connectivity
    let connectedToEdge = false;
    let lastConnectedAt: string | null = null;
    let connectionCount = 0;

    // First, try local cloudflared metrics endpoint (most reliable)
    try {
      // Find the metrics port from cloudflared process or try default ports
      for (let port = 20241; port <= 20250; port++) {
        try {
          const metricsResp = await fetch(`http://127.0.0.1:${port}/metrics`, {
            signal: AbortSignal.timeout(2000),
          });
          if (metricsResp.ok) {
            const metricsText = await metricsResp.text();
            const haMatch = metricsText.match(/cloudflared_tunnel_ha_connections (\d+)/);
            if (haMatch) {
              connectionCount = parseInt(haMatch[1], 10);
              if (connectionCount > 0) {
                connectedToEdge = true;
              }
            }
            break;
          }
        } catch {
          // Try next port
        }
      }
    } catch {
      // Metrics unavailable, fall through to API check
    }

    // If metrics didn't confirm connectivity, try Cloudflare API as fallback
    if (!connectedToEdge) {
      for (const tunnel of tunnels) {
        if (!tunnel.apiToken || !tunnel.accountId || !tunnel.tunnelId) continue;
        
        try {
          const apiToken = decrypt(tunnel.apiToken);
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}`,
            {
              headers: {
                Authorization: `Bearer ${apiToken}`,
              },
            }
          );

          const data = await response.json() as any;
          if (data.success && data.result) {
            const connections = data.result.connections || [];
            if (connections.length > 0) {
              connectedToEdge = true;
              connectionCount = connections.length;
              lastConnectedAt = data.result.conns_active_at || data.result.created_at || null;
              break;
            }
            // Cloudflare API often returns empty connections even when connected
            // If status is "active" in DB and process is running, trust it
            if (tunnel.status === 'active') {
              connectedToEdge = true;
              break;
            }
          }
        } catch {
          // Continue checking other tunnels
        }
      }
    }

    // Final fallback: if process is running and has been running for a while,
    // cloudflared would have exited if it couldn't connect, so trust the process
    if (!connectedToEdge && processRunning) {
      try {
        const uptime = await run('systemctl', ['show', 'cloudflared', '--property=ActiveEnterTimestamp']);
        const ts = uptime.stdout.trim().replace('ActiveEnterTimestamp=', '');
        if (ts) {
          const startTime = new Date(ts);
          const runningSeconds = (Date.now() - startTime.getTime()) / 1000;
          // If process has been running for more than 30 seconds, it's likely connected
          if (runningSeconds > 30) {
            connectedToEdge = true;
          }
        }
      } catch {
        // Can't determine uptime, leave as is
      }
    }

    let status: 'active' | 'inactive' | 'degraded' = 'inactive';
    let message: string | undefined;

    if (processRunning && connectedToEdge) {
      status = 'active';
      message = 'Tunnel is running and connected to Cloudflare edge';
    } else if (processRunning && !connectedToEdge) {
      status = 'degraded';
      message = 'Tunnel process is running but not connected to Cloudflare edge';
    }

    return {
      status,
      processRunning,
      connectedToEdge,
      connectionCount,
      lastConnectedAt,
      message,
      tunnels: tunnels.map(t => ({
        id: t.id,
        tunnelId: t.tunnelId || '',
        name: t.name,
        status: t.status as 'active' | 'inactive',
        accountId: t.accountId || undefined,
        zoneId: t.zoneId || undefined,
      })),
    };
  }

  /**
   * Start tunnel
   */
  async start(userId?: string, ipAddress?: string) {
    await run('systemctl', ['start', 'cloudflared'], { sudo: true });

    const tunnels = await db.select().from(cloudflareTunnels);
    for (const t of tunnels) {
      await db.update(cloudflareTunnels).set({ status: 'active' }).where(eq(cloudflareTunnels.id, t.id));
    }

    logger.info('Cloudflare tunnel started');

    auditService.log({
      userId,
      action: 'tunnel.start',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { status: 'active' };
  }

  /**
   * Stop tunnel
   */
  async stop(userId?: string, ipAddress?: string) {
    await run('systemctl', ['stop', 'cloudflared'], { sudo: true });

    const tunnels = await db.select().from(cloudflareTunnels);
    for (const t of tunnels) {
      await db.update(cloudflareTunnels).set({ status: 'inactive' }).where(eq(cloudflareTunnels.id, t.id));
    }

    logger.info('Cloudflare tunnel stopped');

    auditService.log({
      userId,
      action: 'tunnel.stop',
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { status: 'inactive' };
  }

  /**
   * List tunnel routes
   * Auto-syncs from Cloudflare remote config if no local routes exist
   */
  async listRoutes(tunnelDbId?: string) {
    if (tunnelDbId) {
      const routes = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));

      // Auto-sync from remote if no local routes exist
      if (routes.length === 0) {
        try {
          await this.syncRemoteRoutes(tunnelDbId);
          return db.select().from(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));
        } catch (err) {
          logger.warn({ err, tunnelDbId }, 'Auto-sync of remote routes failed');
        }
      }

      return routes;
    }
    return db.select().from(tunnelRoutes);
  }

  /**
   * Sync remote tunnel routes from Cloudflare API into local DB.
   * Fetches the current ingress rules from Cloudflare and creates
   * local DB records for any routes that don't already exist locally.
   */
  async syncRemoteRoutes(tunnelDbId: string, userId?: string, ipAddress?: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);

    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    // Fetch tunnel config using multiple sources
    let remoteIngress: Array<{ hostname: string; service: string; noTlsVerify: boolean }> = [];
    let source = 'none';

    // Primary: Fetch from local cloudflared management API (/config endpoint)
    for (let port = 20241; port <= 20250; port++) {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/config`, { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data.config?.ingress) {
            remoteIngress = data.config.ingress
              .filter((i: any) => i.hostname) // exclude catch-all (empty hostname)
              .map((i: any) => ({
                hostname: i.hostname,
                service: i.service,
                noTlsVerify: i.originRequest?.noTLSVerify || false,
              }));
            source = `cloudflared:${port}`;
            break;
          }
        }
      } catch { /* try next port */ }
    }

    // Fallback: Cloudflare API
    if (remoteIngress.length === 0 && tunnel.apiToken && tunnel.accountId && tunnel.tunnelId) {
      try {
        const apiToken = decrypt(tunnel.apiToken);
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}/configurations`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const data = await response.json() as any;
        if (data.success && data.result?.config?.ingress) {
          remoteIngress = data.result.config.ingress
            .filter((i: any) => i.hostname)
            .map((i: any) => ({
              hostname: i.hostname,
              service: i.service,
              noTlsVerify: i.originRequest?.noTLSVerify || false,
            }));
          source = 'cloudflare-api';
        }
      } catch { /* fall through */ }
    }

    if (remoteIngress.length === 0) {
      return {
        synced: 0,
        stale: 0,
        totalRemote: 0,
        totalLocal: 0,
        newRoutes: [],
        staleRoutes: [],
        source,
        message: 'No remote routes found. Tunnel may not be running or has no routes configured.',
      };
    }

    // Get existing local routes
    const localRoutes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, tunnelDbId));

    // Find routes that exist remotely but not locally (match by hostname)
    const existingHostnames = new Set(localRoutes.map(r => r.hostname));
    const newRemoteRoutes = remoteIngress.filter((remote: any) => !existingHostnames.has(remote.hostname));

    // Insert new routes into local DB
    const syncedRoutes = [];
    for (const route of newRemoteRoutes) {
      const routeId = nanoid();
      await db.insert(tunnelRoutes).values({
        id: routeId,
        tunnelId: tunnelDbId,
        hostname: route.hostname,
        service: route.service,
        noTlsVerify: route.noTlsVerify,
        domainId: null,
        isActive: true,
      });
      syncedRoutes.push({ id: routeId, hostname: route.hostname, service: route.service });
    }

    // Find local routes that no longer exist remotely (stale local routes)
    const remoteHostnames = new Set(remoteIngress.map((r: any) => r.hostname));
    const staleRoutes = localRoutes.filter(local => !remoteHostnames.has(local.hostname) && local.isActive);

    // Log results
    logger.info({
      tunnelId: tunnel.tunnelId,
      remoteCount: remoteIngress.length,
      localCount: localRoutes.length,
      syncedCount: syncedRoutes.length,
      staleCount: staleRoutes.length,
    }, 'Tunnel routes synced from remote');

    if (syncedRoutes.length > 0) {
      auditService.log({
        userId,
        action: 'tunnel.routes.sync',
        resource: `tunnel:${tunnel.name}`,
        details: JSON.stringify({
          syncedCount: syncedRoutes.length,
          routes: syncedRoutes.map(r => ({ hostname: r.hostname, service: r.service })),
        }),
        ipAddress,
      }).catch(err => logger.error({ err }, 'Audit log failed'));
    }

    return {
      synced: syncedRoutes.length,
      stale: staleRoutes.length,
      totalRemote: remoteIngress.length,
      totalLocal: localRoutes.length + syncedRoutes.length,
      newRoutes: syncedRoutes,
      staleRoutes: staleRoutes.map(r => ({ id: r.id, hostname: r.hostname, service: r.service })),
    };
  }

  /**
   * Add a tunnel route
   * Uses remote config API - no service reload needed!
   */
  async addRoute(data: {
    tunnelId: string;
    hostname: string;
    service: string;
    noTlsVerify?: boolean;
    domainId?: string;
  }, userId?: string, ipAddress?: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, data.tunnelId)).limit(1);
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    // Validate that the hostname's zone is configured in Cloudflare
    if (tunnel.apiToken) {
      const apiToken = decrypt(tunnel.apiToken);
      await this.validateHostnameZone(apiToken, data.hostname);
    }

    const routeId = nanoid();

    await db.insert(tunnelRoutes).values({
      id: routeId,
      tunnelId: data.tunnelId,
      hostname: data.hostname,
      service: data.service,
      noTlsVerify: data.noTlsVerify || false,
      domainId: data.domainId || null,
      isActive: true,
    });

    // Update remote config via Cloudflare API (no reload needed!)
    await this.updateRemoteConfig(tunnel, data.tunnelId);

    // Create DNS CNAME via Cloudflare API
    if (tunnel.apiToken) {
      await this.createDnsCname(tunnel, data.hostname);
    }

    // Auto-update PANEL_URL if tunnel route covers panel domain
    await this.updatePanelUrlIfNeeded(data.hostname);

    logger.info({ hostname: data.hostname, service: data.service }, 'Tunnel route added');

    auditService.log({
      userId,
      action: 'tunnel.route.add',
      resource: `route:${data.hostname}`,
      details: JSON.stringify({ service: data.service, noTlsVerify: data.noTlsVerify }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { 
      id: routeId, 
      hostname: data.hostname, 
      service: data.service,
      noTlsVerify: data.noTlsVerify || false,
    };
  }

  /**
   * Edit a tunnel route
   */
  async editRoute(routeId: string, data: { hostname?: string; service?: string; noTlsVerify?: boolean }, userId?: string, ipAddress?: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    const updateData: any = {};
    if (data.hostname !== undefined) updateData.hostname = data.hostname;
    if (data.service !== undefined) updateData.service = data.service;
    if (data.noTlsVerify !== undefined) updateData.noTlsVerify = data.noTlsVerify;

    await db.update(tunnelRoutes).set(updateData).where(eq(tunnelRoutes.id, routeId));

    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);
    if (tunnel) {
      await this.updateRemoteConfig(tunnel, route.tunnelId);

      // Update DNS if hostname changed
      if (data.hostname && data.hostname !== route.hostname && tunnel?.apiToken) {
        await this.deleteDnsCname(tunnel, route.hostname).catch(() => {});
        await this.createDnsCname(tunnel, data.hostname);
      }
    }

    logger.info({ routeId, updateData }, 'Tunnel route updated');

    auditService.log({
      userId,
      action: 'tunnel.route.edit',
      resource: `route:${routeId}`,
      details: JSON.stringify(updateData),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: routeId, ...updateData };
  }

  /**
   * Delete a tunnel route
   */
  async deleteRoute(routeId: string, userId?: string, ipAddress?: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);

    // Delete DNS CNAME via Cloudflare API
    if (tunnel?.apiToken && route.hostname) {
      await this.deleteDnsCname(tunnel, route.hostname);
    }

    await db.delete(tunnelRoutes).where(eq(tunnelRoutes.id, routeId));

    if (tunnel) {
      await this.updateRemoteConfig(tunnel, route.tunnelId);
    }

    logger.info({ routeId }, 'Tunnel route deleted');

    auditService.log({
      userId,
      action: 'tunnel.route.delete',
      resource: `route:${routeId}`,
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));
  }

  /**
   * Toggle a route active/inactive
   */
  async toggleRoute(routeId: string, userId?: string, ipAddress?: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    const newStatus = !route.isActive;
    await db.update(tunnelRoutes).set({ isActive: newStatus }).where(eq(tunnelRoutes.id, routeId));

    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);
    if (tunnel) {
      await this.updateRemoteConfig(tunnel, route.tunnelId);
    }

    auditService.log({
      userId,
      action: 'tunnel.route.toggle',
      resource: `route:${routeId}`,
      details: JSON.stringify({ isActive: newStatus }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: routeId, isActive: newStatus };
  }

  // --- Private Helpers ---

  /**
   * Update tunnel ingress configuration via Cloudflare API (remote config)
   * This replaces the old writeConfigFile + reloadDaemon approach
   * 
   * Key benefit: NO service reload needed! cloudflared picks up config automatically
   */
  private async updateRemoteConfig(tunnel: any, tunnelDbId: string) {
    if (!tunnel.apiToken || !tunnel.accountId || !tunnel.tunnelId) {
      logger.warn({ tunnelId: tunnel.tunnelId }, 'Missing required data for remote config update');
      return;
    }

    const apiToken = decrypt(tunnel.apiToken);
    const accountId = tunnel.accountId;
    const tunnelId = tunnel.tunnelId;

    const allRoutes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, tunnelDbId));
    
    const activeRoutes = allRoutes.filter(r => r.isActive);

    const ingress = activeRoutes.map(r => {
      const rule: any = {
        hostname: r.hostname,
        service: r.service,
      };
      // Add originRequest settings for self-signed certs
      if (r.noTlsVerify) {
        rule.originRequest = { noTLSVerify: true };
      }
      return rule;
    });
    
    // Mandatory catch-all at the end
    ingress.push({ service: 'http_status:404' });

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ config: { ingress } }),
        }
      );

      const data = await response.json() as any;
      if (!data.success) {
        const errorMsg = data.errors?.[0]?.message || 'Failed to update tunnel configuration';
        logger.error({ error: data.errors }, 'Remote config update failed');
        throw new AppError(500, 'CONFIG_UPDATE_FAILED', errorMsg);
      }

      logger.info({ tunnelId, activeRoutes: activeRoutes.length }, 'Tunnel configuration updated via API');
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error({ error, tunnelId }, 'Failed to update remote config');
      throw new AppError(500, 'CONFIG_UPDATE_FAILED', 'Failed to update tunnel configuration');
    }
  }

  private async createDnsCname(tunnel: any, hostname: string) {
    if (!tunnel.apiToken || !tunnel.tunnelId) return;

    try {
      const apiToken = decrypt(tunnel.apiToken);
      const tunnelId = tunnel.tunnelId;

      // Use stored zoneId if available, otherwise look up by domain
      let zoneId = tunnel.zoneId;
      if (!zoneId) {
        const domain = hostname.split('.').slice(-2).join('.');
        const zonesResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const zonesData = await zonesResponse.json() as any;
        zoneId = zonesData.result?.[0]?.id;
      }

      if (!zoneId) {
        logger.warn({ hostname, domain: tunnel.zoneId ? 'stored' : 'lookup' }, 'Could not find Cloudflare zone for hostname');
        return;
      }

      // Check for existing CNAME record and delete if found
      const listRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${hostname}&type=CNAME`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const listData = await listRes.json() as any;
      if (listData.result?.length > 0) {
        for (const record of listData.result) {
          await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
          );
        }
      }

      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: hostname,
          content: `${tunnelId}.cfargotunnel.com`,
          proxied: true,
        }),
      });

      logger.info({ hostname, zoneId }, 'DNS CNAME created via Cloudflare API');
    } catch (error) {
      logger.warn({ hostname, error }, 'Failed to create DNS CNAME');
    }
  }

  /**
   * Validate that a hostname's root domain is an active Cloudflare zone.
   */
  private async validateHostnameZone(apiToken: string, hostname: string): Promise<void> {
    const parts = hostname.split('.');
    const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${rootDomain}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json() as any;

      if (!data.success || !data.result?.length) {
        const errorMsg = data.errors?.[0]?.message || `Domain "${rootDomain}" is not a configured Cloudflare zone. Add the domain to your Cloudflare account first.`;
        throw createTunnelError(errorMsg, 'ZONE_NOT_FOUND');
      }

      const zone = data.result[0];
      if (zone.status !== 'active') {
        throw new AppError(400, 'ZONE_NOT_ACTIVE',
          `Zone "${rootDomain}" exists but is not active (status: ${zone.status}).`);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'ZONE_VALIDATION_ERROR', 'Failed to validate hostname zone with Cloudflare API');
    }
  }

  /**
   * Delete a DNS CNAME record for a tunnel route via Cloudflare API.
   */
  private async deleteDnsCname(tunnel: any, hostname: string) {
    if (!tunnel.apiToken || !tunnel.tunnelId) return;

    try {
      const apiToken = decrypt(tunnel.apiToken);
      const tunnelId = tunnel.tunnelId;

      const domain = hostname.split('.').slice(-2).join('.');
      const zonesResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const zonesData = await zonesResponse.json() as any;
      const zoneId = zonesData.result?.[0]?.id;

      if (!zoneId) {
        logger.warn({ hostname, domain }, 'Could not find Cloudflare zone for hostname during CNAME deletion');
        return;
      }

      const recordsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=${hostname}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const recordsData = await recordsResponse.json() as any;
      const record = recordsData.result?.find(
        (r: any) => r.type === 'CNAME' && r.name === hostname && r.content === `${tunnelId}.cfargotunnel.com`
      );

      if (record) {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });
        logger.info({ hostname, zoneId, recordId: record.id }, 'DNS CNAME deleted via Cloudflare API');
      }
    } catch (error) {
      logger.warn({ hostname, error }, 'Failed to delete DNS CNAME');
    }
  }

  /**
   * Update PANEL_URL in .env file if the current URL is a private IP
   * and a tunnel route is being added for the panel domain.
   */
  private async updatePanelUrlIfNeeded(hostname: string): Promise<void> {
    const currentUrl = env.PANEL_URL;

    if (!isPrivateUrl(currentUrl)) {
      logger.debug({ hostname, currentUrl }, 'PANEL_URL is not private, skipping update');
      return;
    }

    try {
      const envPath = path.resolve(process.cwd(), '.env');
      
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf-8');
      } catch {
        logger.warn({ envPath }, 'Could not read .env file, skipping PANEL_URL update');
        return;
      }

      const newUrl = `https://${hostname}`;

      const currentMatch = currentUrl.match(/^https?:\/\/[^\/]+/);
      const newMatch = newUrl.match(/^https?:\/\/[^\/]+/);
      if (currentMatch && newMatch && currentMatch[0] === newMatch[0]) {
        logger.debug({ currentUrl, newUrl }, 'PANEL_URL would be unchanged, skipping');
        return;
      }

      const newEnvContent = envContent.replace(
        /^PANEL_URL=.*$/m,
        `PANEL_URL=${newUrl}`
      );

      await sudoFs.writeFile(envPath, newEnvContent);
      process.env.PANEL_URL = newUrl;

      logger.info({ hostname, oldUrl: currentUrl, newUrl }, `PANEL_URL updated from ${currentUrl} to ${newUrl} due to tunnel route`);

    } catch (error) {
      logger.warn({ hostname, error }, 'Failed to update PANEL_URL in .env file');
    }
  }

  /**
   * Create a DNS CNAME record via Cloudflare API (public endpoint)
   */
  async createPublicDnsCname(zoneId: string, hostname: string, target: string) {
    const tunnels = await db.select().from(cloudflareTunnels).limit(1);
    const tunnel = tunnels[0];
    if (!tunnel?.apiToken) {
      throw new AppError(400, 'NO_TUNNEL', 'No Cloudflare tunnel configured');
    }

    const apiToken = decrypt(tunnel.apiToken);

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: hostname,
        content: target,
        proxied: true,
      }),
    });

    const data = await response.json() as any;
    if (!data.success) {
      const errorMsg = data.errors?.map((e: any) => e.message).join('; ') || 'Cloudflare API returned failure';
      logger.error({ hostname, zoneId, target, errors: data.errors }, 'DNS CNAME creation failed');
      throw new AppError(422, 'DNS_CNAME_FAILED', `Failed to create DNS CNAME: ${errorMsg}`);
    }
    logger.info({ hostname, zoneId, target }, 'DNS CNAME created via public endpoint');
    return { success: true, record: data.result };
  }
}
