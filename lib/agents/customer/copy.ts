import type { I18nText, Locale } from "../../domain/common";
import type { StoredRequest } from "./store";

// Customer facing sentences the agent itself produces (progress, inbox). Never diagnosis, recommendation or
// a comparison between clinics (08 sections 3 and 6): only what the agent did and what the platform said.

export const STATUS_COPY: Record<StoredRequest["status"], I18nText> = {
  draft: { ja: "条件を整理しました", "zh-CN": "已整理条件", en: "Conditions ready", ko: "조건을 정리했어요" },
  matching: { ja: "条件に合うクリニックを探しています", "zh-CN": "正在寻找符合条件的诊所", en: "Finding clinics that match", ko: "조건에 맞는 병원을 찾고 있어요" },
  quoting: { ja: "クリニックに見積もりを依頼しています", "zh-CN": "正在向诊所请求报价", en: "Asking clinics for quotes", ko: "병원에 견적을 요청하고 있어요" },
  judging: { ja: "プラットフォームが価格を確認しています", "zh-CN": "平台正在审核价格", en: "The platform is checking the prices", ko: "플랫폼이 가격을 확인하고 있어요" },
  comparing: { ja: "見積もりを比較できます", "zh-CN": "可以比较报价了", en: "Quotes are ready to compare", ko: "견적을 비교할 수 있어요" },
  booking: { ja: "クリニックが予約を確認しています", "zh-CN": "诊所正在确认预约", en: "The clinic is checking your booking", ko: "병원에서 예약을 확인하고 있어요" },
  booked: { ja: "予約が確定しました", "zh-CN": "预约已确认", en: "Your booking is confirmed", ko: "예약이 확정됐어요" },
  closed: { ja: "この依頼は終了しました", "zh-CN": "此请求已结束", en: "This request is closed", ko: "이 요청은 끝났어요" },
  failed: { ja: "問題が起きました。しばらくしてからもう一度お試しください", "zh-CN": "出现问题。请稍后再试", en: "Something went wrong. Please try again shortly", ko: "문제가 생겼어요. 잠시 후 다시 시도해 주세요" },
};

const PLATFORM_NAME: I18nText = { ja: "プラットフォーム", "zh-CN": "平台", en: "the platform", ko: "플랫폼" };

/**
 * One line per A2A call for the progress timeline, used when the log entry has no sentence in the
 * customer's language. `clinic` is the clinic display name per language.
 */
