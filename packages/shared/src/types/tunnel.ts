import type { TunnelStatus } from './enums.js';

export interface CreateTunnelRequest {
  serverId: string;
  name: string;
}

export interface TunnelResponse {
  id: string;
  serverId: string;
  cfTunnelId: string;
  name: string;
  status: TunnelStatus;
  ingressRoutes: Array<{ hostname: string; service: string }>;
  installedAt: string | null;
  createdAt: string;
}

export interface AddRouteRequest {
  hostname: string;
  service: string;
  protocol?: 'http' | 'https' | 'tcp' | 'ssh' | 'unix';
}

export interface ConnectCfAccountRequest {
  name: string;
  apiToken: string;
  email?: string;
  accountId?: string;
}

export interface CfAccountResponse {
  id: string;
  name: string;
  email: string | null;
  accountId: string | null;
  createdAt: string;
}

export interface CfZoneResponse {
  id: string;
  zoneId: string;
  zoneName: string;
  sslMode: string | null;
  plan: string | null;
}

export interface DnsRecordResponse {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  managedByPanel: boolean;
}

export interface CreateDnsRecordRequest {
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
}
