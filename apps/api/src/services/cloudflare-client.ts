/**
 * Unified Cloudflare API Client
 *
 * Single client for all Cloudflare API interactions.
 * Handles authentication, rate limiting, error handling, and retries.
 *
 * Used by:
 * - Cloudflare module (zones, DNS, SSL, settings, rules)
 * - Tunnel module (tunnel CRUD, config, connections)
 * - SSL module (DNS-01 challenge, Origin CA)
 */

import { logger } from '../config/logger.js';
import { AppError } from '../errors.js';

// --- Type Definitions ---

export interface CloudflareZone {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted';
  paused: boolean;
  type: 'full' | 'partial';
  plan: { id: string; name: string; price: number; frequency: string };
  name_servers: string[];
  original_name_servers: string[];
  created_at: string;
  activated_at: string;
}

export interface CloudflareDnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  type: string;
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  priority?: number;
  comment?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  meta: { auto_added: boolean; source: string };
}

export interface CloudflareSslSettings {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on: string;
}

export interface CloudflareZoneSetting<T = string | boolean | number> {
  id: string;
  value: T;
  editable: boolean;
  modified_on: string;
}

export interface CloudflarePageRule {
  id: string;
  targets: Array<{ target: 'url'; constraint: { operator: 'matches'; value: string } }>;
  actions: Array<{ id: string; value: any }>;
  priority: number;
  status: 'active' | 'disabled';
  created_on: string;
  modified_on: string;
}

export interface CloudflareFirewallRule {
  id: string;
  paused: boolean;
  description: string;
  action: 'block' | 'challenge' | 'allow' | 'js_challenge' | 'log' | 'skip';
  priority: number;
  filter: {
    id: string;
    expression: string;
    paused: boolean;
    description: string;
  };
  created_on: string;
  modified_on: string;
}

export interface CloudflareAccessRule {
  id: string;
  mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge';
  configuration: {
    target: 'ip' | 'ip_range' | 'country' | 'asn';
    value: string;
  };
  notes: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareRedirectRule {
  id: string;
  action: 'redirect';
  status: 'active' | 'disabled';
  expression: string;
  description: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareOriginCertificate {
  id: string;
  certificate: string;
  expires_on: string;
  request_type: 'origin-rsa' | 'origin-ecc';
  hostnames: string[];
  private_key?: string;
}

export interface CloudflareTunnelInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'degraded';
  token: string;
  created_at: string;
  conns_active_at: string;
  connections: Array<{
    id: string;
    colo: string;
    ip: string;
    client_version: string;
  }>;
}

export interface CloudflareAccount {
  id: string;
  name: string;
}

// Input types

export interface CreateDnsRecordInput {
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  comment?: string;
  tags?: string[];
}

export interface UpdateDnsRecordInput {
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  comment?: string;
  tags?: string[];
}

export interface CreateFirewallRuleInput {
  action: 'block' | 'challenge' | 'allow' | 'js_challenge' | 'log' | 'skip';
  expression: string;
  description?: string;
  paused?: boolean;
  priority?: number;
}

export interface CreateAccessRuleInput {
  mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge';
  target: 'ip' | 'ip_range' | 'country' | 'asn';
  value: string;
  notes?: string;
}

export interface CreatePageRuleInput {
  targets: Array<{ target: 'url'; constraint: { operator: 'matches'; value: string } }>;
  actions: Array<{ id: string; value: any }>;
  priority?: number;
  status?: 'active' | 'disabled';
}

export interface CreateOriginCertInput {
  hostnames: string[];
  request_type?: 'origin-rsa' | 'origin-ecc';
  requested_validity?: number; // days: 5475 (15yr) default
  request_method?: 'http' | 'csr';
  csr?: string;
}

// --- API Response Types ---

interface CloudflareApiResponse<T = any> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}

// --- Rate Limiter ---

class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait for a token to become available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// --- Cloudflare API Client ---

export class CloudflareClient {
  private apiToken: string;
  private accountId?: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  private rateLimiter = new TokenBucketRateLimiter(100, 10); // 100 burst, 10/sec sustained
  private maxRetries = 3;
  private baseDelay = 1000; // 1s

