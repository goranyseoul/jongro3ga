import type { ModelTier } from "./index";

// Model per tier (09-architecture.md "LLM 사용"). Environment variables override the defaults.
const DEFAULT_MODEL: Record<ModelTier, string> = {
  chat: "claude-sonnet-5-5",
  reasoning: "claude-opus-5-5",
  fast: "claude-haiku-5-5",
};

const ENV_NAME: Record<ModelTier, string> = {
  chat: "CLAUDE_MODEL_CHAT",
  reasoning: "CLAUDE_MODEL_REASONING",
  fast: "CLAUDE_MODEL_FAST",
};

export function modelFor(tier: ModelTier): string {
  return process.env[ENV_NAME[tier]]?.trim() || DEFAULT_MODEL[tier];
}

/** Request timeout per tier in ms. Chat turns must feel live, rule proposals may think longer. */
export const TIMEOUT_MS: Record<ModelTier, number> = { chat: 25_000, reasoning: 90_000, fast: 15_000 };

/**
 * Effort per tier. Chat and fast stay low so a turn answers in a few seconds; reasoning (rule
 * proposals) gets high. Opus 5.5 and Haiku 5.5 default to medium, so it is always sent explicitly.
 */
export const EFFORT: Record<ModelTier, "low" | "medium" | "high"> = { chat: "low", reasoning: "high", fast: "low" };

/** Models that accept the server-side refusal fallback in its "default" form on the Claude API. */
export function supportsDefaultFallback(model: string): boolean {
  return model === "claude-sonnet-5-5" || model === "claude-opus-5-5";
}

export type LlmMode = "live" | "fixtures";

/**
 * Live only with a key, and never under vitest. `LLM_MODE=fixtures` forces fixtures even with a key
 * (rehearsals, offline demo); `DEMO_MODE` is not used for this because it already means the fixed clock.
 */
export function llmMode(): LlmMode {
  if (process.env.VITEST) return "fixtures";
  if (process.env.LLM_MODE === "fixtures") return "fixtures";
  return process.env.ANTHROPIC_API_KEY?.trim() ? "live" : "fixtures";
}
