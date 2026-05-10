import { Server } from 'lucide-react';
import type { FtpAccount } from '../../api/hooks/ftp';

interface FtpAccountCardProps {
  account: FtpAccount;
  onEdit: () => void;
  onChangePassword: () => void;
  onDelete: () => void;
}

export function FtpAccountCard({ account, onEdit, onChangePassword, onDelete }: FtpAccountCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded bg-primary/10 p-2">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{account.username}</div>
            <div className="text-sm text-muted-foreground font-mono">{account.homeDir}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${account.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {account.isActive ? 'Active' : 'Disabled'}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${account.readonly ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
            {account.readonly ? 'Read-only' : 'Read+Write'}
          </span>
        </div>
      </div>

      {account.lastLoginAt && (
        <div className="mb-4 flex items-center gap-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>Last Login: {new Date(account.lastLoginAt).toLocaleString()}</span>
          {account.lastLoginIp && <span className="font-mono">IP: {account.lastLoginIp}</span>}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          Edit
        </button>
        <button onClick={onChangePassword} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          Change Password
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-destructive/10 hover:text-destructive">
          Delete
        </button>
      </div>
    </div>
  );
}