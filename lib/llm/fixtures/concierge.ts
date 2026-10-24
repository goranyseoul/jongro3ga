import type { Locale } from "../../domain/common";
import type { ConciergeInput, ConciergeQuoteRow } from "../prompts/concierge";

// Fixture "결과 요약": the verdict numbers and labels are injected, the template only puts them into words,
// in the order given. Two sentences, no ranking, no recommendation.

const LABELS: Record<ConciergeQuoteRow["label"], Record<Locale, string>> = {
  fair: { ja: "適正", en: "fair", "zh-CN": "合理", ko: "적정" },
  good_deal: { ja: "お得", en: "good deal", "zh-CN": "划算", ko: "저렴한 편" },
  high: { ja: "高め", en: "on the high side", "zh-CN": "偏高", ko: "높은 편" },
  very_high: { ja: "かなり高め", en: "very high", "zh-CN": "明显偏高", ko: "많이 높은 편" },
  underdosed: { ja: "量が少なめ", en: "low dose", "zh-CN": "剂量偏少", ko: "용량이 적은 편" },
  insufficient_data: { ja: "データ不足", en: "not enough data", "zh-CN": "数据不足", ko: "데이터 부족" },
};

const PAID_MORE: Record<Locale, string> = {
  ja: "見積もりより支払額が高かった記録があります",
  en: "records show payments above the quote",
  "zh-CN": "有实付金额高于报价的记录",
  ko: "견적보다 실제 결제가 높았던 기록이 있어요",
};

const won = (krw: number) => krw.toLocaleString("en-US");

function typical(row: ConciergeQuoteRow, locale: Locale): string | undefined {
  if (row.label !== "underdosed" || !row.typicalAmount) return undefined;
  const { min, max, unit } = row.typicalAmount;
  return { ja: `通常${min}~${max}${unit}`, en: `typical ${min}~${max}${unit}`, "zh-CN": `通常${min}~${max}${unit}`, ko: `통상 ${min}~${max}${unit}` }[locale];
}

function rowText(row: ConciergeQuoteRow, locale: Locale): string {
  const label = row.labelText ?? LABELS[row.label][locale];
  const notes = [typical(row, locale), row.paidMoreThanQuoted ? PAID_MORE[locale] : undefined].filter(Boolean);
  const amount = `${row.amount.value}${row.amount.unit}`;
  switch (locale) {
    case "ja":
      return `${row.clinicName} ${amount} ₩${won(row.priceKrw)}は「${label}」${notes.length ? `(${notes.join("、")})` : ""}`;
    case "zh-CN":
      return `${row.clinicName} ${amount} ₩${won(row.priceKrw)} 为“${label}”${notes.length ? `(${notes.join("，")})` : ""}`;
    case "ko":
      return `${row.clinicName} ${amount} ₩${won(row.priceKrw)}은 '${label}'${notes.length ? ` (${notes.join(", ")})` : ""}`;
    case "en":
      return `${row.clinicName} ${amount} at KRW ${won(row.priceKrw)} is "${label}"${notes.length ? ` (${notes.join(", ")})` : ""}`;
  }
}

export function conciergeFixture(input: ConciergeInput): string {
  const { locale, rows, procedureName } = input;
  const n = rows.length;
  const list = rows.map((row) => rowText(row, locale));
  switch (locale) {
    case "ja":
      return `${procedureName}の見積もりが${n}件届きました。価格チェックの結果は、${list.join("、")}です。`;
    case "zh-CN":
      return `已收到${n}份${procedureName}报价。价格检查结果：${list.join("；")}。`;
    case "ko":
      return `${procedureName} 견적이 ${n}건 도착했어요. 가격 판정 결과는 ${list.join(", ")}이에요.`;
    case "en":
      return `${n} quotes for ${procedureName} arrived. The price check says: ${list.join("; ")}.`;
  }
}

/** 10 데모 4행 quotes, for tests and the demo page. Order is the platform's, not a ranking. */
export function demoConciergeInput(locale: Locale): ConciergeInput {
  const names: Record<Locale, [string, string, string, string]> = {
    ja: ["リジュラン", "ソウルグロウ", "ミント", "アラ"],
    en: ["Rejuran", "Seoul Glow", "Mint", "Ara"],
    "zh-CN": ["丽珠兰", "首尔光彩", "Mint", "Ara"],
    ko: ["리쥬란", "서울글로우", "민트", "아라"],
  };
  const [procedureName, glow, mint, ara] = names[locale];
  return {
    locale,
    procedureName,
    rows: [
      { clinicName: glow, priceKrw: 340000, amount: { value: 2, unit: "cc" }, label: "fair" },
      {
        clinicName: mint,
        priceKrw: 99000,
        amount: { value: 1, unit: "cc" },
        label: "underdosed",
        typicalAmount: { min: 2, max: 3, unit: "cc" },
      },
      { clinicName: ara, priceKrw: 380000, amount: { value: 2, unit: "cc" }, label: "fair", paidMoreThanQuoted: true },
    ],
  };
}
