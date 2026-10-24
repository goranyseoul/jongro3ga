import type { Locale } from "./common";

// Labels from docs/spec/07-platform-intelligence.md, wording from 05-screens.md "판정 라벨 문구".
export type VerdictLabel = "fair" | "good_deal" | "high" | "very_high" | "underdosed" | "insufficient_data";

export type VerdictTone = "success" | "warning" | "danger" | "muted";

export const VERDICT_TONE: Record<VerdictLabel, VerdictTone> = {
  fair: "success",
  good_deal: "success",
  high: "warning",
  very_high: "danger",
  underdosed: "warning",
  insufficient_data: "muted",
};

export const VERDICT_TEXT: Record<VerdictLabel, Record<Locale, string>> = {
  fair: { ko: "적정", ja: "適正", en: "Fair", "zh-CN": "合理" },
  good_deal: { ko: "저렴", ja: "お得", en: "Good deal", "zh-CN": "划算" },
  high: { ko: "높음", ja: "高め", en: "High", "zh-CN": "偏高" },
  very_high: { ko: "매우 높음", ja: "かなり高め", en: "Very high", "zh-CN": "过高" },
  underdosed: { ko: "용량 부족", ja: "量が少なめ", en: "Low dose", "zh-CN": "剂量偏少" },
  insufficient_data: { ko: "판정 불가", ja: "判定不可", en: "Not enough data", "zh-CN": "数据不足" },
};
