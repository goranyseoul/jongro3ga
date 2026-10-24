"use client";

import { useCallback, useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAgent } from "@/components/customer/agent-context";
import { Button, Card, buttonStyles } from "@/components/ui";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing } from "@/lib/ui";
import type { Area } from "@/lib/ui-data/customer";
import {
  CATEGORY_NAME,
  DIRECTORY,
  STANDARD_ORDER,
  STANDARD_TEXT,
  directoryClinicName,
  procedureLabel,
} from "@/lib/ui-data/directory";
import { profileFor } from "@/lib/ui-data/directory-profile";
import { ClinicCard, cardDomId } from "./clinic-card";
import { ClinicMap, MAP_DOM_ID, type MapClinic } from "./clinic-map";
import { EXPLORE_COPY } from "./copy";
import { FilterPanel } from "./filter-panel";
import {
  EMPTY_FILTERS,
  activeChips,
  activeFilterCount,
  filterClinics,
  parseFilters,
  removeChip,
  serializeFilters,
  type ExploreFilters,
  type FilterChip,
} from "./filters";
import { CloseGlyph, FilterGlyph } from "./glyphs";

type View = "list" | "map";

const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Brings a card into view only when it is not fully visible; a card in the hidden list (phone map view) is skipped.
function revealCard(clinicId: string) {
  const element = document.getElementById(cardDomId(clinicId));
  if (!element || element.offsetParent === null) return;
  const rect = element.getBoundingClientRect();
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
  element.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function ExploreView({ locale }: { locale: Locale }) {
  const copy = EXPLORE_COPY[locale];
  const common = useTranslations("common");
  const { ask } = useAgent();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const panelId = useId();

  // The URL is the source of truth; the optimistic copy makes a tap show at once while the route updates.
  const fromUrl = useMemo(() => parseFilters(params), [params]);
  const [filters, setOptimistic] = useOptimistic(fromUrl);
  const [, startTransition] = useTransition();

  const [view, setView] = useState<View>("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<Area | null>(null);

  const areaName = useCallback((area: Area) => common(`area.${area}`), [common]);

  const update = useCallback(
    (next: ExploreFilters) => {
      startTransition(() => {
        setOptimistic(next);
        const query = serializeFilters(next);
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setOptimistic],
  );

  const rows = useMemo(
    () =>
      filterClinics(filters).flatMap((clinic) => {
        const profile = profileFor(clinic.id);
        return profile ? [{ clinic, profile }] : [];
      }),
    [filters],
  );
  const byId = useMemo(() => new Map(rows.map((row) => [row.clinic.id, row])), [rows]);
  const mapClinics = useMemo<MapClinic[]>(
    () =>
      rows.map(({ clinic, profile }) => ({
        id: clinic.id,
        area: clinic.area,
        lat: profile.lat,
        lng: profile.lng,
        name: directoryClinicName(clinic, locale),
      })),
    [rows, locale],
  );

  // A selection or hover that the filters removed from the result is simply ignored.
  const selectedId = pickedId && byId.has(pickedId) ? pickedId : null;
  const activeId = hoverId && byId.has(hoverId) ? hoverId : selectedId;
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const total = DIRECTORY.length;
  const filterCount = activeFilterCount(filters);
  const chips = activeChips(filters);

  const chipLabel = (chip: FilterChip): string => {
    switch (chip.key) {
      case "group":
        return CATEGORY_NAME[chip.value][locale] ?? CATEGORY_NAME[chip.value].en ?? chip.value;
      case "tx":
        return procedureLabel(chip.value, locale);
      case "area":
        return areaName(chip.value);
      case "lang":
        return copy.languageNames[chip.value];
      case "std":
        return STANDARD_TEXT[chip.value].label[locale] ?? STANDARD_TEXT[chip.value].label.en ?? chip.value;
      case "fd":
        return copy.filters.femaleDoctor;
    }
  };

  const selectOnMap = (clinicId: string | null) => {
    setPickedId(clinicId);
    if (clinicId) revealCard(clinicId);
  };

  const zoomTo = (area: Area | null) => {
    setFocusArea(area);
    // keeping a selection that is now off the zoomed map would leave a mini card without its pin
    if (area && selected && selected.clinic.area !== area) setPickedId(null);
  };

  const showOnMap = (clinicId: string) => {
    const row = byId.get(clinicId);
    if (!row) return;
    setPickedId(clinicId);
    setFocusArea(row.clinic.area);
    if (isPhone()) {
      setView("map");
      requestAnimationFrame(() => document.getElementById(MAP_DOM_ID)?.scrollIntoView({ block: "start" }));
    }
  };

  // Back in the list, the card of the clinic picked on the map is brought into view.
  const changeView = (next: View) => {
    setView(next);
    if (next === "list" && selectedId) requestAnimationFrame(() => revealCard(selectedId));
  };

  const mini = selected ? (
    <>
      <div className="ex-mini-text">
        <p className="text-title font-semi">{directoryClinicName(selected.clinic, locale)}</p>
        <p className="text-label text-muted">
          {areaName(selected.clinic.area)} · {copy.card.standards}{" "}
          <span className="tabular-nums">
            {selected.clinic.passes.length}/{STANDARD_ORDER.length}
          </span>
        </p>
      </div>
      <Link
        href={`/clinics/${selected.profile.slug}`}
        aria-label={`${copy.card.details}: ${directoryClinicName(selected.clinic, locale)}`}
        className={buttonStyles({ variant: "primary" })}
      >
        {copy.card.details}
      </Link>
      <Button variant="ghost" aria-label={copy.map.closeCard} onClick={() => setPickedId(null)}>
        <CloseGlyph className="size-sp-5" />
      </Button>
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex items-center justify-between gap-sp-3 lg:hidden">
        <Button
          variant="secondary"
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <FilterGlyph className="size-sp-4" />
          {copy.filters.toggle}
          {filterCount > 0 ? <span className="tabular-nums">({filterCount})</span> : null}
        </Button>
        <div role="group" aria-label={copy.view.label} className="inline-flex gap-sp-1 rounded-md border border-input bg-elev p-sp-1">
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => changeView(option)}
              className={cn(
                "min-h-touch min-w-touch rounded-sm px-sp-4 text-body font-med transition-colors duration-press ease-out",
                view === option ? "bg-brand text-on-brand" : "text-muted hover:text-text",
                focusRing,
              )}
            >
              {copy.view[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="ex-layout">
        <div className="flex min-w-0 flex-col gap-sp-4">
          <FilterPanel
            id={panelId}
            locale={locale}
            copy={copy}
            filters={filters}
            onChange={update}
            areaName={areaName}
            open={filtersOpen}
          />

          <div className="flex flex-col gap-sp-2">
            <p role="status" aria-live="polite" data-explore-count={rows.length} className="text-label text-muted tabular-nums">
              {copy.count(rows.length, total)}
            </p>
            {chips.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-sp-2">
                {chips.map((chip) => {
                  const label = chipLabel(chip);
                  return (
                    <li key={`${chip.key}-${chip.value}`}>
                      <button
                        type="button"
                        data-filter-chip={chip.key}
                        aria-label={copy.active.remove(label)}
                        onClick={() => update(removeChip(filters, chip))}
                        className={cn(
                          "inline-flex min-h-touch items-center gap-sp-2 rounded-md border border-input bg-elev px-sp-3 text-label font-med transition-colors duration-press ease-out hover:bg-sunken",
                          focusRing,
                        )}
                      >
                        {label}
                        <CloseGlyph className="size-sp-4 text-muted" />
                      </button>
                    </li>
                  );
                })}
                <li>
                  <Button variant="ghost" onClick={() => update(EMPTY_FILTERS)}>
                    {copy.active.clearAll}
                  </Button>
                </li>
              </ul>
            ) : null}
          </div>

          <div className={cn(view === "map" && "hidden", "lg:block")}>
            {rows.length > 0 ? (
              <ol aria-label={copy.card.listLabel} className="grid gap-sp-3 md:grid-cols-2 lg:grid-cols-1">
                {rows.map(({ clinic, profile }) => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    profile={profile}
                    locale={locale}
                    copy={copy}
                    areaLabel={areaName(clinic.area)}
                    hovered={activeId === clinic.id && selectedId !== clinic.id}
                    selected={selectedId === clinic.id}
                    onHover={setHoverId}
                    onShowOnMap={showOnMap}
                    onAsk={ask}
                  />
                ))}
              </ol>
            ) : (
              <Card className="flex flex-col items-start gap-sp-3 p-sp-6">
                <h2 className="text-title font-semi">{copy.empty.title}</h2>
                <p className="text-body text-muted">{copy.empty.body}</p>
                <div className="flex flex-wrap gap-sp-2">
                  <Button onClick={() => update(EMPTY_FILTERS)}>{copy.empty.clear}</Button>
                  <Button variant="secondary" onClick={() => ask(copy.empty.askSentence, { kind: "all" })}>
                    {copy.empty.ask}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className={cn("ex-map-slot", view === "list" && "hidden", "lg:block")}>
          <ClinicMap
            copy={copy}
            clinics={mapClinics}
            areaName={areaName}
            activeId={activeId}
            selectedId={selectedId}
            focusArea={focusArea}
            onFocusArea={zoomTo}
            onSelect={selectOnMap}
            onHover={setHoverId}
            mini={mini}
          />
        </div>
      </div>
    </div>
  );
}
