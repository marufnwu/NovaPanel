import { useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionDropdownProps {
  items: ActionItem[];
  className?: string;
}

export function ActionDropdown({ items, className = '' }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onClick(); }}
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 ${
                  item.variant === 'danger' ? 'text-destructive hover:bg-destructive/10' : ''
                }`}
              >
                {item.icon && <span className="h-3.5 w-3.5">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}