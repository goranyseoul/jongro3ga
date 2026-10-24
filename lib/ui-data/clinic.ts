import type { AgentCard } from "@/components/ui";
import type { IsoDate, Locale } from "@/lib/domain/common";
import type { ZkClause } from "./customer";

// Mock data for the clinic console (docs/spec/05-screens.md, 병원 콘솔). Shapes follow
// 06-data-model.md "병원 네임스페이스" and 03-a2a-protocol.md until the backend exists.

// Fixed clock so every screen agrees on "today" and "this week": the spec demo day, the same day as
// DEFAULT_DEMO_NOW in lib/clock.ts (06-data-model.md 시계). The task dates below keep their spacing to it.
export const NOW = "2026-11-12T10:30:00+09:00";
export const TODAY: IsoDate = "2026-11-12";

export type ClinicOperationMode = "proxy" | "clinic";

export const OPERATION_MODE_TEXT: Record<ClinicOperationMode, string> = {
  proxy: "PibooK 대행",
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
  /** Contact is released only after confirmation, within the consent scope: the UI hides it until then. */
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
    receivedAt: "2026-11-12T10:12:00+09:00",
    from: "Yuki T.",
    language: "ja",
    product: "Rejuran Healer",
    amount: { value: 2, unit: "cc" },
    priceKrw: 340000,
    slot: "2026-11-15T11:00:00+09:00",
    safetyFlags: [],
    contact: { channel: "LINE", handle: "yuki_demo" },
  },
  {
    id: "tsk_bk_5524",
    a2aTaskId: "task_9f30",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_WORKING",
    receivedAt: "2026-11-12T09:41:00+09:00",
    from: "Lin W.",
    language: "zh-CN",
    product: "Skin Botox",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    slot: "2026-11-16T15:00:00+09:00",
    safetyFlags: ["알레르기: 리도카인 과민 반응 이력"],
    contact: { channel: "WeChat", handle: "lin_demo" },
  },
  {
    id: "tsk_bk_5519",
    a2aTaskId: "task_9e88",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_INPUT_REQUIRED",
    receivedAt: "2026-11-11T18:05:00+09:00",
    from: "Emily R.",
    language: "en",
    product: "Ulthera",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    slot: "2026-11-17T14:00:00+09:00",
    safetyFlags: [],
    contact: { channel: "WhatsApp", handle: "emily_demo" },
    requestedFields: ["직전 울쎄라 시술일"],
  },
  {
    id: "tsk_bk_5502",
    a2aTaskId: "task_9d10",
    skillId: "clinic.book",
    kind: "booking",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-11-10T13:20:00+09:00",
    from: "Mika S.",
    language: "ja",
    product: "Rejuran Healer",
    amount: { value: 1, unit: "cc" },
    priceKrw: 99000,
    slot: "2026-11-14T14:00:00+09:00",
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
    receivedAt: "2026-11-09T16:40:00+09:00",
    from: "Chen J.",
    language: "zh-CN",
    product: "Shurink Universe",
    amount: { value: 300, unit: "shot" },
    priceKrw: 420000,
    slot: "2026-11-18T10:00:00+09:00",
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
    receivedAt: "2026-11-08T11:02:00+09:00",
    from: "Sara L.",
    language: "en",
    product: "Skin Botox",
    amount: { value: 40, unit: "unit" },
    priceKrw: 180000,
    slot: "2026-11-22T16:00:00+09:00",
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
    receivedAt: "2026-11-07T15:30:00+09:00",
    from: "Anna P.",
    language: "en",
    product: "Ulthera",
    amount: { value: 300, unit: "shot" },
    priceKrw: 890000,
    slot: "2026-11-09T10:00:00+09:00",
    safetyFlags: ["임신 또는 수유 중"],
    outcome: "거절: 시술 불가 (안전 정보)",
  },
  {
    id: "tsk_q_8841",
    a2aTaskId: "task_a101",
    skillId: "clinic.quote",
    kind: "quote",
    state: "TASK_STATE_COMPLETED",
    receivedAt: "2026-11-12T10:20:00+09:00",
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
    receivedAt: "2026-11-12T09:58:00+09:00",
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
    receivedAt: "2026-11-12T09:12:00+09:00",
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
    receivedAt: "2026-11-11T22:47:00+09:00",
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

// Comparison values for the dashboard deltas: quotes are compared with yesterday up to the same time of day,
// the weekly figures with the previous 7 days.
export const PREVIOUS_PERIOD = { quotesYesterdayByNow: 2, bookingsLastWeek: 1, responseRateLastWeek: 92 };

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
    procedureId: "shrink_universe",
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
// The first visit 1cc event is the Mint offer of the 06-data-model.md clinics seed (2026-11-01 ~ 11-30).
// The Shurink event is the one that has not started yet.
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
  /** Off means the offer is kept but not sent to customer agents (clinic.offers skips it). */
  active: boolean;
  /** Proof conditions: the event applies only to a customer agent that proves them. `conditions` stays required. */
  zkClauses?: ZkClause[];
};

// Proof condition presets of the event sheet (05-screens.md ZK 확장, INTEGRATION.md section 3).
export type ZkPreset = "none" | "first_visit" | "second_session" | "regular";

export const ZK_PRESETS: ZkPreset[] = ["none", "first_visit", "second_session", "regular"];

