import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.middleware.js';
import { detectNetworkInfo, getPanelUrlInfo } from '../../utils/network.js';
import { settingsService } from './settings.service.js';

export interface ServerContext {
  localIps: string[];
  hasPublicIp: boolean;
  publicIp: string | null;
  primaryIp: string;

  nameservers: {
    ns1: string;
    ns2: string;
  };

  panelUrl: string;
  panelUrlIsPrivate: boolean;

  tunnelConfigured: boolean;
  tunnelActive: boolean;
  tunnelUrl: string | null;

  canIssueHttpSsl: boolean;
  canReceiveExternalMail: boolean;
  canServePublicDns: boolean;
}

export async function getServerContext(): Promise<ServerContext> {
  const networkInfo = await detectNetworkInfo();
  const panelUrlInfo = getPanelUrlInfo();
  const nsSettings = await settingsService.getNameserverSettings();

  const hasPublicIp = networkInfo.hasPublicIp;
  const canIssueHttpSsl = hasPublicIp;
  const canReceiveExternalMail = hasPublicIp;
  const canServePublicDns = hasPublicIp;

  return {
    localIps: networkInfo.localIps,
    hasPublicIp: networkInfo.hasPublicIp,
    publicIp: networkInfo.publicIp,
    primaryIp: networkInfo.primaryIp,
    nameservers: { ns1: nsSettings.ns1, ns2: nsSettings.ns2 },
    panelUrl: panelUrlInfo.panelUrl,
    panelUrlIsPrivate: panelUrlInfo.panelUrlIsPrivate,
    tunnelConfigured: false,
    tunnelActive: false,
    tunnelUrl: null,
    canIssueHttpSsl,
    canReceiveExternalMail,
    canServePublicDns,
  };
}

export default async function serverContextRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);
  fastify.get('/settings/server-context', async () => {
    const context = await getServerContext();
    return { success: true, data: context };
  });
}