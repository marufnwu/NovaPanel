import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { useDomains, type Domain } from './domains';
import { useWebsites, type Website } from './websites';

/**
 * Site is the new unified mental model that combines:
 * - A primary domain (e.g., example.com)
 * - Its associated website (physical document root, system user)
 * - All attached subdomains, aliases, redirects
 */
export interface Site {
  id: string;
  domain: Domain;
  website: Website | null;
  status: 'active' | 'suspended' | 'pending' | 'error';
  name: string;
  documentRoot: string;
  systemUser: string;
  phpVersion: string;
  phpHandler: string;
  webServer: string;
  sslEnabled: boolean;
  diskUsedMb: number | null;
  bandwidthUsedMb: number | null;
  createdAt: string;
  // Aggregated sub-resources
  hasCloudflare: boolean;
  hasTunnelRoute: boolean;
}

/**
 * Site sub-resource types (populated by joined queries)
 */
export interface SiteSubdomain {
  id: string;
  name: string;
  domainId: string;
  documentRoot: string;
  phpVersion: string;
  createdAt: string;
}

export interface SiteAlias {
  id: string;
  alias: string;
  domainId: string;
  createdAt: string;
}

export interface SiteRedirect {
  id: string;
  sourcePath: string;
  targetUrl: string;
  type: '301' | '302';
  domainId: string;
  createdAt: string;
}

export interface SiteFtpAccount {
  id: string;
  username: string;
  path: string;
  status: string;
}

export interface SiteCronJob {
  id: string;
  schedule: string;
  command: string;
  status: string;
}

export interface SiteDatabase {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface SiteBackup {
  id: string;
  name: string;
  date: string;
  size: string;
  status: string;
}

/**
 * Create a Site from a primary Domain and its associated Website
 */
function createSite(domain: Domain, website: Website | null): Site {
  return {
    id: domain.id,
    domain,
    website,
    // Site status is derived from domain status, with 'error' fallback from website
    status: domain.status === 'active'
      ? (website?.status === 'error' ? 'error' : 'active')
      : domain.status === 'pending'
        ? 'pending'
        : 'suspended',
    name: domain.name,
    documentRoot: domain.documentRoot || website?.documentRoot || '',
    systemUser: domain.systemUser || website?.systemUser || '',
    phpVersion: domain.phpVersion || website?.phpVersion || '',
    phpHandler: domain.phpHandler || website?.phpHandler || '',
    webServer: domain.webServer || website?.webServer || '',
    sslEnabled: domain.sslEnabled,
    diskUsedMb: domain.diskUsedMb ?? website?.diskUsedMb ?? null,
    bandwidthUsedMb: domain.bandwidthUsedMb ?? website?.bandwidthUsedMb ?? null,
    createdAt: domain.createdAt,
    hasCloudflare: false, // Will be populated by Cloudflare status query
    hasTunnelRoute: false,
  };
}

/**
 * useSites - Primary hook for the new site-centric mental model
 *
 * Returns all sites (primary domains with their associated websites),
 * sorted by creation date descending.
 */
export function useSites(search?: string) {
  const domainsQuery = useDomains(search);
  const websitesQuery = useWebsites();

  return useQuery({
    queryKey: ['sites', search],
    queryFn: async () => {
      // Wait for both queries to complete
      await Promise.all([
        domainsQuery.isInitialLoading,
        websitesQuery.isInitialLoading,
      ]);

      const domains = domainsQuery.data || [];
      const websites = websitesQuery.data || [];

      // Create a map of websiteId -> Website for quick lookup
      const websiteMap = new Map<string, Website>(
        websites.map((w) => [w.id, w])
      );

      // Filter to only primary domains and create Site objects
      const primaryDomains = domains.filter(
        (d) => d.type === 'primary' || d.type === undefined
      );

      const sites: Site[] = primaryDomains.map((domain) => {
        const website = domain.websiteId
          ? websiteMap.get(domain.websiteId) || null
          : null;
        return createSite(domain, website);
      });

      // Sort by creation date descending (newest first)
      return sites.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    // Refetch when either domains or websites change
    refetchInterval: 30_000,
  });
}

/**
 * useSite - Get a single site by ID
 */
export function useSite(id: string) {
  const sitesQuery = useSites();

  return useQuery({
    queryKey: ['site', id],
    queryFn: async () => {
      const sites = sitesQuery.data || [];
      return sites.find((s) => s.id === id) || null;
    },
    enabled: !!id,
  });
}

/**
 * useSiteSubdomains - Get subdomains for a site
 */
export function useSiteSubdomains(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'subdomains'],
    queryFn: () => api.get<SiteSubdomain[]>(`/domains/${domainId}/subdomains`),
    enabled: !!domainId,
  });
}

/**
 * useSiteAliases - Get aliases for a site
 */
export function useSiteAliases(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'aliases'],
    queryFn: () => api.get<SiteAlias[]>(`/domains/${domainId}/aliases`),
    enabled: !!domainId,
  });
}

/**
 * useSiteRedirects - Get redirects for a site
 */
export function useSiteRedirects(domainId: string) {
  return useQuery({
    queryKey: ['domains', domainId, 'redirects'],
    queryFn: () => api.get<SiteRedirect[]>(`/domains/${domainId}/redirects`),
    enabled: !!domainId,
  });
}

/**
 * useSiteFtp - Get FTP accounts for a site
 */
export function useSiteFtp(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'ftp'],
    queryFn: () => api.get<SiteFtpAccount[]>(`/websites/${websiteId}/ftp`),
    enabled: !!websiteId,
  });
}

/**
 * useSiteCron - Get cron jobs for a site
 */
export function useSiteCron(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'cron'],
    queryFn: () => api.get<SiteCronJob[]>(`/websites/${websiteId}/cron`),
    enabled: !!websiteId,
  });
}

/**
 * useSiteDatabases - Get databases for a site
 */
export function useSiteDatabases(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'databases'],
    queryFn: () => api.get<SiteDatabase[]>(`/websites/${websiteId}/databases`),
    enabled: !!websiteId,
  });
}

/**
 * useSiteBackups - Get backups for a site
 */
export function useSiteBackups(websiteId: string) {
  return useQuery({
    queryKey: ['websites', websiteId, 'backups'],
    queryFn: () => api.get<SiteBackup[]>(`/websites/${websiteId}/backups`),
    enabled: !!websiteId,
  });
}
