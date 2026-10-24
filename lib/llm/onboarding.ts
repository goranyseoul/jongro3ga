import type Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "../domain/common";
import { llm as defaultLlm, type Llm } from "./client";
import { buildClinicOnboardingPrompt } from "./prompts/onboarding-clinic";
import { buildCustomerOnboardingPrompt } from "./prompts/onboarding-customer";
import { ONBOARDING_TOOLS, toolResultBlock, validateToolInput } from "./tools";
import {
  applyProfilePatch,
  onboardingProgress,
  type ClinicOnboardingDraft,
  type CustomerOnboardingDraft,
  type OnboardingDraft,
  type OnboardingKind,
} from "./tools/onboarding";
import type { LlmMode } from "./types";

// One onboarding turn (04 "대화 엔진"): the user's message in, Claude's reply and the validated tool effects out.
// The SSE route (WP9) maps the events to its stream (`text` tokens via onText, `profile_patch`, `widget`, `done`)
// and stores `draft` and `history` in the onboarding_session.

export type OnboardingEvent =
  | { type: "profile_patch"; patch: OnboardingDraft; progress: number }
  | { type: "widget"; widget: { type: string; slot: string; options?: { value: string; label: string }[] } }
  | { type: "consent"; consentType: string }
  | { type: "done" }
  /** Sent back to Claude as tool_result is_error; shown in the ops trace, not to the person. */
  | { type: "tool_error"; tool: string; error: string };

export interface OnboardingTurnInput {
  kind: OnboardingKind;
  draft: OnboardingDraft;
  /** The conversation so far in Messages API shape, as returned by the previous turn. */
  history: Anthropic.MessageParam[];
  /** The new message. A widget answer is passed as its text form ("日本語で", "2026-11-13 ~ 2026-11-15"). */
  message: string;
  /** Browser locale before the locale slot is filled (customer). */
  locale?: Locale;
  today: string;
  resumed?: boolean;
  onText?: (delta: string) => void;
  llm?: Llm;
}

export interface OnboardingTurnResult {
  mode: LlmMode;
  draft: OnboardingDraft;
  history: Anthropic.MessageParam[];
  text: string;
  events: OnboardingEvent[];
  finished: boolean;
}

/** Model calls per turn at most: one answer, plus re-asks after tool errors or a silent save. */
const MAX_ROUNDS = 4;

export async function runOnboardingTurn(input: OnboardingTurnInput): Promise<OnboardingTurnResult> {
  const client = input.llm ?? defaultLlm;
  const { kind } = input;
  const messages: Anthropic.MessageParam[] = [...input.history, { role: "user", content: input.message }];
  const events: OnboardingEvent[] = [];
  let draft = input.draft;
  let text = "";
  let finished = false;
  let mode: LlmMode = "fixture";

  for (let round = 0; round < MAX_ROUNDS && !finished; round += 1) {
    const locale = (kind === "customer" ? (draft as CustomerOnboardingDraft).locale : undefined) ?? input.locale ?? (kind === "clinic" ? "ko" : "en");
    const system =
      kind === "customer"
        ? buildCustomerOnboardingPrompt({ locale, draft: draft as CustomerOnboardingDraft, today: input.today, resumed: round === 0 && input.resumed })
        : buildClinicOnboardingPrompt({ draft: draft as ClinicOnboardingDraft, today: input.today });

    const reply = await client.complete({
      purpose: kind === "customer" ? "onboarding_customer" : "onboarding_clinic",
      system,
      messages,
      tools: ONBOARDING_TOOLS,
      onText: input.onText,
      context: { draft, locale: input.locale },
    });
    mode = reply.mode;
    text += reply.text;
    // Keep the history exactly as it went out (per turn context included) so it stays append-only.
    messages.splice(0, messages.length, ...reply.sentMessages);
    messages.push({ role: "assistant", content: reply.content });
    if (reply.toolCalls.length === 0) break;

    let failed = false;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of reply.toolCalls) {
      const validation = validateToolInput(call.name, call.input, { kind, draft });
      if (!validation.ok) {
        failed = true;
        events.push({ type: "tool_error", tool: call.name, error: validation.error });
        results.push(toolResultBlock(call.id, validation));
        continue;
      }
      const data = validation.data as Record<string, unknown>;
      switch (call.name) {
        case "update_profile": {
          const patch = data.patch as OnboardingDraft;
          draft = applyProfilePatch(draft, patch);
          events.push({ type: "profile_patch", patch, progress: onboardingProgress(kind, draft) });
          break;
        }
        case "show_widget":
          events.push({ type: "widget", widget: data as Extract<OnboardingEvent, { type: "widget" }>["widget"] });
          break;
        case "request_consent":
          events.push({ type: "consent", consentType: data.consentType as string });
          break;
        case "finish_onboarding":
          finished = true;
          events.push({ type: "done" });
          break;
      }
      results.push(toolResultBlock(call.id, validation, call.name === "update_profile" ? "saved" : "shown"));
    }
    // Tool results always go back into the history; consecutive user turns are merged by the API, so the next
    // message can simply follow them.
    messages.push({ role: "user", content: results });
    // Ask Claude again only when it has to fix an input or has not said anything yet.
    if (!failed && text.trim() !== "") break;
  }

  return { mode, draft, history: messages, text, events, finished };
}
