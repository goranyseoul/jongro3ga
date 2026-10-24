import type Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

// Shared types of the LLM layer (09-architecture.md "LLM 사용"). Every Claude call goes through lib/llm/client.ts.

/** Use keys of the 09 LLM table plus the two WP5 extraction tasks. Each maps to one model env var (client.ts). */
export type LlmPurpose =
  | "onboarding_customer"
  | "onboarding_clinic"
  | "intent"
  | "concierge"
  | "menu_extract"
  | "proposer"
  | "translate"
  | "notepad_import"
  | "situation_filter";

export type LlmMode = "live" | "fixture";

/**
 * A system prompt in two parts. `stable` is the same on every turn and is sent with cache_control;
 * `dynamic` (the current profile JSON, injected numbers) changes per turn and is sent after it, uncached,
 * so it never invalidates the cached prefix.
 */
export interface SystemPrompt {
  stable: string;
  dynamic?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface CompleteRequest {
  purpose: LlmPurpose;
  system: string | SystemPrompt;
  messages: Anthropic.MessageParam[];
  /** Tool names from lib/llm/tools. Sent with strict: true and tool_choice auto (forced choice is a 400). */
  tools?: readonly string[];
  maxTokens?: number;
  /** Text deltas as they stream. Fixture mode calls it too, so an SSE route behaves the same in both modes. */
  onText?: (delta: string) => void;
  /** Structured input the prompt was built from. Only the fixture router reads it. */
  context?: unknown;
}

export interface CompleteResult {
  mode: LlmMode;
  model: string;
  text: string;
  toolCalls: ToolCall[];
  stopReason: Anthropic.StopReason | null;
  /** The assistant turn to append to `messages` before sending tool results back. */
  content: Anthropic.ContentBlockParam[];
}

export interface ExtractRequest<T> {
  purpose: LlmPurpose;
  /** zod schema of the output. Sent as structured output (output_config.format) and validated again here. */
  schema: ZodType<T>;
  system: string | SystemPrompt;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  context?: unknown;
}

export interface ExtractResult<T> {
  mode: LlmMode;
  model: string;
  data: T;
}

/** Thrown when neither Claude nor a fixture can answer (the fixture router has nothing for this input). */
export class LlmUnavailableError extends Error {
  constructor(
    readonly purpose: LlmPurpose,
    readonly reason: string,
  ) {
    super(`LLM unavailable for ${purpose}: ${reason}`);
    this.name = "LlmUnavailableError";
  }
}
