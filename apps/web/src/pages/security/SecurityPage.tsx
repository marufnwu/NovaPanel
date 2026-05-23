import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useWafRules,
  useIpAllowlists,
  useUpdateWafRule,
  useUpdateIpAllowlist,
  type WafRule,
  type IpAllowlist,
} from '../../api/hooks/security';
import { useAuthStore } from '../../store/auth.store';
import { Icon } from '../../components/icons';

export function SecurityPage() {
  const queryClient = useQueryClient();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';

  const { data: wafRules, isLoading: wafLoading } = useWafRules(projectId);
  const { data: ipAllowlists, isLoading: ipLoading } = useIpAllowlists(projectId);
  const updateWafRule = useUpdateWafRule();
  const updateIpAllowlist = useUpdateIpAllowlist();

  const [activeSection, setActiveSection] = useState<'waf' | 'allowlists'>('waf');

  const handleToggleWafRule = async (rule: WafRule) => {
    try {
      await updateWafRule.mutateAsync({
        id: rule.id,
        data: { enabled: !rule.enabled },
      });
      queryClient.invalidateQueries({ queryKey: ['waf-rules', projectId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleIpAllowlist = async (allowlist: IpAllowlist) => {
    try {
      await updateIpAllowlist.mutateAsync({
        id: allowlist.id,
        data: { type: allowlist.type === 'allow' ? 'block' : 'allow' },
      });
      queryClient.invalidateQueries({ queryKey: ['ip-allowlists', projectId] });
    } catch (err) {
      console.error(err);
    }
  };

  if (wafLoading || ipLoading) {
    return <PageSkeleton />;
  }

  const wafColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: WafRule) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r: WafRule) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {r.type.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: WafRule) => <span className="text-foreground-secondary">{r.priority}</span>,
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (r: WafRule) => <StatusBadge status={r.enabled ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r: WafRule) => (
        <button
          className={`relative w-10 h-5 rounded-full transition-colors ${r.enabled ? 'bg-foreground-primary' : 'bg-background-secondary'}`}
          onClick={() => handleToggleWafRule(r)}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${r.enabled ? 'left-5' : 'left-0.5'}`}
          />
        </button>
      ),
    },
  ];

  const allowlistColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (a: IpAllowlist) => <span className="font-medium">{a.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (a: IpAllowlist) => (
        <span className={`text-small px-2 py-0.5 rounded capitalize ${a.type === 'allow' ? 'bg-foreground-success/10 text-foreground-success' : 'bg-foreground-danger/10 text-foreground-danger'}`}>
          {a.type}
        </span>
      ),
    },
    {
      key: 'ips',
      label: 'IP Addresses',
      render: (a: IpAllowlist) => (
        <div className="flex flex-wrap gap-1">
          {a.ips.slice(0, 3).map((ip, i) => (
            <span key={i} className="font-mono text-small bg-background-secondary px-1.5 py-0.5 rounded">
              {ip}
            </span>
          ))}
          {a.ips.length > 3 && (
            <span className="text-small text-foreground-tertiary">+{a.ips.length - 3} more</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (a: IpAllowlist) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="small" onClick={() => handleToggleIpAllowlist(a)}>
            {a.type === 'allow' ? 'Block' : 'Allow'}
          </Button>
        </div>
      ),
    },
  ];

  const sections = [
    { id: 'waf', label: 'WAF Rules' },
    { id: 'allowlists', label: 'IP Allowlists' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">Security</h1>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as typeof activeSection)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: activeSection === section.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeSection === section.id ? 500 : 400,
              }}
            >
              {section.label}
              {activeSection === section.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeSection === 'waf' && (
        <>
          {wafRules && wafRules.length > 0 ? (
            <Card>
              <DataTable
                columns={wafColumns}
                data={wafRules}
                rowKey={(r) => r.id}
              />
            </Card>
          ) : (
            <EmptyState
              icon="icon-shield"
              title="No WAF rules"
              description="WAF rules help protect your applications from attacks"
            />
          )}
        </>
      )}

      {activeSection === 'allowlists' && (
        <>
          {ipAllowlists && ipAllowlists.length > 0 ? (
            <Card>
              <DataTable
                columns={allowlistColumns}
                data={ipAllowlists}
                rowKey={(a) => a.id}
              />
            </Card>
          ) : (
            <EmptyState
              icon="icon-globe"
              title="No IP allowlists"
              description="IP allowlists control access to your applications"
            />
          )}
        </>
      )}
    </div>
  );
}