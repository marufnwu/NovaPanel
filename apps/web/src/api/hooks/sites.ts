/**
 * useSites() - Unified Sites hook
 *
 * Provides a unified interface for Sites data by composing data from
 * existing useDomains() and useWebsites() hooks.
 *
 * A Site merges domain and website entities into a single view:
 * - Domain provides the primary identity (domain name, status, SSL)
 * - Website provides the hosting configuration (PHP, document root, web server)
 * - Subdomains, aliases, redirects, and Cloudflare zone are joined from domain sub-resources
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../lib/toast';
import { api } from '../client';
import {
  useDomains,
  useDomain,
  useSubdomains,
  useAliases,
  useRedirects,
  useDomainCloudflareZone,
  useCreateDomain,
  useDeleteDomain,
  useSuspendDomain,
  useActivateDomain,
  useBulkSuspendDomains,
  useBulkActivateDomains,
  useBulkDeleteDomains,
  type Domain,
  type Subdomain as DomainSubdomain,
  type DomainAlias,
  type DomainRedirect,
} from './domains';
import {
  useWebsites,
  useWebsite,
  useCreateWebsite,
  useDeleteWebsite,
  useSuspendWebsite,
  useActivateWebsite,
  type Website,
} from './websites';

// --- Types ---

/** Unified Site interface merging domain and website data */
export interface Site {
  // From domain entity (primary key is domain.id)
  id: string; // domain ID
  name: string; // primary domain name (e.g. "example.com")
  status: 'active' | 'suspended';
  accessType: 'local' | 'public' | 'tunnel';
  sslEnabled: boolean;
  diskUsage: number; // bytes (converted from Mb)
  bandwidth: number; // bytes (converted from Mb)
  systemUser: string;
  createdAt: string;

  // From website entity (may be null for redirect-only sites)
  websiteId: string | null;
  documentRoot: string | null;
  phpVersion: string | null;
  phpHandler: string | null;
  webServer: 'nginx' | 'apache' | 'nginx+apache' | null;

  // Derived / joined
  subdomains: Subdomain[];
  aliases: Alias[];
  redirects: Redirect[];
  cloudflareZone: CloudflareZone | null;

  // Internal flag for orphan websites (website without domain)
  isOrphanWebsite?: boolean;
  /** Inferred domain name from documentRoot path */
  inferredDomainName?: string;
}

export interface Subdomain {
  id: string;
  name: string;
  documentRoot: string;
  status: 'active' | 'suspended';
}

export interface Alias {
  id: string;
  name: string;
  targetDomain: string;
}

export interface Redirect {
  id: string;
  source: string;
  destination: string;
  type: 301 | 302;
}

export interface CloudflareZone {
  id: string;
  status: 'active' | 'pending' | 'disabled';
  sslStatus: 'flexible' | 'full' | 'strict' | 'off';
}

/** Input for creating a new site */
export interface CreateSiteInput {
  // Domain fields
  name: string;
  documentRoot?: string;
  phpVersion?: string;
  phpHandler?: string;
  webServer?: string;
  // Intent: should we create a website?
  createWebsite?: boolean;
  // Existing website to attach (if not creating)
  websiteId?: string;
  // Cloudflare / access
  makePublic?: boolean;
  tunnelId?: string;
  // DNS
  skipDnsVerification?: boolean;
  // Redirect mode (if creating a redirect-only site)
  redirectUrl?: string;
  redirectType?: '301' | '302';
}

// --- Helpers ---

/**
 * Convert megabytes to bytes (for diskUsage/bandwidth fields)
 */
function mbToBytes(mb: number | null | undefined): number {
  return (mb ?? 0) * 1024 * 1024;
}

/**
 * Infer domain name from documentRoot path.
 * e.g. "/var/www/example.com" → "example.com"
 */
function inferDomainNameFromDocumentRoot(documentRoot: string | null | undefined): string | undefined {
  if (!documentRoot) return undefined;
  const parts = documentRoot.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? undefined;
}

/**
 * Transform a Domain + Website + sub-resources into a Site
 */
