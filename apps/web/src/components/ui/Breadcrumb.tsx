import { Link } from '@tanstack/react-router';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
            {isLast || !item.href ? (
              <span className={isLast ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                {index === 0 && <Home className="inline h-3 w-3 mr-1 -mt-0.5" />}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {index === 0 && <Home className="inline h-3 w-3 mr-1 -mt-0.5" />}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
