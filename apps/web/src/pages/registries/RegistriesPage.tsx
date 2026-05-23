import { useState } from 'react';
import {
  useRegistries,
  useCreateRegistry,
  useUpdateRegistry,
  useDeleteRegistry,
  type Registry,
} from '../../api/hooks/registries';
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
  Container,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from '../../lib/toast';

const PROVIDER_LABELS: Record<string, string> = {
  dockerhub: 'Docker Hub',
  ghcr: 'GitHub Container Registry',
  ecr: 'Amazon ECR',
  gcr: 'Google Container Registry',
  selfhosted: 'Self-Hosted',
};

const PROVIDER_COLORS: Record<string, string> = {
  dockerhub: 'bg-blue-500/10 text-blue-500',
  ghcr: 'bg-gray-500/10 text-gray-400',
  ecr: 'bg-orange-500/10 text-orange-500',
  gcr: 'bg-green-500/10 text-green-500',
  selfhosted: 'bg-purple-500/10 text-purple-500',
};

function SecretField({ value, label }: { value: string; label: string }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono">{visible ? value : '••••••••'}</span>
      <button onClick={() => setVisible(!visible)} className="text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

function RegistryModal({
  initial,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: Registry;
  onClose: () => void;
  onSubmit: (data: { name: string; provider: Registry['provider']; url?: string; username?: string; password?: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    provider: initial?.provider ?? 'dockerhub' as Registry['provider'],
    url: initial?.url ?? '',
    username: initial?.username ?? '',
    password: '',
  });

  const handleSubmit = () => {
    onSubmit({
      name: form.name,
      provider: form.provider,
      url: form.url || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Registry' : 'Add Registry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reg-name">Name</Label>
            <Input id="reg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Registry" />
          </div>
          <div>
            <Label>Provider</Label>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value as Registry['provider'] })}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {form.provider === 'selfhosted' && (
            <div>
              <Label htmlFor="reg-url">Registry URL</Label>
              <Input id="reg-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://registry.example.com" />
            </div>
          )}
          <div>
            <Label htmlFor="reg-user">Username (optional)</Label>
            <Input id="reg-user" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" />
          </div>
          <div>
            <Label htmlFor="reg-pass">{initial ? 'New Password (leave blank to keep)' : 'Password (optional)'}</Label>
            <Input id="reg-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending ? 'Saving...' : initial ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegistriesPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const orgId = activeOrgId || 'default';

  const { data: registries, isLoading } = useRegistries();
  const createRegistry = useCreateRegistry();
  const updateRegistry = useUpdateRegistry();
  const deleteRegistry = useDeleteRegistry();

  const [showModal, setShowModal] = useState(false);
  const [editRegistry, setEditRegistry] = useState<Registry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = (data: { name: string; provider: Registry['provider']; url?: string; username?: string; password?: string }) => {
    createRegistry.mutate(
      { ...data, orgId },
      {
        onSuccess: () => { toast.success('Registry added'); setShowModal(false); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  const handleUpdate = (data: { name: string; provider: Registry['provider']; url?: string; username?: string; password?: string }) => {
    if (!editRegistry) return;
    updateRegistry.mutate(
      { id: editRegistry.id, name: data.name, url: data.url, username: data.username, password: data.password || undefined },
      {
        onSuccess: () => { toast.success('Registry updated'); setEditRegistry(null); },
        onError: (e: Error) => toast.error(e.message || 'Failed'),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteRegistry.mutate(deleteId, {
      onSuccess: () => { toast.success('Registry deleted'); setDeleteId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed'),
    });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader
        title="Container Registries"
        icon={Container}
      />

      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Registry
        </Button>
      </div>

      {showModal && (
        <RegistryModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          isPending={createRegistry.isPending}
        />
      )}
      {editRegistry && (
        <RegistryModal
          initial={editRegistry}
          onClose={() => setEditRegistry(null)}
          onSubmit={handleUpdate}
          isPending={updateRegistry.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Registry"
        message="This will permanently delete this registry. Sites currently using images from this registry may fail to deploy."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {!registries || registries.length === 0 ? (
        <EmptyState
          icon={Container}
          title="No registries"
          description="Add a container registry to pull images for your sites."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registries.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.name}</TableCell>
                  <TableCell>
                    <Badge className={PROVIDER_COLORS[reg.provider]}>
                      {PROVIDER_LABELS[reg.provider] ?? reg.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{reg.url ?? '—'}</TableCell>
                  <TableCell><SecretField value={reg.username ?? ''} label="Username" /></TableCell>
                  <TableCell><SecretField value={reg.password ?? ''} label="Password" /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(reg.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditRegistry(reg)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(reg.id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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