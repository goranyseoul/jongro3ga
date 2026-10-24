"use client";

import { useState } from "react";
import { Chip } from "./Chip";

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  options: ChipOption[];
  /** Controlled values. Omit to let the group manage its own state. */
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  onChange?: (value: string[]) => void;
  ariaLabel?: string;
}

export function ChipGroup({ options, value, defaultValue = [], multiple = false, onChange, ariaLabel }: ChipGroupProps) {
  const [inner, setInner] = useState<string[]>(defaultValue);
  const current = value ?? inner;

  function toggle(v: string) {
    let next: string[];
    if (multiple) next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    else next = current.includes(v) ? [] : [v];
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-sp-2">
      {options.map((o) => (
        <Chip key={o.value} selected={current.includes(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
