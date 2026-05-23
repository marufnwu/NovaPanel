import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  timeRange?: string[];
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  className?: string;
}

const TIME_RANGES = ["1h", "6h", "24h", "7d", "30d"];

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  action,
  timeRange,
  selectedRange,
  onRangeChange,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="size-4 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {timeRange && onRangeChange && (
              <div className="flex items-center rounded-lg bg-muted p-0.5">
                {timeRange.map((range) => (
                  <button
                    key={range}
                    onClick={() => onRangeChange(range)}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                      selectedRange === range
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
            {action && <CardAction>{action}</CardAction>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {children}
      </CardContent>
    </Card>
  );
}

export { ChartCard };