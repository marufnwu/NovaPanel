import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { useSystemLogs } from '../../api/hooks/logs';
import { RefreshCw, AlertCircle, ScrollText } from 'lucide-react';

export function LogsPage() {
  const [lines, setLines] = useState(100);
  const { data, isLoading, isError, error, refetch, isFetching } = useSystemLogs(lines);

  const handleRefresh = () => refetch();

  return (
    <div>
      <PageHeader
        title="System Logs"
        description="View system and kernel logs from the server"
        icon={ScrollText}
        actions={
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">
              Lines:
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </label>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Failed to load system logs'}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-2">
              <span className="text-xs text-muted-foreground">
                Last {lines} lines from /var/log/syslog
              </span>
            </div>
            <div className="max-h-[calc(100vh-16rem)] overflow-auto p-4">
              {data?.log && data.log.length > 0 ? (
                <div className="font-mono text-xs">
                  {data.log.split('\n').map((line, i) => (
                    <div key={i} className="py-0.5 text-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No log entries found
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}