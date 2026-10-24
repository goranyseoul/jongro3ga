import type { I18nText, IsoDate, Locale } from "@/lib/domain/common";

// Client side of the ops console (/ops) and the demo controls (/demo): labels, formatting and typed
// calls to app/api/ops/** and app/api/demo/**. Every number on these screens comes from the server; the
// time is the server's demo clock (`now` in each response), never the browser's.

export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
export type OperationMode = "proxy" | "clinic";
export type AgentRole = "customer" | "platform" | "clinic";

export const AREA_LABEL: Record<Area, string> = {
  gangnam: "강남",
  sinsa: "신사",
  apgujeong: "압구정",
  myeongdong: "명동",
  hongdae: "홍대",
  other: "기타",
};

export const NATIONALITY_LABEL: Record<string, string> = {
  JP: "일본",
  CN: "중국",
  US: "미국",
  KR: "한국",
};

export const LOCALE_LABEL: Record<Locale, string> = {
  ja: "일본어",
  "zh-CN": "중국어",
  en: "영어",
  ko: "한국어",
};

export const OPERATION_MODE_LABEL: Record<OperationMode, string> = {
  proxy: "대행",
  clinic: "직접",
};

// Timestamps are stored with the +09:00 offset, so slicing keeps KST without time zone math.
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatMonthDayTime(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

export function formatClock(iso: string): string {
  return iso.slice(11, 19);
}

/** "19분 전" style elapsed time between two server timestamps. */
export function formatElapsed(iso: string, now: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

/** Korean text of an I18nText, falling back to any language present. */
export function koText(text: I18nText | string | undefined): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text.ko ?? text.en ?? text.ja ?? Object.values(text)[0] ?? "";
}

export type ClinicNames = Record<string, string>;

export function clinicName(id: string, names: ClinicNames): string {
  return names[id] ?? id;
}

// ---- API client ----

export class OpsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OpsApiError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new OpsApiError(response.status, data.error?.code ?? "http_error", data.error?.message ?? `요청이 실패했어요 (${response.status}).`);
  }
  return data as T;
}

const post = <T,>(path: string, body?: unknown) => call<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/** Message to show for a failed call. */
export function errorText(error: unknown): string {
  if (error instanceof OpsApiError) return error.message;
  return "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

// ---- clinic registry ----

export type VerificationStatus = "verified" | "pending_verification" | "suspended";
export type DataSource = "sms" | "public_web" | "clinic_input";
export type LanguageMode = "staff" | "interpreter" | "app_translation";

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "검증 완료",
  pending_verification: "확인 대기",
  suspended: "정지",
};

export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  sms: "문자",
  public_web: "공개 웹",
  clinic_input: "병원 입력",
};

export const LANGUAGE_MODE_LABEL: Record<LanguageMode, string> = {
  staff: "상주",
  interpreter: "통역",
  app_translation: "앱 번역",
};

export type OpsClinic = {
  id: string;
  displayName: string;
  area: Area;
  operationMode: OperationMode;
  dataSources: DataSource[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
  verificationStatus: VerificationStatus;
  languages: { locale: Locale; mode: LanguageMode }[];
  daysSinceVerified: number;
  stale: boolean;
};

export type ClinicsResponse = { now: string; today: IsoDate; staleAfterDays: number; clinics: OpsClinic[] };

export const fetchClinics = () => call<ClinicsResponse>("/api/ops/clinics");

// ---- bookings: proxy queue and demo side panel ----

export type BookingStatus = "pending_clinic" | "confirmed" | "canceled" | "no_show" | "completed";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_clinic: "병원 확인 대기",
  confirmed: "확정",
  canceled: "병원 거절",
  no_show: "노쇼",
  completed: "시술 완료",
};

export type OpsBooking = {
  bookingId: string;
  clinicId: string;
  clinicName: string;
  operationMode: OperationMode;
  status: BookingStatus;
  confirmedBy?: "clinic_staff" | "pibu_operator" | "auto";
  slot: string;
  requestId: string;
  quoteId: string;
  guest: { displayName: string; language: Locale; agentId?: string };
  quote?: { procedureId?: string; product?: string; amount?: { value: number; unit: string }; priceKrw?: number; vatIncluded?: boolean };
  procedureName?: string;
  requestedAt?: string;
  resolvedAt?: string;
};

