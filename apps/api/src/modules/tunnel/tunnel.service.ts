import { db } from '../../db/index.js';
import { cloudflareTunnels, tunnelRoutes } from '../../db/schema/tunnels.js';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { run } from '../../services/executor.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { AppError } from '../../errors.js';
import { logger } from '../../config/logger.js';
import * as sudoFs from '../../services/sudo-fs.js';
import YAML from 'yaml';
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
  lastConnectedAt: string | null;
  message?: string;
}

export class TunnelService {
  /**
   * Full tunnel setup: create tunnel, configure, install as service
   */
  async setup(name: string, apiToken: string, accountId?: string, userId?: string, ipAddress?: string) {
    // 1. Create tunnel via cloudflared
    const createResult = await run('cloudflared', ['tunnel', 'create', name], {
      sudo: true,
      timeout: 60_000,
    });
    if (!createResult.success) {
      throw createTunnelError(createResult.stderr, 'TUNNEL_CREATE_FAILED');
    }

    // Parse tunnel ID from output
    const tunnelId = this.parseTunnelId(createResult.stdout);
    if (!tunnelId) {
      throw new AppError(422, 'TUNNEL_ID_PARSE_FAILED', 'Could not parse tunnel ID from cloudflared output');
    }

    // 2. Read credentials JSON
    const credsPath = `/root/.cloudflared/${tunnelId}.json`;
    const credentialsJson = await sudoFs.readFile(credsPath);

    // 3. Store in DB
    const tunnelDbId = nanoid();
    await db.insert(cloudflareTunnels).values({
      id: tunnelDbId,
      name,
      tunnelId,
      accountId: accountId || null,
      apiToken: encrypt(apiToken),
      credentialsJson: encrypt(credentialsJson),
      status: 'inactive',
    });

    // 4. Generate initial config
    await this.writeConfigFile(tunnelId, []);

    // 4b. Write credentials file to /etc/cloudflared/ with restricted permissions
    const credsTargetPath = `/etc/cloudflared/${tunnelId}.json`;
    await sudoFs.writeFile(credsTargetPath, credentialsJson);
    await sudoFs.chmod(credsTargetPath, '600');

    // 5. Install as systemd service
    await run('cloudflared', ['service', 'install'], { sudo: true });
    await run('systemctl', ['enable', 'cloudflared'], { sudo: true });

    logger.info({ name, tunnelId }, 'Cloudflare tunnel created');

    auditService.log({
      userId,
      action: 'tunnel.setup',
      resource: `tunnel:${name}`,
      details: JSON.stringify({ tunnelId }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: tunnelDbId, name, tunnelId, status: 'inactive' };
  }

  /**
   * Validate Cloudflare API Token
   */
  async validateToken(apiToken: string) {
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as any;
      
      if (!data.success) {
        throw new AppError(401, 'INVALID_TOKEN', 'Invalid Cloudflare API token');
      }

      // Check for required permissions
      const hasTunnelPerm = data.result?.policies?.some((p: any) =>
        p.effect === 'allow' && p.permission_groups?.some((g: any) =>
          g.key === 'com.cloudflare.api.account.tunnel'
        )
      );
      const hasDnsPerm = data.result?.policies?.some((p: any) =>
        p.effect === 'allow' && p.permission_groups?.some((g: any) =>
          g.key === 'com.cloudflare.api.account.dns'
        )
      );

      if (!hasTunnelPerm || !hasDnsPerm) {
        throw new AppError(403, 'INSUFFICIENT_PERMISSIONS',
          'Token requires tunnel and DNS edit permissions');
      }

      return {
        valid: true,
        email: data.result?.email,
        username: data.result?.username,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'VALIDATION_FAILED', 'Failed to validate token with Cloudflare API');
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
   * Get detailed tunnel information
   */
  async getTunnelInfo(tunnelDbId: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    try {
      const result = await run('cloudflared', ['tunnel', 'info', tunnel.tunnelId!, '--output', 'json'], {
        sudo: true,
        timeout: 30_000,
      });

      if (!result.success) {
        // If cloudflared is not running, return basic info
        return {
          id: tunnel.tunnelId,
          name: tunnel.name,
          status: tunnel.status,
          connections: [],
        };
      }

      const info: TunnelInfo = JSON.parse(result.stdout);
      
      return {
        id: info.id,
        name: tunnel.name,
        status: tunnel.status,
        connections: info.connections || [],
        createdAt: info.created_at,
      };
    } catch (error) {
      logger.warn({ tunnelDbId, error }, 'Failed to get tunnel info');
      return {
        id: tunnel.tunnelId,
        name: tunnel.name,
        status: tunnel.status,
        connections: [],
      };
    }
  }

  /**
   * Delete a tunnel
   */
  async deleteTunnel(tunnelDbId: string, userId?: string, ipAddress?: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    // Stop the tunnel if running
    await this.stop();

    // Delete from Cloudflare
    try {
      await run('cloudflared', ['tunnel', 'delete', tunnel.tunnelId!], {
        sudo: true,
        timeout: 60_000,
      });
    } catch (error) {
      logger.warn({ tunnelDbId, error }, 'Failed to delete tunnel from Cloudflare');
    }

    // Delete credentials file
    try {
      await sudoFs.unlink(`/root/.cloudflared/${tunnel.tunnelId}.json`);
    } catch (error) {
      logger.warn({ tunnelDbId, error }, 'Failed to delete credentials file');
    }

    // Delete from database
    await db.delete(cloudflareTunnels).where(eq(cloudflareTunnels.id, tunnelDbId));
    await db.delete(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));

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
   * Get tunnel configuration as YAML
   */
  async getTunnelConfig(tunnelDbId: string) {
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, tunnelDbId)).limit(1);
    
    if (!tunnel) {
      throw new AppError(404, 'TUNNEL_NOT_FOUND', 'Tunnel not found');
    }

    const routes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, tunnelDbId));

