import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ActionMenu, ActionMenuItem, ActionMenuSeparator } from "./ActionMenu";

interface ResourceCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  description?: string;
  status?: ReactNode;
  metadata?: ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }>;
  onClick?: () => void;
  className?: string;
}

function ResourceCard({
  icon: Icon,
  title,
  subtitle,
  description,
  status,
  metadata,
  actions,
  onClick,
  className,
}: ResourceCardProps) {
  const isClickable = !!onClick;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        isClickable && "cursor-pointer hover:border-primary/30 hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
                {status && <div className="shrink-0">{status}</div>}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
              {description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
              )}
              {metadata && (
                <div className="mt-2 flex flex-wrap items-center gap-2">{metadata}</div>
              )}
            </div>
          </div>
          {actions && actions.length > 0 && (
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <ActionMenu>
                {actions.map((action, i) => (
                  <ActionMenuItem
                    key={i}
                    onClick={action.onClick}
                    destructive={action.destructive}
                    disabled={action.disabled}
                  >
                    {action.label}
                  </ActionMenuItem>
                ))}
              </ActionMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { ResourceCard };