import { useLocation, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useDatabaseInfo,
  useCreateDbUser,
  useDeleteDbUser,
  useChangeDbPassword,
  useExportDatabase,
  useRepairDatabase,
  useOptimizeDatabase,
  useCloneDatabase,
  useRunQuery,
  useDeleteDatabase,
  type DbUser,
  type QueryResult,
} from '../../api/hooks/databases';
import { Icon } from '../../components/icons';
import { toast } from '../../lib/toast';
import { ErrorState } from '../../components/ui/ErrorState';

export function DatabaseDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split('/databases/');
  const databaseId = pathParts[1]?.split('/')[0] || '';
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  if (!databaseId) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-foreground-secondary">Database ID is required</p>
      </div>
    );
  }

  const queryClient = useQueryClient();

  const { data: dbInfo, isLoading, isError, error, refetch } = useDatabaseInfo(databaseId);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [changePasswordUser, setChangePasswordUser] = useState<DbUser | null>(null);
  const [newDbPassword, setNewDbPassword] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'operations', label: 'Operations' },
    { id: 'query', label: 'Query' },
    { id: 'settings', label: 'Settings' },
  ];

  const handleTabChange = (tabId: string) => {
    navigate({ search: { tab: tabId } } as any);
  };

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  if (!dbInfo) return <ErrorState message="Database not found" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-page-title font-medium">{dbInfo.name}</h1>
          <StatusBadge status="active" />
        </div>
      </div>

      <div className="border-b border-border-tertiary">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-4 py-2.5 text-small transition-colors relative',
                activeTab === tab.id
                  ? 'text-foreground-primary font-medium'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground-primary" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab dbInfo={dbInfo} />}
      {activeTab === 'users' && <UsersTab dbInfo={dbInfo} databaseId={databaseId} />}
      {activeTab === 'operations' && <OperationsTab databaseId={databaseId} />}
      {activeTab === 'query' && <QueryTab databaseId={databaseId} />}
      {activeTab === 'settings' && <SettingsTab databaseId={databaseId} dbInfo={dbInfo} />}
    </div>
  );
}

