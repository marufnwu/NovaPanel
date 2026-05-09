/**
 * DomainsTab - Domain management with subdomains, aliases, redirects, and Cloudflare
 */

import { useState } from 'react';
import { Globe, CheckCircle, XCircle, RefreshCw, Plus } from 'lucide-react';
import { SubdomainsSection } from '../../../components/sites/SubdomainsSection';
import { AliasesSection } from '../../../components/sites/AliasesSection';
import { RedirectsSection } from '../../../components/sites/RedirectsSection';
import { DomainCfDnsTab } from '../../../components/cloudflare/CfDnsTab';
import { DomainCfSslTab } from '../../../components/cloudflare/CfSslTab';
import { DomainCfFirewallTab } from '../../../components/cloudflare/CfFirewallTab';
import { DomainCfRedirectsTab } from '../../../components/cloudflare/CfRedirectsTab';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import {
  useSubdomains,
  useCreateSubdomain,
  useDeleteSubdomain,
  useAliases,
  useCreateAlias,
  useDeleteAlias,
  useRedirects,
  useCreateRedirect,
  useDeleteRedirect,
  useDomainCloudflareDns,
  useCreateDomainCloudflareDns,
  useDeleteDomainCloudflareDns,
  useDomainCloudflareSsl,
  useUpdateDomainCloudflareSsl,
  useDomainCloudflareFirewall,
  useCreateDomainCloudflareFirewall,
  useDeleteDomainCloudflareFirewall,
  useDomainCloudflareRedirects,
  useCreateDomainCloudflareRedirect,
  useDeleteDomainCloudflareRedirect,
  useDomainCloudflareZone,
} from '../../../api/hooks/domains';
import type { Site } from '../../../api/hooks/sites';

type CloudflareSubTab = 'dns' | 'ssl' | 'firewall' | 'redirects';

interface DomainsTabProps {
  site: Site;
  siteId: string;
}

