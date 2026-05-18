import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDatabaseInfo, useDeleteDbUser, useExportDatabase, useImportDatabase, useRepairDatabase, useOptimizeDatabase, useRunQuery, useCloneDatabase, useChangeDbPassword, useDatabases } from '../../api/hooks/databases';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ActionDropdown } from '../../components/ui/ActionDropdown';
import { CopyButton } from '../../components/ui/CopyButton';
import { Database, Download, Plus, Search, Server, Copy, Trash2, X, ArrowLeft, KeyRound, ShieldOff } from 'lucide-react';
import { toast } from '../../lib/toast';

interface DatabaseDetailPageProps {
  databaseId: string;
}

function QueryModal({ databaseId, engine }: { databaseId: string; engine: string }) {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<any>(null);
  const runQuery = useRunQuery();

  const handleRun = () => {
    if (!sql.trim()) return;
    runQuery.mutate({ dbId: databaseId, sql }, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Run Query</h3>
        <button onClick={() => setResult(null)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
      </div>
      <textarea value={sql} onChange={(e) => setSql(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" rows={6} placeholder="SELECT * FROM ..." />
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={() => { setSql(''); setResult(null); }} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Clear</button>
        <button onClick={handleRun} disabled={runQuery.isPending || !sql.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {runQuery.isPending ? 'Running...' : 'Run Query'}
        </button>
      </div>
      {result && (
        <div className="mt-4 rounded border border-border bg-muted/50 p-4">
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function CloneModal({ databaseId, engine, onClose }: { databaseId: string; engine: string; onClose: () => void }) {
  const clone = useCloneDatabase();
  const [newName, setNewName] = useState('');

  const handleClone = () => {
    if (!newName.trim()) return;
    clone.mutate({ dbId: databaseId, newName }, {
      onSuccess: () => { toast.success('Database cloned successfully'); onClose(); },
      onError: (e: Error) => { toast.error(e.message || 'Clone failed'); },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Clone Database</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
      </div>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="New database name" />
      {clone.error && <p className="mt-2 text-sm text-destructive">{String(clone.error)}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
        <button onClick={handleClone} disabled={clone.isPending || !newName.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {clone.isPending ? 'Cloning...' : 'Clone'}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordModal({ databaseId, userId, username, onClose }: { databaseId: string; userId: string; username: string; onClose: () => void }) {
  const changePw = useChangeDbPassword();
  const [password, setPassword] = useState('');

  const handleChange = () => {
    if (!password.trim()) return;
    changePw.mutate({ dbId: databaseId, userId, password }, {
      onSuccess: () => { toast.success('Password updated'); onClose(); },
      onError: (e: Error) => { toast.error(e.message || 'Failed to update password'); },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Change Password for {username}</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
      </div>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="New password" />
      {changePw.error && <p className="mt-2 text-sm text-destructive">{String(changePw.error)}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
        <button onClick={handleChange} disabled={changePw.isPending || !password.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {changePw.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function DatabaseDetailPage({ databaseId }: DatabaseDetailPageProps) {
  const navigate = useNavigate();
  const { data: info, isLoading } = useDatabaseInfo(databaseId);
  const { data: databases } = useDatabases();
  const database = databases?.find(d => d.id === databaseId);
  const databaseName = database?.name ?? info?.name ?? databaseId;
  const databaseEngine = database?.engine ?? info?.engine ?? 'mariadb';
  const databaseCharset = database?.charset ?? info?.charset ?? 'utf8mb4';
  const deleteUser = useDeleteDbUser();
  const exportDb = useExportDatabase();
  const importDb = useImportDatabase();
  const repair = useRepairDatabase();
  const optimize = useOptimizeDatabase();
  const [showClone, setShowClone] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState<{ id: string; username: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; variant: 'danger' | 'warning' }>({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'warning' });

  const handleExport = () => {
    exportDb.mutate(databaseId, {
      onSuccess: (data) => {
        const blob = new Blob([data.sql || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${databaseName}.sql`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const handleImport = () => {
    if (!importSql.trim()) return;
    importDb.mutate({ dbId: databaseId, sql: importSql }, {
      onSuccess: () => {
        setShowImport(false);
        setImportSql('');
      },
    });
  };

  const handleRepair = () => {
    setConfirmDialog({
      open: true,
      title: 'Repair Database',
      message: `Run repair on database '${databaseName}'? This may take a while for large databases.`,
      variant: 'warning',
      onConfirm: () => repair.mutate(databaseId),
    });
  };

  const handleOptimize = () => {
    setConfirmDialog({
      open: true,
      title: 'Optimize Database',
      message: `Run optimization on database '${databaseName}'? This may take a while for large databases.`,
      variant: 'warning',
      onConfirm: () => optimize.mutate(databaseId),
    });
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/databases' })} className="rounded p-1 hover:bg-accent"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="text-xl font-semibold">{databaseName}</h2>
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary uppercase">{databaseEngine}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Size</div>
          <div className="mt-1 text-2xl font-semibold">{info?.sizeMb ? `${info.sizeMb} MB` : '—'}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Engine</div>
          <div className="mt-1 text-lg font-semibold capitalize">{databaseEngine}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Charset</div>
          <div className="mt-1 text-lg font-semibold">{databaseCharset || 'utf8mb4'}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Users</div>
          <div className="mt-1 text-lg font-semibold">{info?.users?.length || 0}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Connection String</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-xs font-mono truncate max-w-[200px]">
              {databaseEngine === 'mariadb' ? 'mysql' : 'postgresql'}://{info?.users?.[0]?.username || 'user'}:****@host:3306/{databaseName}
            </code>
            <CopyButton
              value={`${databaseEngine === 'mariadb' ? 'mysql' : 'postgresql'}://${info?.users?.[0]?.username || 'user'}:<password>@<host>:${databaseEngine === 'mariadb' ? 3306 : 5432}/${databaseName}`}
              label="Copy"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowQuery(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Search className="h-4 w-4" /> Query
        </button>
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={() => setShowImport(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Plus className="h-4 w-4" /> Import SQL
        </button>
        <button onClick={handleRepair} disabled={repair.isPending || databaseEngine !== 'mariadb'} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
          <Server className="h-4 w-4" /> Repair
        </button>
        <button onClick={handleOptimize} disabled={optimize.isPending} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
          <Server className="h-4 w-4" /> Optimize
        </button>
        <button onClick={() => setShowClone(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Copy className="h-4 w-4" /> Clone
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Database Users</h3>
        </div>
        {info?.users && info.users.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Username</th>
                  <th className="px-4 py-2 text-left font-medium">Host</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {info.users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{u.username}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.host}</td>
                    <td className="px-4 py-2 text-right">
                      <ActionDropdown
                        items={[
                          { label: 'Change Password', icon: <KeyRound className="h-3.5 w-3.5" />, onClick: () => setChangePasswordUser({ id: u.id, username: u.username }) },
                          { label: 'Revoke Access', icon: <ShieldOff className="h-3.5 w-3.5" />, onClick: () => {
                            setConfirmDialog({
                              open: true,
                              title: 'Revoke User Access',
                              message: `Revoke access for user "${u.username}" from database "${databaseName}"?`,
                              variant: 'warning',
                              onConfirm: () => deleteUser.mutate({ dbId: databaseId, userId: u.id }),
                            });
                          }},
                          { label: 'Delete User', icon: <Trash2 className="h-3.5 w-3.5" />, variant: 'danger', onClick: () => {
                            setConfirmDialog({
                              open: true,
                              title: 'Delete Database User',
                              message: `Delete user "${u.username}" entirely? This will remove the user from all databases.`,
                              variant: 'danger',
                              onConfirm: () => deleteUser.mutate({ dbId: databaseId, userId: u.id }),
                            });
                          }},
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">No users yet</div>
        )}
      </div>

      {showClone && <CloneModal databaseId={databaseId} engine={databaseEngine} onClose={() => setShowClone(false)} />}
      {changePasswordUser && (
        <ChangePasswordModal
          databaseId={databaseId}
          userId={changePasswordUser.id}
          username={changePasswordUser.username}
          onClose={() => setChangePasswordUser(null)}
        />
      )}
      {showQuery && <QueryModal databaseId={databaseId} engine={databaseEngine} />}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import SQL</h3>
              <button onClick={() => setShowImport(false)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <textarea value={importSql} onChange={(e) => setImportSql(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" rows={8} placeholder="CREATE TABLE..." />
            {importDb.error && <p className="mt-2 text-sm text-destructive">{String(importDb.error)}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleImport} disabled={importDb.isPending || !importSql.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {importDb.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />
    </div>
  );
}