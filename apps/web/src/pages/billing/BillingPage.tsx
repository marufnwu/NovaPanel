import { useState } from 'react';
import {
  useUsageSummary,
  useInvoices,
  usePlans,
  useUpdateInvoiceStatus,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  type Invoice,
  type Plan,
} from '../../api/hooks/billing';
import { useAuthStore } from '../../store/auth.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  Receipt,
  BarChart3,
  Plus,
  Trash2,
  Pencil,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from '../../lib/toast';

type TabKey = 'overview' | 'invoices' | 'plans';

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const variants: Record<Invoice['status'], string> = {
    draft: 'bg-gray-500/10 text-gray-400',
    open: 'bg-blue-500/10 text-blue-500',
    paid: 'bg-green-500/10 text-green-500',
    overdue: 'bg-red-500/10 text-red-500',
    cancelled: 'bg-gray-500/10 text-gray-400',
  };
  return <Badge className={variants[status]}>{status}</Badge>;
}

function PlanModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: Plan;
  onClose: () => void;
  onSubmit: (data: { name: string; slug: string; price: number; currency?: string; interval?: 'monthly' | 'yearly'; quotas: Record<string, unknown>; features: string[]; isActive?: boolean }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    price: initial?.price ?? 0,
    currency: initial?.currency ?? 'USD',
    interval: initial?.interval ?? 'monthly' as 'monthly' | 'yearly',
    quotas: JSON.stringify(initial?.quotas ?? {}),
    features: initial?.features?.join('\n') ?? '',
  });

  const handleSubmit = () => {
    try {
      const quotas = JSON.parse(form.quotas);
      onSubmit({
        name: form.name,
        slug: form.slug,
        price: form.price,
        currency: form.currency,
        interval: form.interval,
        quotas,
        features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
        isActive: true,
      });
    } catch {
      toast.error('Invalid JSON in quotas field');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="plan-name">Name</Label><Input id="plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro Plan" /></div>
          <div><Label htmlFor="plan-slug">Slug</Label><Input id="plan-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pro" disabled={!!initial} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="plan-price">Price (cents)</Label><Input id="plan-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Interval</Label>
              <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as 'monthly' | 'yearly' })} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div><Label htmlFor="plan-quotas">Quotas (JSON)</Label><textarea id="plan-quotas" value={form.quotas} onChange={(e) => setForm({ ...form, quotas: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder='{"sites": 10, "storage_gb": 100}' /></div>
          <div><Label htmlFor="plan-features">Features (one per line)</Label><textarea id="plan-features" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Unlimited sites&#10;100GB storage&#10;Priority support" /></div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.slug.trim()}>
            {isPending ? 'Saving...' : initial ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillingPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';

  const { data: usageSummary, isLoading: usageLoading } = useUsageSummary(orgId);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(orgId);
  const { data: plans, isLoading: plansLoading } = usePlans();
  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [tab, setTab] = useState<TabKey>('overview');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  const handleDeletePlan = () => {
    if (!deletePlanId) return;
    deletePlan.mutate(deletePlanId, {
      onSuccess: () => { toast.success('Plan deleted'); setDeletePlanId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed to delete plan'),
    });
  };

  const handleCreatePlan = (data: { name: string; slug: string; price: number; currency?: string; interval?: 'monthly' | 'yearly'; quotas: Record<string, unknown>; features: string[]; isActive?: boolean }) => {
    createPlan.mutate(data, {
      onSuccess: () => { toast.success('Plan created'); setShowPlanModal(false); },
      onError: (e: Error) => toast.error(e.message || 'Failed to create plan'),
    });
  };

  const handleUpdatePlan = (data: { name: string; slug: string; price: number; currency?: string; interval?: 'monthly' | 'yearly'; quotas: Record<string, unknown>; features: string[]; isActive?: boolean }) => {
    if (!editPlan) return;
    updatePlan.mutate(
      { id: editPlan.id, ...data },
      {
        onSuccess: () => { toast.success('Plan updated'); setEditPlan(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed to update plan'),
      }
    );
  };

  if (usageLoading) return <LoadingSpinner />;

  const TABS: { key: TabKey; label: string; icon: typeof CreditCard }[] = [
    { key: 'overview', label: 'Usage Overview', icon: BarChart3 },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
    { key: 'plans', label: 'Plans', icon: CreditCard },
  ];

  return (
    <div>
      <PageHeader title="Billing" description="Manage usage, invoices, and subscription plans" />

      <div className="mb-6 flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t.key)}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {showPlanModal && (
        <PlanModal
          onClose={() => setShowPlanModal(false)}
          onSubmit={handleCreatePlan}
          isPending={createPlan.isPending}
        />
      )}
      {editPlan && (
        <PlanModal
          initial={editPlan}
          onClose={() => setEditPlan(null)}
          onSubmit={handleUpdatePlan}
          isPending={updatePlan.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deletePlanId}
        title="Delete Plan"
        message="This will deactivate this plan. Existing subscriptions will not be affected."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeletePlan}
        onCancel={() => setDeletePlanId(null)}
      />

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(['cpu', 'memory', 'storage', 'bandwidth', 'requests'] as const).map((resource) => {
              const data = usageSummary?.[resource];
              return (
                <div key={resource} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground capitalize">{resource}</span>
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">
                    {data ? `${data.quantity.toLocaleString()} ${data.unit}` : '0'}
                  </div>
                </div>
              );
            })}
          </div>

          {(!usageSummary || Object.keys(usageSummary).length === 0) && (
            <EmptyState icon={BarChart3} title="No usage data" description="Usage will appear here as resources are consumed." />
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        invoicesLoading ? <LoadingSpinner /> :
        (!invoices || invoices.length === 0) ? (
          <EmptyState icon={Receipt} title="No invoices" description="Invoices will appear here when generated." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="font-medium">{(inv.amount / 100).toFixed(2)}</TableCell>
                    <TableCell>{inv.currency}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.periodStart && inv.periodEnd
                        ? `${new Date(inv.periodStart).toLocaleDateString()} - ${new Date(inv.periodEnd).toLocaleDateString()}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'open' && (
                        <Button variant="ghost" size="sm" onClick={() => updateInvoiceStatus.mutate({ id: inv.id, status: 'paid' }, { onSuccess: () => toast.success('Invoice marked as paid'), onError: (e: Error) => toast.error(e.message) })}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                      {inv.status === 'overdue' && (
                        <Button variant="ghost" size="sm" onClick={() => updateInvoiceStatus.mutate({ id: inv.id, status: 'paid' }, { onSuccess: () => toast.success('Invoice marked as paid'), onError: (e: Error) => toast.error(e.message) })}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Available Plans</h3>
              <p className="text-sm text-muted-foreground">Subscription plans for your organization</p>
            </div>
            <Button onClick={() => setShowPlanModal(true)}><Plus className="h-4 w-4 mr-2" /> Add Plan</Button>
          </div>

          {plansLoading ? <LoadingSpinner /> :
          (!plans || plans.length === 0) ? (
            <EmptyState icon={CreditCard} title="No plans" description="Create your first subscription plan." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-lg">{plan.name}</div>
                    <Badge variant="secondary">{plan.interval}</Badge>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    ${(plan.price / 100).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">/{plan.interval === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">{plan.currency}</div>

                  <div className="border-t border-border pt-3 mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Quotas:</div>
                    <pre className="text-xs font-mono bg-muted/50 rounded p-2">{JSON.stringify(plan.quotas, null, 2)}</pre>
                  </div>

                  <div className="border-t border-border pt-3 mb-4">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Features:</div>
                    <ul className="space-y-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="text-sm flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditPlan(plan)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeletePlanId(plan.id)} className="hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}