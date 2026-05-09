import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { Domain } from '../../api/hooks/domains';

export interface Alias {
  id: string;
  alias: string;
}

export interface AliasesSectionProps {
  domain: Domain;
  aliases: Alias[] | undefined;
  onCreateAlias: {
    mutate: (
      data: { alias: string },
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
    isPending: boolean;
  };
  onDeleteAlias: {
    mutate: (
      id: string,
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
  };
}

export function AliasesSection({
  domain,
  aliases,
  onCreateAlias,
  onDeleteAlias,
}: AliasesSectionProps) {
  const [newAlias, setNewAlias] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="Alias domain (e.g., www.example.net)"
          className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => {
            if (newAlias) {
              onCreateAlias.mutate({ alias: newAlias }, {
                onSuccess: () => { setNewAlias(''); toast.success(`Alias ${newAlias} created`); },
                onError: (e: Error) => toast.error(e.message || 'Failed to create alias'),
              });
            }
          }}
          disabled={!newAlias || onCreateAlias.isPending}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {aliases && aliases.length > 0 ? (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Alias</th>
                <th className="px-4 py-2 text-left font-medium">→ Target</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((alias) => (
                <tr key={alias.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{alias.alias}</td>
                  <td className="px-4 py-2 text-muted-foreground">{domain.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onDeleteAlias.mutate(alias.id, {
                        onSuccess: () => toast.success('Alias deleted'),
                        onError: (e: Error) => toast.error(e.message || 'Failed to delete alias'),
                      })}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      ) : (
        <p className="text-sm text-muted-foreground">No aliases</p>
      )}
    </div>
  );
}
