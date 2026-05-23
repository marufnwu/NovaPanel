import { useState } from 'react';
import {
  usePlugins,
  useCreatePlugin,
  useUpdatePlugin,
  useDeletePlugin,
  useTogglePlugin,
  type Plugin,
} from '../../api/hooks/plugins';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingPage } from '../../components/design-system/LoadingPage';
import { StatusBadge } from '../../components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  Power,
  Loader2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from '../../lib/toast';

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function PluginModal({
  initial, onClose, onSubmit, isPending,
}: {
  initial?: Plugin;
  onClose: () => void;
  onSubmit: (data: { name: string; version: string; description?: string; author?: string; manifest?: Record<string, unknown>; enabled?: boolean; config?: Record<string, unknown> }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    version: initial?.version ?? '',
    description: initial?.description ?? '',
    author: initial?.author ?? '',
    manifest: JSON.stringify(initial?.manifest ?? {}, null, 2),
    config: JSON.stringify(initial?.config ?? {}, null, 2),
  });

  const handleSubmit = () => {
    try {
      const manifest = JSON.parse(form.manifest || '{}');
      const config = JSON.parse(form.config || '{}');
      onSubmit({ name: form.name, version: form.version, description: form.description || undefined, author: form.author || undefined, manifest, enabled: true, config });
    } catch {
      toast.error('Invalid JSON in manifest or config fields');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit Plugin' : 'Install Plugin'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="pl-name">Name</Label><Input id="pl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-plugin" /></div>
          <div><Label htmlFor="pl-version">Version</Label><Input id="pl-version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" /></div>
          <div><Label htmlFor="pl-desc">Description</Label><Input id="pl-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Plugin description" /></div>
          <div><Label htmlFor="pl-author">Author</Label><Input id="pl-author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Author name" /></div>
          <div><Label htmlFor="pl-manifest">Manifest (JSON)</Label><textarea id="pl-manifest" value={form.manifest} onChange={(e) => setForm({ ...form, manifest: e.target.value })} rows={4} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder='{"key": "value"}' /></div>
          <div><Label htmlFor="pl-config">Config (JSON)</Label><textarea id="pl-config" value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder='{"setting": "value"}' /></div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.version.trim()}>{isPending ? 'Saving...' : initial ? 'Update' : 'Install'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PluginsPage() {
  const { data: plugins, isLoading } = usePlugins();
  const createPlugin = useCreatePlugin();
  const updatePlugin = useUpdatePlugin();
  const deletePlugin = useDeletePlugin();
  const togglePlugin = useTogglePlugin();

  const [showModal, setShowModal] = useState(false);
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = (data: { name: string; version: string; description?: string; author?: string; manifest?: Record<string, unknown>; enabled?: boolean; config?: Record<string, unknown> }) => {
    createPlugin.mutate(data, { onSuccess: () => { toast.success('Plugin installed'); setShowModal(false); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };

  const handleUpdate = (data: { name: string; version: string; description?: string; author?: string; manifest?: Record<string, unknown>; enabled?: boolean; config?: Record<string, unknown> }) => {
    if (!editPlugin) return;
    updatePlugin.mutate({ id: editPlugin.id, ...data }, { onSuccess: () => { toast.success('Plugin updated'); setEditPlugin(null); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePlugin.mutate(deleteId, { onSuccess: () => { toast.success('Plugin uninstalled'); setDeleteId(null); }, onError: (e: Error) => toast.error(e.message || 'Failed') });
  };

  const handleToggle = (plugin: Plugin) => {
    togglePlugin.mutate(plugin.id, { onSuccess: () => toast.success(plugin.enabled ? 'Plugin disabled' : 'Plugin enabled'), onError: (e: Error) => toast.error(e.message || 'Failed') });
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Plugins" description="Install and manage system plugins" icon={Package} />
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-2" /> Install Plugin</Button>
      </div>

      {showModal && <PluginModal onClose={() => setShowModal(false)} onSubmit={handleCreate} isPending={createPlugin.isPending} />}
      {editPlugin && <PluginModal initial={editPlugin} onClose={() => setEditPlugin(null)} onSubmit={handleUpdate} isPending={updatePlugin.isPending} />}

      <ConfirmDialog
        open={!!deleteId}
        title="Uninstall Plugin"
        message="This will permanently remove this plugin from the system. This action cannot be undone."
        confirmText="Uninstall"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {!plugins || plugins.length === 0 ? (
        <EmptyState icon={Package} title="No plugins installed" description="Install your first plugin to extend system functionality." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`rounded p-2 ${plugin.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Package className={`h-5 w-5 ${plugin.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="font-medium">{plugin.name}</div>
                    <div className="text-xs text-muted-foreground">v{plugin.version}</div>
                  </div>
                </div>
                <ToggleSwitch enabled={plugin.enabled} onChange={() => handleToggle(plugin)} />
              </div>
              <div className="p-4 space-y-3">
                {plugin.description && <p className="text-sm text-muted-foreground">{plugin.description}</p>}
                {plugin.author && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Author:</span> {plugin.author}
                  </div>
                )}
                {plugin.manifest && Object.keys(plugin.manifest).length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Manifest</div>
                    <pre className="text-xs font-mono bg-muted/50 rounded p-2 max-h-20 overflow-auto">{JSON.stringify(plugin.manifest, null, 2)}</pre>
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditPlugin(plugin)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(plugin.id)} className="hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}