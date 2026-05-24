import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useFirewallStatus,
  useFirewallRules,
  useAddFirewallRule,
  useDeleteFirewallRule,
  useApplyFirewallPreset,
  useToggleFirewall,
  useFail2BanJails,
  useUnbanIp,
  useToggleRule,
  type UfwRule,
  type F2BJail,
} from '../../api/hooks/firewall';
import { useSshSettings, useUpdateSshSettings } from '../../api/hooks/settings';
import { useSystemLogs } from '../../api/hooks/logs';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';

export function FirewallPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading, isError: statusError, error: statusErr, refetch: refetchStatus } = useFirewallStatus();
  const { data: rules, isLoading: rulesLoading, isError: rulesError, error: rulesErr, refetch: refetchRules } = useFirewallRules();
  const { data: jails, isLoading: jailsLoading, refetch: refetchJails } = useFail2BanJails();
  const addRule = useAddFirewallRule();
  const deleteRule = useDeleteFirewallRule();
  const applyPreset = useApplyFirewallPreset();
  const toggleFirewall = useToggleFirewall();
  const unbanIp = useUnbanIp();

  const [activeTab, setActiveTab] = useState<'rules' | 'fail2ban' | 'logs' | 'ssh'>('rules');
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleAction, setRuleAction] = useState<'allow' | 'deny'>('allow');
  const [rulePort, setRulePort] = useState('');
  const [ruleProtocol, setRuleProtocol] = useState('tcp');
  const [ruleFrom, setRuleFrom] = useState('');
  const [deleteRuleNum, setDeleteRuleNum] = useState<number | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<{ jail: string; ip: string } | null>(null);

  if (statusLoading) return <PageSkeleton />;
  if (statusError) return <ErrorState message={statusErr?.message} onRetry={refetchStatus} />;

  const tabs = [
    { id: 'rules', label: 'Rules' },
    { id: 'fail2ban', label: 'Fail2Ban' },
    { id: 'logs', label: 'Logs' },
    { id: 'ssh', label: 'SSH' },
  ];

  const presets = [
    { id: 'ssh', label: 'SSH' },
    { id: 'http', label: 'HTTP' },
    { id: 'https', label: 'HTTPS' },
    { id: 'ftp', label: 'FTP' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'imap', label: 'IMAP' },
  ];

  const ruleColumns = [
    { key: 'number', label: '#' },
    {
      key: 'action',
      label: 'Action',
      render: (r: UfwRule) => (
        <span className={r.action === 'ALLOW' ? 'text-foreground-success' : 'text-foreground-danger'}>
          {r.action}
        </span>
      ),
    },
    { key: 'direction', label: 'Dir' },
    { key: 'from', label: 'From', render: (r: UfwRule) => <span className="font-mono">{r.from || 'Any'}</span> },
    { key: 'rule', label: 'Port/Service', render: (r: UfwRule) => <span className="font-mono">{r.rule}</span> },
    {
      key: 'enabled',
      label: 'Status',
      render: (r: UfwRule) => <StatusBadge status={r.enabled !== false ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r: UfwRule) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => setDeleteRuleNum(r.number)}
          icon={<Icon name="icon-trash" size={15} />}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Firewall</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={status?.enabled ? 'active' : 'inactive'} />
          <Button
            variant={status?.enabled ? 'danger' : 'primary'}
            size="small"
            loading={toggleFirewall.isPending}
            onClick={() => {
              toggleFirewall.mutate(status?.enabled ? 'disable' : 'enable', {
                onSuccess: () => toast.success(status?.enabled ? 'Firewall disabled' : 'Firewall enabled'),
                onError: (err) => toast.error(`Failed to ${status?.enabled ? 'disable' : 'enable'} firewall: ${err.message}`),
              });
            }}
          >
            {status?.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-2.5 text-small transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'rules' && (
        <>
          <Card action={<Button size="small" onClick={() => setShowAddRule(true)}>Add Rule</Button>}>
            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  variant="default"
                  size="small"
                  loading={pendingPreset === p.id}
                  onClick={() => {
                    setPendingPreset(p.id);
                    applyPreset.mutate(p.id as 'ssh' | 'http' | 'https' | 'ftp' | 'smtp' | 'imap', {
                      onSuccess: () => {
                        toast.success(`Firewall preset "${p.label}" applied`);
                        setPendingPreset(null);
                      },
                      onError: (err) => {
                        toast.error(`Failed to apply preset: ${err.message}`);
                        setPendingPreset(null);
                      },
                    });
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {rulesError ? (
              <ErrorState message={rulesErr?.message} onRetry={refetchRules} />
            ) : rules && rules.length > 0 ? (
              <DataTable columns={ruleColumns} data={rules} rowKey={(r) => String(r.number)} />
            ) : (
              <p className="text-small text-foreground-tertiary text-center py-8">No firewall rules</p>
            )}
          </Card>
        </>
      )}

      {activeTab === 'fail2ban' && (
        <Card title="Fail2Ban Jails">
          {jails && jails.length > 0 ? (
            <div className="space-y-4">
              {jails.map((jail) => (
                <div key={jail.name} className="border border-border-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{jail.name}</span>
                    <span className="text-small text-foreground-secondary">{jail.bannedCount} banned IPs</span>
                  </div>
                  {jail.bannedIps.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {jail.bannedIps.map((ip) => (
                        <div key={ip} className="flex items-center gap-1 px-2 py-1 bg-background-secondary rounded text-small">
                          <span className="font-mono">{ip}</span>
                          <Button
                            variant="ghost"
                            size="small"
                            loading={unbanIp.isPending}
                            onClick={() => setUnbanTarget({ jail: jail.name, ip })}
                          >
                            Unban
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-8">No Fail2Ban jails active</p>
          )}
        </Card>
      )}

      {activeTab === 'logs' && <FirewallLogsTab />}

      {activeTab === 'ssh' && <SshTab />}

      <Modal
        isOpen={showAddRule}
        onClose={() => setShowAddRule(false)}
        title="Add Firewall Rule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddRule(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={addRule.isPending}
              onClick={() => {
                addRule.mutate(
                  { action: ruleAction, port: rulePort, protocol: ruleProtocol, from: ruleFrom },
                  {
                    onSuccess: () => {
                      toast.success('Firewall rule added');
                      setShowAddRule(false);
                      setRulePort('');
                    },
                    onError: (err) => toast.error(`Failed to add rule: ${err.message}`),
                  }
                );
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={ruleAction === 'allow' ? 'primary' : 'default'}
              onClick={() => setRuleAction('allow')}
            >
              Allow
            </Button>
            <Button
              variant={ruleAction === 'deny' ? 'danger' : 'default'}
              onClick={() => setRuleAction('deny')}
            >
              Deny
            </Button>
          </div>
          <Input label="Port" value={rulePort} onChange={(e) => setRulePort(e.target.value)} placeholder="80 or 80,443" />
          <div>
            <label className="text-meta font-medium mb-1 block">Protocol</label>
            <div className="flex gap-2">
              <Button
                variant={ruleProtocol === 'tcp' ? 'primary' : 'default'}
                size="small"
                onClick={() => setRuleProtocol('tcp')}
              >
                TCP
              </Button>
              <Button
                variant={ruleProtocol === 'udp' ? 'primary' : 'default'}
                size="small"
                onClick={() => setRuleProtocol('udp')}
              >
                UDP
              </Button>
            </div>
          </div>
          <Input label="From (optional)" value={ruleFrom} onChange={(e) => setRuleFrom(e.target.value)} placeholder="Any or IP/CIDR" />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteRuleNum !== null}
        onClose={() => setDeleteRuleNum(null)}
        onConfirm={() => {
          if (deleteRuleNum === null) return;
          deleteRule.mutate(deleteRuleNum, {
            onSuccess: () => {
              toast.success('Firewall rule deleted');
              setDeleteRuleNum(null);
            },
            onError: (err) => toast.error(`Failed to delete rule: ${err.message}`),
          });
        }}
        title="Delete Firewall Rule"
        description="This rule will be removed from the firewall."
        confirmText="Delete"
        impact="medium"
      />

      <ConfirmDialog
        isOpen={!!unbanTarget}
        onClose={() => setUnbanTarget(null)}
        onConfirm={() => {
          if (!unbanTarget) return;
          unbanIp.mutate(
            { jail: unbanTarget.jail, ip: unbanTarget.ip },
            {
              onSuccess: () => {
                toast.success(`IP ${unbanTarget.ip} unbanned`);
                setUnbanTarget(null);
              },
              onError: (err) => toast.error(`Failed to unban: ${err.message}`),
            }
          );
        }}
        title="Unban IP Address"
        description={`Unban ${unbanTarget?.ip} from ${unbanTarget?.jail}?`}
        confirmText="Unban"
        impact="medium"
        loading={unbanIp.isPending}
      />
    </div>
  );
}

function FirewallLogsTab() {
  const { data, isLoading, isError, error, refetch } = useSystemLogs(200);

  if (isLoading) return <div className="p-8 text-center text-foreground-secondary animate-pulse">Loading logs...</div>;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const lines = data?.log ? data.log.split('\n') : [];

  return (
    <Card title="Firewall Logs">
      {lines ? (
        <pre className="text-small font-mono text-foreground-secondary overflow-x-auto max-h-96 whitespace-pre-wrap">
          {lines}
        </pre>
      ) : (
        <p className="text-small text-foreground-tertiary text-center py-8">No firewall logs available</p>
      )}
    </Card>
  );
}

function SshTab() {
  const { data, isLoading } = useSshSettings();
  const mutation = useUpdateSshSettings();
  const [port, setPort] = useState(0);
  const [pubkeyAuth, setPubkeyAuth] = useState(false);
  const [permitRoot, setPermitRoot] = useState(false);

  useEffect(() => {
    if (data) {
      setPort(data.port);
      setPubkeyAuth(data.pubkeyAuth);
      setPermitRoot(data.permitRootLogin);
    }
  }, [data]);

  if (isLoading) return <PageSkeleton />;

  return (
    <Card title="SSH Settings">
      <div className="flex flex-col gap-4 max-w-md">
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">SSH Port</label>
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pubkeyAuth}
            onChange={(e) => setPubkeyAuth(e.target.checked)}
            className="accent-foreground-info"
          />
          <label className="text-small">Public key authentication</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={permitRoot}
            onChange={(e) => setPermitRoot(e.target.checked)}
            className="accent-foreground-info"
          />
          <label className="text-small">Permit root login</label>
        </div>
        <Button
          variant="primary"
          loading={mutation.isPending}
          onClick={() => {
            mutation.mutate(
              { port, pubkeyAuth, permitRootLogin: permitRoot },
              {
                onSuccess: () => toast.success('SSH settings saved'),
                onError: (err) => toast.error(`Failed to save SSH settings: ${err.message}`),
              }
            );
          }}
        >
          Save SSH Settings
        </Button>
      </div>
    </Card>
  );
}