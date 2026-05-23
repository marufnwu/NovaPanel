import { useState } from 'react';
import {
  useContainers,
  useCreateContainer,
  useDeleteContainer,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
  useContainerLogs,
  type Container,
} from '../../api/hooks/containers';
import { useAuthStore } from '../../store/auth.store';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Box,
  Plus,
  Trash2,
  Play,
  Square,
  RotateCcw,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from '../../lib/toast';

type ContainerType = 'compose' | 'dockerfile' | 'image';
type TabKey = 'containers' | 'logs';

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: 'compose', label: 'Docker Compose' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'image', label: 'Image' },
];

function CreateContainerModal({ onClose }: { onClose: () => void }) {
  const createContainer = useCreateContainer();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';
  const [form, setForm] = useState({
    name: '',
    type: 'compose' as ContainerType,
    composeFile: '',
    dockerfile: '',
    image: '',
  });

  const handleSubmit = () => {
    const payload: Parameters<typeof createContainer.mutate>[0] = {
      projectId,
      name: form.name,
      type: form.type,
    };
    if (form.type === 'compose') payload.composeFile = form.composeFile;
    if (form.type === 'dockerfile') payload.dockerfile = form.dockerfile;
    if (form.type === 'image') payload.image = form.image;

    createContainer.mutate(payload, {
      onSuccess: () => { toast.success('Container created'); onClose(); },
      onError: (e: Error) => toast.error(e.message || 'Failed to create container'),
    });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create Container</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="ctr-name">Name</Label><Input id="ctr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-app" /></div>
          <div>
            <Label>Type</Label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContainerType })} className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              {CONTAINER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {form.type === 'compose' && (
            <div><Label htmlFor="ctr-compose">Compose File (YAML)</Label><textarea id="ctr-compose" value={form.composeFile} onChange={(e) => setForm({ ...form, composeFile: e.target.value })} rows={6} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder="version: '3'&#10;services:&#10;  web:&#10;    image: nginx" /></div>
          )}
          {form.type === 'dockerfile' && (
            <div><Label htmlFor="ctr-df">Dockerfile</Label><textarea id="ctr-df" value={form.dockerfile} onChange={(e) => setForm({ ...form, dockerfile: e.target.value })} rows={6} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" placeholder="FROM node:20&#10;WORKDIR /app&#10;COPY package*.json ./&#10;RUN npm ci&#10;..." /></div>
          )}
          {form.type === 'image' && (
            <div><Label htmlFor="ctr-image">Image</Label><Input id="ctr-image" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="nginx:latest" /></div>
          )}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createContainer.isPending || !form.name.trim()}>
            {createContainer.isPending ? 'Creating...' : 'Create Container'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContainerLogsModal({ containerId, containerName, onClose }: { containerId: string; containerName: string; onClose: () => void }) {
  const { data, isLoading } = useContainerLogs(containerId);

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Logs — {containerName}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-auto bg-background rounded-md border p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{(data?.logs || 'No logs available.')}</pre>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



export function ContainersPage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';

  const { data: containers, isLoading } = useContainers(projectId);
  const createContainer = useCreateContainer();
  const deleteContainer = useDeleteContainer();
  const startContainer = useStartContainer();
  const stopContainer = useStopContainer();
  const restartContainer = useRestartContainer();

  const [tab, setTab] = useState<TabKey>('containers');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteContainerId, setDeleteContainerId] = useState<string | null>(null);
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);

  const viewLogsContainer = containers?.find((c) => c.id === viewLogsId);

  const handleDelete = () => {
    if (!deleteContainerId) return;
    deleteContainer.mutate(deleteContainerId, {
      onSuccess: () => { toast.success('Container deleted'); setDeleteContainerId(null); },
      onError: (e: Error) => toast.error(e.message || 'Failed to delete container'),
    });
  };

  const handleStart = (id: string) => {
    startContainer.mutate(id, { onSuccess: () => toast.success('Container started'), onError: (e: Error) => toast.error(e.message) });
  };

  const handleStop = (id: string) => {
    stopContainer.mutate(id, { onSuccess: () => toast.success('Container stopped'), onError: (e: Error) => toast.error(e.message) });
  };

  const handleRestart = (id: string) => {
    restartContainer.mutate(id, { onSuccess: () => toast.success('Container restarted'), onError: (e: Error) => toast.error(e.message) });
  };

  if (isLoading) return <LoadingPage />;

  const TABS: { key: TabKey; label: string; icon: typeof Box }[] = [
    { key: 'containers', label: 'Containers', icon: Box },
    { key: 'logs', label: 'Logs', icon: FileText },
  ];

  return (
    <div>
      <PageHeader title="Containers" description="Manage Docker containers and compose stacks" icon={Box} />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((t) => (
            <Button key={t.key} variant={tab === t.key ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t.key)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Container
        </Button>
      </div>

      {showCreateModal && <CreateContainerModal onClose={() => setShowCreateModal(false)} />}

      {viewLogsId && viewLogsContainer && (
        <ContainerLogsModal containerId={viewLogsId} containerName={viewLogsContainer.name} onClose={() => setViewLogsId(null)} />
      )}

      <ConfirmDialog
        open={!!deleteContainerId}
        title="Delete Container"
        message="This will permanently delete the container and all associated resources. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteContainerId(null)}
      />

      {tab === 'containers' && (
        containers?.length === 0 ? (
          <EmptyState icon={Box} title="No containers" description="Create your first container to get started." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers?.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground" /> {container.name}
                    </TableCell>
                    <TableCell><StatusBadge variant="neutral">{container.type}</StatusBadge></TableCell>
                    <TableCell><StatusBadge variant={container.status === 'running' ? 'success' : container.status === 'stopped' || container.status === 'exited' ? 'neutral' : 'destructive'}>{container.status}</StatusBadge></TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{container.image || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {container.status === 'running' ? (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleStop(container.id)} title="Stop"><Square className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleRestart(container.id)} title="Restart"><RotateCcw className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="icon-sm" onClick={() => handleStart(container.id)} title="Start"><Play className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => setViewLogsId(container.id)} title="Logs"><FileText className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteContainerId(container.id)} className="hover:bg-destructive/10 hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </div>
  );
}