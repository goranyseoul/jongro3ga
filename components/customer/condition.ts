import type { IsoDate, Krw, Locale } from "@/lib/domain/common";
import {
  getProcedure,
  type Amount,
  type Area,
  type CustomerProfile,
  type Procedure,
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
};

export const AREAS: Area[] = ["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"];

// Area groups of 07-platform-intelligence.md: the stay area stands for its whole group.
const AREA_GROUP: Record<Area, Area[]> = {
  gangnam: ["sinsa", "gangnam", "apgujeong"],
  sinsa: ["sinsa", "gangnam", "apgujeong"],
  apgujeong: ["sinsa", "gangnam", "apgujeong"],
  myeongdong: ["myeongdong"],
  hongdae: ["hongdae"],
  other: [],
};

/** Defaults of 02-agents.md "요청 정리": usual minimum amount, the stay area's group, profile budget, stay dates, profile languages. */
export function buildCondition(profile: CustomerProfile, procedure: Procedure): Condition {
  const stay = profile.trip;
  return {
    procedureId: procedure.id,
    amount: { value: procedure.typicalAmount.min, unit: procedure.unit },
    budgetKrw: profile.prefs.budgetKrw?.max,
    areas: stay?.stayArea ? AREA_GROUP[stay.stayArea] : [],
    languages: profile.prefs.languagesNeeded,
    dateWindow: { from: stay?.arrival ?? "", to: stay?.departure ?? "" },
  };
}

export function isTypicalMinimum(condition: Condition): boolean {
  const procedure = getProcedure(condition.procedureId);
  return Boolean(procedure) && condition.amount.value === procedure?.typicalAmount.min;
}
