// Claude access layer (09-architecture.md "LLM 사용"). OWNER: track LLM.
// Every Claude call goes through here; without ANTHROPIC_API_KEY (or with DEMO_MODE fixtures) it must
// still return deterministic fixture output so the demo runs offline.
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

export async function runClaude(_options: RunOptions): Promise<ToolCallResult> {
  throw new Error("llm layer not implemented yet (track LLM)");
}
