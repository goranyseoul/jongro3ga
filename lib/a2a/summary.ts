import type { I18nText, Locale } from "../domain";
import { isSkillId, type SkillId } from "./schemas";
import type { TaskState } from "./wire";

// One line per A2A call for the progress screen and the ops log (A2ALogEntry.humanSummary), in the four
// customer languages. Lines describe what happened to the call, never how clinics compare to each other.

/** Task states, plus outcomes of calls that never produced a task. */
export type SummaryOutcome =
  | TaskState
  | "unauthorized" // no or bad agent token (HTTP 401)
  | "forbidden" // the caller's role may not call the skill (HTTP 403)
  | "invalid_params" // routing or schema check failed (-32602), no task created
  | "rpc_error" // any other JSON-RPC error, e.g. task not found
  | "no_response"; // timeout, network failure or non JSON reply, logged by the client

export const SUMMARY_OUTCOMES: readonly SummaryOutcome[] = [
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_REJECTED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_AUTH_REQUIRED",
  "unauthorized",
  "forbidden",
  "invalid_params",
  "rpc_error",
  "no_response",
];

type Text = Record<Locale, string>;

const t = (ja: string, zhCN: string, en: string, ko: string): Text => ({ ja, "zh-CN": zhCN, en, ko });

interface SkillCopy {
  topic: Text;
  done: Text;
  /** Replaces the generic phrase for one outcome. */
  phrases?: Partial<Record<SummaryOutcome, Text>>;
}

const CLINIC_REJECTED = t(
  "このクリニックはリクエストを受けられません",
  "该诊所无法受理此请求",
  "this clinic cannot take the request",
  "이 병원은 요청을 받을 수 없어요",
);

const SKILLS: Record<SkillId, SkillCopy> = {
  "platform.recipe": {
    topic: t("施術レシピ", "疗程参考", "Procedure recipe", "시술 레시피"),
    done: t(
      "同じ悩みの韓国人女性が選んだ施術がわかりました",
      "找到了有相同困扰的韩国女性选择的疗程",
      "Found the procedures Korean women with the same concern chose",
      "같은 고민의 한국 여성이 고른 시술을 찾았어요",
    ),
  },
  "platform.match_clinics": {
    topic: t("クリニック探し", "诊所匹配", "Clinic matching", "병원 찾기"),
    done: t("条件に合うクリニックが見つかりました", "找到了符合条件的诊所", "Found clinics that match the request", "조건에 맞는 병원을 찾았어요"),
  },
  "platform.judge_quote": {
    topic: t("見積もりの判定", "报价评估", "Quote check", "견적 판정"),
    done: t("見積もりの価格と量を確認しました", "已核对报价的价格和剂量", "Checked the price and dose of each quote", "견적의 가격과 용량을 확인했어요"),
  },
  "platform.report_booking": {
    topic: t("予約の報告", "预约报告", "Booking report", "예약 보고"),
    done: t("予約をプラットフォームに報告しました", "已向平台报告预约", "Reported the booking to the platform", "예약을 플랫폼에 알렸어요"),
  },
  "platform.submit_outcome": {
    topic: t("施術結果の送信", "疗程结果提交", "Outcome report", "시술 결과 제출"),
    done: t("施術結果を送りました", "已提交疗程结果", "Sent the procedure outcome", "시술 결과를 보냈어요"),
  },
  "platform.report_signal": {
    topic: t("応答状況の報告", "响应情况报告", "Response signal", "응답 신호 보고"),
    done: t("クリニックの応答状況を報告しました", "已报告诊所的响应情况", "Reported how the clinic responded", "병원 응답 상황을 알렸어요"),
  },
  "platform.anchor_record": {
    topic: t("記録の登録", "记录登记", "Record anchoring", "기록 등록"),
    done: t("施術記録を登録しました", "已登记疗程记录", "Anchored the treatment record", "시술 기록을 등록했어요"),
  },
  "platform.submit_review": {
    topic: t("口コミの投稿", "评价提交", "Review", "후기 제출"),
    done: t("匿名の口コミを受け付けました", "匿名评价已受理", "The anonymous review was accepted", "익명 후기를 접수했어요"),
  },
  "clinic.offers": {
    topic: t("今月のイベント", "本月活动", "Monthly offers", "이달의 이벤트"),
    done: t("今月のイベントと価格を受け取りました", "已收到本月活动和价格", "Received this month's offers and prices", "이달 이벤트와 가격을 받았어요"),
    phrases: { TASK_STATE_REJECTED: CLINIC_REJECTED },
  },
  "clinic.quote": {
    topic: t("見積もり", "报价", "Quote", "견적"),
    done: t("見積もりを受け取りました", "已收到报价", "Received a quote", "견적을 받았어요"),
    phrases: { TASK_STATE_REJECTED: CLINIC_REJECTED },
  },
  "clinic.availability": {
    topic: t("空き時間", "空闲时间", "Availability", "예약 가능 시간"),
    done: t("空いている時間を受け取りました", "已收到可预约时间", "Received open times", "예약 가능한 시간을 받았어요"),
    phrases: { TASK_STATE_REJECTED: CLINIC_REJECTED },
  },
  "clinic.book": {
    topic: t("予約", "预约", "Booking", "예약"),
    done: t("予約が確定しました", "预约已确认", "The booking is confirmed", "예약이 확정됐어요"),
    phrases: {
      TASK_STATE_WORKING: t("クリニックが確認しています", "诊所正在确认", "the clinic is checking", "병원에서 확인하고 있어요"),
      TASK_STATE_INPUT_REQUIRED: t(
        "クリニックが追加の情報を求めています",
        "诊所需要补充信息",
        "the clinic asked for more information",
        "병원이 정보를 더 요청했어요",
      ),
      TASK_STATE_REJECTED: CLINIC_REJECTED,
    },
  },
  "clinic.cancel": {
    topic: t("予約キャンセル", "取消预约", "Cancellation", "예약 취소"),
    done: t("予約がキャンセルされました", "预约已取消", "The booking was canceled", "예약이 취소됐어요"),
    phrases: { TASK_STATE_REJECTED: CLINIC_REJECTED },
  },
  "customer.notify": {
    topic: t("お知らせ", "通知", "Notification", "알림"),
    done: t("お知らせを届けました", "已送达通知", "Delivered the notification", "알림을 전달했어요"),
  },
  "customer.checkin": {
    topic: t("施術後の確認", "疗程后回访", "Check-in", "시술 후 확인"),
    done: t("施術後の回答を受け取りました", "已收到疗程后回访答复", "Received the follow-up answers", "시술 후 답변을 받았어요"),
    phrases: {
      TASK_STATE_INPUT_REQUIRED: t("お客様の回答を待っています", "正在等待顾客回答", "waiting for the customer to answer", "고객 답변을 기다리고 있어요"),
    },
  },
};

