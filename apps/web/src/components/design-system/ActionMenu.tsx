import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionMenuProps {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function ActionMenu({ children, align = "end", sideOffset = 4 }: ActionMenuProps) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        render={
          <Button variant="ghost" size="icon-sm" className="opacity-60 hover:opacity-100">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          align={align}
          sideOffset={sideOffset}
          className="isolate z-50 outline-none"
        >
          <MenuPrimitive.Popup
            className={cn(
              "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            {children}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

function ActionMenuItem({
  children,
  onClick,
  destructive,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <MenuPrimitive.Item
      onClick={onClick}
      data-variant={destructive ? "destructive" : "default"}
      disabled={disabled}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      )}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

function ActionMenuSeparator() {
  return (
    <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />
  );
}

export { ActionMenu, ActionMenuItem, ActionMenuSeparator };