  constructor(apiToken: string, accountId?: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  // ==========================================================================
  // Account Operations
  // ==========================================================================

  async listAccounts(): Promise<CloudflareAccount[]> {
    const data = await this.request<CloudflareAccount[]>('GET', '/accounts');
    return data;
  }

  // ==========================================================================
  // Zone Operations
  // ==========================================================================

  async listZones(params?: { name?: string; status?: string; page?: number; per_page?: number }): Promise<{ zones: CloudflareZone[]; total_count: number }> {
    const query = new URLSearchParams();
    if (params?.name) query.set('name', params.name);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));

    const qs = query.toString();
    const path = `/zones${qs ? `?${qs}` : ''}`;
    const data = await this.requestPaginated<CloudflareZone>('GET', path);
    return { zones: data.results, total_count: data.total_count };
  }

  async getZone(zoneId: string): Promise<CloudflareZone> {
    return this.request<CloudflareZone>('GET', `/zones/${zoneId}`);
  }

  async getZoneByName(name: string): Promise<CloudflareZone | null> {
    const { zones } = await this.listZones({ name });
    return zones[0] || null;
  }

  async createZone(name: string, account: { id: string }, type: 'full' | 'partial' = 'full', jumpstart?: boolean): Promise<CloudflareZone> {
    return this.request<CloudflareZone>('POST', '/zones', {
      name,
      account,
      type,
      jump_start: jumpstart,
    });
  }

  async deleteZone(zoneId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}`);
  }

  async pauseZone(zoneId: string): Promise<void> {
    await this.request('PATCH', `/zones/${zoneId}`, { paused: true });
  }

  async unpauseZone(zoneId: string): Promise<void> {
    await this.request('PATCH', `/zones/${zoneId}`, { paused: false });
  }

  // ==========================================================================
  // DNS Record Operations
  // ==========================================================================

  async listDnsRecords(zoneId: string, params?: { type?: string; name?: string; content?: string; page?: number; per_page?: number }): Promise<{ records: CloudflareDnsRecord[]; total_count: number }> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.name) query.set('name', params.name);
    if (params?.content) query.set('content', params.content);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));

    const qs = query.toString();
    const path = `/zones/${zoneId}/dns_records${qs ? `?${qs}` : ''}`;
    const data = await this.requestPaginated<CloudflareDnsRecord>('GET', path);
    return { records: data.results, total_count: data.total_count };
  }

  async getDnsRecord(zoneId: string, recordId: string): Promise<CloudflareDnsRecord> {
    return this.request<CloudflareDnsRecord>('GET', `/zones/${zoneId}/dns_records/${recordId}`);
  }

  async createDnsRecord(zoneId: string, input: CreateDnsRecordInput): Promise<CloudflareDnsRecord> {
    return this.request<CloudflareDnsRecord>('POST', `/zones/${zoneId}/dns_records`, input);
  }

  async updateDnsRecord(zoneId: string, recordId: string, input: UpdateDnsRecordInput): Promise<CloudflareDnsRecord> {
    return this.request<CloudflareDnsRecord>('PATCH', `/zones/${zoneId}/dns_records/${recordId}`, input);
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
  }

  // ==========================================================================
  // SSL/TLS Operations
  // ==========================================================================

  async getSslSettings(zoneId: string): Promise<CloudflareSslSettings> {
    return this.request<CloudflareSslSettings>('GET', `/zones/${zoneId}/settings/ssl`);
  }

  async updateSslMode(zoneId: string, value: 'off' | 'flexible' | 'full' | 'strict'): Promise<CloudflareSslSettings> {
    return this.request<CloudflareSslSettings>('PATCH', `/zones/${zoneId}/settings/ssl`, { value });
  }

  async getAlwaysUseHttps(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/always_use_https`);
  }

  async setAlwaysUseHttps(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/always_use_https`, { value });
  }

  async getAutomaticHttpsRewrites(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/automatic_https_rewrites`);
  }

  async setAutomaticHttpsRewrites(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/automatic_https_rewrites`, { value });
  }

  async getMinTlsVersion(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/min_tls_version`);
  }

  async setMinTlsVersion(zoneId: string, value: '1.0' | '1.1' | '1.2' | '1.3'): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/min_tls_version`, { value });
  }

  async getHttp2(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/http2`);
  }

  async setHttp2(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/http2`, { value });
  }

  async getHttp3(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/http3`);
  }

  async setHttp3(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/http3`, { value });
  }

  // ==========================================================================
  // Origin CA Certificates
  // ==========================================================================

  async createOriginCertificate(input: CreateOriginCertInput): Promise<CloudflareOriginCertificate> {
    return this.request<CloudflareOriginCertificate>('POST', '/certificates', {
      hostnames: input.hostnames,
      request_type: input.request_type || 'origin-rsa',
      requested_validity: input.requested_validity || 5475,
      request_method: input.request_method || 'http',
      csr: input.csr,
    });
  }

  async listOriginCertificates(zoneId?: string): Promise<CloudflareOriginCertificate[]> {
    const params = new URLSearchParams();
    if (zoneId) params.set('zone_id', zoneId);
    const qs = params.toString();
    const data = await this.requestPaginated<CloudflareOriginCertificate>('GET', `/certificates${qs ? `?${qs}` : ''}`);
    return data.results;
  }

  async revokeOriginCertificate(certId: string): Promise<void> {
    await this.request('DELETE', `/certificates/${certId}`);
  }

  // ==========================================================================
  // Zone Settings
  // ==========================================================================

  async getZoneSettings(zoneId: string): Promise<CloudflareZoneSetting[]> {
    return this.request<CloudflareZoneSetting[]>('GET', `/zones/${zoneId}/settings`);
  }

  async getZoneSetting(zoneId: string, settingName: string): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('GET', `/zones/${zoneId}/settings/${settingName}`);
  }

  async updateZoneSetting(zoneId: string, settingName: string, value: any): Promise<CloudflareZoneSetting> {
    return this.request<CloudflareZoneSetting>('PATCH', `/zones/${zoneId}/settings/${settingName}`, { value });
  }

  // Convenience methods for common settings

  async getBrowserCacheTtl(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.getZoneSetting(zoneId, 'browser_cache_ttl');
  }

  async setBrowserCacheTtl(zoneId: string, value: number): Promise<CloudflareZoneSetting> {
    return this.updateZoneSetting(zoneId, 'browser_cache_ttl', value);
  }

  async getDevelopmentMode(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.getZoneSetting(zoneId, 'development_mode');
  }

  async setDevelopmentMode(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.updateZoneSetting(zoneId, 'development_mode', value);
  }

  async getEmailObfuscation(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.getZoneSetting(zoneId, 'email_obfuscation');
  }

  async setEmailObfuscation(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.updateZoneSetting(zoneId, 'email_obfuscation', value);
  }

  async getHotlinkProtection(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.getZoneSetting(zoneId, 'hotlink_protection');
  }

  async setHotlinkProtection(zoneId: string, value: 'on' | 'off'): Promise<CloudflareZoneSetting> {
    return this.updateZoneSetting(zoneId, 'hotlink_protection', value);
  }

  async getSecurityHeader(zoneId: string): Promise<CloudflareZoneSetting> {
    return this.getZoneSetting(zoneId, 'security_header');
  }

  async setSecurityHeader(zoneId: string, value: { strict_transport_security: { enabled: boolean; max_age: number; include_subdomains: boolean; preload: boolean } }): Promise<CloudflareZoneSetting> {
    return this.updateZoneSetting(zoneId, 'security_header', value);
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  async purgeEverything(zoneId: string): Promise<void> {
    await this.request('POST', `/zones/${zoneId}/cache/purge`, { purge_everything: true });
  }

  async purgeCacheByUrls(zoneId: string, urls: string[]): Promise<void> {
    await this.request('POST', `/zones/${zoneId}/cache/purge`, { files: urls });
  }

  async purgeCacheByTags(zoneId: string, tags: string[]): Promise<void> {
    await this.request('POST', `/zones/${zoneId}/cache/purge`, { tags });
  }

  // ==========================================================================
  // Page Rules (Legacy)
  // ==========================================================================

  async listPageRules(zoneId: string): Promise<CloudflarePageRule[]> {
    return this.request<CloudflarePageRule[]>('GET', `/zones/${zoneId}/pagerules`);
  }

  async createPageRule(zoneId: string, input: CreatePageRuleInput): Promise<CloudflarePageRule> {
    return this.request<CloudflarePageRule>('POST', `/zones/${zoneId}/pagerules`, input);
  }

  async updatePageRule(zoneId: string, ruleId: string, input: Partial<CreatePageRuleInput>): Promise<CloudflarePageRule> {
    return this.request<CloudflarePageRule>('PATCH', `/zones/${zoneId}/pagerules/${ruleId}`, input);
  }

  async deletePageRule(zoneId: string, ruleId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}/pagerules/${ruleId}`);
  }

  // ==========================================================================
  // Firewall Operations
  // ==========================================================================

  async listFirewallRules(zoneId: string): Promise<CloudflareFirewallRule[]> {
    return this.request<CloudflareFirewallRule[]>('GET', `/zones/${zoneId}/firewall/rules`);
  }

  async createFirewallRule(zoneId: string, input: CreateFirewallRuleInput): Promise<CloudflareFirewallRule> {
    // First create the filter, then the rule
    const filter = await this.request<{ id: string }>('POST', `/zones/${zoneId}/filters`, {
      expression: input.expression,
      paused: input.paused ?? false,
      description: input.description || '',
    });

    return this.request<CloudflareFirewallRule>('POST', `/zones/${zoneId}/firewall/rules`, {
      action: input.action,
      filter: { id: filter.id },
      description: input.description,
      paused: input.paused ?? false,
      priority: input.priority,
    });
  }

  async updateFirewallRule(zoneId: string, ruleId: string, input: Partial<CreateFirewallRuleInput> & { filterId?: string }): Promise<CloudflareFirewallRule> {
    const body: any = {};
    if (input.action) body.action = input.action;
    if (input.description !== undefined) body.description = input.description;
    if (input.paused !== undefined) body.paused = input.paused;
    if (input.priority !== undefined) body.priority = input.priority;

    if (input.expression && input.filterId) {
      // Update the filter expression too
      await this.request('PUT', `/zones/${zoneId}/filters/${input.filterId}`, {
        expression: input.expression,
        paused: input.paused ?? false,
        description: input.description || '',
      });
    }

    return this.request<CloudflareFirewallRule>('PATCH', `/zones/${zoneId}/firewall/rules/${ruleId}`, body);
  }

  async deleteFirewallRule(zoneId: string, ruleId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}/firewall/rules/${ruleId}`);
  }

  // Access Rules (IP allowlist/blocklist)
  async listAccessRules(zoneId: string): Promise<CloudflareAccessRule[]> {
    return this.request<CloudflareAccessRule[]>('GET', `/zones/${zoneId}/firewall/access_rules/rules`);
  }

  async createAccessRule(zoneId: string, input: CreateAccessRuleInput): Promise<CloudflareAccessRule> {
    return this.request<CloudflareAccessRule>('POST', `/zones/${zoneId}/firewall/access_rules/rules`, {
      mode: input.mode,
      configuration: { target: input.target, value: input.value },
      notes: input.notes || '',
    });
  }

  async deleteAccessRule(zoneId: string, ruleId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`);
  }

  // ==========================================================================
  // Tunnel Operations
  // ==========================================================================

  async listTunnels(accountId?: string): Promise<CloudflareTunnelInfo[]> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    return this.request<CloudflareTunnelInfo[]>('GET', `/accounts/${acctId}/cfd_tunnel`);
  }

  async getTunnel(tunnelId: string, accountId?: string): Promise<CloudflareTunnelInfo> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    return this.request<CloudflareTunnelInfo>('GET', `/accounts/${acctId}/cfd_tunnel/${tunnelId}`);
  }

  async createTunnel(name: string, accountId?: string, configSrc: 'cloudflare' | 'local' = 'cloudflare'): Promise<{ id: string; token: string }> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    return this.request<{ id: string; token: string }>('POST', `/accounts/${acctId}/cfd_tunnel`, {
      name,
      config_src: configSrc,
    });
  }

  async deleteTunnel(tunnelId: string, accountId?: string): Promise<void> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    await this.request('DELETE', `/accounts/${acctId}/cfd_tunnel/${tunnelId}`);
  }

  async getTunnelConfig(tunnelId: string, accountId?: string): Promise<any> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    return this.request('GET', `/accounts/${acctId}/cfd_tunnel/${tunnelId}/configurations`);
  }

  async updateTunnelConfig(tunnelId: string, config: any, accountId?: string): Promise<any> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new AppError(400, 'ACCOUNT_REQUIRED', 'Account ID required for tunnel operations');
    return this.request('PUT', `/accounts/${acctId}/cfd_tunnel/${tunnelId}/configurations`, { config });
  }

  // ==========================================================================
  // DNS Verification
  // ==========================================================================

  async verifyDns(zoneId: string): Promise<{ nameservers: string[]; status: string }> {
    const zone = await this.getZone(zoneId);
    return {
      nameservers: zone.name_servers || [],
      status: zone.status,
    };
  }

  // ==========================================================================
  // Token Verification
  // ==========================================================================

  async verifyToken(): Promise<{ valid: boolean; status: string; type: 'user' | 'account'; accounts?: any[] }> {
    // Try user token verification first
    try {
      const data = await this.requestRaw('GET', '/user/tokens/verify');
      if (data.success) {
        return { valid: true, status: data.result?.status || 'active', type: 'user' };
      }
    } catch {
      // Not a user token, try account-scoped
    }

    // Try account-scoped verification
    try {
      const data = await this.requestPaginated<any>('GET', '/accounts');
      if (data.success !== false) {
        return { valid: true, status: 'active', type: 'account', accounts: data.results };
      }
    } catch {
      // Invalid token
    }

    throw new AppError(400, 'INVALID_TOKEN', 'Invalid Cloudflare API token');
  }

  // ==========================================================================
  // Core HTTP Methods (private)
  // ==========================================================================

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const response = await this.requestWithRetry<CloudflareApiResponse<T>>(method, path, body);
    if (!response.success) {
      const error = response.errors?.[0];
      throw new AppError(
        error?.code === 1000 ? 400 : 500,
        'CF_API_ERROR',
        error?.message || 'Cloudflare API error',
      );
    }
    return response.result;
  }

  private async requestPaginated<T>(method: string, path: string, body?: any): Promise<{ results: T[]; total_count: number; success: boolean }> {
    const response = await this.requestWithRetry<CloudflareApiResponse<T[]>>(method, path, body);
    return {
      results: response.result || [],
      total_count: response.result_info?.total_count || 0,
      success: response.success,
    };
  }

  private async requestRaw(method: string, path: string, body?: any): Promise<any> {
    return this.requestWithRetry(method, path, body);
  }

  private async requestWithRetry<T>(method: string, path: string, body?: any, attempt: number = 0): Promise<T> {
    await this.rateLimiter.acquire();

    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json() as any;

      // Rate limit handling
      if (response.status === 429) {
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          logger.warn({ attempt, delay, path }, 'Cloudflare API rate limited, retrying');
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.requestWithRetry<T>(method, path, body, attempt + 1);
        }
        throw new AppError(429, 'CF_RATE_LIMITED', 'Cloudflare API rate limit exceeded');
      }

      // Server error - retry
      if (response.status >= 500 && attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt);
        logger.warn({ attempt, delay, path, status: response.status }, 'Cloudflare API server error, retrying');
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry<T>(method, path, body, attempt + 1);
      }

      // Client errors - don't retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // Return the error response so callers can handle it
        return data as T;
      }

      return data as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt);
        logger.warn({ attempt, delay, path, error: (error as Error).message }, 'Cloudflare API request failed, retrying');
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry<T>(method, path, body, attempt + 1);
      }
      logger.error({ error, path, method }, 'Cloudflare API request failed after retries');
      throw new AppError(500, 'CF_API_ERROR', `Cloudflare API request failed: ${(error as Error).message}`);
    }
  }
}
