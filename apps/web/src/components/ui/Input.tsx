import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-meta font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary',
            'focus:outline-none focus:ring-2 focus:ring-foreground-info/50 focus:border-foreground-info',
            'placeholder:text-foreground-tertiary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-foreground-danger focus:ring-foreground-danger/50 focus:border-foreground-danger',
            className
          )}
          {...props}
        />
        {error && <span className="text-meta text-foreground-danger">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';