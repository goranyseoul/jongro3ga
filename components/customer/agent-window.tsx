"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type AgentWindowLabels = { open: string; title: string; expand: string; close: string };

export type AgentWindowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: AgentWindowLabels;
  /** Hands the conversation the whole screen instead of a window. */
  onExpand: () => void;
  /** Small control in the window header, e.g. the progress button. */
  headerExtra?: ReactNode;
  /** Moves focus into the window when it opens. Off while a tour owns the focus. */
  focusOnOpen?: boolean;
  /** The text field accepts typing (it is disabled while the agent answers); focus follows as soon as it does. */
  inputReady?: boolean;
  /** Hides the floating button, e.g. during a tour. The window itself still opens. */
  hideLauncher?: boolean;
  children: ReactNode;
};

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "size-sp-5 shrink-0",
} as const;

function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

const iconButton =
  "inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted transition duration-press ease-out hover:bg-sunken hover:text-text active:scale-press";

// A window over the current screen, not a page of its own: the page below keeps its place while the agent talks.
// Not modal (the page stays usable); Escape closes it and gives focus back to the launcher.
export function AgentWindow({
  open,
  onOpenChange,
  labels,
  onExpand,
  headerExtra,
  focusOnOpen = true,
  inputReady = true,
  hideLauncher = false,
  children,
}: AgentWindowProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && focusOnOpen) {
      const panel = panelRef.current;
      // Escape works from the moment the window opens: focus the window itself, then the field when it is usable
      const frame = requestAnimationFrame(() => {
        const field = panel?.querySelector<HTMLTextAreaElement>("textarea:not([disabled])");
        const focus = panel?.contains(document.activeElement) ? document.activeElement : null;
        if (field && (!focus || focus === panel)) field.focus({ preventScroll: true });
        else if (!focus) panel?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!open && wasOpen.current) launcherRef.current?.focus({ preventScroll: true });
  }, [open, focusOnOpen, inputReady]);

  useEffect(() => {
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {open || hideLauncher ? null : (
        <button
          ref={launcherRef}
          type="button"
          data-tour="agent"
          aria-haspopup="dialog"
          onClick={() => onOpenChange(true)}
          className={cn(
            "fixed bottom-sp-4 right-sp-4 z-30 inline-flex min-h-touch items-center gap-sp-2 rounded-pill bg-brand px-sp-4 text-body font-med text-on-brand shadow-pop transition duration-press ease-out hover:opacity-90 active:scale-press",
            focusRing,
          )}
        >
          <ChatIcon />
          <span>{labels.open}</span>
        </button>
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-label={labels.title}
        data-tour={open ? "agent" : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.stopPropagation();
            onOpenChange(false);
          }
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex-col overflow-hidden rounded-t-3xl border border-border bg-popover text-text shadow-pop sm:inset-x-auto sm:bottom-sp-4 sm:right-sp-4 sm:w-full sm:max-w-md sm:rounded-3xl",
          "outline-none",
          open ? "flex animate-sheet-in" : "hidden",
        )}
        // tall enough for a conversation, never taller than the screen
        style={{ height: "min(calc(var(--sp-16) * 10), calc(100dvh - var(--sp-8)))" }}
      >
        <header className="flex items-center justify-between gap-sp-2 border-b border-border-soft py-sp-1 pe-sp-2 ps-sp-4">
          <h2 className="min-w-0 truncate text-title font-semi">{labels.title}</h2>
          <div className="flex shrink-0 items-center gap-sp-1">
            {headerExtra}
            <button type="button" aria-label={labels.expand} onClick={onExpand} className={cn(iconButton, focusRing)}>
              <ExpandIcon />
            </button>
            <button type="button" aria-label={labels.close} onClick={() => onOpenChange(false)} className={cn(iconButton, focusRing)}>
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
