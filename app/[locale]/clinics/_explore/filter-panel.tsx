"use client";

import { useId, useState, type ReactNode } from "react";
import { Chip, ChipGroup } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing, fieldBase } from "@/lib/ui";
import type { Area } from "@/lib/ui-data/customer";
import {
  CATEGORY_NAME,
  CATEGORY_ORDER,
  DIRECTORY_AREAS,
  STANDARD_ORDER,
  STANDARD_TEXT,
  procedureLabel,
  type ProcedureArea,
} from "@/lib/ui-data/directory";
import type { ExploreCopy } from "./copy";
import { FILTER_LANGUAGES, procedureOptions, withGroup, type ExploreFilters, type FilterLanguage } from "./filters";

type Props = {
  id: string;
  locale: Locale;
  copy: ExploreCopy;
  filters: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
  areaName: (area: Area) => string;
  /** Below lg the panel folds away behind the Filters button; from lg up it is always shown. */
  open: boolean;
};

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-sp-1">
      <label htmlFor={id} className="text-label font-med text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldBase, "ex-select border-input", focusRing)}
      >
        {children}
      </select>
    </div>
  );
}

export function FilterPanel({ id, locale, copy, filters, onChange, areaName, open }: Props) {
  const [standardsOpen, setStandardsOpen] = useState(filters.std.length > 0);
  const standardsId = useId();
  const c = copy.filters;
  const groupName = (area: ProcedureArea) => CATEGORY_NAME[area][locale] ?? CATEGORY_NAME[area].en ?? area;
  const options = procedureOptions(filters.group);

  return (
    <section
      id={id}
      aria-label={c.panel}
      className={cn("flex-col gap-sp-4 rounded-card border border-border-soft bg-elev p-sp-4", open ? "flex" : "hidden", "lg:flex")}
    >
      <div className="grid gap-sp-3 sm:grid-cols-2">
        <Select
          label={c.group}
          value={filters.group ?? ""}
          onChange={(value) => onChange(withGroup(filters, (value || null) as ProcedureArea | null))}
        >
          <option value="">{c.any}</option>
          {CATEGORY_ORDER.map((area) => (
            <option key={area} value={area}>
              {groupName(area)}
            </option>
          ))}
        </Select>

        <Select label={c.procedure} value={filters.tx ?? ""} onChange={(value) => onChange({ ...filters, tx: value || null })}>
          <option value="">{c.any}</option>
          {filters.group
            ? options.map((option) => (
                <option key={option.id} value={option.id}>
                  {procedureLabel(option.id, locale)}
                </option>
              ))
            : CATEGORY_ORDER.map((area) => {
                const inGroup = options.filter((option) => option.group === area);
                if (inGroup.length === 0) return null;
                return (
                  <optgroup key={area} label={groupName(area)}>
                    {inGroup.map((option) => (
                      <option key={option.id} value={option.id}>
                        {procedureLabel(option.id, locale)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
        </Select>

        <Select label={c.area} value={filters.area ?? ""} onChange={(value) => onChange({ ...filters, area: (value || null) as Area | null })}>
          <option value="">{c.any}</option>
          {DIRECTORY_AREAS.map((area) => (
            <option key={area} value={area}>
              {areaName(area)}
            </option>
          ))}
        </Select>

        <Select
          label={c.language}
          value={filters.lang ?? ""}
          onChange={(value) => onChange({ ...filters, lang: (value || null) as FilterLanguage | null })}
        >
          <option value="">{c.any}</option>
          {FILTER_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {copy.languageNames[lang]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-sp-2">
        <Chip selected={filters.fd} onClick={() => onChange({ ...filters, fd: !filters.fd })}>
          {c.femaleDoctor}
        </Chip>
      </div>

      <div className="flex flex-col gap-sp-3">
        <button
          type="button"
          aria-expanded={standardsOpen}
          aria-controls={standardsId}
          onClick={() => setStandardsOpen((value) => !value)}
          className={cn(
            "flex min-h-touch w-full items-center justify-between gap-sp-3 rounded-md text-start text-body font-med",
            focusRing,
          )}
        >
          <span>
            {c.standards}
            <span className="ms-sp-2 tabular-nums text-muted">
              {filters.std.length}/{STANDARD_ORDER.length}
            </span>
          </span>
          <span aria-hidden="true" className={cn("ex-chevron text-muted", standardsOpen && "ex-chevron-open")}>
            <svg viewBox="0 0 24 24" fill="none" className="size-sp-5">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <div id={standardsId} className={cn("flex-col gap-sp-3", standardsOpen ? "flex" : "hidden")}>
          <p className="text-caption text-muted">{c.standardsHint}</p>
          <ChipGroup
            multiple
            label={c.standards}
            value={filters.std}
            onChange={(next) => onChange({ ...filters, std: STANDARD_ORDER.filter((key) => next.includes(key)) })}
            options={STANDARD_ORDER.map((key) => ({
              value: key,
              label: STANDARD_TEXT[key].label[locale] ?? STANDARD_TEXT[key].label.en ?? key,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
