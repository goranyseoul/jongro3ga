import { z } from "zod";
import {
  AmountSchema,
  AreaSchema,
  IsoDateSchema,
  KrwSchema,
  ProcedureRequestForPlatformSchema,
  type ProcedureRequestV1,
} from "../a2a/schemas";
import { clock } from "../clock";
import type { AgeBand, Amount, Area, IsoDate, Locale, Unit } from "../domain/common";
import { procedureMaster } from "../domain/procedure-master";
import { resolveFixture } from "./fixtures";
import { llmMode, runClaude, type RunOptions } from "./index";
import { procedureName } from "./procedure-names";
import { buildIntentSystemPrompt } from "./prompts/intent";
import { formatZodError, parseToolInput, zodTool } from "./tools";

// Request drafting (02-agents.md section 1 "요청 정리"): one utterance plus the profile becomes a draft
// pibu/procedure-request@1. Claude (or the fixture) only extracts what was said; the defaults below come from
// the profile and the recipe, and the summary sentence is a template, so no number is invented by a model.

const PROCEDURE_IDS = procedureMaster.map((p) => p.id) as [string, ...string[]];

export const draftProcedureRequestTool = zodTool(
  "draft_procedure_request",
  "Record what the customer asked for in one utterance. Only fields the customer stated; the server applies defaults.",
  z.strictObject({
    procedureId: z.enum([...PROCEDURE_IDS, "unknown"]),
    amount: AmountSchema.optional(),
    productPreference: z.string().min(1).optional(),
    budgetKrwMax: KrwSchema.optional(),
    areas: z.array(AreaSchema).min(1).optional(),
    dateFrom: IsoDateSchema.optional(),
    dateTo: IsoDateSchema.optional(),
    notes: z.string().max(300).optional(),
  }),
);

/** Profile fields the defaults read. Accepts a CustomerProfile (06) or an onboarding draft, they share these names. */
export const IntentProfileSchema = z.object({
  agentId: z.string().regex(/^cag_[A-Za-z0-9_]+$/).optional(),
  locale: z.enum(["ja", "zh-CN", "en", "ko"]).optional(),
  nationality: z.string().regex(/^[A-Z]{2}$/).optional(),
  residency: z.enum(["short_term_visitor", "resident"]).optional(),
  ageBand: z.enum(["20-24", "25-29", "30-34", "35-39", "40+"]).optional(),
  trip: z
    .object({ arrival: IsoDateSchema.optional(), departure: IsoDateSchema.optional(), stayArea: AreaSchema.optional() })
    .optional(),
  skin: z.object({ concerns: z.array(z.string()).optional() }).optional(),
  prefs: z
    .object({
      budgetKrw: z.object({ max: KrwSchema }).optional(),
      languagesNeeded: z.array(z.enum(["ja", "zh-CN", "en", "ko"])).optional(),
    })
    .optional(),
  /** Onboarding draft only: `none: true` means this is the first Korean procedure. */
  history: z.object({ none: z.boolean() }).optional(),
});
export type IntentProfile = z.infer<typeof IntentProfileSchema>;

/** Typical amount source, normally platform.recipe (A2A) or, in the BFF, the recipe module directly. */
export type TypicalAmountResolver = (procedureId: string, profile: IntentProfile) => Promise<{ min: number; max: number; unit: Unit } | null>;

export type DefaultSource = "recipe_typical_min" | "stay_area_group" | "prefs.budgetKrw" | "trip" | "prefs.languagesNeeded" | "locale";

export type MissingField =
  | "procedureId"
  | "amount"
  | "customerAgentId"
  | "languages"
  | "dateWindow"
  | "visitorProfile.nationality"
  | "visitorProfile.residency"
  | "visitorProfile.ageBand";

export interface IntentResult {
  /** Always present; missing fields are simply absent. */
  draft: Partial<ProcedureRequestV1> & { schema: "pibu/procedure-request@1" };
  /** Present when nothing required is missing and the draft passes the platform.match_clinics schema. */
  request?: ProcedureRequestV1;
  missing: MissingField[];
  defaultsApplied: { field: string; source: DefaultSource }[];
  /** False for KR nationals and residents of Korea (08 section 2): matching must not be offered. */
  eligible: boolean;
  /** Condition summary or the next question, in the customer's language. */
  text: string;
  /** "model" when the live tool input validated, "fixture" otherwise. */
  source: "model" | "fixture";
}

/** 07 section 1 area groups: a stay in Sinsa means Sinsa, Gangnam and Apgujeong, the stay area first. */
export function areaGroup(area: Area | undefined): Area[] | undefined {
  if (!area || area === "other") return undefined;
  if (area === "gangnam" || area === "sinsa" || area === "apgujeong") {
    return [area, ...(["sinsa", "gangnam", "apgujeong"] as Area[]).filter((a) => a !== area)];
  }
  return [area];
}

