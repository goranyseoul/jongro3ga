import type { Area, Locale } from "../../domain";
import { AREA_NAME, LANGUAGE_NAME, fill } from "./copy-common";

// Shortlist reasons, four languages, templates only (07 2절 4). Facts about one clinic against market records or
// its own history; never a comparison with another clinic (08 3절) and never the content of a routing rule.

export type MatchingCopyKey =
  | "fit_staff"
  | "fit_interpreter"
  | "price_low"
  | "price_mid"
  | "price_high"
  | "price_insufficient"
  | "outcome_avg"
  | "outcome_none"
  | "reliability_close"
  | "reliability_gap"
  | "reliability_none"
  | "rule_adjusted"
  | "budget_over"
  | "near_stay";

export const MATCHING_COPY: Record<Locale, Record<MatchingCopyKey, string>> = {
  ko: {
    fit_staff: "{lang} 응대 직원이 있어요",
    fit_interpreter: "{lang} 통역을 지원해요",
    price_low: "단위가격이 최근 실결제 기록보다 낮은 편이에요",
    price_mid: "단위가격이 최근 실결제 기록의 중간 범위예요",
    price_high: "단위가격이 최근 실결제 기록보다 높은 편이에요",
    price_insufficient: "비교할 실결제 기록이 아직 적어요",
    outcome_avg: "지난 결과 {n}건의 평균 만족도 {avg}점",
    outcome_none: "아직 결과 기록이 없어요",
    reliability_close: "지난 결과 {n}건에서 실결제가 견적과 가까웠어요",
    reliability_gap: "지난 결과 {n}건에서 실결제가 견적보다 평균 {pct}% 높았어요",
    reliability_none: "견적 대비 실결제 기록이 아직 없어요",
    rule_adjusted: "운영 기준을 반영했어요",
    budget_over: "예산을 넘을 수 있어요",
    near_stay: "숙소 근처예요 ({area})",
  },
  ja: {
    fit_staff: "{lang}対応のスタッフがいます",
    fit_interpreter: "{lang}の通訳に対応しています",
    price_low: "単価は最近の実際の支払い記録と比べて安めです",
    price_mid: "単価は最近の実際の支払い記録の中間の範囲です",
    price_high: "単価は最近の実際の支払い記録と比べて高めです",
    price_insufficient: "比較できる支払い記録はまだ少ないです",
    outcome_avg: "過去の結果{n}件の平均満足度は{avg}点です",
    outcome_none: "結果の記録はまだありません",
    reliability_close: "過去の結果{n}件では支払額が見積もりに近い金額でした",
    reliability_gap: "過去の結果{n}件では支払額が見積もりより平均{pct}%高くなりました",
    reliability_none: "見積もりと支払額の記録はまだありません",
    rule_adjusted: "運営基準を反映しています",
    budget_over: "ご予算を超える可能性があります",
    near_stay: "宿泊先の近くです（{area}）",
  },
  en: {
    fit_staff: "{lang}-speaking staff on site",
    fit_interpreter: "{lang} interpreter available",
    price_low: "Unit price is on the low side of recent paid records",
    price_mid: "Unit price is in the middle range of recent paid records",
    price_high: "Unit price is on the high side of recent paid records",
    price_insufficient: "Few paid records to compare with yet",
    outcome_avg: "Average satisfaction {avg} in {n} past outcomes",
    outcome_none: "No outcome records yet",
    reliability_close: "Paid prices close to quotes in {n} past outcomes",
    reliability_gap: "Paid prices averaged {pct}% above quotes in {n} past outcomes",
    reliability_none: "No quote and payment records yet",
    rule_adjusted: "Reflects platform operating rules",
    budget_over: "May exceed your budget",
    near_stay: "Near where you stay ({area})",
  },
  "zh-CN": {
    fit_staff: "有{lang}工作人员",
    fit_interpreter: "提供{lang}翻译",
    price_low: "单价在近期实付记录中偏低",
    price_mid: "单价处于近期实付记录的中间范围",
    price_high: "单价在近期实付记录中偏高",
    price_insufficient: "可比较的实付记录还不多",
    outcome_avg: "过去{n}条结果的平均满意度为{avg}分",
    outcome_none: "还没有结果记录",
    reliability_close: "过去{n}条结果中实付金额接近报价",
    reliability_gap: "过去{n}条结果中实付金额平均高于报价{pct}%",
    reliability_none: "还没有报价与实付的记录",
    rule_adjusted: "已参考平台运营规则",
    budget_over: "可能超出预算",
    near_stay: "靠近住处（{area}）",
  },
};

export type FactorKey = "fit" | "price" | "outcome" | "reliability";

/** What a reason sentence needs to know about one candidate. */
export interface ReasonFacts {
  /** Factors ordered by their contribution to the score, largest first. */
  topFactors: FactorKey[];
  language?: { locale: Locale; mode: "staff" | "interpreter" | "app_translation" };
  priceBand: "low" | "mid" | "high" | "insufficient";
  outcomes: { n: number; avgSatisfaction: number };
  gaps: { n: number; avgGap: number };
  ruleAdjusted: boolean;
  budgetExceeded: boolean;
  /** Clinic area when it is one of the requested areas (location information, not a score). */
  nearStayArea?: Area;
}

function factorSentence(factor: FactorKey, facts: ReasonFacts, locale: Locale): string | undefined {
  const copy = MATCHING_COPY[locale];
  switch (factor) {
    case "fit": {
      if (!facts.language || facts.language.mode === "app_translation") return undefined;
      const lang = LANGUAGE_NAME[facts.language.locale][locale];
      return fill(facts.language.mode === "staff" ? copy.fit_staff : copy.fit_interpreter, { lang });
    }
    case "price":
      return copy[`price_${facts.priceBand}`];
    case "outcome":
      return facts.outcomes.n === 0
        ? copy.outcome_none
        : fill(copy.outcome_avg, { n: facts.outcomes.n, avg: facts.outcomes.avgSatisfaction.toFixed(1) });
    case "reliability":
      if (facts.gaps.n === 0) return copy.reliability_none;
      return facts.gaps.avgGap <= 0.05
        ? fill(copy.reliability_close, { n: facts.gaps.n })
        : fill(copy.reliability_gap, { n: facts.gaps.n, pct: Math.round(facts.gaps.avgGap * 100) });
  }
}

/** Top two contributing factors, then rule, budget and location sentences (07 2절 4). */
export function buildReasons(facts: ReasonFacts, locale: Locale): string[] {
  const copy = MATCHING_COPY[locale];
  const reasons = facts.topFactors
    .map((factor) => factorSentence(factor, facts, locale))
    .filter((s): s is string => s !== undefined)
    .slice(0, 2);
  if (facts.ruleAdjusted) reasons.push(copy.rule_adjusted);
  if (facts.budgetExceeded) reasons.push(copy.budget_over);
  if (facts.nearStayArea) reasons.push(fill(copy.near_stay, { area: AREA_NAME[facts.nearStayArea][locale] }));
  return reasons;
}
