import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDatabaseInfo, useCreateDbUser, useDeleteDbUser, type DatabaseInfo, type DbUser } from '../../api/hooks/databases';
import { Icon } from '../../components/icons';
import { useState } from 'react';

export function DatabaseDetailPage() {
  const params = useParams({ from: '/databases/$databaseId' });
  const databaseId = params.databaseId as string;
  const queryClient = useQueryClient();

  const { data: dbInfo, isLoading } = useDatabaseInfo(databaseId);
  const createDbUser = useCreateDbUser();
  const deleteDbUser = useDeleteDbUser();

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const handleCreateUser = async () => {
    try {
      await createDbUser.mutateAsync({ databaseId, username: newUsername, password: newPassword });
      setShowCreateUser(false);
      setNewUsername('');
      setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await deleteDbUser.mutateAsync({ dbId: databaseId, userId: deleteUserId });
      setDeleteUserId(null);
      queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!dbInfo) {
    return <div className="text-center py-12">Database not found</div>;
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const columns = [
    {
      key: 'username',
      label: 'Username',
      render: (user: DbUser) => <span className="font-mono">{user.username}</span>,
    },
    {
      key: 'host',
      label: 'Host',
      render: (user: DbUser) => <span className="font-mono text-foreground-secondary">{user.host}</span>,
    },
    {
      key: 'privileges',
      label: 'Privileges',
    },
    {
      key: 'actions',
      label: '',
      render: (user: DbUser) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => setDeleteUserId(user.id)}
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
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-medium">{dbInfo.name}</h1>
          <StatusBadge status="active" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Connection Info">
          <div className="space-y-2 text-small">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Engine</span>
              <span>{dbInfo.engine === 'mariadb' ? 'MariaDB' : 'PostgreSQL'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Charset</span>
              <span>{dbInfo.charset || 'utf8mb4'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Size</span>
              <span>{formatBytes(dbInfo.sizeBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Created</span>
              <span>{new Date(dbInfo.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <Card title="Users" action={<Button size="small" onClick={() => setShowCreateUser(true)}>Add User</Button>}>
          {dbInfo.users && dbInfo.users.length > 0 ? (
            <DataTable
              columns={columns}
              data={dbInfo.users as DbUser[]}
              rowKey={(user) => user.id}
            />
          ) : (
            <p className="text-small text-foreground-tertiary text-center py-4">No users yet</p>
          )}
        </Card>
      </div>

      <Modal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title="Add Database User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateUser(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateUser} loading={createDbUser.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="db_user"
          />
          <Input
            label="Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Strong password"
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDeleteUser}
        title="Delete Database User"
        description="This user will no longer be able to access this database."
        confirmText="Delete"
        impact="medium"
      />
    </div>
  );
}