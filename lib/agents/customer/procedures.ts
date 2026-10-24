import type { Amount, Unit } from "../../domain/common";
import type { Procedure } from "../../domain/procedure";
import { getProcedure } from "../../domain/procedure-master";

// Procedure ids on the wire are free strings (BUILD-LOG 10): 03, 06, 07 and the A2A fixtures use product
// level ids ("rejuran_healer") while the master uses procedure ids ("rejuran"). The customer agent accepts
// both and resolves to the master id for cycle and downtime rules.
const ALIASES: Record<string, string> = {
  rejuran_healer: "rejuran",
  rejuran_hb: "rejuran",
  thermage_flx: "thermage",
  shrink_universe: "shrink",
  skin_booster_juvelook: "juvelook",
  botox_forehead: "botox_wrinkle",
  rituo: "lituo",
};

export function masterProcedureId(id: string): string {
  return ALIASES[id] ?? id;
}

export function procedureFor(id: string): Procedure | undefined {
  return getProcedure(masterProcedureId(id));
}

/** Same procedure for scheduling purposes ("rejuran_healer" and "rejuran" are one series). */
export function sameProcedure(a: string, b: string): boolean {
  return masterProcedureId(a) === masterProcedureId(b);
}

/**
 * Fallback usual amount when platform.recipe is unavailable (demo values, 06 "demo_assumption").
 * 02 says the default is the recipe's typicalAmount.min; this table only keeps the demo running offline.
 */
const FALLBACK_TYPICAL: Record<string, { min: number; max: number; unit: Unit }> = {
  rejuran: { min: 2, max: 3, unit: "cc" },
  thermage: { min: 600, max: 900, unit: "shot" },
  ulthera: { min: 300, max: 600, unit: "shot" },
  botox_wrinkle: { min: 20, max: 50, unit: "unit" },
  shrink: { min: 300, max: 600, unit: "shot" },
  juvelook: { min: 1, max: 2, unit: "vial" },
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
