import type { IsoDate, Locale } from "@/lib/domain/common";

// Mock data for the clinic console (docs/spec/05-screens.md, 병원 콘솔). Shapes follow
// 06-data-model.md "병원 네임스페이스" and 03-a2a-protocol.md until the backend exists.

// Fixed clock so every screen agrees on "today" and "this week" (06-data-model.md 시계).
export const NOW = "2026-10-24T10:30:00+09:00";
export const TODAY: IsoDate = "2026-10-24";

export type ClinicOperationMode = "proxy" | "clinic";

export const OPERATION_MODE_TEXT: Record<ClinicOperationMode, string> = {
  proxy: "Pibu 대행",
  clinic: "직접 운영",
};

export const CLINIC = {
  id: "cln_mint",
  name: "민트피부과의원",
  area: "강남",
  operationMode: "clinic" as ClinicOperationMode,
};

export const LANGUAGE_TEXT: Record<Locale, string> = {
  ja: "일본어",
  "zh-CN": "중국어(간체)",
  en: "영어",
  ko: "한국어",
};

export type AmountUnit = "cc" | "shot" | "unit";

export const UNIT_TEXT: Record<AmountUnit, string> = { cc: "cc", shot: "샷", unit: "유닛" };

export type Amount = { value: number; unit: AmountUnit };

// A2A task states that reach a clinic (03-a2a-protocol.md 태스크 상태 매핑), narrowed to what the inbox shows.
export type TaskState =
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_REJECTED";

export type TaskKind = "quote" | "booking";

export type InboxTask = {
  id: string;
  a2aTaskId: string;
  skillId: "clinic.quote" | "clinic.book";
  kind: TaskKind;
  state: TaskState;
  receivedAt: string;
  /** Booking: guest display name. Quote: the asking customer agent (the clinic never sees a name before booking). */
  from: string;
  language: Locale;
  product: string;
  amount: Amount;
  priceKrw: number;
  /** Booking: the requested slot, or the confirmed slot once decided. */
  slot?: string;
  /** Safety answers the guest consented to share with a booking request; empty means nothing to flag. */
  safetyFlags?: string[];
  /** Contact is released only after confirmation, within the consent scope. */
  contact?: { channel: string; handle: string };
  /** Quote: seconds the agent took to answer. */
  respondedInSec?: number;
  /** What the clinic asked the guest for while INPUT_REQUIRED. */
  requestedFields?: string[];
  /** Outcome line shown on decided tasks, e.g. the rejection reason or the slot that was proposed. */
  outcome?: string;
};

export const INBOX_TASKS: InboxTask[] = [
  {
    id: "tsk_bk_5521",
    a2aTaskId: "task_9f21",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_WORKING",
    receivedAt: "2026-10-24T10:12:00+09:00",
    from: "Yuki T.",
    language: "ja",
    product: "Rejuran Healer",
    amount: { value: 2, unit: "cc" },
    priceKrw: 340000,
    slot: "2026-10-27T11:00:00+09:00",
    safetyFlags: [],
  },
  {
    id: "tsk_bk_5524",
    a2aTaskId: "task_9f30",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_WORKING",
    receivedAt: "2026-10-24T09:41:00+09:00",
    from: "Lin W.",
    language: "zh-CN",
    product: "Skin Botox",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    slot: "2026-10-28T15:00:00+09:00",
    safetyFlags: ["알레르기: 리도카인 과민 반응 이력"],
  },
  {
    id: "tsk_bk_5519",
    a2aTaskId: "task_9e88",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_INPUT_REQUIRED",
    receivedAt: "2026-10-23T18:05:00+09:00",
    from: "Emily R.",
    language: "en",
    product: "Ulthera",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    slot: "2026-10-29T14:00:00+09:00",
    safetyFlags: [],
    requestedFields: ["직전 울쎄라 시술일"],
  },
  {
    id: "tsk_bk_5502",
    a2aTaskId: "task_9d10",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-22T13:20:00+09:00",
    from: "Mika S.",
    language: "ja",
    product: "Rejuran Healer",
    amount: { value: 1, unit: "cc" },
    priceKrw: 99000,
    slot: "2026-10-26T14:00:00+09:00",
    safetyFlags: [],
    contact: { channel: "LINE", handle: "mika_demo" },
    outcome: "병원 직원이 확정",
  },
  {
    id: "tsk_bk_5497",
    a2aTaskId: "task_9c47",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-21T16:40:00+09:00",
    from: "Chen J.",
    language: "zh-CN",
    product: "Shurink Universe",
    amount: { value: 300, unit: "shot" },
    priceKrw: 420000,
    slot: "2026-10-30T10:00:00+09:00",
    safetyFlags: [],
    contact: { channel: "WeChat", handle: "chen_demo" },
    outcome: "병원 직원이 확정",
  },
  {
    id: "tsk_bk_5490",
    a2aTaskId: "task_9b05",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-20T11:02:00+09:00",
    from: "Sara L.",
    language: "en",
    product: "Skin Botox",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    slot: "2026-11-03T16:00:00+09:00",
    safetyFlags: [],
    contact: { channel: "WhatsApp", handle: "sara_demo" },
    outcome: "병원 직원이 확정",
  },
  {
    id: "tsk_bk_5481",
    a2aTaskId: "task_9a92",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_REJECTED",
    receivedAt: "2026-10-19T15:30:00+09:00",
    from: "Anna P.",
    language: "en",
    product: "Ulthera",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    slot: "2026-10-21T10:00:00+09:00",
    safetyFlags: ["임신 또는 수유 중"],
    outcome: "거절: 시술 불가 (안전 정보)",
  },
  {
    id: "tsk_q_8841",
    a2aTaskId: "task_a101",
    skillId: "clinic.quote",
    kind: "quote",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-24T10:20:00+09:00",
    from: "고객 에이전트 cag_7f3k2",
    language: "ja",
    product: "Rejuran Healer",
    amount: { value: 2, unit: "cc" },
    priceKrw: 340000,
    respondedInSec: 4,
  },
  {
    id: "tsk_q_8839",
    a2aTaskId: "task_a0fd",
    skillId: "clinic.quote",
    kind: "quote",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-24T09:58:00+09:00",
    from: "고객 에이전트 cag_2m9xq",
    language: "zh-CN",
    product: "Skin Botox",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    respondedInSec: 3,
  },
  {
    id: "tsk_q_8836",
    a2aTaskId: "task_a0e2",
    skillId: "clinic.quote",
    kind: "quote",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-24T09:12:00+09:00",
    from: "고객 에이전트 cag_5h1ta",
    language: "en",
    product: "Ulthera",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    respondedInSec: 5,
  },
  {
    id: "tsk_q_8830",
    a2aTaskId: "task_a0b9",
    skillId: "clinic.quote",
    kind: "quote",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-10-23T22:47:00+09:00",
    from: "고객 에이전트 cag_8w4pn",
    language: "ja",
    product: "Shurink Universe",
    amount: { value: 300, unit: "shot" },
    priceKrw: 420000,
    respondedInSec: 4,
  },
];

