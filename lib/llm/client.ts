import Anthropic from "@anthropic-ai/sdk";
import { fixtureComplete, fixtureExtract } from "./fixtures";
import { recordLlmCall } from "./trace";
import { strictOutputFormat, toStrictJsonSchema } from "./tools/json-schema";
import { toolDefinitions } from "./tools";
import {
  LlmUnavailableError,
  type CompleteRequest,
  type CompleteResult,
  type ExtractRequest,
  type ExtractResult,
  type LlmMode,
  type LlmPurpose,
  type SystemPrompt,
  type ToolCall,
} from "./types";

// The one way to call Claude (09 "모든 LLM 호출은 lib/llm/client.ts 하나를 거친다").
//
// Mode: fixture when there is no ANTHROPIC_API_KEY or DEMO_MODE=true (10 T07), so the demo runs end to end
// without a key. LLM_FORCE_LIVE=true calls Claude even in demo mode (presentation rehearsal), as long as a key
// is set. A live call that fails (network, 429, 5xx, any API error) or is refused falls back to the fixture
// router, so the demo never stops on the LLM.
//
// API shape (Sonnet 5.5 / Opus 5.5): forced tool_choice ("any", "tool") is a 400, so it is never sent. Single
// shot extraction uses structured outputs (output_config.format, client.messages.parse); the onboarding chat
// uses strict tools with tool_choice auto and names the tool in the prompt. No temperature or top_p (400), no
// assistant prefill (400), thinking left to the model's adaptive default.

type Tier = "chat" | "reasoning" | "fast";

/** 09 LLM table: purpose -> model tier. notepad_import and situation_filter are WP5 additions (BUILD-LOG 21). */
export const PURPOSE_TIER: Record<LlmPurpose, Tier> = {
  onboarding_customer: "chat",
  onboarding_clinic: "chat",
  intent: "chat",
  concierge: "chat",
  menu_extract: "chat",
  notepad_import: "chat",
  proposer: "reasoning",
  translate: "fast",
  situation_filter: "fast",
};

const TIER_ENV: Record<Tier, { env: string; fallback: string }> = {
  chat: { env: "CLAUDE_MODEL_CHAT", fallback: "claude-sonnet-5-5" },
  reasoning: { env: "CLAUDE_MODEL_REASONING", fallback: "claude-opus-5-5" },
  fast: { env: "CLAUDE_MODEL_FAST", fallback: "claude-haiku-5-5" },
};

const DEFAULT_MAX_TOKENS: Record<LlmPurpose, number> = {
  onboarding_customer: 4096,
  onboarding_clinic: 4096,
  intent: 4096,
  concierge: 4096,
  translate: 4096,
  situation_filter: 4096,
  menu_extract: 16000,
  notepad_import: 16000,
  proposer: 16000,
};

/**
 * Per request deadline. Long structured outputs (menu extraction, a whole notepad, rule proposals) take several
 * minutes on a non streaming call, which the 60 s client default cut off in rehearsal (2026-10-24).
 */
const LONG_OUTPUT_TIMEOUT_MS = 300_000;
function requestOptions(purpose: LlmPurpose): { timeout: number; maxRetries: number } {
  return DEFAULT_MAX_TOKENS[purpose] >= 16000 ? { timeout: LONG_OUTPUT_TIMEOUT_MS, maxRetries: 0 } : { timeout: 60_000, maxRetries: 1 };
}

export function modelFor(purpose: LlmPurpose): string {
  const { env, fallback } = TIER_ENV[PURPOSE_TIER[purpose]];
  return process.env[env] || fallback;
}

export function isFixtureMode(): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return true;
  if (process.env.LLM_FORCE_LIVE === "true") return false;
  return process.env.DEMO_MODE === "true";
}

/** The cached, frozen system prompt. Only the stable part goes into `system` (see withDynamicContext). */
export function systemBlocks(system: string | SystemPrompt): Anthropic.TextBlockParam[] {
  const prompt = typeof system === "string" ? { stable: system } : system;
  return [{ type: "text", text: prompt.stable, cache_control: { type: "ephemeral" } }];
}

/**
 * The per turn context (current profile, missing slots, a schema) rides in the last user message instead of the
 * system prompt. Thinking blocks the model returned earlier are bound to the system prompt they were created
 * with: a system prompt that changes every turn made the API reject the second onboarding turn with
 * "The system prompt differs from the one this block was created with" (rehearsal 2026-10-24). Appending to the
 * conversation keeps it append-only, so earlier blocks stay valid and the system prefix stays cached.
 */
