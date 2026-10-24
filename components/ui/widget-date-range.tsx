"use client";

import type { IsoDate } from "@/lib/domain/common";
import { Input } from "./input";

/** Empty string means not chosen yet. */
export type DateRange = { start: IsoDate | ""; end: IsoDate | "" };

export type WidgetDateRangeProps = {
  value: DateRange;
  onChange: (value: DateRange) => void;
  startLabel: string;
  endLabel: string;
  min?: IsoDate;
  max?: IsoDate;
};

// Native date inputs: the OS picker is the best touch UI and handles every locale.
export function WidgetDateRange({ value, onChange, startLabel, endLabel, min, max }: WidgetDateRangeProps) {
  return (
    <div className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2">
      <Input
        type="date"
        label={startLabel}
        value={value.start}
        min={min}
        max={value.end || max}
        onChange={(event) => {
          const start = event.target.value;
          onChange({ start, end: value.end && start > value.end ? start : value.end });
        }}
      />
      <Input
        type="date"
        label={endLabel}
        value={value.end}
        min={value.start || min}
        max={max}
        onChange={(event) => onChange({ start: value.start, end: event.target.value })}
      />
    </div>
  );
}
