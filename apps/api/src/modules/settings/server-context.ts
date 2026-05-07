import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { detectNetworkInfo, getPanelUrlInfo } from '../../utils/network.js';
import { db } from '../../db/index.js';
import { cloudflareTunnels, tunnelRoutes } from '../../db/schema/tunnels.js';
import { eq } from 'drizzle-orm';
import { settingsService } from './settings.service.js';

export interface ServerContext {
  // Network info
  localIps: string[];
  hasPublicIp: boolean;
  publicIp: string | null;
  primaryIp: string;

  // Nameserver info (actual nameservers for this server)
  nameservers: {
    ns1: string;
    ns2: string;
  };

  // Panel info
  panelUrl: string;
  panelUrlIsPrivate: boolean;

  // Tunnel info
  tunnelConfigured: boolean;
  tunnelActive: boolean;
  tunnelUrl: string | null;

  // Capability flags
  canIssueHttpSsl: boolean;
  canReceiveExternalMail: boolean;
  canServePublicDns: boolean;
}

/**
 * Get tunnel information from database
 */
async function getTunnelInfo(): Promise<{
  tunnelConfigured: boolean;
  tunnelActive: boolean;
  tunnelUrl: string | null;
}> {
  try {
    // Check if any tunnel exists
    const tunnels = await db.select().from(cloudflareTunnels);
    const tunnelConfigured = tunnels.length > 0;

    if (!tunnelConfigured) {
      return { tunnelConfigured: false, tunnelActive: false, tunnelUrl: null };
    }

    // Check if any tunnel is active
    const activeTunnel = tunnels.find(t => t.status === 'active');
    const tunnelActive = !!activeTunnel;

    // Get the first active tunnel's route hostname (which would be accessible via tunnel URL)
    let tunnelUrl: string | null = null;
    if (activeTunnel) {
      const routes = await db.select().from(tunnelRoutes)
        .where(eq(tunnelRoutes.tunnelId, activeTunnel.id));
      const activeRoute = routes.find(r => r.isActive);
      if (activeRoute) {
        tunnelUrl = `https://${activeRoute.hostname}`;
      }
    }

    return { tunnelConfigured, tunnelActive, tunnelUrl };
  } catch {
    return { tunnelConfigured: false, tunnelActive: false, tunnelUrl: null };
  }
}

/**
 * Compute capability flags based on network and tunnel info
 */
function computeCapabilities(hasPublicIp: boolean, tunnelActive: boolean, tunnelUrl: string | null): {
  canIssueHttpSsl: boolean;
  canReceiveExternalMail: boolean;
  canServePublicDns: boolean;
} {
  // Can issue HTTP SSL if: has public IP OR (tunnel active AND has a tunnel URL with proper domain)
  const canIssueHttpSsl = hasPublicIp || (tunnelActive && !!tunnelUrl);

  // Can receive external mail only if has public IP
  const canReceiveExternalMail = hasPublicIp;

  // Can serve public DNS only if has public IP
  const canServePublicDns = hasPublicIp;

  return { canIssueHttpSsl, canReceiveExternalMail, canServePublicDns };
}

/**
 * Get complete server context
 * This endpoint aggregates network, panel, and tunnel information
 * to help the frontend understand the server's capabilities and configuration.
 */
export async function getServerContext(): Promise<ServerContext> {
  // Get network info (cached)
  const networkInfo = await detectNetworkInfo();

  // Get panel URL info
  const panelUrlInfo = getPanelUrlInfo();

  // Get tunnel info from database
  const tunnelInfo = await getTunnelInfo();

  // Get nameserver settings
  const nsSettings = await settingsService.getNameserverSettings();

  // Compute capabilities
  const capabilities = computeCapabilities(
    networkInfo.hasPublicIp,
    tunnelInfo.tunnelActive,
    tunnelInfo.tunnelUrl
  );

  return {
    // Network info
    localIps: networkInfo.localIps,
    hasPublicIp: networkInfo.hasPublicIp,
    publicIp: networkInfo.publicIp,
    primaryIp: networkInfo.primaryIp,

    // Nameserver info
    nameservers: {
      ns1: nsSettings.ns1,
      ns2: nsSettings.ns2,
    },

    // Panel info
    panelUrl: panelUrlInfo.panelUrl,
    panelUrlIsPrivate: panelUrlInfo.panelUrlIsPrivate,

    // Tunnel info
    tunnelConfigured: tunnelInfo.tunnelConfigured,
    tunnelActive: tunnelInfo.tunnelActive,
    tunnelUrl: tunnelInfo.tunnelUrl,

    // Capability flags
    canIssueHttpSsl: capabilities.canIssueHttpSsl,
    canReceiveExternalMail: capabilities.canReceiveExternalMail,
    canServePublicDns: capabilities.canServePublicDns,
  };
}

export default async function serverContextRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // GET /settings/server-context
  fastify.get('/settings/server-context', async () => {
    const context = await getServerContext();
    return { success: true, data: context };
  });
}