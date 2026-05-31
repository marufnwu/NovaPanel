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
  { min: '10.0.0.0', max: '10.255.255.255' },
  { min: '172.16.0.0', max: '172.31.255.255' },
  { min: '192.168.0.0', max: '192.168.255.255' },
  { min: '127.0.0.0', max: '127.255.255.255' },
  { min: '169.254.0.0', max: '169.254.255.255' },
];

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

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
 * Verify that a nameserver hostname has valid A records pointing to a public IP.
 * Used to validate glue records before saving nameserver settings.
 */
export interface NameserverVerificationResult {
  hostname: string;
  resolvesTo: string[];
  isResolvable: boolean;
  error?: string;
}

export async function verifyNameserverResolvable(hostname: string): Promise<NameserverVerificationResult> {
  const result: NameserverVerificationResult = {
    hostname,
    resolvesTo: [],
    isResolvable: false,
  };

  const addError = (msg: string) => { result.error = msg; };

  // Validate hostname format
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  if (!hostnameRegex.test(hostname)) {
    addError(`"${hostname}" is not a valid hostname. Use format: ns1.example.com`);
    return result;
  }

  // Try method 1: node:dns.resolve4()
  try {
    const { promises: dnsPromises } = await import('node:dns');
    const addresses = await Promise.race([
      dnsPromises.resolve4(hostname),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ] as any);
    const publicAddresses = addresses.filter((a: string) => !isPrivateIp(a));
    if (publicAddresses.length > 0) {
      result.resolvesTo = publicAddresses;
      result.isResolvable = true;
      return result;
    }
    if (addresses.length > 0 && addresses.every((a: string) => isPrivateIp(a))) {
      addError(`Nameserver ${hostname} resolves to private IP(s) ${addresses.join(', ')}. Glue records must point to a public IP address.`);
      result.resolvesTo = addresses;
      return result;
    }
  } catch {
    // Continue to fallback
  }

  // Try method 2: dig +short hostname A
  try {
    const digResult = await run('dig', ['+short', hostname, 'A'], { timeout: 10000 });
    if (digResult.stdout.trim()) {
      const addresses = digResult.stdout.trim().split('\n').filter(a => a.match(/^\d+\.\d+\.\d+\.\d+$/));
      const publicAddresses = addresses.filter(a => !isPrivateIp(a));
      if (publicAddresses.length > 0) {
        result.resolvesTo = publicAddresses;
        result.isResolvable = true;
        return result;
      }
      if (addresses.length > 0) {
        addError(`Nameserver ${hostname} resolves to private IP(s) ${addresses.join(', ')}. Glue records must point to a public IP address.`);
        result.resolvesTo = addresses;
        return result;
      }
    }
  } catch {
    // Continue
  }

  addError(`Nameserver ${hostname} does not resolve to any IP address. Add an A record for ${hostname} at your registrar before using it.`);
  return result;
}

/**
 * Get all nameservers for a domain and verify their glue records.
 */
export interface DomainDelegationResult {
  domain: string;
  nameservers: string[];
  allResolvable: boolean;
  results: NameserverVerificationResult[];
  unresolvableNs: string[];
  error?: string;
}

export async function getDomainDelegation(domain: string): Promise<DomainDelegationResult> {
  const result: DomainDelegationResult = {
    domain,
    nameservers: [],
    allResolvable: true,
    results: [],
    unresolvableNs: [],
  };

  // Get nameservers for the domain
  const nameservers = await getDomainNameservers(domain);
  if (nameservers.length === 0) {
    result.error = `Could not determine nameservers for ${domain}. Ensure NS records are set at your registrar.`;
    result.allResolvable = false;
    return result;
  }

  result.nameservers = nameservers;

  // Verify each nameserver
  const verificationResults = await Promise.all(
    nameservers.map(ns => verifyNameserverResolvable(ns))
  );

  result.results = verificationResults;

  for (const vr of verificationResults) {
    if (!vr.isResolvable) {
      result.allResolvable = false;
      result.unresolvableNs.push(vr.hostname);
    }
  }

  if (!result.allResolvable) {
    const badNs = verificationResults.filter(v => !v.isResolvable);
    result.error = `Domain nameservers are not resolvable: ${badNs.map(v => `${v.hostname} (${v.error})`).join('; ')}. Fix glue records at your registrar before adding this domain.`;
  }

  return result;
}

export { PRIVATE_RANGES };

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
  errorCode?: 'A_RECORD_WRONG' | 'NO_A_RECORD' | 'NO_NS_RECORDS' | 'VERIFICATION_FAILED';
}

/**
 * Verify that a domain's A record(s) point to a specific IP address.
 * Used to verify domain ownership before attachment.
 *
 * Tries multiple methods in order:
 * 1. node:dns.resolve4() — system resolver
 * 2. dig +short domain A — system resolver fallback
 * 3. Query authoritative nameservers directly via dig @ns +short domain A
 */
