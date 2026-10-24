"use client";

import { useId } from "react";
import { focusRing } from "@/lib/ui";

export type SliderStep = { value: number; label: string };

export type WidgetSliderProps = {
  label: string;
  /** Discrete choices in ascending order, e.g. downtime days 0, 1, 3, 7. */
  steps: SliderStep[];
  value: number;
  onChange: (value: number) => void;
};

export function WidgetSlider({ label, steps, value, onChange }: WidgetSliderProps) {
  const id = useId();
  if (steps.length === 0) return null;

  const index = Math.max(0, steps.findIndex((step) => step.value === value));
  const current = steps[index];

  return (
    <div className="flex flex-col gap-sp-1">
      <div className="flex items-baseline justify-between gap-sp-3">
        <label htmlFor={id} className="text-label font-med text-muted">
          {label}
        </label>
        <output htmlFor={id} className="text-body font-med tabular-nums">
          {current?.label}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        aria-valuetext={current?.label}
        onChange={(event) => {
          const next = steps[Number(event.target.value)];
          if (next) onChange(next.value);
        }}
        className={`h-sp-12 w-full accent-brand ${focusRing}`}
      />
      <div className="flex justify-between text-caption text-subtle tabular-nums" aria-hidden="true">
        {steps.map((step) => (
          <span key={step.value}>{step.label}</span>
        ))}
      </div>
    </div>
  );
}
