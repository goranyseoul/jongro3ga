import Anthropic from "@anthropic-ai/sdk";
import type { RunOptions, ToolCallResult } from "./index";
import { EFFORT, TIMEOUT_MS, modelFor, supportsDefaultFallback } from "./models";

// The single place that talks to the Anthropic Messages API (09: "모든 LLM 호출은 lib/llm/client.ts 하나를
// 거친다"). runClaude() decides whether to come here or to the fixtures.

let client: Anthropic | undefined;

function getClient(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment; the key never appears in code.
  client ??= new Anthropic({ maxRetries: 1 });
  return client;
}

export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly reason: "api_error" | "timeout" | "refusal" | "max_tokens" | "empty",
  ) {
    super(message);
    this.name = "LlmCallError";
  }
}

export async function callAnthropic(options: RunOptions): Promise<ToolCallResult> {
  const model = modelFor(options.tier);
  const tools: Anthropic.Beta.BetaToolUnion[] | undefined = options.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: { type: "object", ...tool.inputSchema } as Anthropic.Beta.BetaTool.InputSchema,
  }));

  // Sonnet 5.5, Opus 5.5 and Haiku 5.5 reject a forced tool_choice, so a required tool is asked for in
  // the system prompt instead and the caller validates that it was called.
  const system = options.toolChoice
    ? `${options.system}\n\nYou must call the tool \`${options.toolChoice}\` exactly once in this reply.`
    : options.system;

  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: options.maxTokens ?? 2048,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    output_config: { effort: EFFORT[options.tier] },
    ...(tools && tools.length > 0 ? { tools, tool_choice: { type: "auto" } } : {}),
    ...(supportsDefaultFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  };

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create(params, { timeout: TIMEOUT_MS[options.tier] });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new LlmCallError("Claude request timed out", "timeout");
    if (error instanceof Anthropic.APIError) {
      throw new LlmCallError(`Claude API error ${error.status ?? "?"}: ${error.message}`, "api_error");
    }
    throw new LlmCallError(error instanceof Error ? error.message : String(error), "api_error");
  }

  if (response.stop_reason === "refusal") throw new LlmCallError("Claude declined the request", "refusal");

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  const toolCalls = response.content
    .filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use")
    .map((block) => ({ name: block.name, input: (block.input ?? {}) as Record<string, unknown> }));

  // A reply cut at max_tokens may hold a half written tool input; treat it as a failed call.
  if (response.stop_reason === "max_tokens") throw new LlmCallError("Claude reply hit max_tokens", "max_tokens");
  if (!text && toolCalls.length === 0) throw new LlmCallError("Claude returned no text and no tool call", "empty");
  return { text, toolCalls };
}
