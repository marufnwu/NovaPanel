import type { ReactNode } from 'react';

interface ResponsiveTableProps {
  children: ReactNode;
}

export function ResponsiveTable({ children }: ResponsiveTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {children}
    </div>
  );
}