export function DomainsTab({ site, siteId }: DomainsTabProps) {
  const [cfTab, setCfTab] = useState<CloudflareSubTab>('dns');

  // Domain hooks - using site.id (which is the domain id for non-orphan sites)
  const { data: subdomains, isLoading: subdomainsLoading } = useSubdomains(siteId);
  const { data: aliases, isLoading: aliasesLoading } = useAliases(siteId);
  const { data: redirects, isLoading: redirectsLoading } = useRedirects(siteId);

  // Cloudflare hooks
  const { data: cfZone, isLoading: cfZoneLoading } = useDomainCloudflareZone(siteId);
  const { data: cfDns, isLoading: cfDnsLoading, refetch: refetchCfDns } = useDomainCloudflareDns(siteId);
  const { data: cfSsl, isLoading: cfSslLoading } = useDomainCloudflareSsl(siteId);
  const { data: cfFirewall, isLoading: cfFirewallLoading, refetch: refetchCfFirewall } = useDomainCloudflareFirewall(siteId);
  const { data: cfRedirects, isLoading: cfRedirectsLoading, refetch: refetchCfRedirects } = useDomainCloudflareRedirects(siteId);

  // Mutation hooks
  const createSubdomain = useCreateSubdomain(siteId);
  const deleteSubdomain = useDeleteSubdomain(siteId);
  const createAlias = useCreateAlias(siteId);
  const deleteAlias = useDeleteAlias(siteId);
  const createRedirect = useCreateRedirect(siteId);
  const deleteRedirect = useDeleteRedirect(siteId);
  const createCfDns = useCreateDomainCloudflareDns(siteId);
  const deleteCfDns = useDeleteDomainCloudflareDns(siteId);
  const updateCfSsl = useUpdateDomainCloudflareSsl(siteId);
  const createCfFirewall = useCreateDomainCloudflareFirewall(siteId);
  const deleteCfFirewall = useDeleteDomainCloudflareFirewall(siteId);
  const createCfRedirect = useCreateDomainCloudflareRedirect(siteId);
  const deleteCfRedirect = useDeleteDomainCloudflareRedirect(siteId);

  return (
    <div className="space-y-6">
      {/* Primary Domain Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-primary" /> Primary Domain
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {site.status === 'active' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium">{site.name}</span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              site.status === 'active'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {site.status}
          </span>
          {site.cloudflareZone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-500">
              <CheckCircle className="h-3 w-3" /> Cloudflare
            </span>
          )}
        </div>
      </div>

      {/* Subdomains Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-primary" /> Subdomains
        </h3>
        {subdomainsLoading ? (
          <LoadingSpinner />
        ) : (
          <SubdomainsSection
            domain={{ id: siteId, name: site.name } as any}
            subdomains={subdomains?.map((s: any) => ({
              id: s.id,
              name: s.name,
              documentRoot: s.documentRoot,
              phpVersion: s.phpVersion,
            }))}
            onCreateSubdomain={createSubdomain}
            onDeleteSubdomain={deleteSubdomain}
          />
        )}
      </div>

      {/* Aliases Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-primary" /> Aliases
        </h3>
        {aliasesLoading ? (
          <LoadingSpinner />
        ) : (
          <AliasesSection
            domain={{ id: siteId, name: site.name } as any}
            aliases={aliases?.map((a: any) => ({ id: a.id, alias: a.alias }))}
            onCreateAlias={createAlias}
            onDeleteAlias={deleteAlias}
          />
        )}
      </div>

      {/* Redirects Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-primary" /> Redirects
        </h3>
        {redirectsLoading ? (
          <LoadingSpinner />
        ) : (
          <RedirectsSection
            domain={{ id: siteId, name: site.name } as any}
            redirects={redirects?.map((r: any) => ({
              id: r.id,
              sourcePath: r.sourcePath,
              targetUrl: r.targetUrl,
              type: r.type,
            }))}
            onCreateRedirect={createRedirect}
            onDeleteRedirect={deleteRedirect}
          />
        )}
      </div>

      {/* Cloudflare Section */}
      {cfZone && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <span className="text-orange-500">☁</span> Cloudflare
          </h3>

          {/* Cloudflare sub-tabs */}
          <div className="mb-4 flex gap-1 border-b border-border">
            {(['dns', 'ssl', 'firewall', 'redirects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCfTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  cfTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'ssl' ? 'SSL/TLS' : tab}
              </button>
            ))}
          </div>

          {cfTab === 'dns' && (
            <DomainCfDnsTab
              domainId={siteId}
              domainName={site.name}
              records={cfDns?.records || []}
              loading={cfDnsLoading}
              onRefresh={refetchCfDns}
              onCreate={createCfDns}
              onDelete={deleteCfDns}
            />
          )}

          {cfTab === 'ssl' && (
            <DomainCfSslTab
              domainId={siteId}
              settings={cfSsl}
              loading={cfSslLoading}
              onRefresh={() => {}}
              onUpdate={updateCfSsl}
            />
          )}

          {cfTab === 'firewall' && (
            <DomainCfFirewallTab
              domainId={siteId}
              rules={cfFirewall || []}
              loading={cfFirewallLoading}
              onRefresh={refetchCfFirewall}
              onCreate={createCfFirewall}
              onDelete={deleteCfFirewall}
            />
          )}

          {cfTab === 'redirects' && (
            <DomainCfRedirectsTab
              domainId={siteId}
              rules={cfRedirects || []}
              loading={cfRedirectsLoading}
              onRefresh={refetchCfRedirects}
              onCreate={createCfRedirect}
              onDelete={deleteCfRedirect}
            />
          )}
        </div>
      )}

      {/* No Cloudflare Zone */}
      {!cfZone && !cfZoneLoading && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-center text-muted-foreground">
            <p>No Cloudflare zone configured for this domain.</p>
          </div>
        </div>
      )}
    </div>
  );
}