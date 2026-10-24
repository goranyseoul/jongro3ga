import { z } from "zod";
import { zodTool } from "../tools";
import { CONSENT_TYPES, ProfilePatchSchema } from "./slots";

// Onboarding tools (04 "대화 엔진"). The server validates every input with these same schemas.

export const updateProfileTool = zodTool(
  "update_profile",
  "Save one or more profile slots the customer just gave. Pass only the slots you learned this turn. The server validates the patch; on an error, ask the customer again.",
  z.strictObject({ patch: ProfilePatchSchema }),
);

export const showWidgetTool = zodTool(
  "show_widget",
  "Show an input widget in the chat for a slot: chips, multi chips, date range, currency amount, slider, or the closing summary card (slot \"summary\").",
  z.strictObject({
    type: z.enum(["chips", "chips_multi", "date_range", "currency", "slider", "summary", "free_text"]),
    slot: z.string().min(1),
    options: z.array(z.union([z.string(), z.number()])).optional(),
  }),
);

export const requestConsentTool = zodTool(
  "request_consent",
  "Show the consent cards. Without arguments all five are shown (terms, privacy, sensitiveHealth, crossBorder, shareAnonymizedRecords).",
  z.strictObject({ consentTypes: z.array(z.enum(CONSENT_TYPES)).min(1).optional() }),
);

export const finishOnboardingTool = zodTool(
  "finish_onboarding",
  "Create the customer's agent. Only call after the customer confirmed the summary. Fails while any required slot is missing.",
  z.strictObject({}),
);

export const ONBOARDING_TOOLS = [updateProfileTool, showWidgetTool, requestConsentTool, finishOnboardingTool];