export const ZK_PRESET_TEXT: Record<ZkPreset, { option: string; short: string }> = {
  none: { option: "없음", short: "없음" },
  first_visit: { option: "첫 방문 (우리 병원 기록 0건)", short: "첫 방문" },
  second_session: { option: "2회차 (해당 시술 정확히 1회)", short: "2회차" },
  regular: { option: "단골 (해당 시술 3회 이상)", short: "단골" },
};

/** The clauses a preset writes for an event on `procedureId`. "none" writes nothing. */
export function zkClausesFor(preset: ZkPreset, procedureId: string): ZkClause[] | undefined {
  switch (preset) {
    case "first_visit":
      return [{ clinicId: CLINIC.id, maxCount: 0 }];
    case "second_session":
      return [{ type: procedureId, minCount: 1, maxCount: 1 }];
    case "regular":
      return [{ type: procedureId, minCount: 3 }];
    case "none":
      return undefined;
  }
}

const clauseKey = (clauses: ZkClause[]) =>
  JSON.stringify(clauses.map((clause) => Object.entries(clause).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))));

/** Reads the preset back from stored clauses; any other shape (date windows, several clauses) is "custom". */
export function zkPresetOf(clauses: ZkClause[] | undefined, procedureId: string): ZkPreset | "custom" {
  if (!clauses || clauses.length === 0) return "none";
  const key = clauseKey(clauses);
  return ZK_PRESETS.find((preset) => preset !== "none" && clauseKey(zkClausesFor(preset, procedureId) ?? []) === key) ?? "custom";
}

export const OFFERS: Offer[] = [
  {
    id: "of_rejuran_first",
    procedureId: "rejuran_healer",
    title: "첫 방문 1cc 이벤트",
    amount: { value: 1, unit: "cc" },
    priceKrw: 99000,
    regularPriceKrw: 150000,
    validFrom: "2026-11-01",
    validUntil: "2026-11-30",
    conditions: "첫 방문 고객만",
    active: true,
    zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }],
  },
  {
    id: "of_shurink_dec",
    procedureId: "shrink_universe",
    title: "12월 슈링크 300샷 이벤트",
    amount: { value: 300, unit: "shot" },
    priceKrw: 380000,
    regularPriceKrw: 420000,
    validFrom: "2026-12-01",
    validUntil: "2026-12-31",
    conditions: "평일 오전 예약 한정",
    active: true,
  },
];

// Reference open times for the "시간 제안" sheet (clinic.availability would supply these).
export const PROPOSAL_SLOTS = [
  "2026-11-15T14:00:00+09:00",
  "2026-11-15T16:00:00+09:00",
  "2026-11-16T11:00:00+09:00",
  "2026-11-17T10:00:00+09:00",
  "2026-11-17T16:00:00+09:00",
  "2026-11-18T14:00:00+09:00",
];

export const AGENT_ENDPOINT = "https://pibu.example/a2a/clinics/mint/rpc";

export const OPERATION_SOURCE_TEXT: Record<string, string> = {
  clinic_console: "병원 콘솔",
  sms: "문자",
  public_web: "공개 웹",
};

// Operation facts that the clinic-operation extension carries (03-a2a-protocol.md 확장).
export const CLINIC_OPERATION = {
  mode: CLINIC.operationMode,
  dataSources: ["clinic_console"],
  lastVerifiedAt: "2026-11-10" as IsoDate,
  foreignPatientFacilityRegistered: true,
};

// Same URL, skill ids and schemas as the proxy-operated card, so taking over changes no caller code (02-agents.md).
export const AGENT_CARD: AgentCard = {
  name: "Mint Dermatology Clinic Agent",
  description:
    "Answers prices, doses, monthly offers and available times for Mint Dermatology Clinic (Gangnam), and accepts booking requests referred by PibooK.",
  supportedInterfaces: [{ url: AGENT_ENDPOINT, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
  provider: { organization: "Mint Dermatology Clinic", url: "https://pibu.example" },
  version: "0.1.0",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    extensions: [
      {
        uri: "https://pibu.app/ext/clinic-operation/v1",
        description: "Operation mode and data provenance of this clinic agent",
        required: false,
        params: CLINIC_OPERATION,
      },
      {
        uri: "https://pibu.app/ext/referral/v1",
        description: "quote and book requests must carry a PibooK referral token in metadata.referralToken",
        required: false,
      },
    ],
  },
  securitySchemes: { pibuBearer: { httpAuthSecurityScheme: { scheme: "bearer", bearerFormat: "JWT" } } },
  securityRequirements: [{ schemes: { pibuBearer: { list: [] } } }],
  defaultInputModes: ["application/json", "text/plain"],
  defaultOutputModes: ["application/json", "text/plain"],
  skills: [
    { id: "clinic.offers", name: "Monthly offers", description: "Lists this month's offers and regular menu prices.", tags: ["price", "event"] },
    {
      id: "clinic.quote",
      name: "Quote",
      description: "Quotes total price, unit price, dose, product, inclusions and slots for a procedure request.",
      tags: ["price", "quote"],
    },
    { id: "clinic.availability", name: "Availability", description: "Returns open slots for a procedure in a date range.", tags: ["schedule"] },
    {
      id: "clinic.book",
      name: "Book",
      description: "Requests a booking. The clinic confirms from its inbox, so the task stays working until confirmed.",
      tags: ["booking"],
    },
    { id: "clinic.cancel", name: "Cancel booking", description: "Cancels a booking made through PibooK.", tags: ["booking"] },
  ],
};
