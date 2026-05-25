import { cn } from '../../lib/utils';
import { Icon } from '../icons';

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
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export function DataTable<T>({
  columns,
  data,
  emptyState,
  loading,
  rowKey,
  onRowClick,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
}: DataTableProps<T>) {
  const handleSelectAll = () => {
    if (selectedRows.size === data.length) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(data.map((row, i) => rowKey ? rowKey(row) : String(i))));
    }
  };

  const handleSelectRow = (key: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange?.(newSelected);
  };

  if (loading) {
    return (
      <div className="border border-border-tertiary rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-tertiary">
              {selectable && (
                <th className="text-left px-4 py-3 w-10">
                  <div className="skeleton h-4 w-4 rounded" />
                </th>
              )}
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
                {selectable && (
                  <td className="px-4 py-3">
                    <div className="skeleton h-4 w-4 rounded" />
                  </td>
                )}
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
      {selectable && selectedRows.size > 0 && (
        <div className="px-4 py-2 bg-background-secondary border-b border-border-tertiary flex items-center gap-2">
          <span className="text-small text-foreground-secondary">
            {selectedRows.size} selected
          </span>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-tertiary">
            {selectable && (
              <th className="text-left px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border-secondary bg-background-primary accent-foreground-primary cursor-pointer"
                />
              </th>
            )}
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
            const isSelected = selectedRows.has(key);
            return (
              <tr
                key={key}
                className={cn(
                  'border-b border-border-tertiary last:border-0 hover:bg-background-secondary transition-colors',
                  onRowClick && 'cursor-pointer',
                  isSelected && 'bg-background-tertiary'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(key)}
                      className="w-4 h-4 rounded border-border-secondary bg-background-primary accent-foreground-primary cursor-pointer"
                    />
                  </td>
                )}
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