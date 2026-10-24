// 06 seed defaults for the six spec procedures ("시드 시술과 주기" table; downtime as the customer screens use it,
// lib/ui-data/customer.ts). schedule.ts falls back to these only where the shared procedure master
// (lib/domain/procedure-master, 27 entries) has a null field. The platform keeps its own copy
// (lib/agents/platform/procedure-facts.ts); modules do not import each other (09 "모듈 경계").

export interface ProcedureDefaults {
  cycle: {
    initial?: { count: number; intervalDays: number };
    maintenanceIntervalDays: { min: number; max: number };
  };
  downtimeDays: { min: number; max: number };
}

export const PROCEDURE_DEFAULTS: Readonly<Record<string, ProcedureDefaults>> = {
  rejuran_healer: {
    cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } },
    downtimeDays: { min: 1, max: 1 },
  },
  thermage_flx: { cycle: { maintenanceIntervalDays: { min: 300, max: 400 } }, downtimeDays: { min: 0, max: 1 } },
  ulthera: { cycle: { maintenanceIntervalDays: { min: 300, max: 400 } }, downtimeDays: { min: 0, max: 2 } },
  botox_forehead: { cycle: { maintenanceIntervalDays: { min: 90, max: 120 } }, downtimeDays: { min: 0, max: 1 } },
  shrink_universe: { cycle: { maintenanceIntervalDays: { min: 30, max: 60 } }, downtimeDays: { min: 0, max: 1 } },
  skin_booster_juvelook: {
    cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 180, max: 180 } },
    downtimeDays: { min: 1, max: 3 },
  },
};
