import { useState, useEffect } from 'react';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useBackupSchedules,
  useCreateBackupSchedule,
  useDeleteBackupSchedule,
  useToggleBackupSchedule,
  useDownloadBackup,
  useVerifyBackup,
  useRemoteStorageConfig,
  useUpdateRemoteStorage,
  type Backup,
  type BackupSchedule,
  type BackupVerifyResult,
  type RemoteStorageConfig,
} from '../../api/hooks/backup';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  Archive, Plus, Trash2, RotateCcw, Clock, ToggleLeft, ToggleRight,
  X, Download, Shield, CheckCircle2, XCircle, RefreshCw, HardDrive,
  Cloud, Server, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* ------------------------------------------------------------------ */
/*  Backup Progress Modal                                              */
/* ------------------------------------------------------------------ */
const BACKUP_STEPS = [
  'Preparing...',
  'Compressing files...',
  'Exporting databases...',
  'Finalizing...',
];

function BackupProgressModal({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [complete, setComplete] = useState(false);

  // Simulate progress steps with proper cleanup
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < BACKUP_STEPS.length) {
        setCurrentStep(step);
      } else {
        setComplete(true);
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Creating Backup</h3>
          {complete && (
            <button onClick={onClose} className="rounded p-1 hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4 h-2 w-full rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              complete ? 'bg-green-500' : 'bg-primary'
            }`}
            style={{ width: `${complete ? 100 : ((currentStep + 1) / BACKUP_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-3">
          {BACKUP_STEPS.map((step, idx) => {
            const isActive = idx === currentStep && !complete;
            const isDone = idx < currentStep || complete;
            return (
              <div key={step} className="flex items-center gap-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  isDone ? 'bg-green-500 text-white' :
                  isActive ? 'bg-primary text-primary-foreground animate-pulse' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className={`text-sm ${isDone ? 'text-green-600' : isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
                {isActive && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-primary" />}
              </div>
            );
          })}
        </div>

        {complete && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Backup created successfully!
          </div>
        )}

        {complete && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Backup Modal                                                */
/* ------------------------------------------------------------------ */
function CreateBackupModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBackup();
  const [type, setType] = useState<Backup['type']>('full');
  const [encrypted, setEncrypted] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [showEncryptionPassword, setShowEncryptionPassword] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const handleSubmit = () => {
    create.mutate(
      { type, encrypted, encryptionPassword: encrypted ? encryptionPassword : undefined },
      {
        onSuccess: () => {
          setShowProgress(true);
        },
      },
    );
  };

  const types = [
    { value: 'full', label: 'Full Backup', desc: 'Files + Databases + DNS + Mail + Config' },
    { value: 'files', label: 'Files Only', desc: 'Website files and directories' },
    { value: 'database', label: 'Database Only', desc: 'MySQL and PostgreSQL databases' },
    { value: 'dns', label: 'DNS Only', desc: 'DNS zone configurations' },
    { value: 'mail', label: 'Mail Only', desc: 'Mailboxes and configurations' },
    { value: 'config', label: 'Config Only', desc: 'Server and domain configurations' },
  ];

  if (showProgress) {
    return <BackupProgressModal onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Backup</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          {types.map(t => (
            <button key={t.value} onClick={() => setType(t.value as Backup['type'])} className={`w-full rounded-lg border p-4 text-left transition-colors ${type === t.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
              <div className="font-medium">{t.label}</div>
              <div className="text-sm text-muted-foreground">{t.desc}</div>
            </button>
          ))}

          {/* Encryption Toggle */}
          <div className="rounded-lg border border-border p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={encrypted}
                onChange={e => setEncrypted(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Shield className="h-4 w-4" /> Encrypt backup
                </div>
                <div className="text-xs text-muted-foreground">
                  Protect backup with a password (AES-256)
                </div>
              </div>
            </label>
            {encrypted && (
              <div className="mt-3 border-t border-border pt-3">
                <label className="mb-1 block text-sm font-medium">Encryption Password</label>
                <div className="relative">
                  <input
                    type={showEncryptionPassword ? 'text' : 'password'}
                    value={encryptionPassword}
                    onChange={e => setEncryptionPassword(e.target.value)}
                    placeholder="Enter encryption password"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                  />
                  <button type="button" onClick={() => setShowEncryptionPassword(!showEncryptionPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showEncryptionPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ⚠️ You will need this password to restore the backup. Store it safely.
                </p>
              </div>
            )}
          </div>

          {create.error && <p className="text-sm text-destructive">{String(create.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending || (encrypted && !encryptionPassword)}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Start Backup'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Restore Modal                                                      */
/* ------------------------------------------------------------------ */
function RestoreModal({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const restore = useRestoreBackup();
  const [options, setOptions] = useState({ files: true, databases: true, dns: true });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRestore = () => {
    restore.mutate({ id: backup.id, options }, { onSuccess: () => { onClose(); } });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Restore Backup</h3>
            <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Select what to restore from <strong>{backup.filename}</strong></p>
          <div className="space-y-3">
            {[
              { key: 'files', label: 'Files', desc: 'Website files and directories' },
              { key: 'databases', label: 'Databases', desc: 'MySQL and PostgreSQL data' },
              { key: 'dns', label: 'DNS', desc: 'DNS zone configurations' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent cursor-pointer">
                <input type="checkbox" checked={(options as any)[opt.key]} onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })} className="h-4 w-4 rounded border-input" />
                <div>
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <p className="text-xs text-muted-foreground">
                Restoring will <strong>overwrite current data</strong> with the backup contents. This action cannot be undone.
              </p>
            </div>
            {restore.error && <p className="text-sm text-destructive">{String(restore.error)}</p>}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
            <button onClick={() => setShowConfirm(true)} disabled={restore.isPending} className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              Restore
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Restore"
        message={`This will overwrite current data with the contents of '${backup.filename}'. The selected data (files, databases, DNS) will be replaced. This cannot be undone.`}
        variant="warning"
        confirmText="Restore Now"
        onConfirm={handleRestore}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Schedule Modal                                              */
/* ------------------------------------------------------------------ */
function CreateScheduleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBackupSchedule();
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [scope, setScope] = useState('all');
  const [retentionCount, setRetentionCount] = useState(7);
  const [storageType, setStorageType] = useState('local');

  const handleSubmit = () => {
    create.mutate({ cronExpression, scope, retentionCount, storageType }, {
      onSuccess: () => { onClose(); },
    });
  };

  const presets = [
    { label: 'Daily at 2 AM', value: '0 2 * * *' },
    { label: 'Daily at 3 AM', value: '0 3 * * *' },
    { label: 'Twice daily', value: '0 2,14 * * *' },
    { label: 'Weekly (Sunday)', value: '0 2 * * 0' },
    { label: 'Monthly', value: '0 2 1 * *' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Backup Schedule</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Cron Expression</label>
            <input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Presets</label>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button key={p.value} onClick={() => setCronExpression(p.value)} className={`rounded-full px-3 py-1 text-xs ${cronExpression === p.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All domains</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Retention (number of backups to keep)</label>
            <input type="number" value={retentionCount} onChange={(e) => setRetentionCount(parseInt(e.target.value) || 7)} min={1} max={100} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Storage</label>
            <select value={storageType} onChange={(e) => setStorageType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="local">Local</option>
            </select>
          </div>
          {create.error && <p className="text-sm text-destructive">{String(create.error)}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {create.isPending ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Storage Settings Tab                                               */
/* ------------------------------------------------------------------ */
function StorageSettings() {
  const { data: storageConfig, isLoading } = useRemoteStorageConfig();
  const updateStorage = useUpdateRemoteStorage();
  const [storageType, setStorageType] = useState<'local' | 's3' | 'sftp'>(
    storageConfig?.type ?? 'local'
  );

  // S3 fields
  const [s3Endpoint, setS3Endpoint] = useState(storageConfig?.s3?.endpoint ?? '');
  const [s3Bucket, setS3Bucket] = useState(storageConfig?.s3?.bucket ?? '');
  const [s3AccessKey, setS3AccessKey] = useState(storageConfig?.s3?.accessKey ?? '');
  const [s3SecretKey, setS3SecretKey] = useState(storageConfig?.s3?.secretKey ?? '');
  const [s3Region, setS3Region] = useState(storageConfig?.s3?.region ?? 'us-east-1');

  // SFTP fields
  const [sftpHost, setSftpHost] = useState(storageConfig?.sftp?.host ?? '');
  const [sftpPort, setSftpPort] = useState(storageConfig?.sftp?.port ?? 22);
  const [sftpUser, setSftpUser] = useState(storageConfig?.sftp?.user ?? '');
  const [sftpPath, setSftpPath] = useState(storageConfig?.sftp?.path ?? '/backups');
  const [sftpAuthType, setSftpAuthType] = useState<'password' | 'key'>(
    storageConfig?.sftp?.authType ?? 'password'
  );
  const [sftpPassword, setSftpPassword] = useState('');
  const [sftpKey, setSftpKey] = useState('');

  const handleSave = () => {
    const config: RemoteStorageConfig = { type: storageType };
    if (storageType === 's3') {
      config.s3 = { endpoint: s3Endpoint, bucket: s3Bucket, accessKey: s3AccessKey, secretKey: s3SecretKey, region: s3Region };
    } else if (storageType === 'sftp') {
      config.sftp = { host: sftpHost, port: sftpPort, user: sftpUser, path: sftpPath, authType: sftpAuthType, password: sftpAuthType === 'password' ? sftpPassword : undefined, key: sftpAuthType === 'key' ? sftpKey : undefined };
    }
    updateStorage.mutate(config);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Storage type selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          { type: 'local' as const, label: 'Local Storage', icon: HardDrive, desc: 'Store on this server' },
          { type: 's3' as const, label: 'Amazon S3', icon: Cloud, desc: 'S3-compatible storage' },
          { type: 'sftp' as const, label: 'SFTP', icon: Server, desc: 'Remote SFTP server' },
        ]).map(opt => (
          <button
            key={opt.type}
            onClick={() => setStorageType(opt.type)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              storageType === opt.type
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <opt.icon className={`h-5 w-5 ${storageType === opt.type ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="mt-2 font-medium text-sm">{opt.label}</div>
            <div className="text-xs text-muted-foreground">{opt.desc}</div>
          </button>
        ))}
      </div>

      {/* S3 configuration */}
      {storageType === 's3' && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">S3 Configuration</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Endpoint</label>
              <input value={s3Endpoint} onChange={e => setS3Endpoint(e.target.value)} placeholder="https://s3.amazonaws.com" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bucket</label>
              <input value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} placeholder="my-backups" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Access Key</label>
              <input value={s3AccessKey} onChange={e => setS3AccessKey(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Secret Key</label>
              <input type="password" value={s3SecretKey} onChange={e => setS3SecretKey(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Region</label>
              <input value={s3Region} onChange={e => setS3Region(e.target.value)} placeholder="us-east-1" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* SFTP configuration */}
      {storageType === 'sftp' && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">SFTP Configuration</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Host</label>
              <input value={sftpHost} onChange={e => setSftpHost(e.target.value)} placeholder="backup.example.com" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Port</label>
              <input type="number" value={sftpPort} onChange={e => setSftpPort(Number(e.target.value))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">User</label>
              <input value={sftpUser} onChange={e => setSftpUser(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Remote Path</label>
              <input value={sftpPath} onChange={e => setSftpPath(e.target.value)} placeholder="/backups" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Authentication</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSftpAuthType('password')}
                className={`rounded-md px-3 py-1.5 text-sm ${sftpAuthType === 'password' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Password
              </button>
              <button
                onClick={() => setSftpAuthType('key')}
                className={`rounded-md px-3 py-1.5 text-sm ${sftpAuthType === 'key' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                SSH Key
              </button>
            </div>
          </div>
          {sftpAuthType === 'password' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input type="password" value={sftpPassword} onChange={e => setSftpPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">SSH Private Key</label>
              <textarea value={sftpKey} onChange={e => setSftpKey(e.target.value)} rows={4} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" />
            </div>
          )}
        </div>
      )}

      {/* Local info */}
      {storageType === 'local' && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Local Storage</p>
              <p className="text-xs text-muted-foreground">
                Backups are stored on this server's local disk. Ensure sufficient disk space is available.
              </p>
            </div>
          </div>
        </div>
      )}

      {updateStorage.error && (
        <p className="text-sm text-destructive">{String(updateStorage.error)}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateStorage.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {updateStorage.isPending ? 'Saving...' : 'Save Storage Settings'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main BackupsPage                                                   */
/* ------------------------------------------------------------------ */
export function BackupsPage() {
  const { data: backups, isLoading, isError, refetch } = useBackups();
  const { data: schedules } = useBackupSchedules();
  const deleteBackup = useDeleteBackup();
  const downloadBackup = useDownloadBackup();
  const verifyBackup = useVerifyBackup();
  const deleteSchedule = useDeleteBackupSchedule();
  const toggleSchedule = useToggleBackupSchedule();

  const [tab, setTab] = useState<'backups' | 'schedules' | 'storage'>('backups');
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, BackupVerifyResult>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div>
        <PageHeader title="Backups" description="Manage server backups and schedules" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-400">Failed to load backups</h3>
          <p className="mt-1 text-sm text-muted-foreground">An error occurred while fetching backups.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = (backup: Backup) => {
    downloadBackup.mutate({ id: backup.id, filename: backup.filename });
  };

  const handleVerify = (backup: Backup) => {
    verifyBackup.mutate(backup.id, {
      onSuccess: (result) => {
        setVerifyResults(prev => ({ ...prev, [backup.id]: result }));
      },
    });
  };

  return (
    <div>
      <PageHeader title="Backups" description="Manage server backups and schedules" actions={
        <button onClick={() => {
          if (tab === 'backups') setShowCreateBackup(true);
          else if (tab === 'schedules') setShowCreateSchedule(true);
        }} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          {tab === 'schedules' ? 'Create Schedule' : 'Create Backup'}
        </button>
      } />

      <div className="mb-6 flex gap-1 rounded-lg border border-border p-1 w-fit">
        {(['backups', 'schedules', 'storage'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            {t}
          </button>
        ))}
      </div>

      {showCreateBackup && <CreateBackupModal onClose={() => setShowCreateBackup(false)} />}
      {showCreateSchedule && <CreateScheduleModal onClose={() => setShowCreateSchedule(false)} />}
      {restoreTarget && <RestoreModal backup={restoreTarget} onClose={() => setRestoreTarget(null)} />}

      {tab === 'backups' && (
        !backups?.length ? (
          <EmptyState icon={Archive} title="No backups" description="Create your first backup to protect your data." />
        ) : (
          <div className="space-y-4">
            {backups.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-primary/10 p-2">
                      <Archive className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {b.filename}
                        {b.encrypted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                            <Shield className="h-3 w-3" /> Encrypted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">{b.type}</span>
                        <span>•</span>
                        <span>{formatBytes(b.sizeBytes)}</span>
                        <span>•</span>
                        <span>{new Date(b.startedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      b.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                      b.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                      b.status === 'restoring' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>{b.status}</span>
                    <div className="flex gap-1">
                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(b)}
                        disabled={b.status !== 'completed'}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {/* Verify button */}
                      <button
                        onClick={() => handleVerify(b)}
                        disabled={verifyBackup.isPending}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                        title="Verify integrity"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => setRestoreTarget(b)} disabled={b.status !== 'completed'} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30" title="Restore">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button onClick={() => {
                        setConfirmDialog({
                          open: true,
                          title: 'Delete Backup',
                          message: `This will permanently delete backup '${b.filename}'. This cannot be undone.`,
                          variant: 'danger',
                          onConfirm: () => deleteBackup.mutate(b.id),
                        });
                      }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Verify result */}
                {verifyResults[b.id] && (
                  <div className={`mt-3 flex items-center gap-2 rounded-md border p-2 text-sm ${
                    verifyResults[b.id].valid
                      ? 'bg-green-500/10 border-green-500/30 text-green-600'
                      : 'bg-red-500/10 border-red-500/30 text-red-600'
                  }`}>
                    {verifyResults[b.id].valid ? (
                      <><CheckCircle2 className="h-4 w-4 shrink-0" /> Integrity check passed — checksum: <span className="font-mono text-xs">{verifyResults[b.id].checksum.slice(0, 16)}...</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 shrink-0" /> Integrity check failed — {verifyResults[b.id].errors?.join(', ') || 'corrupted'}</>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'schedules' && (
        !schedules?.length ? (
          <EmptyState icon={Clock} title="No schedules" description="Create a backup schedule for automated backups." />
        ) : (
          <div className="space-y-4">
            {schedules.map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-blue-500/10 p-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium font-mono text-sm">{s.cronExpression}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.scope} • Keep {s.retentionCount} backup(s) • {s.storageType}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleSchedule.mutate(s.id)} className="text-muted-foreground hover:text-foreground">
                      {s.isActive ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => {
                      setConfirmDialog({
                        open: true,
                        title: 'Delete Schedule',
                        message: `This will permanently delete this backup schedule. Automated backups will no longer run.`,
                        variant: 'danger',
                        onConfirm: () => deleteSchedule.mutate(s.id),
                      });
                    }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'storage' && (
        <StorageSettings />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
