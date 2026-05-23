import { TRANSITION_PAGE, VARIANTS_PAGE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "none" | "7xl" | "6xl" | "5xl" | "4xl" | "full";
}

const maxWidthClasses = {
  none: "",
  "7xl": "max-w-7xl",
  "6xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  "4xl": "max-w-4xl",
  full: "max-w-full",
};

function PageShell({ children, className, maxWidth = "7xl" }: PageShellProps) {
  const routerState = useRouterState();
  const isNavigating = routerState.isLoading;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routerState.location.pathname}
        variants={VARIANTS_PAGE}
        initial="enter"
        animate="center"
        exit="exit"
        transition={TRANSITION_PAGE}
        className={cn(
          "mx-auto w-full",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {isNavigating && (
          <div className="h-1 w-full overflow-hidden bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%", opacity: 1 }}
              animate={{ width: "100%", opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
          </div>
        )}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { PageShell };