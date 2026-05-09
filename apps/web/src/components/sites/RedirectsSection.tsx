import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { Domain } from '../../api/hooks/domains';

export interface Redirect {
  id: string;
  sourcePath: string;
  targetUrl: string;
  type: '301' | '302';
}

export interface RedirectsSectionProps {
  domain: Domain;
  redirects: Redirect[] | undefined;
  onCreateRedirect: {
    mutate: (
      data: { sourcePath: string; targetUrl: string; type: '301' | '302' },
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
    isPending: boolean;
  };
  onDeleteRedirect: {
    mutate: (
      id: string,
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
  };
}

export function RedirectsSection({
  domain,
  redirects,
  onCreateRedirect,
  onDeleteRedirect,
}: RedirectsSectionProps) {
  const [newRedirectSource, setNewRedirectSource] = useState('');
  const [newRedirectTarget, setNewRedirectTarget] = useState('');
  const [newRedirectType, setNewRedirectType] = useState<'301' | '302'>('301');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={newRedirectSource}
          onChange={(e) => setNewRedirectSource(e.target.value)}
          placeholder="/old-path"
          className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          value={newRedirectTarget}
          onChange={(e) => setNewRedirectTarget(e.target.value)}
          placeholder="https://example.com/new"
          className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={newRedirectType}
          onChange={(e) => setNewRedirectType(e.target.value as '301' | '302')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="301">301 Permanent</option>
          <option value="302">302 Temporary</option>
        </select>
        <button
          onClick={() => {
            if (newRedirectSource && newRedirectTarget) {
              onCreateRedirect.mutate(
                { sourcePath: newRedirectSource, targetUrl: newRedirectTarget, type: newRedirectType },
                {
                  onSuccess: () => { setNewRedirectSource(''); setNewRedirectTarget(''); toast.success('Redirect created'); },
                  onError: (e: Error) => toast.error(e.message || 'Failed to create redirect'),
                }
              );
            }
          }}
          disabled={!newRedirectSource || !newRedirectTarget || onCreateRedirect.isPending}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {redirects && redirects.length > 0 ? (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Target</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {redirects.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{r.sourcePath}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.targetUrl}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.type}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onDeleteRedirect.mutate(r.id, {
                        onSuccess: () => toast.success('Redirect deleted'),
                        onError: (e: Error) => toast.error(e.message || 'Failed to delete redirect'),
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
        <p className="text-sm text-muted-foreground">No redirects</p>
      )}
    </div>
  );
}
