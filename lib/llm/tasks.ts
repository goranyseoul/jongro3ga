import type Anthropic from "@anthropic-ai/sdk";
import { llm as defaultLlm, type Llm } from "./client";
import { templateRuleDrafts } from "./fixtures/proposer";
import { buildConciergePrompt, type ConciergeInput } from "./prompts/concierge";
import { buildIntentPrompt, type IntentInput } from "./prompts/intent";
import { buildMenuExtractPrompt, type MenuExtractInput } from "./prompts/menu-extract";
import { buildNotepadImportPrompt, type NotepadImportInput } from "./prompts/notepad-import";
import { buildProposerPrompt, type ProposerInput } from "./prompts/proposer";
import { buildSituationFilterPrompt, type SituationFilterInput } from "./prompts/situation-filter";
import { buildTranslatePrompt } from "./prompts/translate";
import type { Locale } from "../domain/common";
import { ExtractMenuItemsInputSchema, type ExtractMenuItemsInput } from "./tools/menu";
import { NotepadImportSchema, type NotepadImport } from "./tools/notepad";
import { DraftProcedureRequestSchema, buildProcedureRequest, type BuildRequestResult, type DraftProcedureRequest } from "./tools/procedure-request";
import { ProposeRulesInputSchema, sanitizeRuleDrafts, type SanitizedRules } from "./tools/rules";
import { SituationFilterSchema, type SituationFilter } from "./tools/situation";
import { LlmUnavailableError, type ExtractResult, type LlmMode } from "./types";

// One function per LLM task, so agent modules call a task and never assemble prompts themselves.
// Each takes the structured input, builds the prompt from it and passes the same input as fixture context.

/** 요청 정리 (02 1절). With ids, also builds and validates `pibu/procedure-request@1`. */
export async function draftProcedureRequest(
  input: IntentInput,
  ids?: { requestId: string; customerAgentId: string },
  client: Llm = defaultLlm,
): Promise<{ mode: LlmMode; draft: DraftProcedureRequest; built?: BuildRequestResult }> {
  const result = await client.extract({
    purpose: "intent",
    schema: DraftProcedureRequestSchema,
    system: buildIntentPrompt(input),
    messages: [{ role: "user", content: input.utterance }],
    context: input,
  });
  return { mode: result.mode, draft: result.data, ...(ids ? { built: buildProcedureRequest(result.data, ids) } : {}) };
}

/** 메모장 가져오기 (DEMO.md 시나리오 2 ①). */
export function importNotepad(input: NotepadImportInput, client: Llm = defaultLlm): Promise<ExtractResult<NotepadImport>> {
  return client.extract({
    purpose: "notepad_import",
    schema: NotepadImportSchema,
    system: buildNotepadImportPrompt(input),
    messages: [{ role: "user", content: input.text }],
    context: input,
  });
}

/** 상황을 필터로 변환. The fields plug into ProcedureFilterInput of lib/agents/platform/procedure-filter.ts. */
export function situationToFilter(input: SituationFilterInput, client: Llm = defaultLlm): Promise<ExtractResult<SituationFilter>> {
  return client.extract({
    purpose: "situation_filter",
    schema: SituationFilterSchema,
    system: buildSituationFilterPrompt(input),
    messages: [{ role: "user", content: input.text }],
    context: input,
  });
}

/** 가격표·문자 추출. `images` are base64 price list photos (P1). */
export function extractMenuItems(
  input: MenuExtractInput,
  images: Anthropic.ImageBlockParam[] = [],
  client: Llm = defaultLlm,
): Promise<ExtractResult<ExtractMenuItemsInput>> {
  return client.extract({
    purpose: "menu_extract",
    schema: ExtractMenuItemsInputSchema,
    system: buildMenuExtractPrompt(input),
    messages: [{ role: "user", content: [...images, { type: "text", text: input.text || "(price list image)" }] }],
    context: input,
  });
}

/**
 * 규칙 제안 2단계 (07 4절). Drafts go through the guardrails (sanitizeRuleDrafts) whatever their source.
 * If Claude and the fixture both fail, stage 1 candidates come back with template reasons (07 "API 실패 시").
 */
export async function proposeRules(input: ProposerInput, client: Llm = defaultLlm): Promise<{ mode: LlmMode } & SanitizedRules> {
  let mode: LlmMode = "fixture";
  let drafts: unknown[];
  try {
    const result = await client.extract({
      purpose: "proposer",
      schema: ProposeRulesInputSchema,
      system: buildProposerPrompt(input),
      messages: [{ role: "user", content: "Write the rule proposals for these candidates." }],
      context: input,
    });
    mode = result.mode;
    drafts = result.data.rules;
  } catch (error) {
    if (!(error instanceof LlmUnavailableError)) throw error;
    drafts = templateRuleDrafts(input);
  }
  return { mode, ...sanitizeRuleDrafts(drafts, { knownClinicIds: input.knownClinicIds }) };
}

/** 결과 요약: verdict numbers injected, wording only. */
export async function summarizeQuotes(input: ConciergeInput, client: Llm = defaultLlm): Promise<{ mode: LlmMode; text: string }> {
  const result = await client.complete({
    purpose: "concierge",
    system: buildConciergePrompt(input),
    messages: [{ role: "user", content: "Summarize the quotes for me." }],
    context: input,
  });
  return { mode: result.mode, text: result.text };
}

/** 짧은 번역·라벨 (CLAUDE_MODEL_FAST). In fixture mode the text comes back unchanged. */
export async function translate(text: string, to: Locale, client: Llm = defaultLlm): Promise<{ mode: LlmMode; text: string }> {
  const result = await client.complete({
    purpose: "translate",
    system: buildTranslatePrompt(to),
    messages: [{ role: "user", content: text }],
  });
  return { mode: result.mode, text: result.text };
}
