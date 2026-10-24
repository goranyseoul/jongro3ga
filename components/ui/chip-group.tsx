"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Chip } from "./chip";

export type ChipOption<T extends string> = { value: T; label: ReactNode };

type Common<T extends string> = {
  /** Accessible name of the group, not rendered. */
  label: string;
  options: ChipOption<T>[];
  className?: string;
};

type Single<T extends string> = Common<T> & {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

type Multiple<T extends string> = Common<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

export type ChipGroupProps<T extends string> = Single<T> | Multiple<T>;

export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const isSelected = (value: T) => (props.multiple ? props.value.includes(value) : props.value === value);

  const select = (value: T) => {
    if (!props.multiple) {
      props.onChange(value);
      return;
    }
    props.onChange(props.value.includes(value) ? props.value.filter((v) => v !== value) : [...props.value, value]);
  };

  return (
    <div role="group" aria-label={props.label} className={cn("flex flex-wrap gap-sp-2", props.className)}>
      {props.options.map((option) => (
        <Chip key={option.value} selected={isSelected(option.value)} onClick={() => select(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
