import { run } from '../services/executor.js';
import { env } from '../config/env.js';

/**
 * Network detection result
 */
export interface NetworkInfo {
  localIps: string[];
  hasPublicIp: boolean;
  publicIp: string | null;
  primaryIp: string;
}

// RFC1918 private ranges and other special ranges to exclude
const PRIVATE_RANGES = [
  // 10.0.0.0/8
  { min: '10.0.0.0', max: '10.255.255.255' },
  // 172.16.0.0/12
  { min: '172.16.0.0', max: '172.31.255.255' },
  // 192.168.0.0/16
  { min: '192.168.0.0', max: '192.168.255.255' },
  // 127.0.0.0/8 (loopback)
  { min: '127.0.0.0', max: '127.255.255.255' },
  // 169.254.0.0/16 (link-local)
  { min: '169.254.0.0', max: '169.254.255.255' },
];

/**
 * Convert IPv4 string to number for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IP is in a private range
 */
function isPrivateIp(ip: string): boolean {
  const ipNum = ipToNumber(ip);
  for (const range of PRIVATE_RANGES) {
    const min = ipToNumber(range.min);
    const max = ipToNumber(range.max);
    if (ipNum >= min && ipNum <= max) {
      return true;
    }
  }
  return false;
}

/**
 * Simple in-memory cache for network detection
 */
interface NetworkCache {
  data: NetworkInfo;
  timestamp: number;
}

let networkCache: NetworkCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get local IP addresses from hostname -I command
 */
async function getLocalIps(): Promise<string[]> {
  try {
    const result = await run('hostname', ['-I']);
    const ips = result.stdout
      .trim()
      .split(/\s+/)
      .filter(ip => ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip));
    return ips;
  } catch {
    return [];
  }
}

/**
 * Try to detect public IP via external service
 */
async function detectPublicIp(): Promise<string | null> {
  // Try multiple services for reliability
  const services = [
    'https://ifconfig.me',
    'https://icanhazip.com',
    'https://api.ipify.org',
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(service, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        const ip = text.trim().match(/^\d+\.\d+\.\d+\.\d+$/)?.[0];
        if (ip && !isPrivateIp(ip)) {
          return ip;
        }
      }
    } catch {
      // Try next service
    }
  }

  return null;
}

/**
 * Detect network information for this server
 * Results are cached for 5 minutes to avoid excessive external calls
 */
export async function detectNetworkInfo(): Promise<NetworkInfo> {
  const now = Date.now();

  // Check cache
  if (networkCache && (now - networkCache.timestamp) < CACHE_TTL_MS) {
    return networkCache.data;
  }

  // Get local IPs
  const localIps = await getLocalIps();

  // Check for public IP
  const publicIp = await detectPublicIp();
  const hasPublicIp = !!publicIp;

  // Determine primary IP (first non-private local IP, or first local IP, or public IP)
  let primaryIp = publicIp || '';
  if (!primaryIp) {
    const nonPrivateLocal = localIps.find(ip => !isPrivateIp(ip));
    primaryIp = nonPrivateLocal || localIps[0] || '';
  }

  const result: NetworkInfo = {
    localIps,
    hasPublicIp,
    publicIp,
    primaryIp,
  };

  // Update cache
  networkCache = {
    data: result,
    timestamp: now,
  };

  return result;
}

/**
 * Check if a URL contains a private IP address
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const host = url.hostname;

    // Check if hostname is an IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return isPrivateIp(host);
    }

    // For non-IP hostnames, we assume they're resolvable public hostnames
    // (could be private but we have no way to know without DNS resolution)
    return false;
  } catch {
    return false;
  }
}

/**
 * Parse PANEL_URL and determine if it's private
 */
export function getPanelUrlInfo(): { panelUrl: string; panelUrlIsPrivate: boolean } {
  return {
    panelUrl: env.PANEL_URL,
    panelUrlIsPrivate: isPrivateUrl(env.PANEL_URL),
  };
}

/**
 * DNS verification result
 */
export interface DnsVerificationResult {
  domain: string;
  resolvesTo: string[];
  pointsToServer: boolean;
  serverIp: string;
  error?: string;
}

/**
 * Verify that a domain's A record(s) point to a specific IP address.
 * Used to verify domain ownership before attachment.
 */
export async function verifyDomainPointsToIp(domain: string, targetIp: string): Promise<DnsVerificationResult> {
  const result: DnsVerificationResult = {
    domain,
    resolvesTo: [],
    pointsToServer: false,
    serverIp: targetIp,
  };

  try {
    // Use Node's built-in DNS module to resolve A records
    const { promises: dnsPromises } = await import('node:dns');
    const addresses = await dnsPromises.resolve4(domain);
    result.resolvesTo = addresses;
    result.pointsToServer = addresses.includes(targetIp);
  } catch (err: any) {
    // Try using dig command as fallback
    try {
      const { run: runCmd } = await import('../services/executor.js');
      const digResult = await runCmd('dig', ['+short', domain, 'A']);
      if (digResult.stdout.trim()) {
        result.resolvesTo = digResult.stdout.trim().split('\n').filter(Boolean);
        result.pointsToServer = result.resolvesTo.includes(targetIp);
      } else {
        result.error = `DNS resolution failed: ${err.message}`;
      }
    } catch {
      result.error = `DNS resolution failed: ${err.message}`;
    }
  }

  return result;
}

/**
 * Get nameservers for a domain by querying NS records
 */
export async function getDomainNameservers(domain: string): Promise<string[]> {
  try {
    const { promises: dnsPromises } = await import('node:dns');
    const nameservers = await dnsPromises.resolveNs(domain);
    return nameservers;
  } catch {
    // Fallback to dig
    try {
      const { run: runCmd } = await import('../services/executor.js');
      const digResult = await runCmd('dig', ['+short', domain, 'NS']);
      if (digResult.stdout.trim()) {
        return digResult.stdout.trim().split('\n').filter(Boolean);
      }
    } catch { /* ignore */ }
    return [];
  }
}