const GENERIC_TOPIC = t("リクエスト", "请求", "Request", "요청");

const PHRASES: Record<Exclude<SummaryOutcome, "TASK_STATE_COMPLETED">, Text> = {
  TASK_STATE_SUBMITTED: t("リクエストを送りました", "已发送请求", "request sent", "요청을 보냈어요"),
  TASK_STATE_WORKING: t("処理しています", "正在处理", "in progress", "처리하고 있어요"),
  TASK_STATE_INPUT_REQUIRED: t("追加の情報を求められました", "需要补充信息", "more information requested", "정보를 더 요청했어요"),
  TASK_STATE_REJECTED: t(
    "リクエストを受けられないとの返事でした",
    "对方无法受理此请求",
    "the request was declined",
    "요청을 받을 수 없다는 답이 왔어요",
  ),
  TASK_STATE_FAILED: t("問題が発生しました", "出现了问题", "something went wrong", "문제가 생겼어요"),
  TASK_STATE_CANCELED: t("キャンセルされました", "已取消", "canceled", "취소됐어요"),
  TASK_STATE_AUTH_REQUIRED: t("認証を更新しています", "正在更新认证", "renewing authorization", "인증을 다시 받는 중이에요"),
  unauthorized: t(
    "認証されていない呼び出しのため拒否しました",
    "调用方未认证，已拒绝",
    "refused because the caller is not authenticated",
    "인증되지 않은 호출이라 거절했어요",
  ),
  forbidden: t(
    "このエージェントには許可されていない機能のため拒否しました",
    "该代理无权调用此功能，已拒绝",
    "refused because this agent may not call it",
    "이 에이전트가 부를 수 없는 기능이라 거절했어요",
  ),
  invalid_params: t(
    "リクエストの形式が正しくないため拒否しました",
    "请求格式不正确，已拒绝",
    "refused because the request format is invalid",
    "요청 형식이 맞지 않아 거절했어요",
  ),
  rpc_error: t("リクエストを処理できませんでした", "无法处理请求", "the request could not be processed", "요청을 처리하지 못했어요"),
  no_response: t("応答がありませんでした", "没有响应", "no response", "응답이 없었어요"),
};

const LOCALES: readonly Locale[] = ["ja", "zh-CN", "en", "ko"];

export interface SummaryExtra {
  /** The other agent's name, shown first, e.g. the clinic name on the customer's progress screen. */
  counterpart?: I18nText;
}

/**
 * The log line for a call to `skillId` that ended in `outcome`. An unknown skill (a GetTask whose task
 * carries no skill) uses a generic topic; an unknown outcome reads as "request sent".
 */
export function humanSummary(skillId: string | undefined, outcome: SummaryOutcome | undefined, extra: SummaryExtra = {}): I18nText {
  const copy = isSkillId(skillId) ? SKILLS[skillId] : undefined;
  const state = outcome ?? "TASK_STATE_SUBMITTED";

  const out: I18nText = {};
  for (const locale of LOCALES) {
    let line: string;
    if (state === "TASK_STATE_COMPLETED" && copy) {
      line = copy.done[locale];
    } else {
      const topic = (copy?.topic ?? GENERIC_TOPIC)[locale];
      const phrase =
        state === "TASK_STATE_COMPLETED"
          ? t("完了しました", "已完成", "done", "완료됐어요")[locale]
          : (copy?.phrases?.[state] ?? PHRASES[state])[locale];
      line = `${topic} · ${phrase}`;
    }
    const who = extra.counterpart?.[locale] ?? extra.counterpart?.en ?? extra.counterpart?.ko;
    out[locale] = who ? `${who} · ${line}` : line;
  }
  return out;
}
