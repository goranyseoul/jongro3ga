import type { RecipeV1 } from "../a2a/schemas";
import type { Locale } from "../domain/common";
import { resolveFixture } from "./fixtures";
import type { ScenarioId } from "./fixtures/consult";
import { findMedicalViolations, sanitizeText } from "./guard";
import { runClaude, type RunOptions } from "./index";
import { MEDICAL_BOUNDARY_BLOCK } from "./prompts/medical-boundary";

// The customer agent's consultation reply ("Pibu 실장", DEMO.md scenarios). Data the reply may cite (recipe,
// concern ranking) is passed in by the caller, which gets it over A2A (platform.recipe); the model only words
// it. Without a key, or when the live reply crosses the medical boundary, the scenario opener fixture answers.

export type { ScenarioId } from "./fixtures/consult";

/** Which DEMO.md scenario an opening message belongs to, by its telltale phrases in any of the four languages. */
export function detectScenario(utterance: string): ScenarioId | undefined {
  const t = utterance.normalize("NFKC").toLowerCase();
  if (/피부 리포트|skin report|肌レポート|皮肤报告/.test(t) || (t.split("\n").length > 8 && /\d{1,2}\/\d{1,2}/.test(t))) return "jisu";
  if (/(3월|march|3月).*(7월|july|7月).*(11월|november|11月)/s.test(t)) return "lin";
  if (/once a year|in person|conservative|1년에 한 번|직접 상담|年に一度|年1回|直接相談|一年一次|当面咨询/.test(t)) return "grace";
  if (/한국 언니|늙어 보|피부과는 한 번도|韓国の(お姉さん|女性)|老けて|what do korean women|korean women do|韩国女生|显老/.test(t)) return "yuki";
  return undefined;
}

export interface ConsultContext {
  nickname?: string;
  recipe?: RecipeV1;
  topConcerns?: { label: string; share: number }[];
}

const LANGUAGE_NAME: Record<Locale, string> = { ja: "Japanese", ko: "Korean", en: "English", "zh-CN": "Simplified Chinese" };

export function buildConsultSystemPrompt(locale: Locale, context: ConsultContext = {}): string {
  return `You are the PibooK agent (피북 실장), a concierge for foreign visitors who want Korean skin care procedures. Reply in ${LANGUAGE_NAME[locale]}, warm and short (at most 5 lines, lists allowed). No emoji.

Your job in a consultation: understand the concern, then cite what Korean women of the same age band chose (the data below), with typical cycles, downtime and onset as ranges. End with one question that moves the conversation forward. If something is a medical judgment, say the clinic doctor decides.

Data you may cite (never invent other numbers):
${JSON.stringify({ customer: context.nickname ?? null, topConcerns: context.topConcerns ?? null, recipe: context.recipe ?? null })}

${MEDICAL_BOUNDARY_BLOCK}`;
}

export interface ConsultResult {
  text: string;
  scenario?: ScenarioId;
  source: "model" | "fixture";
}

export async function consultReply(input: {
  utterance: string;
  locale: Locale;
  history?: RunOptions["messages"];
  context?: ConsultContext;
}): Promise<ConsultResult> {
  const scenario = detectScenario(input.utterance);
  const options: RunOptions = {
    tier: "chat",
    system: buildConsultSystemPrompt(input.locale, input.context),
    messages: [...(input.history ?? []), { role: "user", content: input.utterance }],
    fixtureKey: `consult.opener.${scenario ?? "generic"}.${input.locale}`,
    maxTokens: 1024,
  };
  const result = await runClaude(options);
  const fixtureText = sanitizeText(resolveFixture(options).text);
  if (!result.text || findMedicalViolations(result.text).length > 0) return { text: fixtureText, scenario, source: "fixture" };
  return { text: result.text, scenario, source: result.text === fixtureText ? "fixture" : "model" };
}
