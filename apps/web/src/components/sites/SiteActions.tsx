import { Edit3, Ban, CheckCircle, Trash2 } from 'lucide-react';
import type { Website } from '../../api/hooks/websites';

interface SiteActionsProps {
  site: Website;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}

export function SiteActions({ site, onEdit, onSuspend, onActivate, onDelete }: SiteActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        <Edit3 className="h-4 w-4" /> Edit
      </button>
      {site.status === 'active' ? (
        <button
          onClick={onSuspend}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Ban className="h-4 w-4" /> Suspend
        </button>
      ) : (
        <button
          onClick={onActivate}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <CheckCircle className="h-4 w-4" /> Activate
        </button>
      )}
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
  );
}