    const activeRoutes = routes.filter(r => r.isActive);

    const config = {
      tunnel: tunnel.tunnelId,
      'credentials-file': `/etc/cloudflared/${tunnel.tunnelId}.json`,
      ingress: [
        ...activeRoutes.map((r) => ({
          hostname: r.hostname,
          service: r.service,
        })),
        { service: 'http_status:404' },
      ],
    };

    return YAML.stringify(config);
  }

  /**
   * Get tunnel status with enhanced connectivity information
   */
  async getStatus(): Promise<TunnelStatus> {
    // Check if process is running
    const processResult = await run('systemctl', ['is-active', 'cloudflared']);
    const processRunning = processResult.stdout.trim() === 'active';

    if (!processRunning) {
      return {
        status: 'inactive',
        processRunning: false,
        connectedToEdge: false,
        lastConnectedAt: null,
        message: 'Cloudflared process is not running',
      };
    }

    // Process is running, check connectivity
    const tunnels = await db.select().from(cloudflareTunnels);
    let connectedToEdge = false;
    let lastConnectedAt: string | null = null;

    // Try to get connectivity info from each tunnel
    for (const tunnel of tunnels) {
      try {
        const infoResult = await run('cloudflared', ['tunnel', 'info', tunnel.tunnelId!, '--output', 'json'], {
          sudo: true,
          timeout: 10_000,
        });

        if (infoResult.success) {
          const info: TunnelInfo = JSON.parse(infoResult.stdout);
          if (info.connections && info.connections.length > 0) {
            connectedToEdge = true;
            lastConnectedAt = info.created_at;
            break;
          }
        }
      } catch {
        // Continue checking other tunnels
      }
    }

    // Also try to get metrics if available
    if (!connectedToEdge) {
      try {
        const metricsResult = await run('curl', ['-s', 'http://localhost:9100/metrics'], {
          timeout: 5_000,
        });
        if (metricsResult.success && metricsResult.stdout.includes('cloudflared')) {
          // Metrics endpoint is responding, tunnel is likely connected
          connectedToEdge = true;
        }
      } catch {
        // Metrics not available, rely on tunnel info
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
      lastConnectedAt,
      message,
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
   */
  async listRoutes(tunnelDbId?: string) {
    if (tunnelDbId) {
      return db.select().from(tunnelRoutes).where(eq(tunnelRoutes.tunnelId, tunnelDbId));
    }
    return db.select().from(tunnelRoutes);
  }

  /**
   * Add a tunnel route
   */
  async addRoute(data: {
    tunnelId: string;
    hostname: string;
    service: string;
    domainId?: string;
  }, userId?: string, ipAddress?: string) {
    // Fetch tunnel for zone validation
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
      domainId: data.domainId || null,
      isActive: true,
    });

    // Regenerate config
    const allRoutes = await db.select().from(tunnelRoutes)
      .where(eq(tunnelRoutes.tunnelId, data.tunnelId));
    await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
    await this.reloadDaemon();

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
      details: JSON.stringify({ service: data.service }),
      ipAddress,
    }).catch(err => logger.error({ err }, 'Audit log failed'));

    return { id: routeId, hostname: data.hostname, service: data.service };
  }

  /**
   * Edit a tunnel route
   */
  async editRoute(routeId: string, data: { hostname?: string; service?: string }, userId?: string, ipAddress?: string) {
    const [route] = await db.select().from(tunnelRoutes).where(eq(tunnelRoutes.id, routeId)).limit(1);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');

    const updateData: any = {};
    if (data.hostname) updateData.hostname = data.hostname;
    if (data.service) updateData.service = data.service;

    await db.update(tunnelRoutes).set(updateData).where(eq(tunnelRoutes.id, routeId));

    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);
    if (tunnel) {
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, route.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();

      // Update DNS if hostname changed
      if (data.hostname && data.hostname !== route.hostname && tunnel?.apiToken) {
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

    // Fetch tunnel for DNS cleanup
    const [tunnel] = await db.select().from(cloudflareTunnels)
      .where(eq(cloudflareTunnels.id, route.tunnelId)).limit(1);

    // Delete DNS CNAME via Cloudflare API
    if (tunnel?.apiToken && route.hostname) {
      await this.deleteDnsCname(tunnel, route.hostname);
    }

    await db.delete(tunnelRoutes).where(eq(tunnelRoutes.id, routeId));

    if (tunnel) {
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, route.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();
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
      const allRoutes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, route.tunnelId));
      await this.writeConfigFile(tunnel.tunnelId!, allRoutes);
      await this.reloadDaemon();
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

  private async writeConfigFile(tunnelUuid: string, routes: any[]) {
    const configDir = '/etc/cloudflared';
    await sudoFs.mkdir(configDir);

    const activeRoutes = routes.filter(r => r.isActive);

    const config = {
      tunnel: tunnelUuid,
      'credentials-file': `${configDir}/${tunnelUuid}.json`,
      ingress: [
        ...activeRoutes.map((r: any) => ({
          hostname: r.hostname,
          service: r.service,
        })),
        { service: 'http_status:404' },
      ],
    };

    const yamlContent = YAML.stringify(config);
    await sudoFs.writeFile(`${configDir}/config.yml`, yamlContent);

    // Ensure credentials file has restrictive permissions
    const credsPath = `${configDir}/${tunnelUuid}.json`;
    try {
      await sudoFs.chmod(credsPath, '600');
    } catch {
      // Credentials file may not exist yet (e.g., initial config generation before setup writes it)
    }
  }

  private async reloadDaemon() {
    await run('systemctl', ['reload', 'cloudflared'], { sudo: true }).catch(() => {
      return run('systemctl', ['restart', 'cloudflared'], { sudo: true });
    });
  }

  private parseTunnelId(output: string): string | null {
    const match = output.match(/id\s+([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  private async createDnsCname(tunnel: any, hostname: string) {
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
        logger.warn({ hostname, domain }, 'Could not find Cloudflare zone for hostname');
        return;
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
   * Throws AppError if the zone is not found or not active.
   */
  private async validateHostnameZone(apiToken: string, hostname: string): Promise<void> {
    // Extract root domain from hostname (e.g., "example.com" from "sub.example.com")
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

      // Find existing CNAME record for this tunnel
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

    // Check if current PANEL_URL is private (private IP or localhost)
    if (!isPrivateUrl(currentUrl)) {
      logger.debug({ hostname, currentUrl }, 'PANEL_URL is not private, skipping update');
      return;
    }

    // Check if the hostname matches the panel's domain
    // We use a simple heuristic: if the hostname looks like a panel hostname
    // (e.g., contains "panel" or is the primary domain), we update
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      
      // Read current .env content
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf-8');
      } catch {
        logger.warn({ envPath }, 'Could not read .env file, skipping PANEL_URL update');
        return;
      }

      // Determine the protocol (https for tunnel routes)
      const newUrl = `https://${hostname}`;

      // Check if PANEL_URL is already set to the same value
      const currentMatch = currentUrl.match(/^https?:\/\/[^\/]+/);
      const newMatch = newUrl.match(/^https?:\/\/[^\/]+/);
      if (currentMatch && newMatch && currentMatch[0] === newMatch[0]) {
        logger.debug({ currentUrl, newUrl }, 'PANEL_URL would be unchanged, skipping');
        return;
      }

      // Update PANEL_URL in .env content
      const newEnvContent = envContent.replace(
        /^PANEL_URL=.*$/m,
        `PANEL_URL=${newUrl}`
      );

      // Write updated .env file
      await sudoFs.writeFile(envPath, newEnvContent);

      // Update process.env for the running process
      process.env.PANEL_URL = newUrl;

      logger.info({ 
        hostname, 
        oldUrl: currentUrl, 
        newUrl 
      }, `PANEL_URL updated from ${currentUrl} to ${newUrl} due to tunnel route`);

    } catch (error) {
      logger.warn({ hostname, error }, 'Failed to update PANEL_URL in .env file');
    }
  }

  /**
   * Create a DNS CNAME record via Cloudflare API (public endpoint)
   */
  async createPublicDnsCname(zoneId: string, hostname: string, target: string) {
    // Find a tunnel to get the API token
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
    logger.info({ hostname, zoneId, target }, 'DNS CNAME created via public endpoint');
    return { success: data.success, record: data.result };
  }
}