// Seven-day answer rate of the clinic agent: a request counts as answered when it replied inside the 20 second window
// the customer agent waits (02-agents.md 대화 대행).
export const RESPONSE_STATS = { windowDays: 7, quoteRequests: 38, answeredWithin20s: 36 };

export function responseRatePercent(stats = RESPONSE_STATS): number {
  return Math.round((stats.answeredWithin20s / stats.quoteRequests) * 100);
}

export type MenuItem = {
  id: string;
  procedureId: string;
  product: string;
  nameKo: string;
  amount: Amount;
  priceKrw: number;
  vatIncluded: boolean;
  includes: string[];
  foreignerSamePrice: boolean;
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "mi_rejuran_1",
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    nameKo: "리쥬란 힐러",
    amount: { value: 1, unit: "cc" },
    priceKrw: 150000,
    vatIncluded: true,
    includes: ["마취크림"],
    foreignerSamePrice: true,
  },
  {
    id: "mi_rejuran_2",
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    nameKo: "리쥬란 힐러",
    amount: { value: 2, unit: "cc" },
    priceKrw: 340000,
    vatIncluded: true,
    includes: ["마취크림", "진정팩"],
    foreignerSamePrice: true,
  },
  {
    id: "mi_skin_botox",
    procedureId: "skin_botox",
    product: "Skin Botox",
    nameKo: "스킨보톡스",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    vatIncluded: true,
    includes: ["마취크림"],
    foreignerSamePrice: true,
  },
  {
    id: "mi_shurink",
    procedureId: "shurink_universe",
    product: "Shurink Universe",
    nameKo: "슈링크 유니버스",
    amount: { value: 300, unit: "shot" },
    priceKrw: 420000,
    vatIncluded: true,
    includes: ["진정팩"],
    foreignerSamePrice: true,
  },
  {
    id: "mi_ulthera",
    procedureId: "ulthera",
    product: "Ulthera",
    nameKo: "울쎄라",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    vatIncluded: false,
    includes: ["마취크림", "진정팩"],
    foreignerSamePrice: true,
  },
];

// An event always carries its regular price, period and conditions (05-screens.md, 병원 콘솔 메뉴·가격).
export type Offer = {
  id: string;
  procedureId: string;
  title: string;
  amount: Amount;
  priceKrw: number;
  regularPriceKrw: number;
  validFrom: IsoDate;
  validUntil: IsoDate;
  conditions: string;
};

export const OFFERS: Offer[] = [
  {
    id: "of_rejuran_first",
    procedureId: "rejuran_healer",
    title: "첫 방문 1cc 이벤트",
    amount: { value: 1, unit: "cc" },
    priceKrw: 99000,
    regularPriceKrw: 150000,
    validFrom: "2026-10-01",
    validUntil: "2026-10-31",
    conditions: "첫 방문 고객만",
  },
  {
    id: "of_shurink_nov",
    procedureId: "shurink_universe",
    title: "11월 슈링크 300샷 이벤트",
    amount: { value: 300, unit: "shot" },
    priceKrw: 380000,
    regularPriceKrw: 420000,
    validFrom: "2026-11-01",
    validUntil: "2026-11-30",
    conditions: "평일 오전 예약 한정",
  },
];
