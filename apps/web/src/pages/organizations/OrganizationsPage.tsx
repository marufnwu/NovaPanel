import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import {
  useOrganizations,
  useCreateOrganization,
  useDeleteOrganization,
  useSwitchOrganization,
  useOrganizationMembers,
  useInviteOrgMember,
  useRemoveOrgMember,
  type Organization,
  type OrgMember,
} from '../../api/hooks/organizations';
import { useAuthStore } from '../../store/auth.store';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const { data: organizations, isLoading, isError, error, refetch } = useOrganizations();
  const createOrg = useCreateOrganization();
  const deleteOrg = useDeleteOrganization();
  const switchOrg = useSwitchOrganization();
  const inviteMember = useInviteOrgMember();
  const removeMember = useRemoveOrgMember();

  const activeOrgId = useAuthStore((s) => s.activeOrgId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'billing'>('member');

  const { data: members } = useOrganizationMembers(selectedOrgId || '');

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const orgColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (org: Organization) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{org.name}</span>
          {org.id === activeOrgId && (
            <span className="text-meta text-foreground-info font-medium">Current</span>
          )}
        </div>
      ),
    },
    { key: 'slug', label: 'Slug', render: (org: Organization) => <span className="font-mono text-foreground-secondary">{org.slug}</span> },
    {
      key: 'plan',
      label: 'Plan',
      render: (org: Organization) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">{org.plan}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (org: Organization) => <StatusBadge status={org.status === 'active' ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (org: Organization) => (
        <div className="flex gap-1">
          {org.id !== activeOrgId && (
            <Button
              variant="ghost"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                switchOrg.mutate(org.id, {
                  onSuccess: () => {
                    toast.success(`Switched to ${org.name}`);
                    queryClient.invalidateQueries({ queryKey: ['organizations'] });
                    queryClient.invalidateQueries({ queryKey: ['containers'] });
                    queryClient.invalidateQueries({ queryKey: ['domains'] });
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                    queryClient.invalidateQueries({ queryKey: ['databases'] });
                  },
                  onError: (err) => toast.error(`Failed to switch organization: ${err.message}`),
                });
              }}
              icon={<Icon name="icon-refresh" size={15} />}
            >
              Switch
            </Button>
          )}
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrgId(org.id);
            }}
            icon={<Icon name="icon-users" size={15} />}
          >
            Members
          </Button>
          {org.role === 'owner' && (
            <Button
              variant="ghost"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOrgId(org.id);
              }}
              icon={<Icon name="icon-trash" size={15} />}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Organizations</h1>
        <Button icon={<Icon name="icon-plus" size={16} />} onClick={() => setShowCreateModal(true)}>
          New Organization
        </Button>
      </div>

      {organizations && organizations.length > 0 ? (
        <Card>
          <DataTable
            columns={orgColumns}
            data={organizations}
            rowKey={(org) => org.id}
            onRowClick={(org) => setSelectedOrgId(org.id)}
          />
        </Card>
      ) : (
        <EmptyState
          icon="icon-users"
          title="No organizations"
          description="Create your first organization to collaborate with your team"
          action={{ label: 'New Organization', onClick: () => setShowCreateModal(true) }}
        />
      )}

      {selectedOrgId && (
        <MembersPanel
          orgId={selectedOrgId}
          members={members || []}
          onClose={() => setSelectedOrgId(null)}
          onInvite={() => setShowInviteModal(true)}
          onRemove={(userId) =>
            removeMember.mutate(
              { orgId: selectedOrgId, userId },
              {
                onSuccess: () => {
                  toast.success('Member removed');
                  queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'members'] });
                },
                onError: (err) => toast.error(`Failed to remove member: ${err.message}`),
              }
            )
          }
        />
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Organization"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createOrg.isPending}
              onClick={() => {
                if (!newOrgName || !newOrgSlug) return;
                createOrg.mutate(
                  { name: newOrgName, slug: newOrgSlug },
                  {
                    onSuccess: () => {
                      toast.success('Organization created');
                      setShowCreateModal(false);
                      setNewOrgName('');
                      setNewOrgSlug('');
                    },
                    onError: (err) => toast.error(`Failed to create organization: ${err.message}`),
                  }
                );
              }}
              disabled={!newOrgName || !newOrgSlug}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Organization Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="My Company"
          />
          <Input
            label="Slug"
            value={newOrgSlug}
            onChange={(e) => setNewOrgSlug(e.target.value.replace(/[^a-z0-9-]/g, '-').toLowerCase())}
            placeholder="my-company"
          />
        </div>
      </Modal>

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={inviteMember.isPending}
              onClick={() => {
                if (!inviteEmail) return;
                inviteMember.mutate(
                  { orgId: selectedOrgId!, email: inviteEmail, role: inviteRole },
                  {
                    onSuccess: () => {
                      toast.success(`Invitation sent to ${inviteEmail}`);
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteRole('member');
                      queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'members'] });
                    },
                    onError: (err) => toast.error(`Failed to invite member: ${err.message}`),
                  }
                );
              }}
              disabled={!inviteEmail}
            >
              Send Invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
          />
          <div>
            <label className="text-meta font-medium mb-1 block">Role</label>
            <div className="flex gap-2">
              {(['admin', 'member', 'billing'] as const).map((role) => (
                <Button
                  key={role}
                  variant={inviteRole === role ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setInviteRole(role)}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteOrgId}
        onClose={() => setDeleteOrgId(null)}
        onConfirm={() => {
          if (!deleteOrgId) return;
          deleteOrg.mutate(deleteOrgId, {
            onSuccess: () => {
              toast.success('Organization deleted');
              setDeleteOrgId(null);
              queryClient.invalidateQueries({ queryKey: ['organizations'] });
            },
            onError: (err) => toast.error(`Failed to delete organization: ${err.message}`),
          });
        }}
        title="Delete Organization"
        description="This organization and all its data will be permanently deleted."
        confirmText="Delete"
        impact="high"
        loading={deleteOrg.isPending}
      />
    </div>
  );
}

function MembersPanel({
  orgId,
  members,
  onClose,
  onInvite,
  onRemove,
}: {
  orgId: string;
  members: OrgMember[];
  onClose: () => void;
  onInvite: () => void;
  onRemove: (userId: string) => void;
}) {
  const memberColumns = [
    { key: 'displayName', label: 'Name', render: (m: OrgMember) => m.displayName || m.username },
    { key: 'email', label: 'Email', render: (m: OrgMember) => <span className="font-mono text-small">{m.email}</span> },
    {
      key: 'role',
      label: 'Role',
      render: (m: OrgMember) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">{m.role}</span>
      ),
    },
    {
      key: 'joinedAt',
      label: 'Joined',
      render: (m: OrgMember) => new Date(m.joinedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (m: OrgMember) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => onRemove(m.userId)}
          icon={<Icon name="icon-trash" size={15} />}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <Card action={<Button size="small" onClick={onInvite} icon={<Icon name="icon-plus" size={15} />}>Invite</Button>}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-card-title font-medium">Organization Members</h2>
        <Button variant="ghost" size="small" onClick={onClose} icon={<Icon name="icon-x" size={15} />}>
          Close
        </Button>
      </div>
      {members.length > 0 ? (
        <DataTable columns={memberColumns} data={members} rowKey={(m) => m.id} />
      ) : (
        <p className="text-small text-foreground-tertiary text-center py-4">No members yet</p>
      )}
    </Card>
  );
}