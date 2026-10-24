import type { IsoDate } from "../../domain/common";
import { PROCEDURE_NAMES } from "../procedure-names";
import { MEDICAL_BOUNDARY_BLOCK } from "./medical-boundary";

// System prompt for request drafting (02 section 1 "요청 정리"). Claude only extracts what the customer said;
// defaults (typical amount, area group, budget, dates, languages) are applied by code afterwards, so the model
// never makes up a number.

const PROCEDURE_LIST = Object.entries(PROCEDURE_NAMES)
  .map(([id, entry]) => `- ${id}: ${entry.name.ko} / ${entry.name.ja} / ${entry.name.en} / ${entry.name["zh-CN"]}`)
  .join("\n");

export function buildIntentSystemPrompt(today: IsoDate): string {
  return `You turn one customer utterance into the fields of a procedure request for PibooK, a concierge that finds Korean dermatology clinics for foreign visitors.

Call the tool draft_procedure_request exactly once with only what the customer actually said:
- procedureId: the id from the list below that the customer named. Use "unknown" if they named none or something not on the list. Do not pick one for them from a concern.
- amount: only if they stated a quantity (2cc, 300 shots, 50 units).
- budgetKrwMax: only if they stated a price cap; convert to KRW only when they used KRW, otherwise leave it out.
- areas, dateFrom, dateTo, productPreference, notes: only if stated. Resolve relative dates against today (${today}).
Leave every other field out. The server fills defaults from the customer's profile.

Procedures (id: ko / ja / en / zh-CN):
${PROCEDURE_LIST}

${MEDICAL_BOUNDARY_BLOCK}`;
}
