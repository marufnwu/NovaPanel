import { useState, useEffect } from 'react';
import { useAccessLogs, useErrorLogs, usePanelLogs, useSystemLogs } from '../../api/hooks/logs';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/icons';
import { cn } from '../../lib/utils';

type LogSource = 'access' | 'error' | 'panel' | 'system';

const LOG_SOURCES: { id: LogSource; label: string }[] = [
  { id: 'access', label: 'Nginx Access' },
  { id: 'error', label: 'Nginx Error' },
  { id: 'panel', label: 'App' },
  { id: 'system', label: 'System' },
];

export function LogsPage() {
  const [selectedSource, setSelectedSource] = useState<LogSource>('access');
  const [lines, setLines] = useState(100);

  const { data: accessData, isLoading: accessLoading } = useAccessLogs(undefined, lines);
  const { data: errorData, isLoading: errorLoading } = useErrorLogs(undefined, lines);
  const { data: panelData, isLoading: panelLoading } = usePanelLogs(lines);
  const { data: systemData, isLoading: systemLoading } = useSystemLogs(lines);

  const isLoading =
    (selectedSource === 'access' && accessLoading) ||
    (selectedSource === 'error' && errorLoading) ||
    (selectedSource === 'panel' && panelLoading) ||
    (selectedSource === 'system' && systemLoading);

  const getLogContent = () => {
    switch (selectedSource) {
      case 'access':
        return accessData?.log || '';
      case 'error':
        return errorData?.log || '';
      case 'panel':
        return panelData?.log || '';
      case 'system':
        return systemData?.log || '';
      default:
        return '';
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">Logs</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-small text-foreground-secondary">Lines:</span>
            <select
              value={lines}
              onChange={(e) => setLines(Number(e.target.value))}
              className="h-[34px] px-2 text-small rounded-md border border-border-tertiary bg-background-primary"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <Button variant="ghost" size="small" onClick={handleRefresh} icon={<Icon name="icon-refresh" size={15} />}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex gap-1">
            {LOG_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={cn(
                  'px-4 py-2 text-small transition-colors rounded-md',
                  selectedSource === source.id
                    ? 'bg-background-tertiary text-foreground-primary font-medium'
                    : 'text-foreground-secondary hover:text-foreground-primary'
                )}
              >
                {source.label}
              </button>
            ))}
          </div>

          <div className="bg-background-primary border border-border-tertiary rounded-lg overflow-hidden">
            <div className="bg-background-secondary px-4 py-2 border-b border-border-tertiary flex items-center justify-between">
              <span className="text-meta text-foreground-secondary">
                {LOG_SOURCES.find((s) => s.id === selectedSource)?.label}
              </span>
              <span className="text-meta text-foreground-tertiary">
                {isLoading ? 'Loading...' : 'Last updated: just now'}
              </span>
            </div>
            <pre
              className={cn(
                'h-[calc(100vh-300px)] overflow-auto p-4 text-meta font-mono leading-relaxed',
                isLoading && 'animate-pulse'
              )}
            >
              {isLoading ? (
                <span className="text-foreground-tertiary">Loading logs...</span>
              ) : getLogContent() ? (
                getLogContent()
              ) : (
                <span className="text-foreground-tertiary">No logs available</span>
              )}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}