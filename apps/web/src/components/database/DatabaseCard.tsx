import { Database as DatabaseIcon, Search, Download, Copy, UserPlus, Plus, Trash2, KeyRound } from 'lucide-react';
import type { Database } from '../../api/hooks/databases';

interface DatabaseCardProps {
  database: Database;
  onClick: () => void;
  onDelete?: () => void;
}

export function DatabaseCard({ database, onClick, onDelete }: DatabaseCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded bg-primary/10 p-2">
            <DatabaseIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">{database.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{database.engine}</p>
          </div>
        </div>
        <button
          onClick={onClick}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Search className="h-4 w-4" /> Details
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Created {new Date(database.createdAt).toLocaleDateString()}</span>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}