/** "리쥬란 2cc" from what the log knows about the quote. */
export function bookingSummary(booking: OpsBooking): string {
  const amount = booking.quote?.amount ? `${booking.quote.amount.value}${booking.quote.amount.unit}` : "";
  return [booking.procedureName ?? booking.quote?.procedureId ?? "시술 정보 없음", amount].filter(Boolean).join(" ");
}

export type ProxyQueueResponse = { now: string; waiting: OpsBooking[]; done: OpsBooking[] };

export const fetchProxyQueue = () => call<ProxyQueueResponse>("/api/ops/proxy-queue");
export const confirmProxyBooking = (bookingId: string) => post<{ result: { status: string } }>(`/api/ops/proxy-queue/${encodeURIComponent(bookingId)}/confirm`);
export const rejectProxyBooking = (bookingId: string, reason?: string) =>
  post<{ result: { status: string } }>(`/api/ops/proxy-queue/${encodeURIComponent(bookingId)}/reject`, reason ? { reason } : {});

// ---- routing rules ----

export type RuleStatus = "proposed" | "active" | "rejected" | "retired";

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  proposed: "제안",
  active: "활성",
  rejected: "반려",
  retired: "폐기",
};

// Health information is not a field here on purpose (07 guardrail 2).
export type RuleCondition = {
  procedureIds?: string[];
  nationalities?: string[];
  languages?: Locale[];
  areas?: Area[];
  ageBands?: string[];
  firstKProcedure?: boolean;
  budgetMaxBelowKrw?: number;
};

export type RuleAction =
  | { kind: "exclude_clinic"; clinicIds: string[] }
  | { kind: "boost_clinic"; clinicIds: string[]; delta: number }
  | { kind: "demote_clinic"; clinicIds: string[]; delta: number }
  | { kind: "prefer_area"; areas: Area[]; delta: number }
  | { kind: "require_language"; languages: Locale[] };

export type OpsRule = {
  id: string;
  version: number;
  status: RuleStatus;
  when: RuleCondition;
  then: RuleAction;
  reason: string;
  evidence: { outcomeIds: string[]; signalIds: string[]; summary: string };
  source: "operator" | "auto_proposal";
  proposedBy?: string;
  approvedBy?: string;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  closedAt?: string;
  appliedCount: number;
  urgent?: boolean;
  daysToExpiry: number | null;
  reviewDue: boolean;
  history?: { version: number; event: string; by: string; at: string }[];
};

export type RulesResponse = {
  now: string;
  excludeTtlDays: number;
  reviewBeforeDays: number;
  counts: Record<RuleStatus, number>;
  rules: OpsRule[];
  clinics: ClinicNames;
};

export type ProposeResponse = {
  ranAt: string;
  windowDays: number;
  mode: "claude" | "template";
  claudeError?: string;
  candidates: { key: string; trigger: string; urgent: boolean }[];
  proposed: OpsRule[];
  skipped: { key: string; reason: string; ruleId: string }[];
  dropped: { source: string; candidateKey?: string; reason: string; detail: string }[];
  suspendedClinicIds: string[];
  clinics: ClinicNames;
};

export const fetchRules = () => call<RulesResponse>("/api/ops/rules");
export const runRuleProposal = () => post<ProposeResponse>("/api/ops/rules/propose");
export const changeRule = (id: string, action: "approve" | "reject" | "retire") =>
  post<{ rule: OpsRule }>(`/api/ops/rules/${encodeURIComponent(id)}/${action}`);

// ---- A2A log (A2ALogEntry, 06-data-model.md) ----

export const TASK_STATE_LABEL: Record<string, string> = {
  TASK_STATE_SUBMITTED: "접수",
  TASK_STATE_COMPLETED: "완료",
  TASK_STATE_WORKING: "진행 중",
  TASK_STATE_REJECTED: "거절",
  TASK_STATE_FAILED: "실패",
  TASK_STATE_CANCELED: "취소",
  TASK_STATE_INPUT_REQUIRED: "추가 정보 필요",
  TASK_STATE_AUTH_REQUIRED: "인증 필요",
};

