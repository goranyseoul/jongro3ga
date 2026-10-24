"use client";

import { useState } from "react";
import { LOCALE_NAME } from "@/app/[locale]/locales";
import type { Locale } from "@/lib/domain/common";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  STANDARD_ORDER,
  STANDARD_TEXT,
  directoryClinicName,
  procedureLabel,
  type DirectoryClinic,
} from "@/lib/ui-data/directory";
import type { Area } from "@/lib/ui-data/customer";
import { TaskSteps } from "./task-steps";

export type ClinicCardLabels = {
  standards: (checked: number, total: number) => string;
  details: string;
  hide: string;
  checked: string;
  unchecked: string;
  proxy: string;
  direct: string;
  demo: string;
};

export type ClinicCarouselProps = {
  clinics: DirectoryClinic[];
  locale: Locale;
  areaName: (area: Area) => string;
  /** Procedures the customer asked about, listed first on each card. */
  focus?: string[];
  labels: ClinicCardLabels;
};

// Clinic cards inside an agent answer: a swipeable row on phones, two or three per view on wider screens.
// Each card opens in place to show which standards it passes.
export function ClinicCarousel({ clinics, locale, areaName, focus = [], labels }: ClinicCarouselProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-sp-2">
      <ul className="cu-snap-row flex snap-x snap-mandatory items-start gap-sp-3 overflow-x-auto pb-sp-1">
        {clinics.map((clinic) => {
          const isOpen = open === clinic.id;
          const procedures = [...clinic.procedures].sort((a, b) => Number(focus.includes(b)) - Number(focus.includes(a))).slice(0, 3);
          return (
            <li key={clinic.id} className="shrink-0 basis-4/5 snap-start sm:basis-1/2">
              <article className="flex flex-col gap-sp-3 rounded-card border border-border-soft bg-elev p-sp-4 shadow-card">
                <header className="flex flex-col gap-sp-1">
                  <h3 className="text-title font-semi">{directoryClinicName(clinic, locale)}</h3>
                  <p className="text-caption text-muted">
                    {areaName(clinic.area)} · {clinic.languages.map((l) => LOCALE_NAME[l]).join(" · ")}
                  </p>
                </header>
                <p className="text-label">{procedures.map((id) => procedureLabel(id, locale)).join(" · ")}</p>
                <div className="flex items-center justify-between gap-sp-2">
                  {/* the count reads like a link, so it opens the same list as the button below */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : clinic.id)}
                    className={cn("inline-flex min-h-touch items-center text-caption font-semi text-brand tabular-nums hover:underline", focusRing)}
                  >
                    {labels.standards(clinic.passes.length, STANDARD_ORDER.length)}
                  </button>
                  <span className="text-caption text-subtle">{clinic.operationMode === "proxy" ? labels.proxy : labels.direct}</span>
                </div>
                {isOpen ? (
                  <TaskSteps
                    label={labels.standards(clinic.passes.length, STANDARD_ORDER.length)}
                    statusLabels={{ done: labels.checked, pending: labels.unchecked, active: labels.unchecked, error: labels.unchecked }}
                    steps={STANDARD_ORDER.map((key) => ({
                      id: key,
                      label: <span className="text-label">{STANDARD_TEXT[key].label[locale] ?? STANDARD_TEXT[key].label.en}</span>,
                      status: clinic.passes.includes(key) ? "done" : "pending",
                    }))}
                  />
                ) : null}
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : clinic.id)}
                  className={cn(
                    "inline-flex min-h-touch items-center justify-center rounded-md border border-input text-label font-med transition duration-press ease-out hover:bg-sunken active:scale-press",
                    focusRing,
                  )}
                >
                  {isOpen ? labels.hide : labels.details}
                </button>
              </article>
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-subtle">{labels.demo}</p>
    </div>
  );
}
