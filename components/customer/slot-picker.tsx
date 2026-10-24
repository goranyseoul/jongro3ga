"use client";

import { Chip } from "@/components/ui";
import type { Locale } from "@/lib/domain/common";
import type { IsoDateTime } from "@/lib/ui-data/customer";
import { formatDay, formatTime } from "./format";

export type SlotPickerProps = {
  slots: IsoDateTime[];
  value?: IsoDateTime;
  onChange: (slot: IsoDateTime) => void;
  locale: Locale;
  disabled?: boolean;
};

// Slots grouped by day, each time a 44px chip. Tapping selects, 05-screens.md "가능 시간".
export function SlotPicker({ slots, value, onChange, locale, disabled = false }: SlotPickerProps) {
  const days = [...new Set(slots.map((slot) => slot.slice(0, 10)))];

  return (
    <div className="flex flex-col gap-sp-2">
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-sp-1">
          <span className="text-caption text-subtle tabular-nums">{formatDay(day, locale)}</span>
          <div className="flex flex-wrap gap-sp-2">
            {slots
              .filter((slot) => slot.startsWith(day))
              .map((slot) => (
                <Chip key={slot} selected={value === slot} disabled={disabled} onClick={() => onChange(slot)} className="tabular-nums">
                  {formatTime(slot)}
                </Chip>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
