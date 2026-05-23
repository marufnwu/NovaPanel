import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-full border-0 px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
        neutral: "bg-muted text-muted-foreground",
        active: "bg-success/10 text-success",
        paused: "bg-warning/10 text-warning",
        error: "bg-destructive/10 text-destructive",
        pending: "bg-muted text-muted-foreground",
        building: "bg-info/10 text-info",
        stopped: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

function StatusBadge({
  className,
  variant = "default",
  dot = false,
  pulse = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        statusBadgeVariants({ variant }),
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-2 rounded-full shrink-0",
            pulse && "animate-pulse",
            variant === "success" || variant === "active"
              ? "bg-success"
              : variant === "warning" || variant === "paused"
              ? "bg-warning"
              : variant === "destructive" || variant === "error"
              ? "bg-destructive"
              : variant === "info" || variant === "building"
              ? "bg-info"
              : "bg-muted-foreground"
          )}
        />
      )}
      {children}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };