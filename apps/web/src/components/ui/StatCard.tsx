import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const getValueColor = () => {
    if (typeof value !== 'number') return undefined;
    if (value >= 90) return 'text-foreground-danger';
    if (value >= 70) return 'text-foreground-warning';
    return 'text-foreground-primary';
  };

  return (
    <div
      className={cn(
        'bg-background-secondary rounded-lg p-4',
        className
      )}
    >
      <div className="text-meta text-foreground-tertiary mb-1">{label}</div>
      <div className={cn('text-[24px] font-medium leading-none', getValueColor())}>{value}</div>
      {sub && <div className="text-section-label text-foreground-tertiary mt-1">{sub}</div>}
    </div>
  );
}