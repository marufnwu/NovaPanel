import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useInvoices, useUsageSummary, usePlans, type Invoice, type Plan } from '../../api/hooks/billing';
import { useAuthStore } from '../../store/auth.store';

export function BillingPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(orgId);
  const { data: usageSummary, isLoading: usageLoading } = useUsageSummary(orgId);
  const { data: plans } = usePlans();

  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'plans'>('overview');

  if (invoicesLoading || usageLoading) {
    return <PageSkeleton />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'plans', label: 'Plans' },
  ];

  const currentPlan = plans?.[0];
  const formatCurrency = (amount: number, currency: string) => `${currency} ${(amount / 100).toFixed(2)}`;

  const invoiceColumns = [
    {
      key: 'id',
      label: 'Invoice',
      render: (i: Invoice) => <span className="font-mono text-small">{i.id.slice(0, 8)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (i: Invoice) => <StatusBadge status={i.status === 'paid' ? 'active' : i.status === 'overdue' ? 'expired' : 'pending'} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (i: Invoice) => <span>{formatCurrency(i.amount, i.currency)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (i: Invoice) => new Date(i.createdAt).toLocaleDateString(),
    },
  ];

  const usageEntries = usageSummary
    ? Object.entries(usageSummary).map(([key, value]) => ({ key, ...value }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-page-title font-medium">Billing</h1>

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

      {activeTab === 'overview' && (
        <>
          <Card title="Current Plan">
            {currentPlan ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Plan</span>
                  <span className="font-medium">{currentPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Price</span>
                  <span>{formatCurrency(currentPlan.price, currentPlan.currency)}/{currentPlan.interval}</span>
                </div>
              </div>
            ) : (
              <p className="text-small text-foreground-tertiary">No active plan</p>
            )}
          </Card>

          <Card title="Usage Summary">
            {usageEntries.length > 0 ? (
              <div className="grid grid-cols-4 gap-4">
                {usageEntries.map((entry) => (
                  <StatCard key={entry.key} label={entry.key} value={entry.quantity} sub={entry.unit} />
                ))}
              </div>
            ) : (
              <p className="text-small text-foreground-tertiary">No usage data</p>
            )}
          </Card>
        </>
      )}

      {activeTab === 'invoices' && (
        <Card>
          {invoices && invoices.length > 0 ? (
            <DataTable columns={invoiceColumns} data={invoices} rowKey={(i) => i.id} />
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-8">No invoices</p>
          )}
        </Card>
      )}

      {activeTab === 'plans' && (
        <Card>
          {plans && plans.length > 0 ? (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div key={plan.id} className="border border-border-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{plan.name}</span>
                    <span>{formatCurrency(plan.price, plan.currency)}/{plan.interval}</span>
                  </div>
                  <p className="text-small text-foreground-secondary mt-1">{plan.features.join(', ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-8">No plans available</p>
          )}
        </Card>
      )}
    </div>
  );
}