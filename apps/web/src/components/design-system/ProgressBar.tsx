import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const variantClasses = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
};

const sizeClasses = {
  sm: "h-1",
  default: "h-2",
  lg: "h-3",
};

function ProgressBar({
  value,
  max = 100,
  variant = "default",
  size = "default",
  showLabel = false,
  label,
  className,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {showLabel && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-muted", sizeClasses[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", variantClasses[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };