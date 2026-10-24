"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

export interface DateRange {
  from: string;
  to: string;
}

export interface WidgetDateRangeProps {
  fromLabel: string;
  toLabel: string;
  confirmLabel: string;
  defaultValue?: DateRange;
  onConfirm: (range: DateRange) => void;
}

export function WidgetDateRange({ fromLabel, toLabel, confirmLabel, defaultValue, onConfirm }: WidgetDateRangeProps) {
  const [from, setFrom] = useState(defaultValue?.from ?? "");
  const [to, setTo] = useState(defaultValue?.to ?? "");
  const invalid = !from || !to || to < from;
  return (
    <div className="flex flex-col gap-sp-3 rounded-card border border-line bg-elev p-sp-4">
      <div className="grid gap-sp-3 sm:grid-cols-2">
        <Input type="date" label={fromLabel} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label={toLabel} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button disabled={invalid} onClick={() => onConfirm({ from, to })}>
        {confirmLabel}
      </Button>
    </div>
  );
}
