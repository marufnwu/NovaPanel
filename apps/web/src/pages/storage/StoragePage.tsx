import { useState } from 'react';
import {
  useBuckets,
  useCreateBucket,
  useDeleteBucket,
  useAccessKeys,
  useCreateAccessKey,
  useDeleteAccessKey,
  type Bucket,
} from '../../api/hooks/storage';
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
  HardDrive,
  Plus,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Globe,
  Loader2,
} from 'lucide-react';
import { toast } from '../../lib/toast';

type TabKey = 'buckets' | 'keys';

function CreateBucketModal({ onClose }: { onClose: () => void }) {
  const createBucket = useCreateBucket();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';
  const [form, setForm] = useState({ name: '', region: '', publicAccess: false, versioning: false });

  const handleSubmit = () => {
    createBucket.mutate(
      { projectId, name: form.name, region: form.region || undefined, publicAccess: form.publicAccess, versioning: form.versioning },
      { onSuccess: () => { toast.success('Bucket created'); onClose(); }, onError: (e: Error) => toast.error(e.message || 'Failed') }
    );
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Bucket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="bk-name">Name</Label><Input id="bk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-bucket" /></div>
          <div><Label htmlFor="bk-region">Region (optional)</Label><Input id="bk-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="us-east-1" /></div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Public Access</span>
            <button onClick={() => setForm({ ...form, publicAccess: !form.publicAccess })} className={`relative h-6 w-11 rounded-full transition-colors ${form.publicAccess ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.publicAccess ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Versioning</span>
            <button onClick={() => setForm({ ...form, versioning: !form.versioning })} className={`relative h-6 w-11 rounded-full transition-colors ${form.versioning ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.versioning ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createBucket.isPending || !form.name.trim()}>
            {createBucket.isPending ? 'Creating...' : 'Create Bucket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAccessKeyModal({ onClose }: { onClose: () => void }) {
  const createKey = useCreateAccessKey();
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';
  const [form, setForm] = useState({ name: '' });

  const handleSubmit = () => {
    createKey.mutate(
      { projectId, name: form.name },
      { onSuccess: () => { toast.success('Access key created'); onClose(); }, onError: (e: Error) => toast.error(e.message || 'Failed') }
    );
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Access Key</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label htmlFor="ak-name">Name</Label><Input id="ak-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production key" /></div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createKey.isPending || !form.name.trim()}>
            {createKey.isPending ? 'Creating...' : 'Create Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoragePage() {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const projectId = activeOrgId || 'default';

  const { data: buckets, isLoading: bucketsLoading } = useBuckets(projectId);
  const { data: accessKeys, isLoading: keysLoading } = useAccessKeys(projectId);
  const deleteBucket = useDeleteBucket();
  const deleteKey = useDeleteAccessKey();

  const [tab, setTab] = useState<TabKey>('buckets');
  const [showBucketModal, setShowBucketModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [deleteBucketId, setDeleteBucketId] = useState<string | null>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  const handleDeleteBucket = () => {
    if (!deleteBucketId) return;
    deleteBucket.mutate(deleteBucketId, { onSuccess: () => { toast.success('Bucket deleted'); setDeleteBucketId(null); }, onError: (e: Error) => toast.error(e.message) });
  };

  const handleDeleteKey = () => {
    if (!deleteKeyId) return;
    deleteKey.mutate(deleteKeyId, { onSuccess: () => { toast.success('Access key deleted'); setDeleteKeyId(null); }, onError: (e: Error) => toast.error(e.message) });
  };

  if (bucketsLoading || keysLoading) return <LoadingPage />;

  const TABS: { key: TabKey; label: string; icon: typeof HardDrive }[] = [
    { key: 'buckets', label: 'Buckets', icon: HardDrive },
    { key: 'keys', label: 'Access Keys', icon: Key },
  ];

  return (
    <div>
      <PageHeader title="Storage" description="Manage object storage buckets and access keys" icon={HardDrive} />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((t) => (
            <Button key={t.key} variant={tab === t.key ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t.key)}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Button>
          ))}
        </div>
        {tab === 'buckets' && <Button onClick={() => setShowBucketModal(true)}><Plus className="mr-2 h-4 w-4" /> Add Bucket</Button>}
        {tab === 'keys' && <Button onClick={() => setShowKeyModal(true)}><Plus className="mr-2 h-4 w-4" /> Add Key</Button>}
      </div>

      {showBucketModal && <CreateBucketModal onClose={() => setShowBucketModal(false)} />}
      {showKeyModal && <CreateAccessKeyModal onClose={() => setShowKeyModal(false)} />}

      <ConfirmDialog
        open={!!deleteBucketId}
        title="Delete Bucket"
        message="This will permanently delete the bucket and all its objects. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteBucket}
        onCancel={() => setDeleteBucketId(null)}
      />

      <ConfirmDialog
        open={!!deleteKeyId}
        title="Delete Access Key"
        message="This will permanently delete this access key. Applications using it will lose access."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteKey}
        onCancel={() => setDeleteKeyId(null)}
      />

      {tab === 'buckets' && (
        buckets?.length === 0 ? (
          <EmptyState icon={HardDrive} title="No buckets" description="Create your first storage bucket to get started." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Versioning</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets?.map((bucket) => (
                  <TableRow key={bucket.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" /> {bucket.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{bucket.region || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge variant={bucket.publicAccess ? 'success' : 'neutral'}>
                        {bucket.publicAccess ? 'Public' : 'Private'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={bucket.versioning ? 'success' : 'neutral'}>
                        {bucket.versioning ? 'Enabled' : 'Disabled'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteBucketId(bucket.id)} className="hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {tab === 'keys' && (
        accessKeys?.length === 0 ? (
          <EmptyState icon={Key} title="No access keys" description="Create your first access key to interact with storage." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Access Key</TableHead>
                  <TableHead>Secret Key</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessKeys?.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">{key.accessKey}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {showSecret === key.id ? key.secretKey : '••••••••••••••••'}
                      <button onClick={() => setShowSecret(showSecret === key.id ? null : key.id)} className="ml-2 text-muted-foreground hover:text-foreground">
                        {showSecret === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteKeyId(key.id)} className="hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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