export interface DraftOptions {
  utterance: string;
  profile: IntentProfile;
  /** Customer language for the text; defaults to the profile locale. */
  locale?: Locale;
  typicalAmount?: TypicalAmountResolver;
  /** Fixed in tests. */
  requestId?: string;
  today?: IsoDate;
}

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function draftProcedureRequest(options: DraftOptions): Promise<IntentResult> {
  const profile = IntentProfileSchema.parse(options.profile);
  const locale: Locale = options.locale ?? profile.locale ?? "en";
  const today = options.today ?? clock.today();

  const runOptions: RunOptions = {
    tier: "chat",
    system: buildIntentSystemPrompt(today),
    messages: [{ role: "user", content: options.utterance }],
    tools: [draftProcedureRequestTool.spec],
    toolChoice: draftProcedureRequestTool.spec.name,
    fixtureKey: "intent.draft",
    maxTokens: 512,
  };
  const extract = (result: { toolCalls: { name: string; input: Record<string, unknown> }[] }) => {
    const call = result.toolCalls.find((c) => c.name === draftProcedureRequestTool.spec.name);
    return call ? parseToolInput(draftProcedureRequestTool, call.input) : ({ ok: false, error: "tool not called" } as const);
  };
  let source: IntentResult["source"] = llmMode() === "live" ? "model" : "fixture";
  let extracted = extract(await runClaude(runOptions));
  if (!extracted.ok) {
    source = "fixture";
    extracted = extract(resolveFixture(runOptions));
  }
  const said = extracted.ok ? extracted.value : { procedureId: "unknown" as const };

  const defaultsApplied: IntentResult["defaultsApplied"] = [];
  const missing: MissingField[] = [];
  const draft: IntentResult["draft"] = { schema: "pibu/procedure-request@1", requestId: options.requestId ?? newRequestId() };

  if (profile.agentId) draft.customerAgentId = profile.agentId;
  else missing.push("customerAgentId");

  const procedureId = said.procedureId === "unknown" ? undefined : said.procedureId;
  if (procedureId) draft.procedureId = procedureId;
  else missing.push("procedureId");
  if (said.productPreference) draft.productPreference = said.productPreference;

  // amount: what was said, otherwise the recipe's typical minimum (02 section 1)
  let amount: Amount | undefined = said.amount as Amount | undefined;
  if (!amount && procedureId && options.typicalAmount) {
    const typical = await options.typicalAmount(procedureId, profile);
    if (typical) {
      amount = { value: typical.min, unit: typical.unit };
      defaultsApplied.push({ field: "amount", source: "recipe_typical_min" });
    }
  }
  if (amount) draft.amount = amount;
  else if (procedureId) missing.push("amount");

  const budget = said.budgetKrwMax ?? profile.prefs?.budgetKrw?.max;
  if (budget !== undefined) {
    draft.budgetKrw = { max: budget };
    if (said.budgetKrwMax === undefined) defaultsApplied.push({ field: "budgetKrw", source: "prefs.budgetKrw" });
  }

  const areas = said.areas ?? areaGroup(profile.trip?.stayArea);
  if (areas) {
    draft.areas = areas;
    if (!said.areas) defaultsApplied.push({ field: "areas", source: "stay_area_group" });
  }

  const languages = profile.prefs?.languagesNeeded?.length ? profile.prefs.languagesNeeded : profile.locale ? [profile.locale] : undefined;
  if (languages) {
    draft.languages = languages;
    defaultsApplied.push({ field: "languages", source: profile.prefs?.languagesNeeded?.length ? "prefs.languagesNeeded" : "locale" });
  } else missing.push("languages");

  const from = said.dateFrom ?? profile.trip?.arrival;
  const to = said.dateTo ?? profile.trip?.departure;
  if (from && to) {
    draft.dateWindow = { from, to };
    if (!said.dateFrom || !said.dateTo) defaultsApplied.push({ field: "dateWindow", source: "trip" });
  } else missing.push("dateWindow");

  const firstKProcedure = profile.history ? profile.history.none : undefined;
  if (profile.nationality) {
    draft.visitorProfile = {
      nationality: profile.nationality,
      ...(profile.residency ? { residency: profile.residency } : {}),
      ...(profile.ageBand ? { ageBand: profile.ageBand as AgeBand } : {}),
      ...(firstKProcedure !== undefined ? { firstKProcedure } : {}),
    };
  } else missing.push("visitorProfile.nationality");
  if (profile.nationality !== "KR" && !profile.residency) missing.push("visitorProfile.residency");
  if (!profile.ageBand) missing.push("visitorProfile.ageBand");
  if (said.notes) draft.notes = said.notes;

  const eligible = profile.nationality !== "KR" && profile.residency !== "resident";
  let request: ProcedureRequestV1 | undefined;
  if (missing.length === 0) {
    const parsed = ProcedureRequestForPlatformSchema.safeParse(draft);
    if (parsed.success) request = parsed.data;
    else throw new Error(`draft failed validation: ${formatZodError(parsed.error)}`);
  }

  return { draft, request, missing, defaultsApplied, eligible, text: summaryText(draft, missing, eligible, locale), source };
}

// ---- customer facing sentence (template, so numbers come from the draft only) ----

