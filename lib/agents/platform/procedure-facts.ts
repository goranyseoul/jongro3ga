import type { Unit } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";

// Procedure facts the platform needs and the shared procedure master (lib/domain/procedure-master, 27 entries
// from PLANNING appendix A, BUILD-LOG 10) does not carry: 06 `Procedure.typicalAmount`, `products`,
// `onsetDays` and `dataStatus`. Values for the six spec procedures are the 06 seed defaults (the same values the
// customer screens use in lib/ui-data/customer.ts), all `demo_assumption`. Cycle and downtime come from the master.

interface Facts {
  typicalAmount: { min: number; max: number };
  products: string[];
  onsetDays: { min: number; max: number };
  dataStatus: "confirmed_by_planner" | "demo_assumption";
}

const SPEC_FACTS: Record<string, Facts> = {
  rejuran_healer: {
    typicalAmount: { min: 2, max: 3 },
    products: ["Rejuran Healer", "Rejuran HB"],
    onsetDays: { min: 14, max: 28 },
    dataStatus: "demo_assumption",
  },
  thermage_flx: { typicalAmount: { min: 600, max: 900 }, products: ["Thermage FLX"], onsetDays: { min: 30, max: 90 }, dataStatus: "demo_assumption" },
  ulthera: { typicalAmount: { min: 300, max: 600 }, products: ["Ulthera"], onsetDays: { min: 30, max: 90 }, dataStatus: "demo_assumption" },
  botox_forehead: { typicalAmount: { min: 20, max: 50 }, products: ["Botox"], onsetDays: { min: 3, max: 14 }, dataStatus: "demo_assumption" },
  shrink_universe: { typicalAmount: { min: 300, max: 600 }, products: ["Shrink Universe"], onsetDays: { min: 14, max: 60 }, dataStatus: "demo_assumption" },
  skin_booster_juvelook: { typicalAmount: { min: 1, max: 2 }, products: ["Juvelook"], onsetDays: { min: 14, max: 42 }, dataStatus: "demo_assumption" },
};

/** Onset in days for the master's coarse `effectOnset` (used when a procedure has no spec facts). */
const ONSET_DAYS = {
  instant: { min: 0, max: 1 },
  "1w": { min: 3, max: 7 },
  "2-4w": { min: 14, max: 28 },
  gradual: { min: 30, max: 90 },
} as const;

export interface ProcedureFacts {
  procedureId: string;
  unit: Unit | null;
  /** Undefined when neither the spec facts nor the unit give one (only "session" procedures default to 1). */
  typicalAmount?: { min: number; max: number };
  products: string[];
  onsetDays?: { min: number; max: number };
  downtimeDays?: { min: number; max: number };
  cycle: {
    initial?: { count: number; intervalDays: number };
    maintenanceIntervalDays?: { min: number; max: number };
  };
  dataStatus: "confirmed_by_planner" | "demo_assumption";
}

export function procedureFacts(procedureId: string): ProcedureFacts | undefined {
  const master = getProcedure(procedureId);
  if (!master) return undefined;
  const spec = SPEC_FACTS[procedureId];
  const initial = master.cycle.initial;
  return {
    procedureId,
    unit: master.unit,
    typicalAmount: spec?.typicalAmount ?? (master.unit === "session" ? { min: 1, max: 1 } : undefined),
    products: spec?.products ?? [master.name.en ?? procedureId],
    onsetDays: spec?.onsetDays ?? (master.effectOnset ? ONSET_DAYS[master.effectOnset] : undefined),
    downtimeDays: master.downtimeDays ?? undefined,
    cycle: {
      ...(initial && initial.count !== null ? { initial: { count: initial.count, intervalDays: initial.intervalDays } } : {}),
      // Series only treatments (no upkeep interval in the table) repeat at the series interval.
      ...(master.cycle.maintenanceIntervalDays
        ? { maintenanceIntervalDays: master.cycle.maintenanceIntervalDays }
        : initial
          ? { maintenanceIntervalDays: { min: initial.intervalDays, max: initial.intervalDays } }
          : {}),
    },
    // Every master value is unverified (verified: false); only confirmed cycles would be "confirmed_by_planner".
    dataStatus: spec?.dataStatus ?? "demo_assumption",
  };
}
