import { cn } from '../../lib/utils';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyState?: React.ReactNode;
  loading?: boolean;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  emptyState,
  loading,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="border border-border-tertiary rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-tertiary">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border-tertiary last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="skeleton h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data.length && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="border border-border-tertiary rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-tertiary">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const key = rowKey ? rowKey(row) : String(index);
            return (
              <tr
                key={key}
                className={cn(
                  'border-b border-border-tertiary last:border-0 hover:bg-background-secondary transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-small">
                    {col.render ? col.render(row) : String((row as any)[col.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}