export function withDynamicContext(messages: Anthropic.MessageParam[], system: string | SystemPrompt): Anthropic.MessageParam[] {
  const dynamic = typeof system === "string" ? undefined : system.dynamic;
  if (!dynamic) return messages;
  const block: Anthropic.TextBlockParam = { type: "text", text: dynamic };
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return [...messages, { role: "user", content: [block] }];
  const content = typeof last.content === "string" ? [{ type: "text" as const, text: last.content }] : last.content;
  return [...messages.slice(0, -1), { role: "user", content: [...content, block] }];
}

function lastJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("no JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}

let fixtureIds = 0;

export interface LlmClientOptions {
  /** Injected Anthropic client (tests). */
  anthropic?: Anthropic;
  /** Injected fetch for the default client (tests stub the network with it). */
  fetch?: typeof fetch;
}

export interface Llm {
  complete(request: CompleteRequest): Promise<CompleteResult>;
  extract<T>(request: ExtractRequest<T>): Promise<ExtractResult<T>>;
  isFixtureMode(): boolean;
}

export function createLlm(options: LlmClientOptions = {}): Llm {
  let client: Anthropic | undefined = options.anthropic;
  const anthropic = (): Anthropic =>
    (client ??= new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      fetch: options.fetch,
      maxRetries: 1,
      timeout: 60_000,
    }));

  /**
   * Purposes whose strict schema the API refused (400). Strict schemas have complexity limits that cannot be
   * checked offline; after one refusal the purpose runs without strict / structured output and relies on the
   * zod validation that runs anyway.
   */
  const strictRefused = new Set<LlmPurpose>();

  function fixtureTurn(request: CompleteRequest, model: string, started: number, fallbackReason?: string): CompleteResult {
    const turn = fixtureComplete(request);
    if (!turn) throw new LlmUnavailableError(request.purpose, fallbackReason ?? "no fixture for this input");
    const toolCalls: ToolCall[] = turn.toolCalls.map((call) => ({ id: `toolu_fixture_${++fixtureIds}`, name: call.name, input: call.input }));
    if (request.onText && turn.text) {
      for (const chunk of turn.text.match(/.{1,12}/gsu) ?? []) request.onText(chunk);
    }
    const content: Anthropic.ContentBlockParam[] = [
      ...(turn.text ? [{ type: "text" as const, text: turn.text }] : []),
      ...toolCalls.map((call) => ({ type: "tool_use" as const, id: call.id, name: call.name, input: call.input })),
    ];
    recordLlmCall({ purpose: request.purpose, model, mode: "fixture", latencyMs: performance.now() - started, fallbackReason });
    return {
      mode: "fixture",
      model,
      sentMessages: request.messages,
      text: turn.text,
      toolCalls,
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      content,
    };
  }

  function fixtureData<T>(request: ExtractRequest<T>, model: string, started: number, fallbackReason?: string): ExtractResult<T> {
    const raw = fixtureExtract(request);
    if (raw === null) throw new LlmUnavailableError(request.purpose, fallbackReason ?? "no fixture for this input");
    const data = request.schema.parse(raw);
    recordLlmCall({ purpose: request.purpose, model, mode: "fixture", latencyMs: performance.now() - started, fallbackReason });
    return { mode: "fixture", model, data };
  }

  async function send(purpose: LlmPurpose, params: Anthropic.MessageCreateParamsNonStreaming, onText?: (delta: string) => void): Promise<Anthropic.Message> {
    const options = requestOptions(purpose);
    if (!onText) return anthropic().messages.create(params, options);
    const stream = anthropic().messages.stream(params, options);
    stream.on("text", (delta) => onText(delta));
    return stream.finalMessage();
  }

  async function complete(request: CompleteRequest): Promise<CompleteResult> {
    const model = modelFor(request.purpose);
    const started = performance.now();
    if (isFixtureMode()) return fixtureTurn(request, model, started);

    const kind = request.purpose === "onboarding_clinic" ? "clinic" : "customer";
    const sent = withDynamicContext(request.messages, request.system);
    const build = (strict: boolean): Anthropic.MessageCreateParamsNonStreaming => ({
      model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS[request.purpose],
      system: systemBlocks(request.system),
      messages: sent,
      ...(request.tools?.length
        ? { tools: toolDefinitions(request.tools, { kind }).map((tool) => ({ ...tool, strict: strict && tool.strict !== false })), tool_choice: { type: "auto" as const } }
        : {}),
    });

    try {
      let message: Anthropic.Message;
      try {
        message = await send(request.purpose, build(!strictRefused.has(request.purpose)), request.onText);
      } catch (error) {
        if (!(error instanceof Anthropic.BadRequestError) || !request.tools?.length || strictRefused.has(request.purpose)) throw error;
        strictRefused.add(request.purpose);
        message = await send(request.purpose, build(false), request.onText);
      }
      if (message.stop_reason === "refusal") return fixtureTurn(request, model, started, "refusal");

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      const toolCalls = message.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
        .map((block) => ({ id: block.id, name: block.name, input: block.input }));
      recordLlmCall({
        purpose: request.purpose,
        model,
        mode: "live",
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        latencyMs: performance.now() - started,
      });
      return {
        mode: "live",
        model,
      sentMessages: sent,
        text,
        toolCalls,
        stopReason: message.stop_reason,
        content: message.content as Anthropic.ContentBlockParam[],
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) return fixtureTurn(request, model, started, `api_error:${error.status ?? "network"}`);
      throw error;
    }
  }

  async function extract<T>(request: ExtractRequest<T>): Promise<ExtractResult<T>> {
    const model = modelFor(request.purpose);
    const started = performance.now();
    if (isFixtureMode()) return fixtureData(request, model, started);

    let inputTokens = 0;
    let outputTokens = 0;
    const base = {
      model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS[request.purpose],
      messages: request.messages,
    };

    // Two attempts: an output that fails the zod schema (or none) is retried once, then the fixture answers.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        let data: T | null;
        let stopReason: Anthropic.StopReason | null;
        if (!strictRefused.has(request.purpose)) {
          try {
            const message = await anthropic().messages.parse(
              {
                ...base,
                system: systemBlocks(request.system),
                messages: withDynamicContext(base.messages, request.system),
                output_config: { format: strictOutputFormat(request.schema) },
              },
              requestOptions(request.purpose),
            );
            inputTokens += message.usage.input_tokens;
            outputTokens += message.usage.output_tokens;
            data = message.parsed_output;
            stopReason = message.stop_reason;
          } catch (error) {
            if (!(error instanceof Anthropic.BadRequestError)) throw error;
            strictRefused.add(request.purpose);
            attempt -= 1; // the refused schema does not count as an attempt
            continue;
          }
        } else {
          // Structured output refused: the schema goes into the prompt and the reply is validated here.
          const system = typeof request.system === "string" ? { stable: request.system } : request.system;
          const withSchema = {
            ...system,
            dynamic: `${system.dynamic ?? ""}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(toStrictJsonSchema(request.schema))}`,
          };
          const message = await anthropic().messages.create(
            {
              ...base,
              system: systemBlocks(withSchema),
              messages: withDynamicContext(base.messages, withSchema),
            },
            requestOptions(request.purpose),
          );
          inputTokens += message.usage.input_tokens;
          outputTokens += message.usage.output_tokens;
          stopReason = message.stop_reason;
          const text = message.content
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("");
          const parsed = request.schema.safeParse(lastJsonObject(text));
          data = parsed.success ? parsed.data : null;
        }

        if (stopReason === "refusal") return fixtureData(request, model, started, "refusal");
        if (data !== null && data !== undefined) {
          recordLlmCall({ purpose: request.purpose, model, mode: "live", inputTokens, outputTokens, latencyMs: performance.now() - started });
          return { mode: "live", model, data };
        }
      } catch (error) {
        if (error instanceof Anthropic.APIError) return fixtureData(request, model, started, `api_error:${error.status ?? "network"}`);
        // AnthropicError (the SDK's structured output parse failed) and SyntaxError (no JSON): retry.
        if (!(error instanceof Anthropic.AnthropicError) && !(error instanceof SyntaxError)) throw error;
      }
    }
    return fixtureData(request, model, started, "invalid_output");
  }

  return { complete, extract, isFixtureMode };
}

/** The process wide client. */
export const llm: Llm = createLlm();

export type { LlmMode };
