import type { Locale } from "../../domain/common";
import type { SystemPrompt } from "../types";

// Short translations and labels (09 LLM table, CLAUDE_MODEL_FAST).

export const TRANSLATE_STABLE = `Translate the user's text for a dermatology booking app. Return only the translation, no quotes, no notes. Keep numbers, prices, dates, product names and clinic names exactly. No emoji, no em dash or en dash. Do not add medical advice.`;

export function buildTranslatePrompt(to: Locale): SystemPrompt {
  return { stable: TRANSLATE_STABLE, dynamic: `Target language: ${to}.` };
}