export async function verifyDomainPointsToIp(domain: string, targetIp: string): Promise<DnsVerificationResult> {
  const result: DnsVerificationResult = {
    domain,
    resolvesTo: [],
    pointsToServer: false,
    serverIp: targetIp,
  };

  // Helper to check if we found a match
  const checkMatch = (addresses: string[]) => {
    result.resolvesTo = addresses;
    result.pointsToServer = addresses.includes(targetIp);
  };

  // Try method 1: node:dns (system resolver)
  try {
    const { promises: dnsPromises } = await import('node:dns');
    const addresses = await Promise.race([
      dnsPromises.resolve4(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    checkMatch(addresses);
    if (result.pointsToServer) return result;
  } catch {
    // Continue to next method
  }

  // Try method 2: dig (system resolver fallback)
  try {
    const { run: runCmd } = await import('../services/executor.js');
    const digResult = await runCmd('dig', ['+short', domain, 'A'], { timeout: 10000 });
    if (digResult.stdout.trim()) {
      const addresses = digResult.stdout.trim().split('\n').filter(a => a.match(/^\d+\.\d+\.\d+\.\d+$/));
      checkMatch(addresses);
      if (result.pointsToServer) return result;
      // Method 2 returned non-matching IPs - continue to method 3 (authoritative NS)
      // because these may be stale/incorrect and authoritative NS may have correct data
    }
  } catch {
    // Continue to next method
  }

  // Try method 3: Query authoritative nameservers directly
  // Only proceed if we got non-matching IPs from methods 1 & 2
  // If we got NO IPs at all from methods 1 & 2, that likely means:
  // - Domain doesn't exist, OR
  // - Local resolver has no data (could be propagation delay)
  // Either way, we should try authoritative NS as last resort
  try {
    const nameservers = await getDomainNameservers(domain);

    // If we have nameservers, query them directly
    if (nameservers.length > 0) {
      const { run: runCmd } = await import('../services/executor.js');
      const allAddresses: string[] = [];

      // Query each authoritative nameserver
      for (const ns of nameservers) {
        try {
          const digResult = await runCmd('dig', [`@${ns}`, '+short', domain, 'A'], { timeout: 10000 });
          if (digResult.stdout.trim()) {
            const addresses = digResult.stdout.trim().split('\n').filter(a => a.match(/^\d+\.\d+\.\d+\.\d+$/));
            allAddresses.push(...addresses);
          }
        } catch {
          // Try next nameserver
        }
      }

      // Deduplicate
      const uniqueAddresses = [...new Set(allAddresses)];
      checkMatch(uniqueAddresses);
      if (result.pointsToServer) return result;

      if (uniqueAddresses.length > 0) {
        result.error = `Domain ${domain} resolves to ${uniqueAddresses.join(', ')} but your server IP is ${targetIp}. Update the A record at your registrar to point to ${targetIp}.`;
        result.errorCode = 'A_RECORD_WRONG';
      } else if (result.resolvesTo.length === 0) {
        result.error = `Domain ${domain} has nameservers set (${nameservers.join(', ')}) but no A record exists. Add an A record pointing to ${targetIp} at your registrar.`;
        result.errorCode = 'NO_A_RECORD';
      }
    } else {
      // No nameservers found - this is informational, not a hard failure
      // The domain might still have a valid A record via other methods
      // Only set error if we actually have some info to report
      if (result.resolvesTo.length === 0) {
        result.error = `Could not determine nameservers for ${domain}. Ensure NS records are set at your registrar. If your A record is already pointing to ${targetIp}, wait for DNS propagation (can take up to 48 hours).`;
        result.errorCode = 'NO_NS_RECORDS';
      } else {
        // We have A record IPs but they don't match - this means A record is wrong
        result.error = `Domain ${domain} currently resolves to ${result.resolvesTo.join(', ')} but your server IP is ${targetIp}. Update the A record at your registrar to point to ${targetIp}.`;
        result.errorCode = 'A_RECORD_WRONG';
      }
    }
  } catch (err: any) {
    result.error = result.error || `DNS verification failed: ${err.message}`;
    result.errorCode = 'VERIFICATION_FAILED';
  }

  return result;
}

/**
 * Get nameservers for a domain by querying NS records
 * Uses multiple methods to ensure we get the authoritative NS
 */
export async function getDomainNameservers(domain: string): Promise<string[]> {
  // Method 1: node:dns.resolveNs() - uses system resolver
  try {
    const { promises: dnsPromises } = await import('node:dns');
    const nameservers = await Promise.race([
      dnsPromises.resolveNs(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]) as string[];
    if (nameservers && nameservers.length > 0) {
      return nameservers;
    }
  } catch {
    // Continue to fallback
  }

  // Method 2: dig +short domain NS - uses system resolver fallback
  try {
    const { run: runCmd } = await import('../services/executor.js');
    const digResult = await runCmd('dig', ['+short', domain, 'NS'], { timeout: 10000 });
    if (digResult.stdout.trim()) {
      const ns = digResult.stdout.trim().split('\n').filter(Boolean);
      if (ns.length > 0) return ns;
    }
  } catch { /* ignore */ }

  // Method 3: whois command - gets NS from registrar/TLD registry WHOIS data
  try {
    const { run: runCmd } = await import('../services/executor.js');
    const whoisResult = await runCmd('whois', [domain], { timeout: 15000 });
    if (whoisResult.exitCode === 0 && whoisResult.stdout) {
      // Parse nameservers from whois output
      // Common patterns: "Name Server: ns1.example.com", "NS: dns1.registrar-servers.com"
      const lines = whoisResult.stdout.split('\n');
      const nameservers: string[] = [];
      for (const line of lines) {
        const lowerLine = line.toLowerCase().trim();
        if (lowerLine.startsWith('name server:') || lowerLine.startsWith('nserver:') || lowerLine.startsWith('ns:')) {
          const parts = line.split(/\s+/);
          // Last part is usually the hostname
          for (const part of parts.reverse()) {
            if (part.match(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/)) {
              nameservers.push(part.toLowerCase());
            }
          }
        }
      }
      if (nameservers.length > 0) {
        return [...new Set(nameservers)];
      }
    }
  } catch { /* ignore */ }

  return [];
}