import { useState } from 'react';
import { Database as DatabaseIcon, Search, Download, Plus, Server, Copy, X, ArrowLeft, Loader2, Table2, KeyRound, ShieldOff } from 'lucide-react';
import { useDatabaseInfo, useDeleteDbUser, useExportDatabase, useChangeDbPassword } from '../../api/hooks/databases';
import type { Database } from '../../api/hooks/databases';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ResponsiveTable } from '../ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import { DbUserList } from './DbUserList';
import { ChangePasswordModal } from './ChangePasswordModal';

interface DatabaseInfoProps {
  database: Database;
  onBack: () => void;
}

export function DatabaseInfo({ database, onBack }: DatabaseInfoProps) {
  const { data: info, isLoading } = useDatabaseInfo(database.id);
  const deleteUser = useDeleteDbUser();
  const exportDb = useExportDatabase();
  const [showQuery, setShowQuery] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSql, setImportSql] = useState('');
  const [changePasswordUser, setChangePasswordUser] = useState<{ id: string; username: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ userId: string; username: string; action: 'revoke' | 'delete' } | null>(null);

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

  if (isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;

  return (
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
      </div>

      <DbUserList
        databaseId={database.id}
        users={info?.users || []}
        onChangePassword={(user) => setChangePasswordUser({ id: user.id, username: user.username })}
        onRevokeUser={(user) => setShowDeleteConfirm({ userId: user.id, username: user.username, action: 'revoke' })}
        onDeleteUser={(user) => setShowDeleteConfirm({ userId: user.id, username: user.username, action: 'delete' })}
      />

      {changePasswordUser && (
        <ChangePasswordModal
          databaseId={database.id}
          userId={changePasswordUser.id}
          username={changePasswordUser.username}
          onClose={() => setChangePasswordUser(null)}
        />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import SQL</h3>
              <button onClick={() => setShowImport(false)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <textarea value={importSql} onChange={(e) => setImportSql(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" rows={8} placeholder="CREATE TABLE..." />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={() => { /* Import logic here */ setShowImport(false); }} disabled={!importSql.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}