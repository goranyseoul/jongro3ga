import type Anthropic from "@anthropic-ai/sdk";
import { clock } from "../../clock";
import type { Locale } from "../../domain/common";
import type { ConciergeInput } from "../prompts/concierge";
import type { IntentInput } from "../prompts/intent";
import type { NotepadImportInput } from "../prompts/notepad-import";
import type { ProposerInput } from "../prompts/proposer";
import type { OnboardingDraft } from "../tools/onboarding";
import type { LlmPurpose } from "../types";
import { conciergeFixture, demoConciergeInput } from "./concierge";
import { intentFixture } from "./intent";
import { menuFixture } from "./menu";
import { notepadFixture } from "./notepad";
import { onboardingFixtureTurn, type FixtureTurn } from "./onboarding";
import { templateRuleDrafts } from "./proposer";
import { situationFixture } from "./situation";

export { conciergeFixture, demoConciergeInput } from "./concierge";
export { INTENT_FOLLOW_UPS, YUKI_INTENT_INPUT, YUKI_PROFILE, intentFixture } from "./intent";
export { matchProcedure } from "./keywords";
export { menuFixture } from "./menu";
export { JISU_MEMO, JISU_NOTEPAD_IMPORT, notepadFixture } from "./notepad";
export {
  allOnboardingFixtureTexts,
  fixtureNextUserUtterance,
  onboardingFixtureTurn,
  type FixtureToolCall,
  type FixtureTurn,
  type OnboardingFixtureState,
} from "./onboarding";
export { DEMO_ARA_PROPOSER_INPUT, templateRuleDrafts } from "./proposer";
export { GRACE_SITUATIONS, situationFixture } from "./situation";

// Fixture router (09: "ANTHROPIC_API_KEY가 없으면 데모 모드 응답"). Deterministic: the answer depends only on
// the purpose, the last user message and the structured context the prompt was built from. Null means there
// is no fixture for this input and the client reports the LLM as unavailable.

/** Onboarding context: the session draft (and the browser locale before the locale slot is filled). */
export interface OnboardingFixtureContext {
  draft: OnboardingDraft;
  locale?: Locale;
}

type LastUser = { kind: "text"; text: string } | { kind: "tool_results" } | { kind: "none" };

export function lastUserMessage(messages: readonly Anthropic.MessageParam[]): LastUser {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return { kind: "text", text: message.content };
    const texts = message.content.filter((block): block is Anthropic.TextBlockParam => block.type === "text");
    if (texts.length > 0) return { kind: "text", text: texts.map((block) => block.text).join("\n") };
    if (message.content.some((block) => block.type === "tool_result")) return { kind: "tool_results" };
    return { kind: "none" };
  }
  return { kind: "none" };
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export interface FixtureCompleteInput {
  purpose: LlmPurpose;
  messages: readonly Anthropic.MessageParam[];
  context?: unknown;
}

export function fixtureComplete(input: FixtureCompleteInput): FixtureTurn | null {
  const last = lastUserMessage(input.messages);
  const text = last.kind === "text" ? last.text : undefined;

  switch (input.purpose) {
    case "onboarding_customer":
    case "onboarding_clinic": {
      // The turn after tool results: the question was already asked with the tool calls, nothing to add.
      if (last.kind === "tool_results") return { text: "", toolCalls: [] };
      const context = isRecord(input.context) ? (input.context as unknown as OnboardingFixtureContext) : undefined;
      return onboardingFixtureTurn(
        { kind: input.purpose === "onboarding_clinic" ? "clinic" : "customer", draft: context?.draft ?? {}, locale: context?.locale },
        text,
      );
    }
    case "concierge": {
      const context = isRecord(input.context) && Array.isArray(input.context.rows) ? (input.context as unknown as ConciergeInput) : demoConciergeInput("ja");
      return { text: conciergeFixture(context), toolCalls: [] };
    }
    case "translate":
      // No translation without Claude: the text comes back as is and the trace says "fixture".
      return text === undefined ? null : { text, toolCalls: [] };
    default:
      return null;
  }
}

export function fixtureExtract(input: FixtureCompleteInput): unknown | null {
  const last = lastUserMessage(input.messages);
  const text = last.kind === "text" ? last.text : undefined;
  const context = isRecord(input.context) ? input.context : undefined;

  switch (input.purpose) {
    case "intent": {
      const intent = context && isRecord(context.profile) ? (context as unknown as IntentInput) : undefined;
      return intentFixture(intent, text ?? intent?.utterance);
    }
    case "notepad_import": {
      const notepad = context as Partial<NotepadImportInput> | undefined;
      const memo = notepad?.text ?? text;
      return memo === undefined ? null : notepadFixture(memo, notepad?.today ?? clock.today());
    }
    case "situation_filter": {
      const situation = (context?.text as string | undefined) ?? text;
      return situation === undefined ? null : situationFixture(situation);
    }
    case "proposer":
      return context && Array.isArray(context.candidates) ? { rules: templateRuleDrafts(context as unknown as ProposerInput) } : null;
    case "menu_extract": {
      const menu = (context?.text as string | undefined) ?? text;
      return menu === undefined ? null : menuFixture(menu);
    }
    default:
      return null;
  }
}
