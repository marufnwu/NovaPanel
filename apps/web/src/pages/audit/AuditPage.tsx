import { useState, useMemo, useCallback } from 'react';
import { useAuditLog, AuditEntry } from '../../api/hooks/audit';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingPage } from '@/components/design-system/LoadingPage';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import {
  ScrollText, Search, Download, Filter, ChevronLeft, ChevronRight,
  RefreshCw, X, Calendar, User, Shield, Eye, ChevronDown, AlertTriangle,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;


const ACTION_CATEGORIES: { key: string; label: string; pattern: string }[] = [
  { key: 'all', label: 'All', pattern: '' },
  { key: 'create', label: 'Create', pattern: '.create' },
  { key: 'update', label: 'Update', pattern: '.update' },
  { key: 'delete', label: 'Delete', pattern: '.delete' },
  { key: 'login', label: 'Login', pattern: 'login' },
  { key: 'logout', label: 'Logout', pattern: 'logout' },
  { key: 'other', label: 'Other', pattern: '__other__' },
];

const ACTION_BADGE_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  logout: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  other: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function getActionCategory(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('.create') || lower.includes('created')) return 'create';
  if (lower.includes('.update') || lower.includes('updated')) return 'update';
  if (lower.includes('.delete') || lower.includes('deleted') || lower.includes('.remove')) return 'delete';
  if (lower.includes('login') || lower.includes('auth.login')) return 'login';
  if (lower.includes('logout') || lower.includes('auth.logout')) return 'logout';
  return 'other';
}

// ─── CSV Export Helper ───────────────────────────────────────────────────────

function exportToCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp', 'User ID', 'Action', 'Resource', 'IP Address', 'Details'];
  const rows = entries.map((entry) => [
    new Date(entry.timestamp).toISOString(),
    entry.userId || 'System',
    entry.action,
    entry.resource || '',
    entry.ip || '',
    entry.details ? JSON.stringify(entry.details) : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        // Escape cells that contain commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function EntryDetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Audit Entry Detail</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono text-xs">{entry.id}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Timestamp</span>
            <span>{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{entry.userId || 'System'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Action</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {entry.action}
            </span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Resource</span>
            <span>{entry.resource || '—'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">IP Address</span>
            <span className="font-mono text-xs">{entry.ip || '—'}</span>
          </div>
          {entry.userAgent && (
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">User Agent</span>
              <span className="max-w-[300px] truncate text-xs" title={entry.userAgent}>
                {entry.userAgent}
              </span>
            </div>
          )}
          {entry.details && (
            <div>
              <span className="text-muted-foreground">Details</span>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                {typeof entry.details === 'string'
                  ? entry.details
                  : JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AuditPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);

  // Filter state
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  // Build server-side filters
  const filters = useMemo(() => ({
    search: searchQuery || undefined,
    category: actionFilter !== 'all' ? actionFilter : undefined,
    user: userFilter !== 'all' ? userFilter : undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page: currentPage,
    perPage,
  }), [searchQuery, actionFilter, userFilter, dateFrom, dateTo, currentPage, perPage]);

  const { data, isLoading, isError, refetch, isRefetching } = useAuditLog(filters);

  const entries = data?.data ?? [];
  const totalFiltered = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, data?.meta?.totalPages ?? 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Extract unique users from current page entries for the user filter dropdown
  const uniqueUsers = useMemo(() => {
    const userIds = new Set<string>();
    entries.forEach((e) => { if (e.userId) userIds.add(e.userId); });
    return Array.from(userIds).sort();
  }, [entries]);

  // Reset to page 1 when filters change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  const handleActionFilterChange = useCallback((key: string) => {
    setActionFilter(key);
    resetPage();
  }, [resetPage]);

  const handleUserFilterChange = useCallback((value: string) => {
    setUserFilter(value);
    resetPage();
  }, [resetPage]);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    resetPage();
  }, [resetPage]);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    resetPage();
  }, [resetPage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    resetPage();
  }, [resetPage]);

  const clearAllFilters = useCallback(() => {
    setActionFilter('all');
    setUserFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    resetPage();
  }, [resetPage]);

  const hasActiveFilters =
    actionFilter !== 'all' ||
    userFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingPage />;

  if (isError) return (
    <div>
      <PageHeader title="Audit Log" description="Track all system activities and changes" icon={ScrollText} />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load audit log. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track all system activities and changes"
        icon={ScrollText}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => exportToCSV(entries)} disabled={entries.length === 0}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Search & Filter Bar */}
      <div className="mb-4 space-y-3">
        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search actions, resources, IPs, users..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-md border border-border bg-card py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors ${
              showFilters || hasActiveFilters ? 'bg-accent border-primary/30' : 'hover:bg-accent'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {[actionFilter !== 'all', userFilter !== 'all', searchQuery.trim() !== '', dateFrom !== '', dateTo !== ''].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Expandable filters panel */}
        {showFilters && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {/* Action type filter */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Action Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ACTION_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => handleActionFilterChange(cat.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      actionFilter === cat.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User filter & Date range */}
            <div className="flex flex-wrap items-end gap-4">
              {/* User filter */}
              <div className="min-w-[200px] flex-1">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  User
                </label>
                <div className="relative">
                  <select
                    value={userFilter}
                    onChange={(e) => handleUserFilterChange(e.target.value)}
                    className="w-full appearance-none rounded-md border border-border bg-card py-2 pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  >
                    <option value="all">All Users</option>
                    {uniqueUsers.map((userId) => (
                      <option key={userId} value={userId}>
                        {userId}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {/* Date from */}
              <div className="min-w-[160px]">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>

              {/* Date to */}
              <div className="min-w-[160px]">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-card py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results summary */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {entries.length} of {totalFiltered} entries
        </p>
      </div>

      {/* Table */}
      {!entries?.length ? (
        <EmptyState
          icon={ScrollText}
          title="No actions logged yet"
          description="Audit entries will appear here as system activities occur."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching entries"
          description="Try adjusting your filters or search query."
          action={
            <button
              onClick={clearAllFilters}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Clear Filters
            </button>
          }
        />
      ) : (
        <ResponsiveTable>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">User</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Resource</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">IP Address</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap w-16">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: AuditEntry) => {
                  const category = getActionCategory(entry.action);
                  const badgeColor = ACTION_BADGE_COLORS[category] || ACTION_BADGE_COLORS.other;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-xs">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs truncate max-w-[140px]" title={entry.userId || 'System'}>
                            {entry.userId || 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="truncate block max-w-[200px]" title={entry.resource || ''}>
                          {entry.resource || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.ip || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </ResponsiveTable>
      )}

      {/* Pagination */}
      {entries.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {totalFiltered} total entries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage === totalPages}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              »»
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}
