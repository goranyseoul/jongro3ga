"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LuChevronsUpDown } from "react-icons/lu";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type StaffMenuItem = {
  id: string;
  label: string;
  /** Navigates and closes the menu. */
  href?: string;
  /** Runs and closes the menu, for example sign-out. */
  onSelect?: () => void;
};

export type StaffMenuProps = {
  /** Accessible name of the trigger, e.g. "계정 메뉴". */
  label: string;
  /** Visible trigger content (name and role). */
  trigger: ReactNode;
  /** Who is signed in, shown above the items. Not focusable. */
  header?: ReactNode;
  items: StaffMenuItem[];
  className?: string;
  /** Placement of the popover relative to the trigger (absolute utilities). */
  popoverClassName?: string;
};

const itemClass = cn(
  "flex min-h-touch w-full items-center rounded-md px-sp-3 text-start text-body text-text transition-colors duration-press ease-out hover:bg-sunken focus-visible:bg-sunken",
  focusRing,
);

// Account menu for the staff consoles (WAI-ARIA menu button). Opens on click, Enter, Space or
// ArrowDown; arrows, Home and End move between items; Escape closes and returns focus to the
// trigger; Tab or a click outside closes. Every target keeps the 44px touch height.
export function StaffMenu({ label, trigger, header, items, className, popoverClassName }: StaffMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const focusOnOpen = useRef<"first" | "last">("first");
  const menuId = useId();
  itemRefs.current.length = items.length;

  const focusItem = useCallback((index: number) => {
    const list = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    focusItem(focusOnOpen.current === "first" ? 0 : -1);
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close, focusItem]);

  const openWith = (where: "first" | "last") => {
    focusOnOpen.current = where;
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openWith("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openWith("last");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const list = itemRefs.current.filter(Boolean) as HTMLElement[];
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(-1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : openWith("first"))}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex min-h-touch w-full min-w-touch items-center justify-between gap-sp-2 rounded-md px-sp-2 text-start transition-colors duration-press ease-out hover:bg-sunken",
          open && "bg-sunken",
          focusRing,
        )}
      >
        <span className="flex min-w-0 flex-col">{trigger}</span>
        <LuChevronsUpDown aria-hidden className="size-sp-4 shrink-0 text-subtle" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-30 flex w-max min-w-full max-w-xs flex-col gap-sp-1 rounded-card border border-border bg-popover p-sp-1 shadow-pop animate-fade-in",
            popoverClassName,
          )}
        >
          {header ? <div className="flex flex-col gap-sp-1 border-b border-border-soft px-sp-3 pb-sp-2 pt-sp-2">{header}</div> : null}
          <ul id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="flex flex-col">
            {items.map((item, index) => {
              const ref = (node: HTMLElement | null) => {
                itemRefs.current[index] = node;
              };
              return (
                <li key={item.id} role="none">
                  {item.href ? (
                    <Link ref={ref} href={item.href} role="menuitem" tabIndex={-1} className={itemClass} onClick={() => close(false)}>
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      ref={ref}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={itemClass}
                      onClick={() => {
                        close(false);
                        item.onSelect?.();
                      }}
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
