import type { Concern, I18nText, Unit } from "./common";

// Procedure master, docs/spec/06-data-model.md. Read only seed data shared by all agents.
export interface Procedure {
  id: string;
  name: I18nText;
  category: "injection" | "laser" | "lifting" | "skin_booster";
  products: string[];
  unit: Unit;
  concerns: Concern[];
  typicalAmount: { min: number; max: number };
  downtimeDays: { min: number; max: number };
  onsetDays: { min: number; max: number };
  cycle: {
    initial?: { count: number; intervalDays: number };
    maintenanceIntervalDays: { min: number; max: number };
  };
  dataStatus: "confirmed_by_planner" | "demo_assumption";
}
