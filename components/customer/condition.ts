import type { IsoDate, Krw, Locale } from "@/lib/domain/common";
import {
  getProcedure,
  type Amount,
  type Area,
  type Unit,
} from "@/lib/ui-data/customer";

// The condition card of 05-screens.md: procedure, amount, budget, area, language, dates.
export type Condition = {
  procedureId: string;
  amount: Amount;
  budgetKrw?: Krw;
  areas: Area[];
  languages: Locale[];
  dateWindow: { from: IsoDate; to: IsoDate };
};

/** Discrete amounts a customer can pick for each unit. */
export const AMOUNT_STEPS: Record<Unit, number[]> = {
  cc: [1, 2, 3, 4],
  shot: [300, 600, 900, 1200],
  unit: [20, 30, 40, 50, 60],
  line: [200, 300, 400, 600],
  session: [1, 2, 3],
  vial: [1, 2, 3, 4],
};

export const AREAS: Area[] = ["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"];

export function isTypicalMinimum(condition: Condition): boolean {
  const procedure = getProcedure(condition.procedureId);
  return Boolean(procedure) && condition.amount.value === procedure?.typicalAmount.min;
}
