import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDatabases, useCreateDatabase, useDeleteDatabase, type Database } from '../../api/hooks/databases';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTableV2 } from '@/components/design-system/DataTableV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Database as DatabaseIcon, Plus, Trash2, Server, Loader2, HardDrive
} from 'lucide-react';
import { toast } from '../../lib/toast';

function CreateDbModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createDb = useCreateDatabase();
  const [form, setForm] = useState({ name: '', engine: 'mariadb' as const, charset: 'utf8mb4' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createDb.mutate(form, { onSuccess: () => { toast.success(`Database "${form.name}" created`); onClose(); }, onError: (err: any) => toast.error(err?.message || 'Failed to create database') });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Database</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Database Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my_database" />
          </div>
          <div className="space-y-1.5">
            <Label>Engine</Label>
            <select
              value={form.engine}
              onChange={(e) => setForm({ ...form, engine: e.target.value as any })}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="mariadb">MariaDB</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Charset</Label>
            <select
              value={form.charset}
              onChange={(e) => setForm({ ...form, charset: e.target.value })}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="utf8mb4">utf8mb4 (Recommended)</option>
              <option value="latin1">latin1</option>
              <option value="utf8">utf8</option>
            </select>
          </div>
          {createDb.error && <p className="text-sm text-destructive">{String(createDb.error)}</p>}
          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createDb.isPending}>
              {createDb.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {createDb.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DatabasesPage() {
  const { data: result, isLoading } = useDatabases();
  const databases = (result as any)?.items || result || [];
  const deleteDb = useDeleteDatabase();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteDb.mutate(id, { onSuccess: () => { toast.success('Database deleted'); setDeleteId(null); }, onError: () => toast.error('Failed') });
  };

  const columns: ColumnDef<Database>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => (
      <span className="flex items-center gap-2 font-medium"><DatabaseIcon className="h-4 w-4 text-muted-foreground" />{row.original.name}</span>
    )},
    { accessorKey: 'engine', header: 'Engine', cell: ({ row }) => <StatusBadge variant="info">{row.original.engine || 'mariadb'}</StatusBadge> },
    { accessorKey: 'charset', header: 'Charset', cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.charset || 'utf8mb4'}</span> },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: `/protected/databases/${row.original.id}` } as any)}><Server className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
    ), enableSorting: false },
  ];

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader
        title="Databases"
        description="Manage MariaDB and PostgreSQL databases"
        icon={HardDrive}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-1.5" />
            Create Database
          </Button>
        }
      />
      {!databases?.length ? (
        <DataTableV2 columns={[]} data={[]} emptyIcon={DatabaseIcon} emptyTitle="No databases yet" emptyDescription="Create your first database to get started." />
      ) : (
        <DataTableV2 columns={columns} data={databases} searchKey="name" searchPlaceholder="Search databases..." emptyIcon={DatabaseIcon} emptyTitle="No databases yet" emptyDescription="Create your first database to get started." />
      )}
      <CreateDbModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Database"
        message="All data will be permanently lost. This cannot be undone."
        confirmText="Delete"
        variant="danger"
        requireTyping="DELETE"
      />
    </div>
  );
}