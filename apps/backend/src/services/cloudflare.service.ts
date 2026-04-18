import crypto from 'node:crypto';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CfApiOptions {
  apiToken: string;
}

async function cfFetch<T>(path: string, options: CfApiOptions, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = await res.json() as { success: boolean; result: T; errors?: Array<{ message: string }> };

  if (!body.success) {
    const msgs = body.errors?.map((e) => e.message).join(', ') || 'Cloudflare API error';
    throw new Error(msgs);
  }

  return body.result;
}

// ─── Zones ───

export interface CfZone {
  id: string;
  name: string;
  status: string;
  plan: { name: string };
  ssl: string;
}

export async function listZones(options: CfApiOptions): Promise<CfZone[]> {
  return cfFetch<CfZone[]>('/zones?per_page=100', options);
}

export async function getZone(zoneId: string, options: CfApiOptions): Promise<CfZone> {
  return cfFetch<CfZone>(`/zones/${zoneId}`, options);
}

export async function setZoneSslMode(zoneId: string, sslMode: string, options: CfApiOptions): Promise<unknown> {
  return cfFetch(`/zones/${zoneId}/settings/ssl`, options, {
    method: 'PATCH',
    body: JSON.stringify({ value: sslMode }),
  });
}

// ─── DNS Records ───

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

export async function listDnsRecords(zoneId: string, options: CfApiOptions): Promise<CfDnsRecord[]> {
  const result = await cfFetch<{ result: CfDnsRecord[] }>(`/zones/${zoneId}/dns_records?per_page=100`, options);
  return Array.isArray(result) ? result : (result as unknown as { result: CfDnsRecord[] }).result;
}

export async function createDnsRecord(
  zoneId: string,
  record: { type: string; name: string; content: string; proxied: boolean; ttl: number },
  options: CfApiOptions,
): Promise<CfDnsRecord> {
  return cfFetch<CfDnsRecord>(`/zones/${zoneId}/dns_records`, options, {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function deleteDnsRecord(zoneId: string, recordId: string, options: CfApiOptions): Promise<unknown> {
  return cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, options, {
    method: 'DELETE',
  });
}

// ─── Tunnels ───

export interface CfTunnel {
  id: string;
  name: string;
  status: string;
  created_at: string;
  conns_active_at: string | null;
  tun_type: string;
}

export async function createTunnel(
  accountId: string,
  name: string,
  options: CfApiOptions,
): Promise<CfTunnel> {
  return cfFetch<CfTunnel>(`/accounts/${accountId}/cfd_tunnel`, options, {
    method: 'POST',
    body: JSON.stringify({ name, tunnel_secret: generateTunnelSecret() }),
  });
}

export async function deleteTunnel(
  accountId: string,
  tunnelId: string,
  options: CfApiOptions,
): Promise<unknown> {
  return cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, options, {
    method: 'DELETE',
  });
}

export async function getTunnel(
  accountId: string,
  tunnelId: string,
  options: CfApiOptions,
): Promise<CfTunnel> {
  return cfFetch<CfTunnel>(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, options);
}

export async function listTunnels(
  accountId: string,
  options: CfApiOptions,
): Promise<CfTunnel[]> {
  return cfFetch<CfTunnel[]>(`/accounts/${accountId}/cfd_tunnel?per_page=100`, options);
}

// ─── Tunnel Config (ingress routes via CF API) ───

export interface TunnelIngressRule {
  hostname: string;
  service: string;
  path?: string;
}

export async function setTunnelConfig(
  accountId: string,
  tunnelId: string,
  ingress: TunnelIngressRule[],
  options: CfApiOptions,
): Promise<unknown> {
  const config = {
    ingress: [
      ...ingress,
      { service: 'http_status:404' }, // catch-all must be last
    ],
  };

  return cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, options, {
    method: 'PUT',
    body: JSON.stringify({ config }),
  });
}

// ─── Verify Token ───

export async function verifyToken(options: CfApiOptions): Promise<{ status: string; account_id?: string }> {
  return cfFetch<{ status: string; id: string }>('/user/tokens/verify', options);
}

// ─── Helpers ───

function generateTunnelSecret(): string {
  return crypto.randomBytes(32).toString('base64');
}
