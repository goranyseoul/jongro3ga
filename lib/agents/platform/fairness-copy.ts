// Verdict explanations in four languages (07 "설명": template sentences, no LLM). Pure.
// Sentences compare a quote with recent paid records only, never one clinic with another (08 3절).
import type { FairnessVerdictV1 } from "../../a2a/schemas";
import type { Locale, Unit } from "../../domain";

type Label = FairnessVerdictV1["label"];
type L4 = Record<Locale, string>;

export interface ExplanationInput {
  label: Label;
  amountValue: number;
  unit: Unit;
  typicalMin: number;
  typicalMax: number;
  unitKrw: number;
  sampleSize: number;
  p25?: number;
  p75?: number;
  p90?: number;
  paidMoreThanQuotedPct?: number;
  indicative: boolean;
}

const UNIT_WORD: Record<Unit, L4> = {
  cc: { ko: "cc", ja: "cc", en: "cc", "zh-CN": "cc" },
  shot: { ko: "샷", ja: "ショット", en: " shots", "zh-CN": "发" },
  unit: { ko: "유닛", ja: "単位", en: " units", "zh-CN": "单位" },
  line: { ko: "줄", ja: "本", en: " lines", "zh-CN": "根" },
  session: { ko: "회", ja: "回", en: " sessions", "zh-CN": "次" },
  vial: { ko: "바이알", ja: "バイアル", en: " vials", "zh-CN": "瓶" },
};

/** "per cc", "per shot": singular English unit for unit prices. */
const UNIT_SINGULAR_EN: Record<Unit, string> = { cc: "cc", shot: "shot", unit: "unit", line: "line", session: "session", vial: "vial" };

const num = (n: number): string => Math.round(n).toLocaleString("en-US");
const amt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function won(n: number | undefined, locale: Locale): string {
  const v = num(n ?? 0);
  switch (locale) {
    case "ko":
      return `${v}원`;
    case "ja":
      return `${v}ウォン`;
    case "zh-CN":
      return `${v}韩元`;
    default:
      return `KRW ${v}`;
  }
}

function base(input: ExplanationInput, locale: Locale): string {
  const u = UNIT_WORD[input.unit][locale];
  const a = `${amt(input.amountValue)}${u}`;
  const range = `${amt(input.typicalMin)}~${amt(input.typicalMax)}${u}`;
  const price = won(input.unitKrw, locale);
  const p25 = won(input.p25, locale);
  const p75 = won(input.p75, locale);
  const p90 = won(input.p90, locale);
  const per = locale === "en" ? UNIT_SINGULAR_EN[input.unit] : u.trim();

  const table: Record<Label, L4> = {
    underdosed: {
      ko: `${a}는 한국 여성이 보통 받는 ${range}보다 적어요. 단가는 낮아 보여도 시술량이 적어요.`,
      ja: `${a}は、韓国の女性が通常受ける${range}より少ない量です。単価は安く見えても、施術量も少なくなります。`,
      en: `${a} is below the ${range} Korean women usually receive. The unit price may look low, but the total treatment is smaller.`,
      "zh-CN": `${a}少于韩国女性通常接受的${range}。单价看起来便宜，但治疗量也更少。`,
    },
    good_deal: {
      ko: `${per}당 ${price}으로, 최근 실결제 기록의 보통 범위(${p25}~${p75})보다 낮아요.`,
      ja: `1${per}あたり${price}で、最近の実際の支払い記録の通常の範囲(${p25}~${p75})を下回っています。`,
      en: `At ${price} per ${per}, this is below the usual range of recent paid records (${p25} to ${p75}).`,
      "zh-CN": `每${per}${price}，低于近期实际支付记录的常见范围（${p25}~${p75}）。`,
    },
    fair: {
      ko: `${per}당 ${price}으로, 최근 실결제 기록의 보통 범위(${p25}~${p75}) 안이에요.`,
      ja: `1${per}あたり${price}で、最近の実際の支払い記録の通常の範囲(${p25}~${p75})内です。`,
      en: `At ${price} per ${per}, this is within the usual range of recent paid records (${p25} to ${p75}).`,
      "zh-CN": `每${per}${price}，在近期实际支付记录的常见范围（${p25}~${p75}）内。`,
    },
    high: {
      ko: `${per}당 ${price}으로, 최근 실결제 기록의 보통 범위(${p25}~${p75})보다 높아요.`,
      ja: `1${per}あたり${price}で、最近の実際の支払い記録の通常の範囲(${p25}~${p75})を上回っています。`,
      en: `At ${price} per ${per}, this is above the usual range of recent paid records (${p25} to ${p75}).`,
      "zh-CN": `每${per}${price}，高于近期实际支付记录的常见范围（${p25}~${p75}）。`,
    },
    very_high: {
      ko: `${per}당 ${price}으로, 최근 실결제 기록의 상위 10% 기준(${p90})보다 높아요.`,
      ja: `1${per}あたり${price}で、最近の実際の支払い記録の上位10%の水準(${p90})を超えています。`,
      en: `At ${price} per ${per}, this is above the top 10% of recent paid records (${p90}).`,
      "zh-CN": `每${per}${price}，高于近期实际支付记录前10%的水平（${p90}）。`,
    },
    insufficient_data: {
      ko: `최근 실결제 기록이 ${input.sampleSize}건뿐이라 가격을 판정하기 어려워요.`,
      ja: `最近の実際の支払い記録が${input.sampleSize}件しかなく、価格を判定できません。`,
      en: `There are only ${input.sampleSize} recent paid records, not enough to judge this price.`,
      "zh-CN": `近期实际支付记录只有${input.sampleSize}条，不足以判断价格。`,
    },
  };
  return table[input.label][locale];
}

export const PAID_MORE_WARNING: L4 = {
  ko: "견적보다 실제 결제액이 높았던 기록이 있어요",
  ja: "見積もりより支払額が高かった記録があります",
  en: "Past visitors paid more than the quoted price",
  "zh-CN": "有实际支付金额高于报价的记录",
};

const INDICATIVE_NOTE: L4 = {
  ko: "이 가격은 참고가이며 병원 확인 후 확정돼요.",
  ja: "この価格は参考価格で、クリニックの確認後に確定します。",
  en: "This is a reference price; the clinic confirms the final price.",
  "zh-CN": "此价格为参考价，需诊所确认后才最终确定。",
};

const LOCALES: Locale[] = ["ko", "ja", "en", "zh-CN"];

function paidMore(pct: number, locale: Locale): string {
  const avg = { ko: `평균 +${pct}%`, ja: `平均+${pct}%`, en: `average +${pct}%`, "zh-CN": `平均+${pct}%` }[locale];
  const open = locale === "zh-CN" || locale === "ja" ? "（" : " (";
  const close = locale === "zh-CN" || locale === "ja" ? "）" : ")";
  const end = locale === "en" ? "." : locale === "ko" ? "." : "。";
  return `${PAID_MORE_WARNING[locale]}${open}${avg}${close}${end}`;
}

export function explainVerdict(input: ExplanationInput): FairnessVerdictV1["explanation"] {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    const parts = [base(input, locale)];
    if (input.paidMoreThanQuotedPct !== undefined) parts.push(paidMore(input.paidMoreThanQuotedPct, locale));
    if (input.indicative) parts.push(INDICATIVE_NOTE[locale]);
    out[locale] = parts.join(locale === "ja" || locale === "zh-CN" ? "" : " ");
  }
  return out as FairnessVerdictV1["explanation"];
}
