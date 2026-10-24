// Claude access layer (09-architecture.md "LLM 사용"). OWNER: track LLM.
// Every Claude call goes through here; without ANTHROPIC_API_KEY (or with LLM_MODE=fixtures) it
// returns deterministic fixture output so the demo runs offline. API errors, timeouts and refusals
// fall back to the same fixtures, so a flaky network never stops the demo.
import { callAnthropic } from "./client";
import { resolveFixture } from "./fixtures";
import { sanitizeText } from "./guard";
import { llmMode } from "./models";

export type ModelTier = "chat" | "reasoning" | "fast";

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
}

export interface ToolCallResult {
  /** Assistant text shown to the user (customer language). */
  text: string;
  /** Tool calls made by the model, inputs already parsed as JSON. */
  toolCalls: { name: string; input: Record<string, unknown> }[];
}

export interface RunOptions {
  tier: ModelTier;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools?: ToolSpec[];
  /** Force a specific tool (structured extraction). */
  toolChoice?: string;
  /** Key into lib/llm/fixtures used when the API is unavailable. */
  fixtureKey: string;
  maxTokens?: number;
}

export async function runClaude(options: RunOptions): Promise<ToolCallResult> {
  if (llmMode() === "live") {
    try {
      return clean(await callAnthropic(options));
    } catch (error) {
      // Graceful fallback (09): log the reason without any prompt content, then serve the fixture.
      console.warn(`[llm] ${options.fixtureKey}: falling back to fixture (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return clean(resolveFixture(options));
}

function clean(result: ToolCallResult): ToolCallResult {
  return { text: sanitizeText(result.text), toolCalls: result.toolCalls };
}

export { llmMode } from "./models";
