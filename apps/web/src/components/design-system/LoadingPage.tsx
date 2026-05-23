import { cn } from "@/lib/utils";

interface LoadingPageProps {
  title?: string;
  description?: string;
  className?: string;
}

function LoadingPage({ title = "Loading...", className }: LoadingPageProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-24", className)}>
      <div className="relative">
        <div className="size-12 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 size-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 animate-pulse", className)}>
      <div className="h-4 w-24 rounded bg-muted mb-3" />
      <div className="h-8 w-32 rounded bg-muted" />
    </div>
  );
}

function LoadingTableRow({ columns = 5, className }: { columns?: number; className?: string }) {
  return (
    <tr className={cn("border-b border-border", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${Math.random() * 40 + 60}%` }} />
        </td>
      ))}
    </tr>
  );
}

function LoadingTable({ rows = 5, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <LoadingTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { LoadingPage, LoadingCard, LoadingTable, LoadingTableRow };