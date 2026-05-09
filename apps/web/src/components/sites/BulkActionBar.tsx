import { Ban, CheckCircle, Trash2, X } from 'lucide-react';

export interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

export function BulkActionBar({ selectedIds, onClear, onSuspend, onActivate, onDelete, isLoading }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="h-4 w-px bg-border" />
      <button
        onClick={onSuspend}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <Ban className="h-3.5 w-3.5" /> Suspend
      </button>
      <button
        onClick={onActivate}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <CheckCircle className="h-3.5 w-3.5" /> Activate
      </button>
      <button
        onClick={onDelete}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
      <div className="h-4 w-px bg-border" />
      <button onClick={onClear} className="rounded p-1 text-muted-foreground hover:bg-accent">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
