"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";

export type FilterOption = { value: string; label: string };

export type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

// Native select styled like Input so the filter row reads as one set of fields.
export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-sp-1">
      <label htmlFor={id} className="text-label font-med text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn("ops-select", fieldBase, "border-input", focusRing)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
