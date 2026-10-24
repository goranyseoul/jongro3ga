import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { toStrictJsonSchema, type JsonSchema } from "./json-schema";
import { ExtractMenuItemsInputSchema } from "./menu";
import {
  CLINIC_CONSENTS,
  CLINIC_SLOTS,
  CUSTOMER_CONSENTS,
  CUSTOMER_SLOTS,
  FinishOnboardingInputSchema,
  RequestConsentInputSchema,
  ShowWidgetInputSchema,
  UpdateClinicProfileInputSchema,
  UpdateCustomerProfileInputSchema,
  missingRequiredSlots,
  sensitiveBeforeConsent,
  type CustomerOnboardingDraft,
  type OnboardingDraft,
  type OnboardingKind,
} from "./onboarding";
import { DraftProcedureRequestSchema } from "./procedure-request";
import { ProposeRulesInputSchema, sanitizeRuleDrafts, type SanitizedRules } from "./rules";

export * from "./common";
export * from "./json-schema";
export * from "./menu";
export * from "./notepad";
export * from "./onboarding";
export * from "./procedure-request";
export * from "./rules";
export * from "./situation";

// The seven tools of 09 "LLM 사용" and 04. Each has a zod schema (the server side truth) and a strict JSON
// Schema made from it. Forced tool_choice is a 400 on Sonnet 5.5 and Opus 5.5, so:
//   - single shot extraction (draft_procedure_request, extract_menu_items, propose_rules) goes through
//     llm.extract with the same zod schema as structured output, and
//   - the onboarding conversation sends the tools with strict: true and tool_choice auto, names the tool in
//     the prompt, and validates every call here. A failed validation goes back as tool_result is_error so
//     Claude asks again (04 "update_profile ... 실패 시 도구 에러로 반환").