const AREA_NAME: Record<Locale, Record<Area, string>> = {
  ja: { gangnam: "江南", sinsa: "新沙", apgujeong: "狎鴎亭", myeongdong: "明洞", hongdae: "弘大", other: "その他" },
  ko: { gangnam: "강남", sinsa: "신사", apgujeong: "압구정", myeongdong: "명동", hongdae: "홍대", other: "기타" },
  en: { gangnam: "Gangnam", sinsa: "Sinsa", apgujeong: "Apgujeong", myeongdong: "Myeongdong", hongdae: "Hongdae", other: "Other" },
  "zh-CN": { gangnam: "江南", sinsa: "新沙", apgujeong: "狎鸥亭", myeongdong: "明洞", hongdae: "弘大", other: "其他" },
};
const LANGUAGE_NAME: Record<Locale, Record<Locale, string>> = {
  ja: { ja: "日本語", ko: "韓国語", en: "英語", "zh-CN": "中国語" },
  ko: { ja: "일본어", ko: "한국어", en: "영어", "zh-CN": "중국어" },
  en: { ja: "Japanese", ko: "Korean", en: "English", "zh-CN": "Chinese" },
  "zh-CN": { ja: "日语", ko: "韩语", en: "英语", "zh-CN": "中文" },
};
const UNIT_NAME: Record<Unit, string> = { cc: "cc", shot: " shots", unit: " units", line: " lines", session: "x", vial: " vial" };

const won = (krw: number, locale: Locale) => {
  if (locale === "en") return `KRW ${krw.toLocaleString("en-US")}`;
  if (krw % 10_000 === 0) return locale === "ko" ? `${krw / 10_000}만 원` : locale === "ja" ? `${krw / 10_000}万ウォン` : `${krw / 10_000}万韩元`;
  return locale === "ko" ? `${krw.toLocaleString("en-US")}원` : locale === "ja" ? `${krw.toLocaleString("en-US")}ウォン` : `${krw.toLocaleString("en-US")}韩元`;
};
const md = (iso: string, locale: Locale) => {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (locale === "en") return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}`;
  return locale === "ko" ? `${m}/${d}` : `${m}月${d}日`;
};

const QUESTION: Record<Locale, Partial<Record<MissingField, string>>> = {
  ja: { procedureId: "受けたい施術の名前を教えてください。", dateWindow: "韓国に滞在する日程を教えてください。", amount: "希望の量を教えてください。" },
  ko: { procedureId: "받고 싶은 시술 이름을 알려 주세요.", dateWindow: "한국에 머무는 일정을 알려 주세요.", amount: "원하는 용량을 알려 주세요." },
  en: { procedureId: "Which treatment would you like?", dateWindow: "When will you be in Korea?", amount: "How much would you like (for example 2cc)?" },
  "zh-CN": { procedureId: "请告诉我你想做的项目名称。", dateWindow: "请告诉我你在韩国的日期。", amount: "请告诉我希望的用量。" },
};
const NOT_ELIGIBLE: Record<Locale, string> = {
  ja: "韓国にお住まいの方には、クリニックの紹介と予約をご案内できません。施術記録はお使いいただけます。",
  ko: "한국에 거주하시는 분께는 병원 매칭과 예약을 도와드릴 수 없어요. 시술 기록은 쓰실 수 있어요.",
  en: "I can't match or book clinics for people who live in Korea. You can still keep your treatment records.",
  "zh-CN": "居住在韩国的用户无法使用诊所匹配和预约。项目记录仍可使用。",
};
const CONFIRM: Record<Locale, (parts: string) => string> = {
  ja: (p) => `${p}で探しますか？`,
  ko: (p) => `${p} 조건으로 찾을까요?`,
  en: (p) => `Shall I search with: ${p}?`,
  "zh-CN": (p) => `按${p}来找吗？`,
};
const UNDER: Record<Locale, (amount: string) => string> = {
  ja: (a) => `${a}以下`,
  ko: (a) => `${a} 이하`,
  en: (a) => `up to ${a}`,
  "zh-CN": (a) => `${a}以内`,
};

export function summaryText(draft: IntentResult["draft"], missing: MissingField[], eligible: boolean, locale: Locale): string {
  if (!eligible) return NOT_ELIGIBLE[locale];
  const ask = missing.map((field) => QUESTION[locale][field]).find(Boolean);
  if (ask) return ask;
  const parts: string[] = [];
  if (draft.procedureId) {
    const amount = draft.amount ? ` ${draft.amount.value}${UNIT_NAME[draft.amount.unit]}`.replace(/^ (\d)/, " $1") : "";
    parts.push(`${procedureName(draft.procedureId, locale)}${amount}`);
  }
  if (draft.budgetKrw) parts.push(UNDER[locale](won(draft.budgetKrw.max, locale)));
  if (draft.areas) parts.push(draft.areas.map((a) => AREA_NAME[locale][a]).join("/"));
  if (draft.languages) parts.push(draft.languages.map((l) => LANGUAGE_NAME[locale][l]).join("/"));
  if (draft.dateWindow) parts.push(`${md(draft.dateWindow.from, locale)}~${md(draft.dateWindow.to, locale)}`);
  const separator = locale === "en" ? ", " : locale === "ko" ? " · " : "・";
  return CONFIRM[locale](parts.join(separator));
}