async function buildSite(
  domain: Domain,
  subdomains: DomainSubdomain[],
  aliases: DomainAlias[],
  redirects: DomainRedirect[],
  cloudflareZone: { id: string; zoneName: string; zoneId: string; accountId: string | null; sslMode: string; isPaused: boolean } | null,
  website: Website | null
): Promise<Site> {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status === 'pending' ? 'active' : domain.status,
    accessType: 'local' as const,
    sslEnabled: domain.sslEnabled,
    diskUsage: mbToBytes(domain.diskUsedMb),
    bandwidth: mbToBytes(domain.bandwidthUsedMb),
    systemUser: domain.systemUser,
    createdAt: domain.createdAt,

    websiteId: domain.websiteId ?? (website?.id ?? null),
    documentRoot: domain.documentRoot ?? (website?.documentRoot ?? null),
    phpVersion: domain.phpVersion ?? (website?.phpVersion ?? null),
    phpHandler: domain.phpHandler ?? (website?.phpHandler ?? null),
    webServer: ((domain.webServer ?? website?.webServer) ?? null) as Site['webServer'],

    subdomains: subdomains.map((s) => ({
      id: s.id,
      name: s.name,
      documentRoot: s.documentRoot,
      status: 'active' as const,
    })),

    aliases: aliases.map((a) => ({
      id: a.id,
      name: a.alias,
      targetDomain: domain.name,
    })),

    redirects: redirects.map((r) => ({
      id: r.id,
      source: r.sourcePath,
      destination: r.targetUrl,
      type: parseInt(r.type) as 301 | 302,
    })),

    cloudflareZone: cloudflareZone
      ? {
          id: cloudflareZone.id,
          status: cloudflareZone.isPaused ? 'disabled' : 'active',
          sslStatus: cloudflareZone.sslMode as CloudflareZone['sslStatus'],
        }
      : null,
  };
}

/**
 * Build an orphan website site (website without domain)
 */
async function buildOrphanWebsiteSite(website: Website): Promise<Site> {
  const inferredName = inferDomainNameFromDocumentRoot(website.documentRoot);
  return {
    id: website.id,
    name: inferredName ?? website.name,
    status: website.status === 'error' ? 'suspended' : website.status,
    accessType: 'local',
    sslEnabled: false,
    diskUsage: mbToBytes(website.diskUsedMb),
    bandwidth: mbToBytes(website.bandwidthUsedMb),
    systemUser: website.systemUser,
    createdAt: website.createdAt,

    websiteId: website.id,
    documentRoot: website.documentRoot,
    phpVersion: website.phpVersion,
    phpHandler: website.phpHandler,
    webServer: website.webServer as Site['webServer'],

    subdomains: [],
    aliases: [],
    redirects: [],
    cloudflareZone: null,

    isOrphanWebsite: true,
    inferredDomainName: inferredName,
  };
}

// --- Main Hooks ---

/**
 * Core hook: fetch and compose all sites from domains + websites
 *
 * Returns unified Site[] by joining domains with their websites.
 * Orphan websites (with no attached domain) are also included with a warning badge.
 *
 * @example
 * const { data: sites, isLoading, error, refetch } = useSites();
 */
export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async (): Promise<Site[]> => {
      // Fetch base data
      const [domains, websites] = await Promise.all([
        api.get<Domain[]>('/domains'),
        api.get<Website[]>('/websites'),
      ]);

      // Build lookup maps
      const websiteMap = new Map<string, Website>(websites.map((w: Website) => [w.id, w]));
      const attachedWebsiteIds = new Set<string>();

      // First pass: identify attached websites
      for (const domain of domains) {
        if (domain.websiteId) {
          attachedWebsiteIds.add(domain.websiteId);
        }
      }

      // Build sites from domains
      const domainSites = await Promise.all(
        domains.map(async (domain: Domain) => {
          const website = domain.websiteId ? websiteMap.get(domain.websiteId) ?? null : null;

          // Fetch sub-resources in parallel
          const [subdomains, aliases, redirects, cfZone] = await Promise.all([
            api.get<DomainSubdomain[]>(`/domains/${domain.id}/subdomains`).catch(() => []),
            api.get<DomainAlias[]>(`/domains/${domain.id}/aliases`).catch(() => []),
            api.get<DomainRedirect[]>(`/domains/${domain.id}/redirects`).catch(() => []),
            api.get<{ id: string; zoneName: string; zoneId: string; accountId: string | null; sslMode: string; isPaused: boolean } | null>(`/domains/${domain.id}/cloudflare-zone`).catch(() => null),
          ]);

          return buildSite(domain, subdomains, aliases, redirects, cfZone, website);
        })
      );

      // Add orphan websites (website without any domain)
      const orphanWebsites = websites.filter((w: Website) => !attachedWebsiteIds.has(w.id));
      const orphanSites = await Promise.all(orphanWebsites.map(buildOrphanWebsiteSite));

      return [...domainSites, ...orphanSites];
    },
  });
}

/**
 * Single site detail hook
 *
 * @param id - Domain ID (or website ID for orphan sites)
 * @example
 * const { data: site, isLoading, error } = useSite(domainId);
 */
export function useSite(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: async (): Promise<Site | null> => {
      // Try domain first
      const domain = await api.get<Domain>(`/domains/${id}`).catch(() => null);
      if (domain) {
        const [subdomains, aliases, redirects, cfZone] = await Promise.all([
          api.get<DomainSubdomain[]>(`/domains/${domain.id}/subdomains`).catch(() => []),
          api.get<DomainAlias[]>(`/domains/${domain.id}/aliases`).catch(() => []),
          api.get<DomainRedirect[]>(`/domains/${domain.id}/redirects`).catch(() => []),
          api.get<{ id: string; zoneName: string; zoneId: string; accountId: string | null; sslMode: string; isPaused: boolean } | null>(`/domains/${domain.id}/cloudflare-zone`).catch(() => null),
        ]);
        const website = domain.websiteId
          ? await api.get<Website>(`/websites/${domain.websiteId}`).catch(() => null)
          : null;
        return buildSite(domain, subdomains, aliases, redirects, cfZone, website);
      }

      // Fall back to website (orphan site)
      const website = await api.get<Website>(`/websites/${id}`).catch(() => null);
      if (website) {
        return buildOrphanWebsiteSite(website);
      }

      return null;
    },
    enabled: !!id,
  });
}

