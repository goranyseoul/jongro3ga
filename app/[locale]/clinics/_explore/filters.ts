// Value imports are relative on purpose: vitest in this repo has no "@" alias and these helpers are unit tested.
import { procedureMaster } from "../../../../lib/domain/procedure-master";
import type { Area } from "@/lib/ui-data/customer";
import {
  CATEGORY_ORDER,
  DIRECTORY,
  DIRECTORY_AREAS,
  STANDARD_ORDER,
  proceduresInCategory,
  rankClinics,
  type DirectoryClinic,
  type ProcedureArea,
  type StandardKey,
} from "../../../../lib/ui-data/directory";
import { profileFor } from "../../../../lib/ui-data/directory-profile";

// The explore screen keeps its whole filter state in the URL (?group=&tx=&area=&lang=&std=&fd=1), so a
// filtered list can be shared. This module is pure: parse the query, write it back, apply it.

export const FILTER_LANGUAGES = ["ja", "zh-CN", "en"] as const;
export type FilterLanguage = (typeof FILTER_LANGUAGES)[number];

export type ExploreFilters = {
  group: ProcedureArea | null;
  tx: string | null;
  area: Area | null;
  lang: FilterLanguage | null;
  std: StandardKey[];
  fd: boolean;
};

export const EMPTY_FILTERS: ExploreFilters = { group: null, tx: null, area: null, lang: null, std: [], fd: false };

/** Anything that reads like URLSearchParams (Next's ReadonlyURLSearchParams included). */
export type ParamReader = { get(name: string): string | null };

/** Procedure ids that at least one clinic offers, in procedure master order. */
export const OFFERED_PROCEDURE_IDS: string[] = procedureMaster
  .map((p) => p.id)
  .filter((id) => DIRECTORY.some((c) => c.procedures.includes(id)));

const isOneOf = <T extends string>(list: readonly T[], value: string | null): value is T =>
  value !== null && (list as readonly string[]).includes(value);

export function parseFilters(params: ParamReader): ExploreFilters {
  const group = params.get("group");
  const tx = params.get("tx");
  const area = params.get("area");
  const lang = params.get("lang");
  const std = new Set((params.get("std") ?? "").split(",").filter((key) => key.length > 0));
  return {
    group: isOneOf(CATEGORY_ORDER, group) ? group : null,
    tx: isOneOf(OFFERED_PROCEDURE_IDS, tx) ? tx : null,
    area: isOneOf(DIRECTORY_AREAS, area) ? area : null,
    lang: isOneOf(FILTER_LANGUAGES, lang) ? lang : null,
    std: STANDARD_ORDER.filter((key) => std.has(key)),
    fd: params.get("fd") === "1",
  };
}

/** Query string without the leading "?"; empty when no filter is set. Values are plain ids, so no escaping. */
export function serializeFilters(filters: ExploreFilters): string {
  const parts: string[] = [];
  if (filters.group) parts.push(`group=${filters.group}`);
  if (filters.tx) parts.push(`tx=${filters.tx}`);
  if (filters.area) parts.push(`area=${filters.area}`);
  if (filters.lang) parts.push(`lang=${filters.lang}`);
  if (filters.std.length > 0) parts.push(`std=${filters.std.join(",")}`);
  if (filters.fd) parts.push("fd=1");
  return parts.join("&");
}

export function activeFilterCount(filters: ExploreFilters): number {
  return (
    (filters.group ? 1 : 0) +
    (filters.tx ? 1 : 0) +
    (filters.area ? 1 : 0) +
    (filters.lang ? 1 : 0) +
    filters.std.length +
    (filters.fd ? 1 : 0)
  );
}

/** Clinics that match every active filter, in rank order (standards passed, never anything else). */
export function filterClinics(filters: ExploreFilters): DirectoryClinic[] {
  const inGroup = filters.group ? new Set(proceduresInCategory(filters.group).map((p) => p.id)) : null;
  const matches = DIRECTORY.filter(
    (clinic) =>
      (!inGroup || clinic.procedures.some((id) => inGroup.has(id))) &&
      (!filters.tx || clinic.procedures.includes(filters.tx)) &&
      (!filters.area || clinic.area === filters.area) &&
      (!filters.lang || clinic.languages.includes(filters.lang)) &&
      filters.std.every((key) => clinic.passes.includes(key)) &&
      (!filters.fd || profileFor(clinic.id)?.femaleDoctor === true),
  );
  return rankClinics(matches);
}

export type ProcedureOption = { id: string; group: ProcedureArea };

/** Procedures for the procedure select: one treatment group's, or every offered one under its first group. */
export function procedureOptions(group: ProcedureArea | null): ProcedureOption[] {
  const offered = new Set(OFFERED_PROCEDURE_IDS);
  if (group) {
    return proceduresInCategory(group)
      .filter((p) => offered.has(p.id))
      .map((p) => ({ id: p.id, group }));
  }
  return CATEGORY_ORDER.flatMap((area) =>
    proceduresInCategory(area)
      .filter((p) => offered.has(p.id) && CATEGORY_ORDER.find((a) => p.areas.includes(a)) === area)
      .map((p) => ({ id: p.id, group: area })),
  );
}

/** Choosing a treatment group drops a procedure that does not belong to it. */
export function withGroup(filters: ExploreFilters, group: ProcedureArea | null): ExploreFilters {
  const keepsProcedure =
    !group || !filters.tx || proceduresInCategory(group).some((p) => p.id === filters.tx);
  return { ...filters, group, tx: keepsProcedure ? filters.tx : null };
}

export type FilterChip =
  | { key: "group"; value: ProcedureArea }
  | { key: "tx"; value: string }
  | { key: "area"; value: Area }
  | { key: "lang"; value: FilterLanguage }
  | { key: "std"; value: StandardKey }
  | { key: "fd"; value: true };

export function activeChips(filters: ExploreFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.group) chips.push({ key: "group", value: filters.group });
  if (filters.tx) chips.push({ key: "tx", value: filters.tx });
  if (filters.area) chips.push({ key: "area", value: filters.area });
  if (filters.lang) chips.push({ key: "lang", value: filters.lang });
  for (const key of filters.std) chips.push({ key: "std", value: key });
  if (filters.fd) chips.push({ key: "fd", value: true });
  return chips;
}

export function removeChip(filters: ExploreFilters, chip: FilterChip): ExploreFilters {
  switch (chip.key) {
    case "group":
      return { ...filters, group: null };
    case "tx":
      return { ...filters, tx: null };
    case "area":
      return { ...filters, area: null };
    case "lang":
      return { ...filters, lang: null };
    case "std":
      return { ...filters, std: filters.std.filter((key) => key !== chip.value) };
    case "fd":
      return { ...filters, fd: false };
  }
}

export function toggleStandard(filters: ExploreFilters, key: StandardKey): ExploreFilters {
  const has = filters.std.includes(key);
  return { ...filters, std: STANDARD_ORDER.filter((k) => (k === key ? !has : filters.std.includes(k))) };
}
