"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface WidgetSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  confirmLabel: string;
  onConfirm: (value: number) => void;
}

export function WidgetSlider({ label, min, max, step = 1, unit, defaultValue, confirmLabel, onConfirm }: WidgetSliderProps) {
  const [value, setValue] = useState(defaultValue ?? min);
  return (
    <div className="flex flex-col gap-sp-3 rounded-card border border-line bg-elev p-sp-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor="widget-slider" className="text-sm font-med text-muted">
          {label}
        </label>
        <span className="text-title font-semi text-text">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        id="widget-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="min-h-touch w-full accent-brand"
      />
      <Button onClick={() => onConfirm(value)}>{confirmLabel}</Button>
    </div>
  );
}