export const TOOL_NAMES = [
  "update_profile",
  "show_widget",
  "request_consent",
  "finish_onboarding",
  "draft_procedure_request",
  "extract_menu_items",
  "propose_rules",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const ONBOARDING_TOOLS = ["update_profile", "show_widget", "request_consent", "finish_onboarding"] as const satisfies readonly ToolName[];

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

const DESCRIPTIONS: Record<ToolName, string> = {
  update_profile:
    "Save slots the person just told you. Put every value from their message into one patch, only values they actually said. Returns an error to read back if a value is invalid or asked out of order.",
  show_widget:
    "Show an input widget under your message for the slot you are asking about: chips for fixed choices, date_range, time, slider, money, yes_no, upload, weekly_hours, summary for the final confirmation card. Free text stays possible.",
  request_consent: "Show one consent card. Call it once per consent type. Never assume consent: wait for the answer.",
  finish_onboarding:
    "Finish onboarding after the person confirmed the summary card. Fails while a required slot is still empty and lists the missing slots.",
  draft_procedure_request:
    "Turn the customer's request into procedure request conditions. Use profile defaults for what they did not say. Never judge whether the procedure suits them.",
  extract_menu_items:
    "Extract price list rows. procedureId must be one of the listed master ids, or unknown when no id fits. Keep the source line of every row.",
  propose_rules:
    "Propose routing rules for operator review. Write reason and evidence.summary in Korean. Never use health information as a condition and never set prices by nationality.",
};

export interface ToolOptions {
  /** Which onboarding the tool is for (update_profile patch shape, valid slots and consents). Default customer. */
  kind?: OnboardingKind;
}

export function toolInputSchema(name: ToolName, options: ToolOptions = {}): z.ZodType {
  switch (name) {
    case "update_profile":
      return options.kind === "clinic" ? UpdateClinicProfileInputSchema : UpdateCustomerProfileInputSchema;
    case "show_widget":
      return ShowWidgetInputSchema;
    case "request_consent":
      return RequestConsentInputSchema;
    case "finish_onboarding":
      return FinishOnboardingInputSchema;
    case "draft_procedure_request":
      return DraftProcedureRequestSchema;
    case "extract_menu_items":
      return ExtractMenuItemsInputSchema;
    case "propose_rules":
      return ProposeRulesInputSchema;
  }
}

const schemaCache = new Map<string, JsonSchema>();

export function toolJsonSchema(name: ToolName, options: ToolOptions = {}): JsonSchema {
  const key = `${name}:${options.kind ?? "customer"}`;
  let cached = schemaCache.get(key);
  if (!cached) {
    cached = toStrictJsonSchema(toolInputSchema(name, options));
    schemaCache.set(key, cached);
  }
  return cached;
}

/**
 * Tools whose schema the API refuses in strict mode: strict grammars allow at most 24 optional parameters and the
 * profile patch has 41 (rehearsal 2026-10-24, "Schemas contains too many optional parameters"). They go out
 * non strict and rely on the zod check in validateToolInput, which every tool input passes through anyway.
 */
const NEVER_STRICT: ReadonlySet<ToolName> = new Set<ToolName>(["update_profile"]);

/** The tool as sent to the Messages API: strict where the API allows it, so inputs match the schema's shape. */
export function toolDefinition(name: ToolName, options: ToolOptions = {}): Anthropic.Tool {
  return {
    name,
    description: DESCRIPTIONS[name],
    input_schema: toolJsonSchema(name, options) as Anthropic.Tool.InputSchema,
    strict: !NEVER_STRICT.has(name),
  };
}

export function toolDefinitions(names: readonly string[], options: ToolOptions = {}): Anthropic.Tool[] {
  return names.map((name) => {
    if (!isToolName(name)) throw new TypeError(`unknown tool ${name}`);
    return toolDefinition(name, options);
  });
}

export type ToolValidation<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export interface ValidateOptions extends ToolOptions {
  /** The session's draft so far: update_profile and finish_onboarding are checked against it. */
  draft?: OnboardingDraft;
  /** Registry clinic ids, required for propose_rules. */
  knownClinicIds?: Iterable<string>;
}

const issuesOf = (error: z.ZodError) => error.issues.map((issue) => `${issue.path.join(".") || "(input)"}: ${issue.message}`).join("; ");

/**
 * Validates a tool call's input. `ok: false` is the tool error to send back as tool_result is_error.
 * propose_rules returns ok with the drafts that survived the guardrails in `data.accepted` and the dropped ones in
 * `data.rejected`; it fails only when the input is not a list of rules at all.
 */
export function validateToolInput(name: string, input: unknown, options: ValidateOptions = {}): ToolValidation {
  if (!isToolName(name)) return { ok: false, error: `unknown tool ${name}` };
  const kind = options.kind ?? "customer";

  if (name === "propose_rules") {
    const rules = input !== null && typeof input === "object" ? (input as { rules?: unknown }).rules : undefined;
    if (!Array.isArray(rules)) return { ok: false, error: "rules: expected an array of rule drafts" };
    if (options.knownClinicIds === undefined) return { ok: false, error: "propose_rules needs the registry clinic ids" };
    const sanitized: SanitizedRules = sanitizeRuleDrafts(rules, { knownClinicIds: options.knownClinicIds });
    return { ok: true, data: sanitized };
  }

  const parsed = toolInputSchema(name, { kind }).safeParse(input);
  if (!parsed.success) return { ok: false, error: issuesOf(parsed.error) };
  const data = parsed.data;

  if (name === "update_profile" && kind === "customer") {
    const patch = (data as { patch: CustomerOnboardingDraft }).patch;
    if (sensitiveBeforeConsent((options.draft ?? {}) as CustomerOnboardingDraft, patch)) {
      return { ok: false, error: "skin, safety and past procedures need the sensitiveHealth consent first (request_consent)" };
    }
  }

  if (name === "show_widget") {
    const slots: readonly string[] = kind === "customer" ? CUSTOMER_SLOTS : CLINIC_SLOTS;
    const { slot } = data as { slot: string };
    if (!slots.includes(slot)) return { ok: false, error: `slot: ${slot} is not a ${kind} onboarding slot` };
  }

  if (name === "request_consent") {
    const allowed: readonly string[] = kind === "customer" ? CUSTOMER_CONSENTS : CLINIC_CONSENTS;
    const { consentType } = data as { consentType: string };
    if (!allowed.includes(consentType)) return { ok: false, error: `consentType: ${consentType} is not a ${kind} consent` };
  }

  if (name === "finish_onboarding") {
    const missing = missingRequiredSlots(kind, options.draft ?? {});
    if (missing.length > 0) return { ok: false, error: `required slots still empty: ${missing.join(", ")}` };
  }

  return { ok: true, data };
}

/** The tool_result block for a validation: is_error with the message on failure, so Claude asks again. */
export function toolResultBlock(toolUseId: string, validation: ToolValidation, okContent = "ok"): Anthropic.ToolResultBlockParam {
  return validation.ok
    ? { type: "tool_result", tool_use_id: toolUseId, content: okContent }
    : { type: "tool_result", tool_use_id: toolUseId, content: validation.error, is_error: true };
}
