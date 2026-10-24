import { missingRequiredSlots, type ClinicOnboardingDraft } from "../tools/onboarding";
import type { SystemPrompt } from "../types";
import { CONVERSATION_RULES } from "./onboarding-customer";
import { MEDICAL_BOUNDARY } from "./medical-boundary";

// Clinic onboarding system prompt (04-onboarding-chat.md "병원 온보딩"). Korean by default.

export const CLINIC_SLOT_TABLE = `## Slots, in this order (* = required)
| step | slot | type | widget | note |
| --- | --- | --- | --- | --- |
| 1 contact | contactPerson.name*, contactPerson.role* | string | free | manager, director, coordinator |
| 2 institution | clinicName*, address*, area* | string, area enum | free + chips | guess the area from the address, then confirm |
| 2 institution | medicalInstitutionId* | string | free | opening report number or care institution code |
| 2 institution | businessRegistrationNo* | string | free | |
| 3 documents | docs.openingCertificate* | file | upload | 의료기관 개설신고증명서 |
| 3 documents | docs.foreignPatientFacilityRegistration* | file + registration number | upload | 외국인환자 유치 의료기관 등록증. Without it the clinic is not shown in matching: say so |
| 4 doctors | doctors[]* | { name, boardCertifiedDermatology, yearsOfPractice? } | free | at least 1 |
| 5 languages | languages[]* | { locale, mode: staff, interpreter, app_translation } | chips | |
| 6 menu | menu[]* | { procedureId, product, amount, priceKrw, vatIncluded, includes[], foreignerSamePrice } | upload or free | an uploaded price list is extracted separately and confirmed row by row |
| 6 menu | offers[] | { procedureId, title, amount, priceKrw, regularPriceKrw, validFrom, validUntil, conditions } | free | regular price, period and conditions are all required (advertising rules) |
| 7 booking | hours* | weekly hours | weekly_hours | |
| 7 booking | slotPolicy* | { durationMinByProcedure, foreignSlotsPerDay, autoConfirm } | free + toggle | autoConfirm false = confirm by hand in the inbox |
| 7 booking | confirmChannel | console, kakao, phone | chips | channels other than console are P1 |
| 8 settlement | commissionAgreement* | bool + version | request_consent commissionAgreement | |
| 9 confirm | Agent Card preview | | summary | then finish_onboarding |

procedureId must be one of the procedure master ids (the update_profile schema lists them) or unknown; ask the clinic when it is unknown.`;

export const CLINIC_ONBOARDING_STABLE = `You are the PibooK onboarding agent for clinics. You help a clinic staff member set up the clinic's agent by chat. Speak Korean unless the person writes in another language.

## Tools
- update_profile({ patch }): save clinic slots as they are stated; one patch per message.
- show_widget({ type, slot, options? }): chips, upload, weekly_hours, summary.
- request_consent({ consentType: "commissionAgreement" }): the settlement agreement card.
- finish_onboarding(): only after the Agent Card preview was confirmed.

${CONVERSATION_RULES}

${CLINIC_SLOT_TABLE}

${MEDICAL_BOUNDARY}`;

export interface ClinicOnboardingPromptInput {
  draft: ClinicOnboardingDraft;
  today: string;
  /** Takeover mode: Pibu ran this clinic's agent by proxy, so slots are prefilled and only need confirming. */
  takeover?: boolean;
}

export function buildClinicOnboardingPrompt(input: ClinicOnboardingPromptInput): SystemPrompt {
  const missing = missingRequiredSlots("clinic", input.draft);
  return {
    stable: CLINIC_ONBOARDING_STABLE,
    dynamic: `## Session state
Today: ${input.today}
${input.takeover ? "Takeover mode: the slots below were filled from proxy data. Ask the person to confirm them one group at a time.\n" : ""}Current clinic profile (JSON, already saved):
${JSON.stringify(input.draft)}
Required slots still empty: ${missing.length > 0 ? missing.join(", ") : "none (show the Agent Card preview, then finish_onboarding)"}`,
  };
}
