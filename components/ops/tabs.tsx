"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number };

export type TabsProps<T extends string> = {
  /** Accessible name of the tab list, not rendered. */
  label: string;
  /** Prefix for the ids that link each tab to its panel, see tabId and panelId. */
  idPrefix: string;
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
};

export const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
export const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

// Flat underline tabs. Arrow keys move between tabs, the panel is rendered by the caller with
// role="tabpanel", id={panelId(...)} and aria-labelledby={tabId(...)}.
export function Tabs<T extends string>({ label, idPrefix, tabs, value, onChange }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-border">
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(node) => {
              refs.current[tab.value] = node;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.value)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex min-h-touch shrink-0 items-center gap-sp-2 border-b-2 px-sp-4 text-body transition-colors duration-press ease-out",
              selected ? "border-brand font-med text-text" : "border-transparent text-muted hover:text-text",
              focusRing,
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="text-label text-subtle tabular-nums">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
