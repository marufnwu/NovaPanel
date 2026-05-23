import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'default' | 'danger' | 'ghost';
  size?: 'small' | 'default' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'default',
  size = 'default',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-foreground-info text-white hover:bg-foreground-info/90',
    default: 'bg-background-tertiary text-foreground-primary hover:bg-background-secondary',
    danger: 'bg-foreground-danger text-white hover:bg-foreground-danger/90',
    ghost: 'bg-transparent hover:bg-background-tertiary',
  };

  const sizes = {
    small: 'h-[26px] px-2 text-small',
    default: 'h-8 px-4 text-small',
    large: 'h-[38px] px-6 text-body',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-info/50 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}