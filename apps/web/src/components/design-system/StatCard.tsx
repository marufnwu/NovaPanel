import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "./ProgressBar";
import { Sparkline } from "./Sparkline";
import { TRANSITION_CARD, VARIANTS_CARD } from "@/lib/motion";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  sparklineData?: number[];
  progressValue?: number;
  progressMax?: number;
  progressLabel?: string;
  className?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  variant = "default",
  sparklineData,
  progressValue,
  progressMax,
  progressLabel,
  className,
}: StatCardProps) {
  return (
    <motion.div
      variants={VARIANTS_CARD}
      transition={TRANSITION_CARD}
      className={cn("group", className)}
    >
      <Card className="overflow-hidden transition-shadow duration-200 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center",
                    variant === "default" && "bg-primary/10 text-primary",
                    variant === "success" && "bg-success/10 text-success",
                    variant === "warning" && "bg-warning/10 text-warning",
                    variant === "destructive" && "bg-destructive/10 text-destructive",
                    variant === "info" && "bg-info/10 text-info"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {value}
              </div>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {description}
                </p>
              )}
              {sparklineData && sparklineData.length > 1 && (
                <div className="mt-3">
                  <Sparkline data={sparklineData} variant={variant} width={120} height={32} />
                </div>
              )}
              {progressValue !== undefined && (
                <div className="mt-3">
                  <ProgressBar
                    value={progressValue}
                    max={progressMax || 100}
                    variant={variant}
                    size="sm"
                    label={progressLabel}
                    showLabel
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export { StatCard };