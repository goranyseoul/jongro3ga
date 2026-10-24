import type { Locale } from "../../domain/common";
import type { ExclusionReason, Warning } from "./procedure-filter";

// What the agent tells the visitor when downtime would run past the departure day: check whether the stay
// can be extended. Fixed templates in four languages, so the days always come from the filter and never
// from a model, and the wording stays free of any medical statement.
// The Japanese and Chinese lines still need a native check.

const MAY_OVERLAP: Record<Locale, (days: number) => string> = {
  ko: (days) => `다운타임이 출국일을 최대 ${days}일 넘길 수 있어요. 체류를 연장할 수 있는지 먼저 확인해 보세요.`,
  ja: (days) => `ダウンタイムが出国日を最大${days}日過ぎる可能性があります。滞在を延長できるか先にご確認ください。`,
  en: (days) =>
    `Downtime may run up to ${days} ${days === 1 ? "day" : "days"} past your departure date. Please check first whether you can extend your stay.`,
  "zh-CN": (days) => `恢复期最多可能比出境日期多${days}天。请先确认是否可以延长停留时间。`,
};

const CANNOT_FINISH: Record<Locale, (days: number) => string> = {
  ko: (days) => `이번 일정에서는 출국일까지 다운타임이 끝나지 않아요. 체류를 ${days}일 연장할 수 있다면 가능해요. 연장이 가능한지 확인해 보세요.`,
  ja: (days) =>
    `今回の日程では出国日までにダウンタイムが終わりません。滞在を${days}日延ばせる場合は可能です。延長できるかご確認ください。`,
  en: (days) =>
    `With this schedule the downtime would not end before you leave. It would work if you can extend your stay by ${days} ${days === 1 ? "day" : "days"}. Please check whether an extension is possible.`,
  "zh-CN": (days) => `按这次的行程，恢复期在出境前无法结束。如果能延长停留${days}天就可以进行。请先确认是否可以延长。`,
};

/** The sentence for a filter warning or exclusion that asks to check a stay extension, otherwise undefined. */
export function stayExtensionNotice(item: Warning | ExclusionReason, locale: Locale): string | undefined {
  if (item.code === "downtime_may_overlap_departure") return MAY_OVERLAP[locale](item.daysOver);
  if (item.code === "downtime_after_departure") return CANNOT_FINISH[locale](item.extendDays);
  return undefined;
}
