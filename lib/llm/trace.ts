import { clock } from "../clock";
import { pibuGlobals } from "../pibu-globals";
import type { IsoDateTime } from "../domain/common";
import type { LlmMode, LlmPurpose } from "./types";

// Ring buffer of the latest LLM calls for the ops console: which purpose, which model, live or fixture,
// tokens and latency. Kept on globalThis.__pibu so dev server hot reload does not empty it
// (09-architecture.md "SDK 함정" 5). Prompts and outputs are not stored: they can carry profile data.

export const TRACE_LIMIT = 50;

export interface LlmTraceEntry {
  purpose: LlmPurpose;
  model: string;
  mode: LlmMode;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  at: IsoDateTime;
  /** Why a live call ended on a fixture: "no_api_key" is not a fallback, these are, e.g. "api_error:429", "refusal". */
  fallbackReason?: string;
}

declare module "../pibu-globals" {
  interface PibuGlobals {
    /** Latest LLM calls, newest last (lib/llm/trace.ts). */
    llmTrace?: LlmTraceEntry[];
  }
}

export function recordLlmCall(entry: Omit<LlmTraceEntry, "at">): LlmTraceEntry {
  const buffer = (pibuGlobals().llmTrace ??= []);
  const full: LlmTraceEntry = { ...entry, at: clock.nowIso() };
  buffer.push(full);
  if (buffer.length > TRACE_LIMIT) buffer.splice(0, buffer.length - TRACE_LIMIT);
  return full;
}

/** Newest first. */
export function recentLlmCalls(): LlmTraceEntry[] {
  return [...(pibuGlobals().llmTrace ?? [])].reverse();
}

export function clearLlmTrace(): void {
  pibuGlobals().llmTrace = [];
}
