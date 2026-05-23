import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useFirewallStatus, useFirewallRules, useAddFirewallRule, useDeleteFirewallRule, useToggleFirewall, useFail2BanJails, useUnbanIp, type UfwRule, type F2BJail } from '../../api/hooks/firewall';
import { Icon } from '../../components/icons';

export function FirewallPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useFirewallStatus();
  const { data: rules } = useFirewallRules();
  const { data: jails } = useFail2BanJails();
  const addRule = useAddFirewallRule();
  const deleteRule = useDeleteFirewallRule();
  const toggleFirewall = useToggleFirewall();
  const unbanIp = useUnbanIp();

  const [activeTab, setActiveTab] = useState<'rules' | 'fail2ban' | 'logs' | 'ssh'>('rules');
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleAction, setRuleAction] = useState<'allow' | 'deny'>('allow');
  const [rulePort, setRulePort] = useState('');
  const [ruleProtocol, setRuleProtocol] = useState('tcp');
  const [ruleFrom, setRuleFrom] = useState('');
  const [deleteRuleNum, setDeleteRuleNum] = useState<number | null>(null);

  const handleAddRule = async () => {
    try {
      await addRule.mutateAsync({ action: ruleAction, port: rulePort, protocol: ruleProtocol, from: ruleFrom });
      setShowAddRule(false);
      setRulePort('');
      queryClient.invalidateQueries({ queryKey: ['firewall'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async () => {
    if (deleteRuleNum === null) return;
    try {
      await deleteRule.mutateAsync(deleteRuleNum);
      setDeleteRuleNum(null);
      queryClient.invalidateQueries({ queryKey: ['firewall'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (statusLoading) {
    return <PageSkeleton />;
  }

  const tabs = [
    { id: 'rules', label: 'Rules' },
    { id: 'fail2ban', label: 'Fail2Ban' },
    { id: 'logs', label: 'Logs' },
    { id: 'ssh', label: 'SSH' },
  ];

  const ruleColumns = [
    {
      key: 'number',
      label: '#',
    },
    {
      key: 'action',
      label: 'Action',
      render: (r: UfwRule) => (
        <span className={r.action === 'ALLOW' ? 'text-foreground-success' : 'text-foreground-danger'}>
          {r.action}
        </span>
      ),
    },
    {
      key: 'direction',
      label: 'Dir',
    },
    {
      key: 'from',
      label: 'From',
      render: (r: UfwRule) => <span className="font-mono">{r.from || 'Any'}</span>,
    },
    {
      key: 'rule',
      label: 'Port/Service',
      render: (r: UfwRule) => <span className="font-mono">{r.rule}</span>,
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (r: UfwRule) => <StatusBadge status={r.enabled !== false ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r: UfwRule) => (
        <Button variant="ghost" size="small" onClick={() => setDeleteRuleNum(r.number)} icon={<Icon name="icon-trash" size={15} />}>
          Delete
        </Button>
      ),
    },
  ];

  const presets = [
    { id: 'ssh', label: 'SSH' },
    { id: 'http', label: 'HTTP' },
    { id: 'https', label: 'HTTPS' },
    { id: 'ftp', label: 'FTP' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'imap', label: 'IMAP' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Firewall</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={status?.enabled ? 'running' : 'stopped'} />
          <Button variant={status?.enabled ? 'danger' : 'primary'} size="small" onClick={() => toggleFirewall.mutate(status?.enabled ? 'disable' : 'enable')}>
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
                <Button key={p.id} variant="default" size="small">{p.label}</Button>
              ))}
            </div>
            {rules && rules.length > 0 ? (
              <DataTable
                columns={ruleColumns}
                data={rules}
                rowKey={(r) => String(r.number)}
              />
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
                          <Button variant="ghost" size="small" onClick={() => unbanIp.mutate({ jail: jail.name, ip })}>Unban</Button>
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

      {activeTab === 'logs' && (
        <Card title="Firewall Logs">
          <p className="text-small text-foreground-tertiary text-center py-8">Logs view coming soon</p>
        </Card>
      )}

      {activeTab === 'ssh' && (
        <Card title="SSH Settings">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-small">Current SSH Port</span>
              <span className="font-mono">22</span>
            </div>
          </div>
        </Card>
      )}

      <Modal isOpen={showAddRule} onClose={() => setShowAddRule(false)} title="Add Firewall Rule"
        footer={<><Button variant="ghost" onClick={() => setShowAddRule(false)}>Cancel</Button><Button variant="primary" onClick={handleAddRule} loading={addRule.isPending}>Add</Button></>}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={ruleAction === 'allow' ? 'primary' : 'default'} onClick={() => setRuleAction('allow')}>Allow</Button>
            <Button variant={ruleAction === 'deny' ? 'danger' : 'default'} onClick={() => setRuleAction('deny')}>Deny</Button>
          </div>
          <Input label="Port" value={rulePort} onChange={(e) => setRulePort(e.target.value)} placeholder="80 or 80,443" />
          <div>
            <label className="text-meta font-medium mb-1 block">Protocol</label>
            <div className="flex gap-2">
              <Button variant={ruleProtocol === 'tcp' ? 'primary' : 'default'} size="small" onClick={() => setRuleProtocol('tcp')}>TCP</Button>
              <Button variant={ruleProtocol === 'udp' ? 'primary' : 'default'} size="small" onClick={() => setRuleProtocol('udp')}>UDP</Button>
            </div>
          </div>
          <Input label="From (optional)" value={ruleFrom} onChange={(e) => setRuleFrom(e.target.value)} placeholder="Any or IP/CIDR" />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteRuleNum !== null}
        onClose={() => setDeleteRuleNum(null)}
        onConfirm={handleDeleteRule}
        title="Delete Firewall Rule"
        description="This rule will be removed from the firewall."
        confirmText="Delete"
        impact="medium"
      />
    </div>
  );
}