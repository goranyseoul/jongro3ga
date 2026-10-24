"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CategoryGlyph } from "@/components/customer/category-glyph";
import type { Locale } from "@/lib/domain/common";
import { procedureMaster } from "@/lib/domain/procedure-master";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  CATEGORY_NAME,
  CATEGORY_ORDER,
  DIRECTORY,
  DIRECTORY_AREAS,
  STANDARD_ORDER,
  STANDARD_TEXT,
  clinicsForCategory,
  clinicsForProcedure,
  clinicsInArea,
  procedureLabel,
  proceduresInCategory,
  type DirectoryTopic,
} from "@/lib/ui-data/directory";
import { COURSE_PROCEDURES, FEATURED_PROCEDURES, LANDING_HOME_COPY } from "./landing-home-copy";

export type LandingAsk = (text: string, topic: DirectoryTopic) => void;

const card = cn(
  "rounded-card border border-border-soft bg-elev text-start shadow-card transition duration-press ease-out hover:bg-sunken active:scale-press",
  focusRing,
);
const section = "mx-auto w-full max-w-5xl px-sp-4 md:px-sp-6";
const snapRow =
  "cu-snap-row -mx-sp-4 flex snap-x snap-mandatory gap-sp-3 overflow-x-auto px-sp-4 pb-sp-1 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0";

