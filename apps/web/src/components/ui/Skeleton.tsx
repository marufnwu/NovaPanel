import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-border-tertiary rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-tertiary">
            <th className="text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary">Name</th>
            <th className="text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary">Status</th>
            <th className="text-left px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary">Created</th>
            <th className="text-right px-4 py-3 text-section-label uppercase tracking-wide text-foreground-tertiary">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border-tertiary last:border-0">
              <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <TableSkeleton />
    </div>
  );
}