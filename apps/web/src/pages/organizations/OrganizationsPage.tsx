import { useState } from 'react';
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useOrganizationMembers,
  useInviteOrgMember,
  useRemoveOrgMember,
  type Organization,
  type OrgMember,
} from '../../api/hooks/organizations';
import { useAuthStore } from '../../store/auth.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
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
  Building2,
  Plus,
  Trash2,
  Pencil,
  Mail,
  UserMinus,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-400',
  starter: 'bg-blue-500/10 text-blue-500',
  pro: 'bg-purple-500/10 text-purple-500',
  enterprise: 'bg-orange-500/10 text-orange-500',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-orange-500/10 text-orange-500',
  admin: 'bg-red-500/10 text-red-500',
  member: 'bg-blue-500/10 text-blue-500',
  billing: 'bg-green-500/10 text-green-500',
};

function OrgModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: Organization;
  onClose: () => void;
  onSubmit: (data: { name: string; slug: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.name ? initial.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '',
  });

  const handleSubmit = () => {
    onSubmit({ name: form.name, slug: form.slug });
  };

  const handleNameChange = (value: string) => {
    setForm({
      name: value,
      slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Organization"
            />
          </div>
          <div>
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="my-org"
            />
          </div>
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

function InviteModal({
  orgId,
  onClose,
  onSubmit,
  isPending,
}: {
  orgId: string;
  onClose: () => void;
  onSubmit: (data: { email: string; role: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ email: '', role: 'member' });

  const handleSubmit = () => {
    onSubmit({ email: form.email, role: form.role });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label>Role</Label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="billing">Billing</option>
            </select>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.email.trim()}>
            {isPending ? 'Sending...' : 'Send Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({ orgId }: { orgId: string }) {
  const { data: members, isLoading } = useOrganizationMembers(orgId);
  const removeMember = useRemoveOrgMember();
  const [removeData, setRemoveData] = useState<{ orgId: string; userId: string } | null>(null);

  const handleRemove = () => {
    if (!removeData) return;
    removeMember.mutate(removeData, {
      onSuccess: () => { toast.success('Member removed'); setRemoveData(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Team Members</h3>
      </div>

      <ConfirmDialog
        open={!!removeData}
        title="Remove Member"
        message="This will remove this user from the organization. They will lose access to all organization resources."
        confirmText="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveData(null)}
      />

      {!members || members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No members found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.displayName ?? m.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                  <TableCell><Badge className={ROLE_COLORS[m.role]}>{m.role}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRemoveData({ orgId, userId: m.userId })}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function OrganizationsPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const { data: orgs, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const inviteMember = useInviteOrgMember();

  const [showModal, setShowModal] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const selectedOrg = activeTab ? orgs?.find((o) => o.id === activeTab) : null;

  const handleCreate = (data: { name: string; slug: string }) => {
    createOrg.mutate(data, {
      onSuccess: () => { toast.success('Organization created'); setShowModal(false); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  const handleUpdate = (data: { name: string; slug: string }) => {
    if (!editOrg) return;
    updateOrg.mutate(
      { id: editOrg.id, name: data.name },
      {
        onSuccess: () => { toast.success('Organization updated'); setEditOrg(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteOrg.mutate(deleteId, {
      onSuccess: () => { toast.success('Organization deleted'); setDeleteId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  const handleInvite = (data: { email: string; role: string }) => {
    if (!activeTab) return;
    inviteMember.mutate(
      { orgId: activeTab, email: data.email, role: data.role },
      {
        onSuccess: () => { toast.success('Invitation sent'); setShowInvite(false); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader
        title="Organizations"
        icon={Building2}
      />

      <div className="mb-6 flex items-center justify-end gap-2">
        <Button onClick={() => { setActiveTab(null); setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Organization
        </Button>
      </div>

      {showModal && (
        <OrgModal
          initial={editOrg ?? undefined}
          onClose={() => { setShowModal(false); setEditOrg(null); }}
          onSubmit={editOrg ? handleUpdate : handleCreate}
          isPending={createOrg.isPending || updateOrg.isPending}
        />
      )}
      {showInvite && (
        <InviteModal
          orgId={activeTab!}
          onClose={() => setShowInvite(false)}
          onSubmit={handleInvite}
          isPending={inviteMember.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Organization"
        message="This will permanently delete this organization and all associated data. This cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {!orgs || orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations"
          description="Create your first organization to start collaborating with your team."
        />
      ) : (
        <div className="space-y-6">
          {/* Org selector tabs */}
          <div className="flex gap-2 border-b border-border pb-2">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => setActiveTab(org.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === org.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Building2 className="h-4 w-4" />
                {org.name}
                {org.id === activeOrgId && <Badge variant="secondary" className="text-xs ml-1">Active</Badge>}
              </button>
            ))}
          </div>

          {/* Selected org detail */}
          {selectedOrg ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedOrg.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge className={PLAN_COLORS[selectedOrg.plan]}>{selectedOrg.plan}</Badge>
                    <span className="text-sm text-muted-foreground">/{selectedOrg.slug}</span>
                    <Badge variant={selectedOrg.status === 'active' ? 'default' : 'destructive'}>{selectedOrg.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
                    <Mail className="h-4 w-4 mr-2" /> Invite
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditOrg(selectedOrg)}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  {selectedOrg.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(selectedOrg.id)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <MembersTab orgId={selectedOrg.id} />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select an organization above to manage it
            </div>
          )}
        </div>
      )}
    </div>
  );
}