// --- CRUD Mutations ---

/**
 * Create a new site (domain + optionally website)
 *
 * Returns the new domain ID for navigation.
 *
 * @example
 * const { createSite, isLoading } = useCreateSite();
 * await createSite({ name: 'example.com', createWebsite: true });
 */
export function useCreateSite() {
  const createDomain = useCreateDomain();
  const createWebsite = useCreateWebsite();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSiteInput): Promise<string> => {
      const { createWebsite: shouldCreateWebsite, websiteId, redirectUrl, redirectType, ...domainInput } = input;

      // If redirect intent, create domain with redirect type
      if (redirectUrl) {
        const domain = await createDomain.mutateAsync({
          ...domainInput,
          type: 'redirect',
          redirectTarget: redirectUrl,
          websiteMode: 'none',
        });
        return domain.id;
      }

      // If "Host a website" intent, create website first (or use existing)
      let finalWebsiteId = websiteId;
      if (shouldCreateWebsite && !finalWebsiteId) {
        const website = await createWebsite.mutateAsync({
          name: input.name,
          documentRoot: input.documentRoot,
          phpVersion: input.phpVersion,
          phpHandler: input.phpHandler,
          webServer: input.webServer,
        });
        finalWebsiteId = website.id;
      }

      // Create domain, optionally linking to website
      const domain = await createDomain.mutateAsync({
        ...domainInput,
        websiteId: finalWebsiteId,
        websiteMode: finalWebsiteId ? 'existing' : 'none',
      });

      return domain.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Site created successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create site');
    },
  });
}

/**
 * Delete a site (removes domain and optionally the associated website)
 *
 * @param id - Domain ID
 * @example
 * const { deleteSite, isLoading } = useDeleteSite(id);
 * await deleteSite();
 */
export function useDeleteSite(_id: string) {
  const deleteDomain = useDeleteDomain();
  const deleteWebsite = useDeleteWebsite();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get domain to find website ID before deleting
      const domain = await api.get<Domain>(`/domains/${id}`).catch(() => null);
      if (!domain) throw new Error('Site not found');

      const websiteId = domain.websiteId;

      // Delete domain first
      await deleteDomain.mutateAsync(id);

      // If there's an associated website, delete it too
      if (websiteId) {
        await deleteWebsite.mutateAsync(websiteId);
      }

      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Site deleted successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete site');
    },
  });
}

/**
 * Suspend a site (suspends domain)
 *
 * @param id - Domain ID
 * @example
 * const { suspendSite, isLoading } = useSuspendSite(id);
 * await suspendSite();
 */
export function useSuspendSite(_id: string) {
  const suspendDomain = useSuspendDomain();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => suspendDomain.mutateAsync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Site suspended');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend site');
    },
  });
}

/**
 * Activate a suspended site
 *
 * @param id - Domain ID
 * @example
 * const { activateSite, isLoading } = useActivateSite(id);
 * await activateSite();
 */
export function useActivateSite(_id: string) {
  const activateDomain = useActivateDomain();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateDomain.mutateAsync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Site activated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to activate site');
    },
  });
}

// --- Bulk Mutations ---

/**
 * Bulk suspend multiple sites
 *
 * @example
 * const { bulkSuspendSites, isLoading } = useBulkSuspendSites();
 * await bulkSuspendSites(['id1', 'id2']);
 */
export function useBulkSuspendSites() {
  const bulkSuspendDomains = useBulkSuspendDomains();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkSuspendDomains.mutateAsync(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Sites suspended');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend sites');
    },
  });
}

/**
 * Bulk activate multiple sites
 *
 * @example
 * const { bulkActivateSites, isLoading } = useBulkActivateSites();
 * await bulkActivateSites(['id1', 'id2']);
 */
export function useBulkActivateSites() {
  const bulkActivateDomains = useBulkActivateDomains();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkActivateDomains.mutateAsync(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Sites activated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to activate sites');
    },
  });
}

/**
 * Bulk delete multiple sites
 *
 * @example
 * const { bulkDeleteSites, isLoading } = useBulkDeleteSites();
 * await bulkDeleteSites(['id1', 'id2']);
 */
export function useBulkDeleteSites() {
  const bulkDeleteDomains = useBulkDeleteDomains();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteDomains.mutateAsync(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Sites deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete sites');
    },
  });
}
