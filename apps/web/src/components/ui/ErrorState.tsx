import { Icon } from '../icons';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  title = 'Failed to load',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-foreground-danger rounded-xl">
      <Icon name="icon-alert-circle" size={28} className="text-foreground-danger mb-3" />
      <h3 className="text-[15px] font-medium text-foreground-danger mb-1">{title}</h3>
      <p className="text-small text-foreground-secondary mb-4 text-center">{message}</p>
      {onRetry && (
        <Button variant="default" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}