import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function Card({ title, action, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-background-primary border border-border-tertiary rounded-xl p-4',
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-card-title font-medium">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}