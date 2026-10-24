import type { Amount, Unit } from "../../domain/common";
import type { Procedure } from "../../domain/procedure";
import { getProcedure } from "../../domain/procedure-master";

// Procedure ids are the spec ids of data/seed/procedures.json ("rejuran_healer", BUILD-LOG row 10). Older
// short ids ("rejuran") from records stored before the ids were unified still resolve to the spec id.
const ALIASES: Record<string, string> = {
  rejuran: "rejuran_healer",
  rejuran_hb: "rejuran_healer",
  thermage: "thermage_flx",
  shrink: "shrink_universe",
  juvelook: "skin_booster_juvelook",
  botox_wrinkle: "botox_forehead",
  rituo: "lituo",
};

export function masterProcedureId(id: string): string {
  return ALIASES[id] ?? id;
}

export function procedureFor(id: string): Procedure | undefined {
  return getProcedure(masterProcedureId(id));
}

/** Same procedure for scheduling purposes ("rejuran" and "rejuran_healer" are one series). */
export function sameProcedure(a: string, b: string): boolean {
  return masterProcedureId(a) === masterProcedureId(b);
}

/**
 * Fallback usual amount when platform.recipe is unavailable (demo values, 06 "demo_assumption").
 * 02 says the default is the recipe's typicalAmount.min; this table only keeps the demo running offline.
 */
const FALLBACK_TYPICAL: Record<string, { min: number; max: number; unit: Unit }> = {
  rejuran_healer: { min: 2, max: 3, unit: "cc" },
  thermage_flx: { min: 600, max: 900, unit: "shot" },
  ulthera: { min: 300, max: 600, unit: "shot" },
  botox_forehead: { min: 20, max: 50, unit: "unit" },
  shrink_universe: { min: 300, max: 600, unit: "shot" },
  skin_booster_juvelook: { min: 1, max: 2, unit: "vial" },
  juvelook_volume: { min: 1, max: 2, unit: "vial" },
  skin_booster: { min: 2, max: 4, unit: "cc" },
};

export function fallbackTypicalAmount(id: string): { min: number; max: number; unit: Unit } {
  const known = FALLBACK_TYPICAL[masterProcedureId(id)];
  if (known) return known;
  const unit = procedureFor(id)?.unit ?? "session";
  return { min: 1, max: 1, unit };
}

export function fallbackAmount(id: string): Amount {
  const { min, unit } = fallbackTypicalAmount(id);
  return { value: min, unit };
}
