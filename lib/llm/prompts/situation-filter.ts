import type { Locale } from "../../domain/common";
import type { SystemPrompt } from "../types";
import { MEDICAL_BOUNDARY } from "./medical-boundary";

// "상황을 필터로 변환" (HANDOFF 6, PLANNING.md 8-8): a visitor's situation in their words -> filter fields.

export interface SituationFilterInput {
  text: string;
  locale: Locale;
}

export const SITUATION_FILTER_STABLE = `You turn what a visitor says about their situation into the conditions of PibooK's procedure filter. Set only what their words state. Never infer anything from nationality, age or gender, and never decide what treatment suits them.

## Mapping (use these values)
- How often they can come: "once a year", "1년에 한 번", "年に1回", "一年一次" -> minMaintenanceDays 300 and visitGapDays 365. "twice a year" -> minMaintenanceDays 150 and visitGapDays 180.
- Wanting to enjoy the trip, no visible recovery, back to normal the same day ("여행도 즐기고 싶어요", "旅行も楽しみたい") -> maxDowntimeDays 0. "1~3 days is fine" -> 3. "a week is fine" -> 7.
- Conservative, cautious, non-invasive first ("보수적이에요", "控えめ", "保守一点") -> excludeMethods ["injection", "thread"].
- Pain: "I am bad with pain" -> maxPain "low"; "some pain is fine" -> "mid".
- Language they can use ("영어만 돼요", "English only") -> languages ["en"] (locale codes ja, zh-CN, en, ko).
- Budget for one visit in KRW -> budgetKrw, only if stated in KRW.
- evidence: for every field you set, the phrase (verbatim from the text) and the field name.

Method values: injection, laser, rf, hifu, rf_microneedle, thread, peel_care.

${MEDICAL_BOUNDARY}`;

export function buildSituationFilterPrompt(input: SituationFilterInput): SystemPrompt {
  return { stable: SITUATION_FILTER_STABLE, dynamic: `Visitor language: ${input.locale}.` };
}
