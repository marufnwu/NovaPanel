import { Icon } from '../icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border-tertiary rounded-xl">
      {icon && (
        <Icon name={icon as any} size={32} className="text-foreground-tertiary mb-3" />
      )}
      <h3 className="text-[15px] font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-small text-foreground-secondary mb-4 text-center">{description}</p>
      )}
      {action && (
        <Button variant="default" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}