import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDatabases, useDatabaseInfo, useCreateDatabase, useDeleteDatabase, useCreateDbUser, useDeleteDbUser, useExportDatabase, useImportDatabase, useRepairDatabase, useOptimizeDatabase, useCloneDatabase, useRunQuery, useChangeDbPassword } from '../../api/hooks/databases';
import type { Database } from '../../api/hooks/databases';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { ActionDropdown } from '../../components/ui/ActionDropdown';
import { Database as DatabaseIcon, Plus, Trash2, Download, UserPlus, Server, Search, Play, Copy, X, ArrowLeft, Table2, KeyRound, ShieldOff, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

function CreateDbModal({ onClose }: { onClose: () => void }) {
  const createDb = useCreateDatabase();
  const [form, setForm] = useState({ name: '', engine: 'mariadb' as const, charset: 'utf8mb4' });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createDb.mutate(form, {
      onSuccess: () => {
        onClose();
        setForm({ name: '', engine: 'mariadb', charset: 'utf8mb4' });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Database</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Database Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my_database" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Engine</label>
            <select value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value as any })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="mariadb">MariaDB</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Charset</label>
            <select value={form.charset} onChange={(e) => setForm({ ...form, charset: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="utf8mb4">utf8mb4 (Recommended)</option>
              <option value="latin1">latin1</option>
              <option value="utf8">utf8</option>
            </select>
          </div>
          {createDb.error && <p className="text-sm text-destructive">{String(createDb.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={createDb.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createDb.isPending ? 'Creating...' : 'Create Database'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateUserModal({ databaseId, onClose }: { databaseId: string; onClose: () => void }) {
  const createUser = useCreateDbUser();
  const [form, setForm] = useState({ username: '', password: '', host: 'localhost' });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (!form.username.trim() || !form.password) return;
    createUser.mutate({ databaseId, username: form.username, password: form.password, host: form.host }, {
      onSuccess: () => {
        onClose();
        setForm({ username: '', password: '', host: 'localhost' });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add Database User</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="db_user" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Host</label>
            <select value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="localhost">localhost</option>
              <option value="%">Any host (%)</option>
            </select>
          </div>
          {createUser.error && <p className="text-sm text-destructive">{String(createUser.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={createUser.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createUser.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChangePasswordModal({ databaseId, userId, username, onClose }: { databaseId: string; userId: string; username: string; onClose: () => void }) {
  const changePassword = useChangeDbPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = () => {
    if (!newPassword || newPassword !== confirmPassword) return;
    changePassword.mutate(
      { dbId: databaseId, userId, password: newPassword },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Change Password — {username}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && !passwordLongEnough && (
              <p className="mt-1 text-xs text-destructive">Password must be at least 8 characters</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          {(changePassword.error as any) && (
            <p className="text-sm text-destructive">{(changePassword.error as any).message}</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={changePassword.isPending || !passwordsMatch || !passwordLongEnough}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloneModal({ databaseId, engine, onClose }: { databaseId: string; engine: string; onClose: () => void }) {
  const clone = useCloneDatabase();
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    clone.mutate({ dbId: databaseId, newName: name }, {
      onSuccess: () => {
        onClose();
        setName('');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Clone Database</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Creates a new {engine} database with the same data as the source.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">New Database Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my_database_clone" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {clone.error && <p className="text-sm text-destructive">{String(clone.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={clone.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {clone.isPending ? 'Cloning...' : 'Clone Database'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueryModal({ databaseId, engine }: { databaseId: string; engine: string }) {
  const runQuery = useRunQuery();
  const [sql, setSql] = useState('SELECT 1;');
  const [results, setResults] = useState<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = () => {
    if (!sql.trim()) return;
    setError(null);
    setResults(null);
    runQuery.mutate({ dbId: databaseId, sql }, {
      onSuccess: (data) => {
        setResults(data);
      },
      onError: (err: any) => {
        setError(err?.message || 'Query failed');
      },
    });
  };

  const handleCopyResults = () => {
    if (!results) return;
    const text = JSON.stringify(results.rows, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[80vh] w-full max-w-5xl rounded-lg border border-border bg-card p-6 shadow-lg flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Table2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">SQL Query — {engine}</h3>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('close-db-modal'))} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-4 flex gap-2">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            rows={4}
            placeholder="SELECT * FROM table_name LIMIT 10;"
          />
          <div className="flex flex-col gap-2">
            <button onClick={handleExecute} disabled={runQuery.isPending || !sql.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              <Play className="h-4 w-4" /> Execute
            </button>
            {results && (
              <button onClick={handleCopyResults} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent flex items-center gap-2">
                <Copy className="h-4 w-4" /> Copy
              </button>
            )}
          </div>
        </div>
        {error && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}
        {runQuery.isPending && <div className="py-4 text-center text-sm text-muted-foreground">Executing query...</div>}
        {results && (
          <div className="flex-1 overflow-auto rounded-md border border-border">
            <div className="p-2 text-sm text-muted-foreground border-b border-border bg-muted/30">{results.rowCount} row(s) returned</div>
            {results.rows.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    {Object.keys(results.rows[0]).map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2">{String(val ?? 'NULL')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No results</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DbDetailModal({ database, onBack }: { database: Database; onBack: () => void }) {
  const { data: info, isLoading } = useDatabaseInfo(database.id);
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
    exportDb.mutate(database.id, {
      onSuccess: (data) => {
        const blob = new Blob([data.sql || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${database.name}.sql`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const handleImport = () => {
    if (!importSql.trim()) return;
    importDb.mutate({ dbId: database.id, sql: importSql }, {
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
      message: `Run repair on database '${database.name}'? This may take a while for large databases.`,
      variant: 'warning',
      onConfirm: () => repair.mutate(database.id),
    });
  };

  const handleOptimize = () => {
    setConfirmDialog({
      open: true,
      title: 'Optimize Database',
      message: `Run optimization on database '${database.name}'? This may take a while for large databases.`,
      variant: 'warning',
      onConfirm: () => optimize.mutate(database.id),
    });
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded p-1 hover:bg-accent"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="text-xl font-semibold">{database.name}</h2>
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary uppercase">{database.engine}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Size</div>
          <div className="mt-1 text-2xl font-semibold">{info?.sizeMb ? `${info.sizeMb} MB` : '—'}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Engine</div>
          <div className="mt-1 text-lg font-semibold capitalize">{database.engine}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Charset</div>
          <div className="mt-1 text-lg font-semibold">{database.charset || 'utf8mb4'}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Users</div>
          <div className="mt-1 text-lg font-semibold">{info?.users?.length || 0}</div>
        </div>
      </div>

      {/* Actions */}
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
        <button onClick={handleRepair} disabled={repair.isPending || database.engine !== 'mariadb'} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
          <Server className="h-4 w-4" /> Repair
        </button>
        <button onClick={handleOptimize} disabled={optimize.isPending} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
          <Server className="h-4 w-4" /> Optimize
        </button>
        <button onClick={() => setShowClone(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Copy className="h-4 w-4" /> Clone
        </button>
      </div>

      {/* Users */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Database Users</h3>
        </div>
        {info?.users && info.users.length > 0 ? (
          <ResponsiveTable>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setChangePasswordUser({ id: u.id, username: u.username })}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Change password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: 'Revoke User Access',
                              message: `Revoke access for user "${u.username}" from database "${database.name}"?`,
                              variant: 'warning',
                              onConfirm: () => deleteUser.mutate({ dbId: database.id, userId: u.id }),
                            });
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500"
                          title="Revoke access from this database"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: 'Delete Database User',
                              message: `Delete user "${u.username}" entirely? This will remove the user from all databases.`,
                              variant: 'danger',
                              onConfirm: () => deleteUser.mutate({ dbId: database.id, userId: u.id }),
                            });
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        ) : (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">No users yet</div>
        )}
      </div>

      {showClone && <CloneModal databaseId={database.id} engine={database.engine} onClose={() => setShowClone(false)} />}
      {changePasswordUser && (
        <ChangePasswordModal
          databaseId={database.id}
          userId={changePasswordUser.id}
          username={changePasswordUser.username}
          onClose={() => setChangePasswordUser(null)}
        />
      )}
      {showQuery && <QueryModal databaseId={database.id} engine={database.engine} />}
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
    </div>
    <ConfirmDialog
      open={confirmDialog.open}
      onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
      onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      title={confirmDialog.title}
      message={confirmDialog.message}
      variant={confirmDialog.variant}
    />
    </>
  );
}

export function DatabasesPage() {
  const navigate = useNavigate();
  const { data: databases, isLoading, isError, refetch } = useDatabases();
  const deleteDb = useDeleteDatabase();
  const [showCreate, setShowCreate] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [userDbId, setUserDbId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Database | null>(null);

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div>
        <PageHeader title="Databases" description="Manage MySQL and PostgreSQL databases" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load databases</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching databases.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Databases" description="Manage MySQL and PostgreSQL databases" actions={
        <div className="flex gap-2">
          <button onClick={() => setShowUser(!showUser)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            <UserPlus className="h-4 w-4" /> Add User
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create Database
          </button>
        </div>
      } />

      {showCreate && <CreateDbModal onClose={() => setShowCreate(false)} />}
      {showUser && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6">
          <div className="flex gap-3">
            <select value={userDbId} onChange={(e) => setUserDbId(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select database...</option>
              {databases?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {userDbId && <button onClick={() => { setShowUser(false); setUserDbId(''); }} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
              <UserPlus className="h-4 w-4 inline mr-1" /> Add User
            </button>}
          </div>
        </div>
      )}

      {showUser && userDbId && (
        <CreateUserModal databaseId={userDbId} onClose={() => { setShowUser(false); setUserDbId(''); }} />
      )}

      {!databases?.length ? (
        <EmptyState icon={DatabaseIcon} title="No databases" description="Create your first database to get started." />
      ) : (
        <div className="space-y-6">
          <ResponsiveTable>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Engine</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate({ to: '/databases/$id', params: { id: d.id } })} className="font-medium hover:text-primary">{d.name}</button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground uppercase">{d.engine}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ActionDropdown
                          items={[
                            { label: 'View Details', icon: <Eye className="h-3.5 w-3.5" />, onClick: () => navigate({ to: '/databases/$id', params: { id: d.id } }) },
                            { label: 'Delete', icon: <Trash2 className="h-3.5 w-3.5" />, variant: 'danger', onClick: () => setDeleteTarget(d) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={() => {
          if (deleteTarget) deleteDb.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Database"
        message={`This will permanently delete the database '${deleteTarget?.name}' and all its data. This cannot be undone.`}
        confirmText="Delete Database"
        variant="danger"
      />
    </div>
  );
}
