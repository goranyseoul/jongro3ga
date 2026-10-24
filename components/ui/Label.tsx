import { cx } from "./cx";

export type VerdictLabel = "fair" | "good_deal" | "high" | "very_high" | "underdosed" | "insufficient_data";
export type LabelLocale = "ko" | "ja" | "en" | "zh-CN";

// Copy table from docs/spec/05-screens.md "판정 라벨 문구".
export const VERDICT_LABEL_COPY: Record<VerdictLabel, Record<LabelLocale, string>> = {
  fair: { ko: "적정", ja: "適正", en: "Fair", "zh-CN": "合理" },
  good_deal: { ko: "저렴", ja: "お得", en: "Good deal", "zh-CN": "划算" },
  high: { ko: "높음", ja: "高め", en: "High", "zh-CN": "偏高" },
  very_high: { ko: "매우 높음", ja: "かなり高め", en: "Very high", "zh-CN": "过高" },
  underdosed: { ko: "용량 부족", ja: "量が少なめ", en: "Low dose", "zh-CN": "剂量偏少" },
  insufficient_data: { ko: "판정 불가", ja: "判定不可", en: "Not enough data", "zh-CN": "数据不足" },
};

const TONE: Record<VerdictLabel, string> = {
  fair: "text-text",
  good_deal: "text-success",
  high: "text-warning",
  very_high: "text-danger",
  underdosed: "text-warning",
  insufficient_data: "text-subtle",
};

export interface LabelProps {
  label: VerdictLabel;
  locale: LabelLocale;
  className?: string;
}

/** Verdict label: one word of flat text, semantic color only on the text. Never a pill or tinted background. */
export function Label({ label, locale, className }: LabelProps) {
  return (
    <span data-verdict={label} className={cx("text-body font-semi", TONE[label], className)}>
      {VERDICT_LABEL_COPY[label][locale]}
    </span>
  );
}