function OverviewTab({ dbInfo }: { dbInfo: any }) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
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
      <Card title="Statistics">
        <div className="space-y-2 text-small">
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Users</span>
            <span>{dbInfo.users?.length ?? 0}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function UsersTab({ dbInfo, databaseId }: { dbInfo: any; databaseId: string }) {
  const queryClient = useQueryClient();
  const createDbUser = useCreateDbUser();
  const deleteDbUser = useDeleteDbUser();
  const changeDbPassword = useChangeDbPassword();

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [changePasswordUser, setChangePasswordUser] = useState<DbUser | null>(null);
  const [newDbPassword, setNewDbPassword] = useState('');

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) return;
    createDbUser.mutateAsync(
      { databaseId, username: newUsername, password: newPassword },
      {
        onSuccess: () => {
          toast.success('Database user created');
          setShowCreateUser(false);
          setNewUsername('');
          setNewPassword('');
          queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
        },
        onError: (err: any) => toast.error(`Failed to create database user: ${err.message}`),
      }
    );
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    deleteDbUser.mutateAsync(
      { dbId: databaseId, userId: deleteUserId },
      {
        onSuccess: () => {
          toast.success('Database user deleted');
          setDeleteUserId(null);
          queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
        },
        onError: (err: any) => toast.error(`Failed to delete database user: ${err.message}`),
      }
    );
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser || !newDbPassword) return;
    changeDbPassword.mutateAsync(
      { dbId: databaseId, userId: changePasswordUser.id, password: newDbPassword },
      {
        onSuccess: () => {
          toast.success('Password updated for ' + changePasswordUser.username);
          setChangePasswordUser(null);
          setNewDbPassword('');
          queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
        },
        onError: (err: any) => toast.error(`Failed to update password: ${err.message}`),
      }
    );
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
      key: 'actions',
      label: '',
      render: (user: DbUser) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="small"
            onClick={() => setChangePasswordUser(user)}
            icon={<Icon name="icon-key" size={15} />}
          />
          <Button
            variant="ghost"
            size="small"
            onClick={() => setDeleteUserId(user.id)}
            icon={<Icon name="icon-trash" size={15} />}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Card action={<Button size="small" onClick={() => setShowCreateUser(true)}>Add User</Button>}>
        {dbInfo.users && dbInfo.users.length > 0 ? (
          <DataTable
            columns={columns}
            data={dbInfo.users as DbUser[]}
            rowKey={(user) => user.id}
          />
        ) : (
          <EmptyState
            icon="icon-users"
            title="No users"
            description="Add a user to this database"
            action={{
              label: 'Add User',
              onClick: () => setShowCreateUser(true),
            }}
          />
        )}
      </Card>

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

      <Modal
        isOpen={!!changePasswordUser}
        onClose={() => setChangePasswordUser(null)}
        title={`Change Password — ${changePasswordUser?.username}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangePasswordUser(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleChangePassword} loading={changeDbPassword.isPending}>
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Password"
            type="password"
            value={newDbPassword}
            onChange={(e) => setNewDbPassword(e.target.value)}
            placeholder="New strong password"
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => handleDeleteUser()}
        title="Delete Database User"
        description="This user will no longer be able to access this database."
        confirmText="Delete"
        impact="medium"
        loading={deleteDbUser.isPending}
      />
    </>
  );
}

function OperationsTab({ databaseId }: { databaseId: string }) {
  const queryClient = useQueryClient();
  const exportDb = useExportDatabase();
  const repairDb = useRepairDatabase();
  const optimizeDb = useOptimizeDatabase();
  const cloneDb = useCloneDatabase();

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [exportData, setExportData] = useState<string | null>(null);

  const handleExport = () => {
    exportDb.mutate(databaseId, {
      onSuccess: (data) => {
        setExportData(data.sql);
        toast.success('Database exported');
      },
      onError: (err: any) => toast.error(`Failed to export: ${err.message}`),
    });
  };

  const handleRepair = () => {
    repairDb.mutate(databaseId, {
      onSuccess: (data) => {
        toast.success('Database repaired: ' + data.output);
        queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
      },
      onError: (err: any) => toast.error(`Failed to repair: ${err.message}`),
    });
  };

  const handleOptimize = () => {
    optimizeDb.mutate(databaseId, {
      onSuccess: (data) => {
        toast.success('Database optimized: ' + data.output);
        queryClient.invalidateQueries({ queryKey: ['database-info', databaseId] });
      },
      onError: (err: any) => toast.error(`Failed to optimize: ${err.message}`),
    });
  };

  const handleClone = () => {
    if (!cloneName) return;
    cloneDb.mutate(
      { dbId: databaseId, newName: cloneName },
      {
        onSuccess: () => {
          toast.success('Database cloned');
          setShowCloneModal(false);
          setCloneName('');
          queryClient.invalidateQueries({ queryKey: ['databases'] });
        },
        onError: (err: any) => toast.error(`Failed to clone: ${err.message}`),
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card title="Database Operations">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="small"
            onClick={handleExport}
            loading={exportDb.isPending}
            icon={<Icon name="icon-download" size={15} />}
          >
            Export
          </Button>
          <Button
            variant="default"
            size="small"
            onClick={handleRepair}
            loading={repairDb.isPending}
            icon={<Icon name="icon-settings" size={15} />}
          >
            Repair
          </Button>
          <Button
            variant="default"
            size="small"
            onClick={handleOptimize}
            loading={optimizeDb.isPending}
            icon={<Icon name="icon-refresh" size={15} />}
          >
            Optimize
          </Button>
          <Button
            variant="default"
            size="small"
            onClick={() => setShowCloneModal(true)}
            icon={<Icon name="icon-copy" size={15} />}
          >
            Clone
          </Button>
        </div>
      </Card>

      {exportData && (
        <Card title="Export Result">
          <pre className="text-meta font-mono whitespace-pre-wrap">{exportData}</pre>
        </Card>
      )}

      <Modal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        title="Clone Database"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCloneModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleClone} loading={cloneDb.isPending}>
              Clone
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Database Name"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="new_database_name"
          />
        </div>
      </Modal>
    </div>
  );
}

function QueryTab({ databaseId }: { databaseId: string }) {
  const runQuery = useRunQuery();
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const handleRunQuery = () => {
    if (!sql.trim()) return;
    runQuery.mutate(
      { dbId: databaseId, sql },
      {
        onSuccess: (data) => {
          setResults(data);
          setQueryError(null);
        },
        onError: (err: any) => {
          setQueryError(err.message);
          setResults(null);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card title="SQL Query">
        <div className="flex flex-col gap-3">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT * FROM users LIMIT 10;"
            className="w-full h-32 px-3 py-2 text-small font-mono rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50 resize-y"
          />
          <Button
            variant="primary"
            onClick={handleRunQuery}
            loading={runQuery.isPending}
            icon={<Icon name="icon-play" size={15} />}
          >
            Run Query
          </Button>
        </div>
      </Card>

      {queryError && (
        <Card title="Error">
          <p className="text-small text-foreground-error">{queryError}</p>
        </Card>
      )}

      {results && (
        <Card title={`Results — ${results.rowCount} row${results.rowCount !== 1 ? 's' : ''}`}>
          {results.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr>
                    {results.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-foreground-secondary border-b border-border-tertiary">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, i) => (
                    <tr key={i}>
                      {results.columns.map((col) => (
                        <td key={col} className="px-3 py-2 border-b border-border-tertiary font-mono">
                          {String(row[col] ?? 'NULL')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-small text-foreground-tertiary">No results</p>
          )}
        </Card>
      )}
    </div>
  );
}

function SettingsTab({ databaseId, dbInfo }: { databaseId: string; dbInfo: any }) {
  const queryClient = useQueryClient();
  const deleteDatabase = useDeleteDatabase();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteDatabase = () => {
    deleteDatabase.mutate(databaseId, {
      onSuccess: () => {
        toast.success('Database deleted');
        window.location.href = '/databases';
      },
      onError: (err: any) => toast.error(`Failed to delete database: ${err.message}`),
    });
  };

  return (
    <div className="space-y-4">
      <Card title="Danger Zone">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-small font-medium">Delete Database</p>
            <p className="text-small text-foreground-secondary">
              Permanently delete this database and all its data. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="danger"
            size="small"
            onClick={() => setShowDeleteConfirm(true)}
            icon={<Icon name="icon-trash" size={15} />}
          >
            Delete Database
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteDatabase}
        title="Delete Database"
        description={`Delete database "${dbInfo.name}"? All data will be permanently lost.`}
        confirmText="Delete"
        impact="high"
        loading={deleteDatabase.isPending}
      />
    </div>
  );
}