export function stepSummary(skillId: string | undefined, state: string | undefined, clinic: I18nText | undefined): I18nText {
  const c = (locale: Locale) => clinic?.[locale] ?? clinic?.en ?? "";
  const rejected = state === "TASK_STATE_REJECTED";
  const failed = state === "TASK_STATE_FAILED";
  switch (skillId) {
    case "platform.recipe":
      return { ja: "同じ悩みの韓国女性の記録から通常の量を確認しました", "zh-CN": "已从同样烦恼的韩国女性记录中确认常见用量", en: "I checked the usual amount in records of Korean women with the same concern", ko: "같은 고민의 한국 여성 기록에서 보통 용량을 확인했어요" };
    case "platform.match_clinics":
      return rejected
        ? { ja: "この条件ではクリニックを紹介できません", "zh-CN": "此条件下无法介绍诊所", en: "Clinics cannot be introduced for this request", ko: "이 조건으로는 병원을 소개할 수 없어요" }
        : { ja: "プラットフォームに、条件に合うクリニックを聞きました", "zh-CN": "已向平台询问符合条件的诊所", en: "I asked the platform which clinics match your conditions", ko: "플랫폼에 맞는 병원을 물어봤어요" };
    case "clinic.quote":
      if (rejected) return { ja: `${c("ja")}は今回の依頼を受けられません`, "zh-CN": `${c("zh-CN")}无法接受此次请求`, en: `${c("en")} cannot take this request`, ko: `${c("ko")}은(는) 이번 요청을 받을 수 없어요` };
      if (failed) return { ja: `${c("ja")}から回答がありませんでした`, "zh-CN": `${c("zh-CN")}没有回复`, en: `${c("en")} did not answer`, ko: `${c("ko")}에서 답이 없었어요` };
      return { ja: `${c("ja")}に見積もりを依頼しました`, "zh-CN": `已向${c("zh-CN")}请求报价`, en: `I asked ${c("en")} for a quote`, ko: `${c("ko")}에 견적을 요청했어요` };
    case "platform.judge_quote":
      return { ja: "プラットフォームが価格を確認しました", "zh-CN": "平台已审核价格", en: "The platform reviewed the prices", ko: "플랫폼이 가격을 검토했어요" };
    case "platform.report_signal":
      return { ja: "回答のなかったクリニックをプラットフォームに伝えました", "zh-CN": "已将未回复的诊所告知平台", en: "I told the platform which clinic did not answer", ko: "답이 없던 병원을 플랫폼에 알렸어요" };
    case "clinic.book":
      return state === "TASK_STATE_COMPLETED"
        ? { ja: `${c("ja")}が予約を確定しました`, "zh-CN": `${c("zh-CN")}已确认预约`, en: `${c("en")} confirmed the booking`, ko: `${c("ko")}에서 예약을 확정했어요` }
        : { ja: `${c("ja")}に予約を依頼しました`, "zh-CN": `已向${c("zh-CN")}发送预约请求`, en: `I sent a booking request to ${c("en")}`, ko: `${c("ko")}에 예약을 요청했어요` };
    case "platform.submit_outcome":
      return { ja: "施術の記録を匿名でプラットフォームに送りました", "zh-CN": "已将施术记录匿名发送给平台", en: "I sent your procedure record to the platform anonymously", ko: "시술 기록을 익명으로 플랫폼에 보냈어요" };
    default:
      return { ja: `${PLATFORM_NAME.ja}とやり取りしました`, "zh-CN": `已与${PLATFORM_NAME["zh-CN"]}沟通`, en: `I talked to ${PLATFORM_NAME.en}`, ko: `${PLATFORM_NAME.ko}과 대화했어요` };
  }
}

export function bookingConfirmedText(clinic: I18nText | undefined, slot: string): I18nText {
  const when = `${slot.slice(5, 7)}/${slot.slice(8, 10)} ${slot.slice(11, 16)}`;
  const c = (locale: Locale) => clinic?.[locale] ?? clinic?.en ?? "";
  return {
    ja: `${c("ja")}の予約が確定しました (${when})`,
    "zh-CN": `${c("zh-CN")}的预约已确认 (${when})`,
    en: `Your booking at ${c("en")} is confirmed (${when})`,
    ko: `${c("ko")} 예약이 확정됐어요 (${when})`,
  };
}

export function checkinDueText(checkpoint: "D7" | "D30"): I18nText {
  return checkpoint === "D7"
    ? { ja: "施術から7日たちました。ダウンタイムと満足度を記録しましょう", "zh-CN": "施术已过7天。记录一下恢复期和满意度吧", en: "It has been 7 days since your procedure. Record your downtime and satisfaction", ko: "시술 후 7일이 지났어요. 다운타임과 만족도를 기록해요" }
    : { ja: "施術から30日たちました。効果の実感と再来院の意向を記録しましょう", "zh-CN": "施术已过30天。记录一下效果感受和再次到访意向吧", en: "It has been 30 days since your procedure. Record how it feels and whether you would return", ko: "시술 후 30일이 지났어요. 효과 체감과 재방문 의향을 기록해요" };
}

export function checkinRequestText(questions: string[]): I18nText {
  const list = questions.join(" / ");
  return { ja: `プラットフォームからの質問: ${list}`, "zh-CN": `平台的问题: ${list}`, en: `Questions from the platform: ${list}`, ko: `플랫폼의 질문: ${list}` };
}