// The landing under the hero: categories, an overview card, the treatment rail, visitor courses,
// standards, figures and areas. Nothing here links away: every tap becomes a message to the agent,
// which answers in the chat on this same screen. No clinic names or prices appear on this page.
export function LandingHome({ locale, onAsk }: { locale: Locale; onAsk: LandingAsk }) {
  const c = LANDING_HOME_COPY[locale];
  const common = useTranslations("common");

  const downtime = (id: string) => {
    const range = procedureMaster.find((p) => p.id === id)?.downtimeDays;
    if (!range || range.max === 0) return c.treatments.noDowntime;
    return c.treatments.downtime(range.min === range.max ? `${range.max}` : `${range.min}~${range.max}`);
  };

  return (
    <div className="relative flex flex-col gap-sp-12 pb-sp-16 pt-sp-8">
      <section aria-labelledby="home-categories" data-tour="topics" className={section}>
        <SectionHead id="home-categories" title={c.categories.title} sub={c.categories.sub} />
        <ul className="mt-sp-4 grid grid-cols-2 gap-sp-3 md:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_ORDER.map((area) => {
            const name = CATEGORY_NAME[area][locale] ?? CATEGORY_NAME[area].en ?? area;
            const sample = proceduresInCategory(area)
              .slice(0, 2)
              .map((p) => procedureLabel(p.id, locale))
              .join(" · ");
            return (
              <li key={area}>
                <button
                  type="button"
                  onClick={() => onAsk(c.ask.category(name), { kind: "category", id: area })}
                  className={cn(card, "group relative flex min-h-touch w-full flex-col justify-between gap-sp-6 overflow-hidden p-sp-4")}
                >
                  <CategoryGlyph
                    area={area}
                    className="pointer-events-none absolute -bottom-sp-3 -right-sp-3 size-sp-16 text-subtle opacity-50 transition duration-dropdown ease-out group-hover:text-brand group-active:text-brand"
                  />
                  <span className="relative flex min-w-0 flex-col gap-sp-1">
                    <span className="text-title font-semi">{name}</span>
                    <span className="text-caption text-muted">{sample}</span>
                  </span>
                  <span className="relative text-label tabular-nums text-muted">
                    <span className="font-semi text-brand">{c.categories.count(clinicsForCategory(area).length)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={section}>
        <button
          type="button"
          onClick={() => onAsk(c.overview.ask, { kind: "all" })}
          className={cn(card, "cu-dot-grid flex min-h-touch w-full items-end justify-between gap-sp-4 p-sp-6")}
        >
          <span className="flex flex-col gap-sp-1">
            <span className="text-label text-muted">{c.overview.eyebrow}</span>
            <span className="text-h2 font-semi">{c.overview.title(DIRECTORY.length, DIRECTORY_AREAS.length)}</span>
          </span>
          <Chevron />
        </button>
      </section>

      <section aria-labelledby="home-treatments" className={section}>
        <SectionHead id="home-treatments" title={c.treatments.title} sub={c.treatments.sub} />
        <ul className={cn(snapRow, "mt-sp-4 md:grid-cols-5 md:gap-sp-3")}>
          {FEATURED_PROCEDURES.map((id) => {
            const procedure = procedureMaster.find((p) => p.id === id);
            const area = procedure?.areas[0] ?? "lifting";
            const name = procedureLabel(id, locale);
            return (
              <li key={id} className="shrink-0 basis-3/5 snap-start sm:basis-2/5 md:basis-auto">
                <button
                  type="button"
                  onClick={() => onAsk(c.ask.procedure(name), { kind: "procedure", id })}
                  className={cn(card, "flex h-full min-h-touch w-full flex-col gap-sp-2 p-sp-4")}
                >
                  <CategoryGlyph area={area} className="size-sp-5 text-text" />
                  <span className="text-body font-semi">{name}</span>
                  <span className="text-caption text-muted">{CATEGORY_NAME[area][locale] ?? CATEGORY_NAME[area].en}</span>
                  <span className="mt-auto flex flex-col gap-sp-1 text-caption tabular-nums">
                    <span className="whitespace-nowrap font-semi text-brand">{c.treatments.count(clinicsForProcedure(id).length)}</span>
                    <span className="text-muted">{downtime(id)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="home-courses" className={section}>
        <SectionHead id="home-courses" title={c.courses.title} sub={c.courses.sub} />
        <ul className={cn(snapRow, "mt-sp-4 md:grid-cols-3 md:gap-sp-3")}>
          {c.courses.items.map((item) => {
            const ids = COURSE_PROCEDURES[item.key];
            const names = ids.map((id) => procedureLabel(id, locale)).join(" · ");
            return (
              <li key={item.key} className="shrink-0 basis-4/5 snap-start sm:basis-1/2 md:basis-auto">
                <button
                  type="button"
                  onClick={() => onAsk(c.ask.course(names), { kind: "procedures", ids })}
                  className={cn(card, "flex h-full min-h-touch w-full flex-col gap-sp-2 p-sp-4")}
                >
                  <span className="text-body font-semi">{item.title}</span>
                  <span className="text-caption text-muted">{item.note}</span>
                  <span className="text-label">{names}</span>
                  <span className="mt-auto flex items-center gap-sp-1 text-caption font-semi text-brand">
                    {c.courses.open}
                    <Chevron small />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-sp-3 text-caption text-subtle">{c.courses.note}</p>
      </section>

      <section aria-labelledby="home-standards" className={section}>
        <p className="text-label font-med text-muted">{c.standards.eyebrow}</p>
        <SectionHead id="home-standards" title={c.standards.title(DIRECTORY.length)} sub={c.standards.sub} />
        <ul className="mt-sp-4 grid grid-cols-1 gap-sp-3 md:grid-cols-3">
          {c.standards.principles.map((p) => (
            <li key={p.title} className="rounded-card border border-border-soft bg-elev p-sp-4">
              <p className="text-body font-semi">{p.title}</p>
              <p className="mt-sp-1 text-label text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
        <ol className="mt-sp-4 overflow-hidden rounded-card border border-border-soft bg-elev">
          {STANDARD_ORDER.map((key, i) => (
            <li key={key} className="flex items-baseline gap-sp-3 border-t border-border-soft px-sp-4 py-sp-3 first:border-t-0">
              <span className="w-sp-6 shrink-0 text-title font-semi tabular-nums text-brand">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 text-body font-med">{STANDARD_TEXT[key].label[locale] ?? STANDARD_TEXT[key].label.en}</span>
              <span className="shrink-0 text-label text-muted">{STANDARD_TEXT[key].cycle[locale] ?? STANDARD_TEXT[key].cycle.en}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={section}>
        <dl className="grid grid-cols-2 gap-x-sp-6 gap-y-sp-6 md:grid-cols-4">
          {c.stats.items.map((s) => (
            <div key={s.caption} className="flex flex-col gap-sp-1">
              <dt className="order-2 text-label text-muted">{s.caption}</dt>
              <dd className="order-1 text-display font-semi tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-sp-3 text-caption text-subtle">{c.stats.source}</p>
      </section>

      <section aria-labelledby="home-areas" className={section}>
        <SectionHead id="home-areas" title={c.areas.title} />
        <ul className="mt-sp-3 flex flex-wrap gap-sp-2">
          {DIRECTORY_AREAS.map((area) => {
            const name = common(`area.${area}`);
            return (
              <li key={area}>
                <button
                  type="button"
                  onClick={() => onAsk(c.ask.area(name), { kind: "area", id: area })}
                  className={cn(card, "inline-flex min-h-touch items-center gap-sp-2 px-sp-4 text-body font-med")}
                >
                  {name}
                  <span className="text-label tabular-nums text-muted">{clinicsInArea(area).length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-brand px-sp-6 py-sp-12 text-on-brand">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-sp-3 text-center">
          <p className="text-label font-med opacity-80">{c.closing.eyebrow}</p>
          <h2 className="text-h1 font-semi">{c.closing.title}</h2>
          <p className="text-body opacity-80">{c.closing.body}</p>
          <button
            type="button"
            onClick={() => onAsk(c.overview.ask, { kind: "all" })}
            className={cn(
              "mt-sp-3 inline-flex min-h-touch items-center rounded-md bg-elev px-sp-6 text-body font-semi text-text transition duration-press ease-out active:scale-press",
              focusRing,
            )}
          >
            {c.closing.cta}
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ id, title, sub }: { id?: string; title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1">
      <h2 id={id} className="text-h2 font-semi">
        {title}
      </h2>
      {sub ? <p className="text-label text-muted">{sub}</p> : null}
    </div>
  );
}

function Chevron({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={small ? "size-sp-3" : "size-sp-5 shrink-0"}>
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
