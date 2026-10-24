import type { FairnessVerdictV1 } from "../../a2a/schemas";
import type { I18nText, Locale, Unit } from "../../domain";
import { LOCALES, fill, formatAmount, formatRange } from "./copy-common";

// Verdict explanations, four languages, templates only (07 1절 "설명", no LLM). Prices are compared with market
// records only, never with another clinic (08 3절).

export type FairnessCopyKey =
  | "dose_below"
  | "dose_above"
  | "band_low"
  | "band_mid"
  | "band_high"
  | "band_very_high"
  | "band_insufficient"
  | "flag_paid_more"
  | "flag_indicative";

export const FAIRNESS_COPY: Record<Locale, Record<FairnessCopyKey, string>> = {
  ko: {
    dose_below: "{amount}는 보통 받는 {typical}보다 적어요. 단가는 낮아 보여도 시술량이 적어요.",
    dose_above: "{amount}는 보통 받는 {typical}보다 많아요.",
    band_low: "단위가격이 최근 실결제 기록보다 낮은 편이에요.",
    band_mid: "단위가격이 최근 실결제 기록의 중간 범위예요.",
    band_high: "단위가격이 최근 실결제 기록보다 높은 편이에요.",
    band_very_high: "단위가격이 최근 실결제 기록의 상위 10%보다 높아요.",
    band_insufficient: "비교할 실결제 기록이 부족해 가격은 판정하지 않았어요.",
    flag_paid_more: "이 병원은 견적보다 실제 결제액이 높았던 기록이 있어요 (평균 +{pct}%).",
    flag_indicative: "대행 운영 병원의 참고 가격이라 병원 확인 뒤 달라질 수 있어요.",
  },
  ja: {
    dose_below: "{amount}は、通常受ける{typical}より少ない量です。単価は安く見えても施術量が少なくなります。",
    dose_above: "{amount}は、通常受ける{typical}より多い量です。",
    band_low: "単価は最近の実際の支払い記録と比べて安めです。",
    band_mid: "単価は最近の実際の支払い記録の中間の範囲です。",
    band_high: "単価は最近の実際の支払い記録と比べて高めです。",
    band_very_high: "単価は最近の実際の支払い記録の上位10%を超えています。",
    band_insufficient: "比較できる支払い記録が少ないため、価格は判定していません。",
    flag_paid_more: "見積もりより支払額が高かった記録があります（平均+{pct}%）。",
    flag_indicative: "代行運営のクリニックの参考価格のため、クリニックの確認後に変わる場合があります。",
  },
  en: {
    dose_below: "{amount} is below the {typical} people usually receive. The unit price looks low, but the treatment is smaller.",
    dose_above: "{amount} is above the {typical} people usually receive.",
    band_low: "The unit price is on the low side of recent paid records.",
    band_mid: "The unit price is in the middle range of recent paid records.",
    band_high: "The unit price is on the high side of recent paid records.",
    band_very_high: "The unit price is above the top 10% of recent paid records.",
    band_insufficient: "There are too few paid records to judge the price.",
    flag_paid_more: "Past patients of this clinic paid more than quoted (average +{pct}%).",
    flag_indicative: "This is an indicative price relayed on behalf of the clinic and may change after the clinic confirms.",
  },
  "zh-CN": {
    dose_below: "{amount}少于通常的{typical}。单价看起来低，但施术量也更少。",
    dose_above: "{amount}多于通常的{typical}。",
    band_low: "单价在近期实付记录中偏低。",
    band_mid: "单价处于近期实付记录的中间范围。",
    band_high: "单价在近期实付记录中偏高。",
    band_very_high: "单价高于近期实付记录的前10%。",
    band_insufficient: "可比较的实付记录不足，未判定价格。",
    flag_paid_more: "该诊所有实付金额高于报价的记录（平均+{pct}%）。",
    flag_indicative: "这是代运营诊所的参考价格，诊所确认后可能变化。",
  },
};

const BAND_KEY: Record<FairnessVerdictV1["priceBand"], FairnessCopyKey> = {
  low: "band_low",
  mid: "band_mid",
  high: "band_high",
  very_high: "band_very_high",
  insufficient: "band_insufficient",
};

export interface ExplanationInput {
  amount: { value: number; unit: Unit };
  typicalAmount: { min: number; max: number };
  priceBand: FairnessVerdictV1["priceBand"];
  doseFlag: FairnessVerdictV1["doseFlag"];
  clinicFlags: FairnessVerdictV1["clinicFlags"];
}

/** One explanation per locale: dose sentence (if off the typical range), price band, then clinic flags. */
export function fairnessExplanation(input: ExplanationInput): I18nText {
  const out: I18nText = {};
  for (const locale of LOCALES) {
    const copy = FAIRNESS_COPY[locale];
    const vars = {
      amount: formatAmount(input.amount.value, input.amount.unit, locale),
      typical: formatRange(input.typicalAmount.min, input.typicalAmount.max, input.amount.unit, locale),
    };
    const sentences: string[] = [];
    if (input.doseFlag === "below_typical") sentences.push(fill(copy.dose_below, vars));
    if (input.doseFlag === "above_typical") sentences.push(fill(copy.dose_above, vars));
    sentences.push(copy[BAND_KEY[input.priceBand]]);
    for (const flag of input.clinicFlags) {
      if (flag.code === "paid_more_than_quoted") sentences.push(fill(copy.flag_paid_more, { pct: flag.avgGapPct ?? 0 }));
      if (flag.code === "indicative_price") sentences.push(copy.flag_indicative);
    }
    out[locale] = sentences.join(locale === "ja" || locale === "zh-CN" ? "" : " ");
  }
  return out;
}