export const TASK_STATE_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  TASK_STATE_COMPLETED: "success",
  TASK_STATE_REJECTED: "danger",
  TASK_STATE_FAILED: "danger",
  TASK_STATE_INPUT_REQUIRED: "warning",
  TASK_STATE_AUTH_REQUIRED: "warning",
};

export const AGENT_ROLE_LABEL: Record<AgentRole, string> = {
  customer: "고객",
  platform: "플랫폼",
  clinic: "병원",
};

export type A2AAgent = { agentId: string; role: AgentRole };
export type A2AEndpoint = A2AAgent & { url: string };

export type A2ALogEntry = {
  id: string;
  at: string;
  contextId?: string;
  taskId?: string;
  from: A2AAgent;
  to: A2AEndpoint;
  method: "SendMessage" | "GetTask" | "CancelTask";
  skillId?: string;
  /** Full JSON-RPC request, sensitive fields masked by the server. */
  request: unknown;
  response?: unknown;
  state?: string;
  latencyMs?: number;
  humanSummary: I18nText;
};

export function agentLabel(agent: A2AAgent, names: ClinicNames): string {
  const role = AGENT_ROLE_LABEL[agent.role];
  if (agent.role === "clinic") return `${role} ${clinicName(agent.agentId, names)}`;
  if (agent.role === "platform") return role;
  return `${role} ${agent.agentId}`;
}

export type A2ALogFilters = { agent?: string; skill?: string; state?: string; contextId?: string };

export type A2ALogResponse = {
  now: string;
  total: number;
  entries: A2ALogEntry[];
  facets: { agents: A2AAgent[]; skills: string[]; states: string[]; contextIds: string[] };
  clinics: ClinicNames;
};

export function fetchA2ALog(filters: A2ALogFilters = {}): Promise<A2ALogResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return call<A2ALogResponse>(`/api/ops/a2a-log${query ? `?${query}` : ""}`);
}

// ---- demo controls (05-screens.md "데모 컨트롤", scenario in 10-build-plan.md) ----

export type DemoPersona = {
  id: string;
  label: string;
  kind: "customer" | "clinic" | "operator";
  customerId?: string;
  locale?: Locale;
  path: string;
  hint: string;
};

export type DemoState = { now: string; today: IsoDate; injected: number; proposedRules: number; bookings: OpsBooking[] };

// Demo start is lib/clock.ts DEFAULT_DEMO_NOW; Yuki's dates follow BUILD-LOG 13 (+28 days), and the
// 11/14 preset is the spec 10 scenario row 6.
export const DEMO_CLOCK_PRESETS = [
  { value: "2026-10-24T10:00:00+09:00", label: "10/24 10:00", hint: "데모 시작" },
  { value: "2026-11-10T13:00:00+09:00", label: "11/10 13:00", hint: "유키 시술 당일" },
  { value: "2026-11-14T13:00:00+09:00", label: "11/14 13:00", hint: "시나리오 6행 시술 당일" },
  { value: "2026-12-10T10:00:00+09:00", label: "12/10 10:00", hint: "유키 2회차 예정일" },
];

export const fetchDemoState = () => call<DemoState>("/api/demo/state");
export const fetchDemoPersonas = () => call<{ personas: DemoPersona[] }>("/api/demo/personas");
export const resetDemo = () => post<{ ok: true; now: string; loaded: Record<string, number> }>("/api/demo/reset");
export const moveDemoClock = (to: string) => post<{ now: string; today: IsoDate }>("/api/demo/clock", { to });
export const injectDemoOutcomes = () => post<{ injected: number; meanGapPct: number; now: string }>("/api/demo/inject-outcomes");
export const confirmDemoBooking = (bookingId: string) =>
  post<{ bookingId: string; operationMode: OperationMode; confirmedBy: "pibu_operator" | "clinic_staff" }>("/api/demo/confirm-booking", { bookingId });
