import type { Locale } from "../../domain/common";
import { areaGroupOf, type IntentInput, type IntentProfile } from "../prompts/intent";
import { UNKNOWN_PROCEDURE } from "../tools/common";
import type { DraftProcedureRequest } from "../tools/procedure-request";
import { matchProcedure } from "./keywords";

// Fixture "요청 정리": the 02 default rules applied by code, so fixture mode gives the same conditions Claude
// is told to give. With no context it is Yuki's request (10 데모 2행).

/** Yuki after onboarding (04 대화 예시, trip moved to the spec's 11/13~11/15, BUILD-LOG 13). */
export const YUKI_PROFILE: IntentProfile = {
  locale: "ja",
  nationality: "JP",
  residency: "short_term_visitor",
  ageBand: "25-29",
  trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa", flightTimeHome: "20:00" },
  prefs: { budgetKrw: { max: 450000 }, languagesNeeded: ["ja"] },
};

export const YUKI_INTENT_INPUT: IntentInput = {
  utterance: "リジュラン受けたい",
  locale: "ja",
  profile: YUKI_PROFILE,
  firstKProcedure: true,
  today: "2026-11-12",
};

/**
 * Typical amounts used when no platform.recipe answer is in the context. Rejuran 2~3cc is the 07 verdict's
 * "통상 2~3cc" of the demo; the master itself has no amounts.
 */
const FIXTURE_TYPICAL_AMOUNTS: Record<string, { value: number; unit: "cc" | "shot" | "unit" | "vial" }> = {
  rejuran_healer: { value: 2, unit: "cc" },
  thermage_flx: { value: 300, unit: "shot" },
  ulthera: { value: 300, unit: "shot" },
  shrink_universe: { value: 300, unit: "shot" },
  botox_forehead: { value: 50, unit: "unit" },
  skin_booster_juvelook: { value: 1, unit: "vial" },
};

const ASK_PROCEDURE: Record<Locale, string> = {
  ja: "どの施術についてお探ししましょうか？",
  en: "Which procedure would you like me to look for?",
  "zh-CN": "您想了解哪个项目？",
  ko: "어떤 시술을 찾아 드릴까요?",
};

const ASK_AMOUNT: Record<Locale, string> = {
  ja: "ご希望の量(ccやショット数)を教えてください。",
  en: "How much would you like (cc or shots)?",
  "zh-CN": "请告诉我您想要的剂量(cc或发数)。",
  ko: "원하시는 양(cc나 샷 수)을 알려 주세요.",
};

export const INTENT_FOLLOW_UPS = [...Object.values(ASK_PROCEDURE), ...Object.values(ASK_AMOUNT)];

const AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(cc|CC|ml|ショット|shots?|샷|发)/;

const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

export function intentFixture(input: IntentInput = YUKI_INTENT_INPUT, utterance = input.utterance): DraftProcedureRequest {
  const { profile, locale } = input;
  const procedureId = matchProcedure(utterance) ?? UNKNOWN_PROCEDURE;

  const said = AMOUNT_RE.exec(utterance);
  const recipeAmount = input.recipe?.procedures.find((procedure) => procedure.procedureId === procedureId)?.typicalAmount;
  const amount = said
    ? { value: Number(said[1]), unit: /cc|ml/i.test(said[2]!) ? ("cc" as const) : ("shot" as const) }
    : recipeAmount
      ? { value: recipeAmount.min, unit: recipeAmount.unit }
      : FIXTURE_TYPICAL_AMOUNTS[procedureId];

  const followUpQuestion =
    procedureId === UNKNOWN_PROCEDURE ? ASK_PROCEDURE[locale] : amount === undefined ? ASK_AMOUNT[locale] : undefined;

  const trip = profile.trip;
  const draft: DraftProcedureRequest = {
    procedureId,
    languages: profile.prefs.languagesNeeded.length > 0 ? profile.prefs.languagesNeeded : [locale],
    dateWindow: trip ? { from: trip.arrival, to: trip.departure } : { from: input.today, to: addDays(input.today, 30) },
    visitorProfile: {
      nationality: profile.nationality,
      ...(profile.residency ? { residency: profile.residency } : {}),
      ageBand: profile.ageBand,
      ...(input.firstKProcedure !== undefined ? { firstKProcedure: input.firstKProcedure } : {}),
    },
  };
  if (amount && procedureId !== UNKNOWN_PROCEDURE) draft.amount = amount;
  if (profile.prefs.budgetKrw) draft.budgetKrw = { max: profile.prefs.budgetKrw.max };
  if (trip?.stayArea) draft.areas = areaGroupOf(trip.stayArea);
  if (followUpQuestion) draft.followUpQuestion = followUpQuestion;
  return draft;
}
