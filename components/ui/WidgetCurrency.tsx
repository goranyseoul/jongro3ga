"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

export interface WidgetCurrencyProps {
  label: string;
  confirmLabel: string;
  /** Currency symbol shown in the label hint, for example the KRW sign. */
  symbol?: string;
  defaultValue?: number;
  onConfirm: (value: number) => void;
}

export function WidgetCurrency({ label, confirmLabel, symbol = "₩", defaultValue, onConfirm }: WidgetCurrencyProps) {
  const [raw, setRaw] = useState(defaultValue !== undefined ? String(defaultValue) : "");
  const n = Number(raw.replace(/,/g, ""));
  const valid = raw !== "" && Number.isFinite(n) && n > 0;
  return (
    <div className="flex flex-col gap-sp-3 rounded-card border border-line bg-elev p-sp-4">
      <Input
        label={`${label} (${symbol})`}
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9,]/g, ""))}
        hint={valid ? `${symbol}${Math.round(n).toLocaleString("en-US")}` : undefined}
      />
      <Button disabled={!valid} onClick={() => onConfirm(Math.round(n))}>
        {confirmLabel}
      </Button>
    </div>
  );
}
