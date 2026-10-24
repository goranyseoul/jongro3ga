import type { RecipeV1 } from "../../a2a/schemas";
import type { Area, Locale } from "../../domain/common";
import type { CustomerProfile } from "../../domain/customer";
import type { SystemPrompt } from "../types";
import { MEDICAL_BOUNDARY, languageRules } from "./medical-boundary";
import { PROCEDURE_ID_TABLE } from "./procedures";

// "요청 정리" (02 1절): one sentence ("リジュラン受けたい") -> draft_procedure_request, extracted as structured
// output. Defaults come from the profile and the platform recipe; the model fills, it does not judge.

const GANGNAM_SINSA: Area[] = ["gangnam", "sinsa", "apgujeong"];

/** 07 "지역 그룹": gangnam_sinsa = gangnam, sinsa, apgujeong; the others are groups of one. The stay area comes first. */
export function areaGroupOf(area: Area): Area[] {
  return GANGNAM_SINSA.includes(area) ? [area, ...GANGNAM_SINSA.filter((other) => other !== area)] : [area];
}

export type IntentProfile = Pick<CustomerProfile, "locale" | "nationality" | "residency" | "ageBand" | "trip" | "prefs">;

export interface IntentInput {
  utterance: string;
  locale: Locale;
  profile: IntentProfile;
  /** platform.recipe answer when the agent already has it (typical amounts for the default). */
  recipe?: Pick<RecipeV1, "procedures">;
  /** True when the customer has no treatment record in Korea yet. */
  firstKProcedure?: boolean;
  today: string;
}

export const INTENT_STABLE = `You turn one sentence from a customer of PibooK into the conditions of a procedure request. You fill fields, you never judge whether the procedure suits the customer.

## Default rules (02 "요청 정리")
- procedureId: from the table below only. If the sentence names no procedure in the table, use "unknown" and ask which procedure in followUpQuestion.
- amount: if the customer did not say it, use the recipe's typical amount minimum (typicalAmount.min with its unit). If no recipe is given and no amount was said, leave amount out and ask in followUpQuestion.
- areas: the whole area group of the stay area (sinsa, gangnam, apgujeong belong together; myeongdong, hongdae, other are alone). This is location information, not a filter. Leave out if no stay area.
- budgetKrw: prefs.budgetKrw of the profile, unless the customer said another budget.
- dateWindow: the trip (arrival to departure), unless the customer named dates.
- languages: prefs.languagesNeeded of the profile.
- visitorProfile: nationality, residency, ageBand from the profile; firstKProcedure as given.
- productPreference only if the customer named a product. notes only for a stated wish that fits no field.
- followUpQuestion: only when a required value is still missing, one short question in the customer's language.

## Procedure master
${PROCEDURE_ID_TABLE}

${MEDICAL_BOUNDARY}`;

export function buildIntentPrompt(input: IntentInput): SystemPrompt {
  return {
    stable: INTENT_STABLE,
    dynamic: `${languageRules(input.locale)}

## Customer
Today: ${input.today}
Profile: ${JSON.stringify(input.profile)}
firstKProcedure: ${input.firstKProcedure ?? "unknown"}
Recipe: ${input.recipe ? JSON.stringify(input.recipe.procedures) : "not available"}`,
  };
}
