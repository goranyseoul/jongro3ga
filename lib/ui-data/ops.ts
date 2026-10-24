import type { IsoDate, Locale } from "@/lib/domain/common";

// Mock data for the ops console (/ops) and demo controls (/demo) until the platform API exists.
// Shapes follow docs/spec/06-data-model.md (platform and shared namespaces), values follow the
// seed in the same file. Every clinic, person and number here is made up.

/** Fixed demo clock (DEMO_NOW in 09-architecture.md). Pages never call Date.now(). */
export const OPS_NOW = "2026-11-12T10:00:00+09:00";
export const OPS_TODAY: IsoDate = "2026-11-12";

/** A clinic whose lastVerifiedAt is older than this gets a warning sentence (05-screens.md). */
export const STALE_AFTER_DAYS = 30;

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

const MS_PER_DAY = 86_400_000;

/** Whole days from a YYYY-MM-DD date to the demo clock's date. */
export function daysSince(date: IsoDate): number {
  return Math.round((Date.parse(OPS_TODAY) - Date.parse(date)) / MS_PER_DAY);
}

/** Whole days from the demo clock's date to a YYYY-MM-DD date. */
export function daysUntil(date: IsoDate): number {
  return -daysSince(date);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

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

// ---- Clinic registry (ClinicRegistryEntry, 06-data-model.md) ----

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
  name: string;
  area: Area;
  operationMode: OperationMode;
  dataSources: DataSource[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
  verificationStatus: VerificationStatus;
  languages: { locale: Locale; mode: LanguageMode }[];
};

// The five seed clinics of 01-users-journeys.md. lastVerifiedAt is chosen so that two proxy
// clinics (한빛, 아라) are past the 30 day limit against the demo clock.
export const OPS_CLINICS: OpsClinic[] = [
  {
    id: "cln_seoul_glow",
    name: "서울글로우의원",
    area: "sinsa",
    operationMode: "clinic",
    dataSources: ["clinic_input"],
    lastVerifiedAt: "2026-11-05",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_mint",
    name: "민트피부과의원",
    area: "gangnam",
    operationMode: "proxy",
    dataSources: ["sms", "public_web"],
    lastVerifiedAt: "2026-10-20",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "interpreter" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_hanbit",
    name: "한빛의원",
    area: "myeongdong",
    operationMode: "proxy",
    dataSources: ["sms"],
    lastVerifiedAt: "2026-09-28",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "zh-CN", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_ara",
    name: "아라의원",
    area: "apgujeong",
    operationMode: "proxy",
    dataSources: ["sms", "public_web"],
    lastVerifiedAt: "2026-10-09",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "interpreter" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_dahye",
    name: "다혜피부과의원",
    area: "hongdae",
    operationMode: "clinic",
    dataSources: ["clinic_input"],
    lastVerifiedAt: "2026-11-09",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "en", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
];

export function clinicName(id: string): string {
  return OPS_CLINICS.find((clinic) => clinic.id === id)?.name ?? id;
}

export function isStale(clinic: OpsClinic): boolean {
  return daysSince(clinic.lastVerifiedAt) > STALE_AFTER_DAYS;
}

/** "19분 전" style elapsed time against the demo clock. */
export function formatElapsed(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(OPS_NOW) - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

// ---- Proxy queue: booking requests to proxy-operated clinics (clinic.book, 02-agents.md) ----

export type ProxyBookingState = "waiting_clinic" | "confirmed" | "rejected";

export const PROXY_STATE_LABEL: Record<ProxyBookingState, string> = {
  waiting_clinic: "병원 확인 대기",
  confirmed: "확정",
  rejected: "병원 거절",
};

export type ProxyBooking = {
  id: string;
  clinicId: string;
  /** What a proxy operator sees when acting as the clinic: display name and pseudonymous agent id. */
  guest: { displayName: string; agentId: string; language: Locale };
  procedure: string;
  amountText: string;
  priceKrw: number;
  vatIncluded: boolean;
  slot: string;
  requestedAt: string;
  state: ProxyBookingState;
  resolvedAt?: string;
  note?: string;
};

export const PROXY_BOOKINGS: ProxyBooking[] = [
  {
    id: "pq_201",
    clinicId: "cln_hanbit",
    guest: { displayName: "Lin W.", agentId: "cag_2m8x9", language: "zh-CN" },
    procedure: "리쥬란 힐러",
    amountText: "2cc",
    priceKrw: 420_000,
    vatIncluded: true,
    slot: "2026-11-16T14:00:00+09:00",
    requestedAt: "2026-11-12T09:41:00+09:00",
    state: "waiting_clinic",
  },
  {
    id: "pq_202",
    clinicId: "cln_mint",
    guest: { displayName: "Mika S.", agentId: "cag_4d8p7", language: "ja" },
    procedure: "리쥬란 힐러 (이벤트)",
    amountText: "1cc",
    priceKrw: 99_000,
    vatIncluded: true,
    slot: "2026-11-13T11:00:00+09:00",
    requestedAt: "2026-11-12T09:52:00+09:00",
    state: "waiting_clinic",
  },
  {
    id: "pq_203",
    clinicId: "cln_ara",
    guest: { displayName: "Aoi H.", agentId: "cag_6c3v8", language: "ja" },
    procedure: "리쥬란 힐러",
    amountText: "2cc",
    priceKrw: 300_000,
    vatIncluded: false,
    slot: "2026-11-14T15:00:00+09:00",
    requestedAt: "2026-11-11T16:40:00+09:00",
    state: "confirmed",
    resolvedAt: "2026-11-11T17:20:00+09:00",
  },
  {
    id: "pq_204",
    clinicId: "cln_hanbit",
    guest: { displayName: "Chen L.", agentId: "cag_1r9k5", language: "zh-CN" },
    procedure: "울쎄라",
    amountText: "300샷",
    priceKrw: 1_200_000,
    vatIncluded: true,
    slot: "2026-11-15T10:00:00+09:00",
    requestedAt: "2026-11-11T11:05:00+09:00",
    state: "rejected",
    resolvedAt: "2026-11-11T13:30:00+09:00",
    note: "해당 시간 예약 마감",
  },
];

// ---- Routing rules (RoutingRule, 06-data-model.md, 07-platform-intelligence.md section 4) ----

export const PROCEDURE_LABEL: Record<string, string> = {
  rejuran_healer: "리쥬란 힐러",
  thermage_flx: "써마지 FLX",
  ulthera: "울쎄라",
  botox_forehead: "이마 보톡스",
  shrink_universe: "슈링크 유니버스",
  skin_booster_juvelook: "쥬베룩 스킨부스터",
};

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
  /** Human readable reason (ko). */
  reason: string;
  evidence: { outcomeIds: string[]; signalIds: string[]; summary: string };
  source: "operator" | "auto_proposal";
  proposedBy?: string;
  approvedBy?: string;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: IsoDate;
  /** UI only: when the rule was rejected or retired. */
  closedAt?: string;
  appliedCount: number;
};

/** exclude_clinic rules expire after 90 days unless renewed (07 guardrail 3). */
export const EXCLUDE_RULE_TTL_DAYS = 90;
/** A rule is flagged for review this many days before it expires. */
export const RULE_REVIEW_DAYS = 7;

// rules.json seed: two active rules, no proposals. Neither matches Yuki's Rejuran request.
export const SEED_RULES: OpsRule[] = [
  {
    id: "rule_001",
    version: 1,
    status: "active",
    when: { nationalities: ["CN"] },
    then: { kind: "require_language", languages: ["zh-CN"] },
    reason: "중국 고객에게는 중국어 응대가 되는 병원만 보여줘요.",
    evidence: { outcomeIds: [], signalIds: [], summary: "운영 정책이라 결과 근거는 없어요." },
    source: "operator",
    approvedBy: "운영자",
    createdAt: "2026-10-01T10:00:00+09:00",
    activatedAt: "2026-10-01T10:00:00+09:00",
    appliedCount: 9,
  },
  {
    id: "rule_002",
    version: 1,
    status: "active",
    when: { procedureIds: ["ulthera"] },
    then: { kind: "demote_clinic", clinicIds: ["cln_dahye"], delta: 0.1 },
    reason: "울쎄라 요청에서 다혜피부과의원 순위를 조금 낮춰요.",
    evidence: { outcomeIds: [], signalIds: ["sig_0211", "sig_0214", "sig_0219"], summary: "최근 30일 응답 시간 초과 신호 3건" },
    source: "operator",
    approvedBy: "운영자",
    createdAt: "2026-10-08T14:30:00+09:00",
    activatedAt: "2026-10-08T14:30:00+09:00",
    appliedCount: 3,
  },
];

// outcomes-ara-burst.json: 20 outcomes with quoteGapRatio from 0.25 to 0.37 in equal steps,
// mean exactly 0.31 (06-data-model.md seed table).
export const ARA_BURST_COUNT = 20;
export const ARA_BURST_GAPS: number[] = Array.from({ length: ARA_BURST_COUNT }, (_, i) => 0.25 + (0.12 * i) / (ARA_BURST_COUNT - 1));
export const ARA_BURST_MEAN_GAP = ARA_BURST_GAPS.reduce((sum, gap) => sum + gap, 0) / ARA_BURST_COUNT;
export const ARA_BURST_OUTCOME_IDS: string[] = ARA_BURST_GAPS.map((_, i) => `out_ara_b${String(i + 1).padStart(2, "0")}`);

/** What "[규칙 제안 실행]" produces once the burst is injected (demo scenario step 7). */
export function buildAraProposal(): OpsRule {
  return {
    id: "rule_003",
    version: 1,
    status: "proposed",
    when: { nationalities: ["JP"] },
    then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
    reason: "일본 고객이 아라의원에서 견적보다 더 많이 결제했어요. 같은 일이 이어지는 동안 일본 고객 매칭에서 제외해요.",
    evidence: {
      outcomeIds: ARA_BURST_OUTCOME_IDS,
      signalIds: [],
      summary: `최근 30일 견적 대비 실결제 평균 +${Math.round(ARA_BURST_MEAN_GAP * 100)}% (n=${ARA_BURST_COUNT})`,
    },
    source: "auto_proposal",
    proposedBy: "claude-opus-5-5",
    createdAt: OPS_NOW,
    appliedCount: 0,
  };
}

// The demo controls and /ops/rules run in separate pages, so the "burst injected" fact travels
// through sessionStorage. Both ends tolerate storage being unavailable.
const OUTCOMES_INJECTED_KEY = "pibu:demo:outcomes-injected";

export function readOutcomesInjected(): boolean {
  try {
    return window.sessionStorage.getItem(OUTCOMES_INJECTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOutcomesInjected(injected: boolean): void {
  try {
    if (injected) window.sessionStorage.setItem(OUTCOMES_INJECTED_KEY, "1");
    else window.sessionStorage.removeItem(OUTCOMES_INJECTED_KEY);
  } catch {
    // storage blocked: the demo falls back to "not injected"
  }
}

// ---- A2A log (A2ALogEntry, 06-data-model.md, wire format from 03-a2a-protocol.md) ----

export type TaskState =
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_INPUT_REQUIRED";

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  TASK_STATE_COMPLETED: "완료",
  TASK_STATE_WORKING: "진행 중",
  TASK_STATE_REJECTED: "거절",
  TASK_STATE_FAILED: "실패",
  TASK_STATE_INPUT_REQUIRED: "추가 정보 필요",
};

export const TASK_STATE_TONE: Record<TaskState, "success" | "warning" | "danger" | "muted"> = {
  TASK_STATE_COMPLETED: "success",
  TASK_STATE_WORKING: "muted",
  TASK_STATE_REJECTED: "danger",
  TASK_STATE_FAILED: "danger",
  TASK_STATE_INPUT_REQUIRED: "warning",
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
  /** The customer requestId: groups every call made for one request. */
  contextId: string;
  taskId: string;
  from: A2AAgent;
  to: A2AEndpoint;
  method: "SendMessage" | "GetTask" | "CancelTask";
  skillId: string;
  /** Full JSON-RPC request. Sensitive fields are stored as "[masked]" (06-data-model.md). */
  request: unknown;
  response?: unknown;
  state: TaskState;
  latencyMs?: number;
  /** One human readable line (ko), the same text the customer sees in the progress timeline. */
  humanSummary: string;
};

export function agentLabel(agent: A2AAgent): string {
  const role = AGENT_ROLE_LABEL[agent.role];
  return agent.role === "clinic" ? `${role} ${clinicName(agent.agentId)}` : agent.role === "platform" ? role : `${role} ${agent.agentId}`;
}

const MASKED = "[masked]";

const platformEndpoint: A2AEndpoint = { agentId: "agt_platform", role: "platform", url: "https://pibu.app/a2a/platform" };
const clinicEndpoint = (agentId: string, slug: string): A2AEndpoint => ({
  agentId,
  role: "clinic",
  url: `https://pibu.app/a2a/clinics/${slug}`,
});
const seoulGlow = clinicEndpoint("cln_seoul_glow", "seoul-glow");
const mint = clinicEndpoint("cln_mint", "mint");
const hanbit = clinicEndpoint("cln_hanbit", "hanbit");
const ara = clinicEndpoint("cln_ara", "ara");
const dahye = clinicEndpoint("cln_dahye", "dahye");
const customer = (agentId: string): A2AAgent => ({ agentId, role: "customer" });

type CallInput = {
  n: number;
  at: string;
  contextId: string;
  from: A2AAgent;
  to: A2AEndpoint;
  skillId: string;
  text: string;
  data: Record<string, unknown>;
  state: TaskState;
  latencyMs: number;
  summary: string;
  artifact?: { name: string; data: Record<string, unknown> };
  error?: { code: number; message: string };
};

// Builds the JSON-RPC pair the way lib/a2a/client.ts would log it.
function call(input: CallInput): A2ALogEntry {
  const rpcId = `rpc_${String(input.n).padStart(4, "0")}`;
  const taskId = `tsk_${String(input.n).padStart(4, "0")}`;
  const request = {
    jsonrpc: "2.0",
    id: rpcId,
    method: "SendMessage",
    params: {
      message: {
        messageId: `msg_${rpcId}`,
        contextId: input.contextId,
        role: "ROLE_USER",
        parts: [{ text: input.text }, { data: input.data, mediaType: "application/json" }],
        metadata: { skillId: input.skillId },
      },
    },
  };
  const response = input.error
    ? { jsonrpc: "2.0", id: rpcId, error: input.error }
    : {
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          task: {
            id: taskId,
            contextId: input.contextId,
            status: { state: input.state, timestamp: input.at },
            artifacts: input.artifact
              ? [{ artifactId: `art_${taskId}`, name: input.artifact.name, parts: [{ data: input.artifact.data, mediaType: "application/json" }] }]
              : [],
          },
        },
      };
  return {
    id: `log_${String(input.n).padStart(3, "0")}`,
    at: input.at,
    contextId: input.contextId,
    taskId,
    from: input.from,
    to: input.to,
    method: "SendMessage",
    skillId: input.skillId,
    request,
    response,
    state: input.state,
    latencyMs: input.latencyMs,
    humanSummary: input.summary,
  };
}

const rejuranRequest = (requestId: string, agentId: string, nationality: string, languages: Locale[], areas: Area[], budgetKrw?: number) => ({
  schema: "pibu/procedure-request@1",
  requestId,
  customerAgentId: agentId,
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  languages,
  areas,
  ...(budgetKrw ? { budgetKrw: { max: budgetKrw } } : {}),
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality, firstKProcedure: true },
});

const quoteData = (
  requestId: string,
  quoteId: string,
  clinicId: string,
  cc: number,
  priceKrw: number,
  vatIncluded: boolean,
  mode: OperationMode,
  languages: Locale[],
  slots: string[],
) => ({
  schema: "pibu/quote@1",
  quoteId,
  requestId,
  clinicId,
  procedureId: "rejuran_healer",
  product: "Rejuran Healer",
  amount: { value: cc, unit: "cc" },
  priceKrw,
  vatIncluded,
  includes: ["numbing_cream", "soothing_mask"],
  excludes: [],
  slots,
  languages,
  indicative: mode === "proxy",
  validUntil: "2026-11-20",
  operationMode: mode,
});

const REFERRAL = { referralToken: "eyJhbGciOiJFUzI1NiJ9.example.signature" };

const YUKI = "cag_7f3k2";
const YUKI_REQ = "req_01J9Z8";
const YUKI_REQUEST = rejuranRequest(YUKI_REQ, YUKI, "JP", ["ja"], ["sinsa", "gangnam", "apgujeong"], 450_000);

export const A2A_LOG: A2ALogEntry[] = [
  // Yuki (JP): recipe, match, three quotes, judge, then a booking at Seoul Glow (direct clinic).
  call({
    n: 1,
    at: "2026-11-12T09:55:01+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: platformEndpoint,
    skillId: "platform.recipe",
    text: "Recipe query: ageBand 25-29, concerns elasticity and fine lines.",
    data: { schema: "pibu/recipe-query@1", ageBand: "25-29", concerns: ["elasticity", "fine_lines"], candidates: ["rejuran_healer"] },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 412,
    summary: "한국 여성 기록에서 많이 받은 시술 조합을 확인했어요",
    artifact: {
      name: "recipe",
      data: {
        schema: "pibu/recipe@1",
        procedures: [{ procedureId: "rejuran_healer", share: 0.46, typicalAmount: { min: 2, max: 3, unit: "cc" }, cycleDays: 30 }],
        disclaimer: "데모용 값",
      },
    },
  }),
  call({
    n: 2,
    at: "2026-11-12T09:55:02+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: platformEndpoint,
    skillId: "platform.match_clinics",
    text: "Match clinics for Rejuran Healer 2cc, Japanese support, Sinsa area.",
    data: YUKI_REQUEST,
    state: "TASK_STATE_COMPLETED",
    latencyMs: 380,
    summary: "조건에 맞는 병원 3곳을 찾았어요",
    artifact: {
      name: "clinic-shortlist",
      data: {
        schema: "pibu/clinic-shortlist@1",
        requestId: YUKI_REQ,
        matchId: "mt_4401",
        appliedRuleIds: [],
        clinics: [
          { clinicId: "cln_seoul_glow", score: 0.78, reasons: ["일본어 상주 응대", "숙소와 같은 지역"] },
          { clinicId: "cln_mint", score: 0.66, reasons: ["일본어 통역 응대", "예산 안"] },
          { clinicId: "cln_ara", score: 0.61, reasons: ["일본어 통역 응대"] },
        ],
      },
    },
  }),
  call({
    n: 3,
    at: "2026-11-12T09:55:03+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: seoulGlow,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
    data: { ...YUKI_REQUEST, ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 640,
    summary: "서울글로우의원이 견적을 보냈어요",
    artifact: {
      name: "quote",
      data: quoteData(YUKI_REQ, "qt_1203", "cln_seoul_glow", 2, 340_000, true, "clinic", ["ja"], ["2026-11-14T11:00:00+09:00"]),
    },
  }),
  call({
    n: 4,
    at: "2026-11-12T09:55:03+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: mint,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
    data: { ...YUKI_REQUEST, ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 910,
    summary: "민트피부과의원이 참고가 견적을 보냈어요",
    artifact: {
      name: "quote",
      data: quoteData(YUKI_REQ, "qt_1204", "cln_mint", 1, 99_000, true, "proxy", ["ja"], ["2026-11-13T11:00:00+09:00"]),
    },
  }),
  call({
    n: 5,
    at: "2026-11-12T09:55:04+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: ara,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
    data: { ...YUKI_REQUEST, ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 1020,
    summary: "아라의원이 참고가 견적을 보냈어요",
    artifact: {
      name: "quote",
      data: quoteData(YUKI_REQ, "qt_1205", "cln_ara", 2, 300_000, false, "proxy", ["ja"], ["2026-11-14T15:00:00+09:00"]),
    },
  }),
  call({
    n: 6,
    at: "2026-11-12T09:55:05+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: platformEndpoint,
    skillId: "platform.judge_quote",
    text: "Judge 3 quotes for Rejuran Healer.",
    data: { schema: "pibu/judge-request@1", requestId: YUKI_REQ, quoteIds: ["qt_1203", "qt_1204", "qt_1205"] },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 230,
    summary: "견적 3건의 가격과 용량을 판정했어요",
    artifact: {
      name: "fairness-verdict-list",
      data: {
        schema: "pibu/fairness-verdict-list@1",
        verdicts: [
          { quoteId: "qt_1204", label: "underdosed", priceBand: "low", doseFlag: "below_typical", confidence: "high", n: 42, clinicFlags: [{ code: "indicative_price" }] },
          { quoteId: "qt_1203", label: "fair", priceBand: "mid", doseFlag: "within", confidence: "high", n: 42, clinicFlags: [] },
          {
            quoteId: "qt_1205",
            label: "fair",
            priceBand: "mid",
            doseFlag: "within",
            confidence: "high",
            n: 42,
            clinicFlags: [{ code: "paid_more_than_quoted", avgGapPct: 15 }, { code: "indicative_price" }],
          },
        ],
      },
    },
  }),
  call({
    n: 7,
    at: "2026-11-12T09:57:11+09:00",
    contextId: YUKI_REQ,
    from: customer(YUKI),
    to: seoulGlow,
    skillId: "clinic.book",
    text: "Booking request for Rejuran Healer 2cc on 2026-11-14 11:00.",
    data: {
      schema: "pibu/booking-request@1",
      requestId: YUKI_REQ,
      quoteId: "qt_1203",
      slot: "2026-11-14T11:00:00+09:00",
      guest: { displayName: "Yuki T.", contactChannel: "line", contactHandle: MASKED, language: "ja" },
      safetyInfo: MASKED,
      passportName: MASKED,
      ...REFERRAL,
    },
    state: "TASK_STATE_WORKING",
    latencyMs: 180,
    summary: "서울글로우의원에 예약을 요청했어요. 병원 확인을 기다려요",
  }),
  call({
    n: 8,
    at: "2026-11-12T09:58:40+09:00",
    contextId: YUKI_REQ,
    from: { agentId: "cln_seoul_glow", role: "clinic" },
    to: platformEndpoint,
    skillId: "platform.report_booking",
    text: "Booking confirmed by clinic staff.",
    data: {
      schema: "pibu/booking@1",
      bookingId: "bk_0088",
      clinicId: "cln_seoul_glow",
      status: "confirmed",
      slot: "2026-11-14T11:00:00+09:00",
      priceKrw: 340_000,
      confirmedBy: "clinic_staff",
      referralTokenJti: "jti_c41b",
    },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 150,
    summary: "서울글로우의원이 예약 확정을 플랫폼에 보고했어요",
  }),

  // Aoi (JP): booking at Ara, a proxy clinic, confirmed by the operator (queue item pq_203).
  call({
    n: 9,
    at: "2026-11-11T16:38:02+09:00",
    contextId: "req_01J9Y2",
    from: customer("cag_6c3v8"),
    to: platformEndpoint,
    skillId: "platform.match_clinics",
    text: "Match clinics for Rejuran Healer 2cc, Japanese support.",
    data: rejuranRequest("req_01J9Y2", "cag_6c3v8", "JP", ["ja"], ["apgujeong", "gangnam", "sinsa"]),
    state: "TASK_STATE_COMPLETED",
    latencyMs: 402,
    summary: "조건에 맞는 병원 3곳을 찾았어요",
    artifact: {
      name: "clinic-shortlist",
      data: {
        schema: "pibu/clinic-shortlist@1",
        requestId: "req_01J9Y2",
        matchId: "mt_4398",
        appliedRuleIds: [],
        clinics: [
          { clinicId: "cln_seoul_glow", score: 0.76 },
          { clinicId: "cln_ara", score: 0.64 },
          { clinicId: "cln_mint", score: 0.63 },
        ],
      },
    },
  }),
  call({
    n: 10,
    at: "2026-11-11T16:38:05+09:00",
    contextId: "req_01J9Y2",
    from: customer("cag_6c3v8"),
    to: ara,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, Japanese support.",
    data: { ...rejuranRequest("req_01J9Y2", "cag_6c3v8", "JP", ["ja"], ["apgujeong"]), ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 980,
    summary: "아라의원이 참고가 견적을 보냈어요",
    artifact: { name: "quote", data: quoteData("req_01J9Y2", "qt_1190", "cln_ara", 2, 300_000, false, "proxy", ["ja"], ["2026-11-14T15:00:00+09:00"]) },
  }),
  call({
    n: 11,
    at: "2026-11-11T16:40:12+09:00",
    contextId: "req_01J9Y2",
    from: customer("cag_6c3v8"),
    to: ara,
    skillId: "clinic.book",
    text: "Booking request for Rejuran Healer 2cc on 2026-11-14 15:00.",
    data: {
      schema: "pibu/booking-request@1",
      requestId: "req_01J9Y2",
      quoteId: "qt_1190",
      slot: "2026-11-14T15:00:00+09:00",
      guest: { displayName: "Aoi H.", contactChannel: "line", contactHandle: MASKED, language: "ja" },
      safetyInfo: MASKED,
      passportName: MASKED,
      ...REFERRAL,
    },
    state: "TASK_STATE_WORKING",
    latencyMs: 170,
    summary: "아라의원에 예약을 요청했어요. 병원 확인을 기다려요",
  }),
  call({
    n: 12,
    at: "2026-11-11T17:21:05+09:00",
    contextId: "req_01J9Y2",
    from: { agentId: "cln_ara", role: "clinic" },
    to: platformEndpoint,
    skillId: "platform.report_booking",
    text: "Booking confirmed by PibooK operator after the clinic confirmed by phone.",
    data: {
      schema: "pibu/booking@1",
      bookingId: "bk_0087",
      clinicId: "cln_ara",
      status: "confirmed",
      slot: "2026-11-14T15:00:00+09:00",
      priceKrw: 300_000,
      confirmedBy: "pibu_operator",
      referralTokenJti: "jti_b207",
    },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 140,
    summary: "아라의원 예약이 운영자 확인으로 확정됐어요",
  }),

  // Emily (US): only Dahye speaks English, and its quote times out.
  call({
    n: 13,
    at: "2026-11-11T20:15:03+09:00",
    contextId: "req_01J9X7",
    from: customer("cag_5t1q4"),
    to: platformEndpoint,
    skillId: "platform.match_clinics",
    text: "Match clinics for Rejuran Healer 2cc, English support.",
    data: rejuranRequest("req_01J9X7", "cag_5t1q4", "US", ["en"], ["hongdae"]),
    state: "TASK_STATE_COMPLETED",
    latencyMs: 365,
    summary: "조건에 맞는 병원 1곳을 찾았어요",
    artifact: {
      name: "clinic-shortlist",
      data: {
        schema: "pibu/clinic-shortlist@1",
        requestId: "req_01J9X7",
        matchId: "mt_4395",
        appliedRuleIds: [],
        clinics: [{ clinicId: "cln_dahye", score: 0.71 }],
      },
    },
  }),
  call({
    n: 14,
    at: "2026-11-11T20:15:04+09:00",
    contextId: "req_01J9X7",
    from: customer("cag_5t1q4"),
    to: dahye,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, English support.",
    data: { ...rejuranRequest("req_01J9X7", "cag_5t1q4", "US", ["en"], ["hongdae"]), ...REFERRAL },
    state: "TASK_STATE_FAILED",
    latencyMs: 20_000,
    summary: "다혜피부과의원이 20초 안에 답하지 않았어요",
    error: { code: -32001, message: "Timeout after 20000ms" },
  }),
  call({
    n: 15,
    at: "2026-11-11T20:15:25+09:00",
    contextId: "req_01J9X7",
    from: customer("cag_5t1q4"),
    to: platformEndpoint,
    skillId: "platform.report_signal",
    text: "Clinic did not answer in time.",
    data: { schema: "pibu/signal-report@1", clinicId: "cln_dahye", kind: "response_timeout", taskId: "tsk_0014" },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 88,
    summary: "응답 시간 초과를 플랫폼에 알렸어요",
  }),

  // Jisoo (KR resident): matching is not offered to Korean residents.
  call({
    n: 16,
    at: "2026-11-11T09:12:30+09:00",
    contextId: "req_01J9X1",
    from: customer("cag_8w6n3"),
    to: platformEndpoint,
    skillId: "platform.match_clinics",
    text: "Match clinics for Rejuran Healer 2cc.",
    data: rejuranRequest("req_01J9X1", "cag_8w6n3", "KR", ["ko"], ["gangnam"]),
    state: "TASK_STATE_REJECTED",
    latencyMs: 95,
    summary: "한국 거주 고객은 병원 매칭 대상이 아니에요",
    error: { code: -32010, message: "Matching is not available for Korean nationals and residents." },
  }),

  // Lin (CN) and Mika (JP): booking requests that wait in the proxy queue (pq_201, pq_202).
  call({
    n: 17,
    at: "2026-11-12T09:40:02+09:00",
    contextId: "req_01J9Z1",
    from: customer("cag_2m8x9"),
    to: platformEndpoint,
    skillId: "platform.match_clinics",
    text: "Match clinics for Rejuran Healer 2cc, Chinese support.",
    data: rejuranRequest("req_01J9Z1", "cag_2m8x9", "CN", ["zh-CN"], ["myeongdong"]),
    state: "TASK_STATE_COMPLETED",
    latencyMs: 391,
    summary: "조건에 맞는 병원 1곳을 찾았어요",
    artifact: {
      name: "clinic-shortlist",
      data: {
        schema: "pibu/clinic-shortlist@1",
        requestId: "req_01J9Z1",
        matchId: "mt_4399",
        appliedRuleIds: ["rule_001"],
        clinics: [{ clinicId: "cln_hanbit", score: 0.69 }],
      },
    },
  }),
  call({
    n: 18,
    at: "2026-11-12T09:40:04+09:00",
    contextId: "req_01J9Z1",
    from: customer("cag_2m8x9"),
    to: hanbit,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer 2cc, Chinese support.",
    data: { ...rejuranRequest("req_01J9Z1", "cag_2m8x9", "CN", ["zh-CN"], ["myeongdong"]), ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 870,
    summary: "한빛의원이 참고가 견적을 보냈어요",
    artifact: { name: "quote", data: quoteData("req_01J9Z1", "qt_1201", "cln_hanbit", 2, 420_000, true, "proxy", ["zh-CN"], ["2026-11-16T14:00:00+09:00"]) },
  }),
  call({
    n: 19,
    at: "2026-11-12T09:41:10+09:00",
    contextId: "req_01J9Z1",
    from: customer("cag_2m8x9"),
    to: hanbit,
    skillId: "clinic.book",
    text: "Booking request for Rejuran Healer 2cc on 2026-11-16 14:00.",
    data: {
      schema: "pibu/booking-request@1",
      requestId: "req_01J9Z1",
      quoteId: "qt_1201",
      slot: "2026-11-16T14:00:00+09:00",
      guest: { displayName: "Lin W.", contactChannel: "wechat", contactHandle: MASKED, language: "zh-CN" },
      safetyInfo: MASKED,
      passportName: MASKED,
      ...REFERRAL,
    },
    state: "TASK_STATE_WORKING",
    latencyMs: 160,
    summary: "한빛의원에 예약을 요청했어요. 병원 확인을 기다려요",
  }),
  call({
    n: 20,
    at: "2026-11-12T09:51:30+09:00",
    contextId: "req_01J9Z5",
    from: customer("cag_4d8p7"),
    to: mint,
    skillId: "clinic.quote",
    text: "Quote request for Rejuran Healer, Japanese support.",
    data: { ...rejuranRequest("req_01J9Z5", "cag_4d8p7", "JP", ["ja"], ["gangnam"]), ...REFERRAL },
    state: "TASK_STATE_COMPLETED",
    latencyMs: 940,
    summary: "민트피부과의원이 참고가 견적을 보냈어요",
    artifact: { name: "quote", data: quoteData("req_01J9Z5", "qt_1199", "cln_mint", 1, 99_000, true, "proxy", ["ja"], ["2026-11-13T11:00:00+09:00"]) },
  }),
  call({
    n: 21,
    at: "2026-11-12T09:52:08+09:00",
    contextId: "req_01J9Z5",
    from: customer("cag_4d8p7"),
    to: mint,
    skillId: "clinic.book",
    text: "Booking request for Rejuran Healer 1cc on 2026-11-13 11:00.",
    data: {
      schema: "pibu/booking-request@1",
      requestId: "req_01J9Z5",
      quoteId: "qt_1199",
      slot: "2026-11-13T11:00:00+09:00",
      guest: { displayName: "Mika S.", contactChannel: "line", contactHandle: MASKED, language: "ja" },
      safetyInfo: MASKED,
      passportName: MASKED,
      ...REFERRAL,
    },
    state: "TASK_STATE_WORKING",
    latencyMs: 175,
    summary: "민트피부과의원에 예약을 요청했어요. 병원 확인을 기다려요",
  }),
].sort((a, b) => a.at.localeCompare(b.at));

// ---- Demo controls (05-screens.md "데모 컨트롤", scenario in 10-build-plan.md) ----

export type DemoPersonaKind = "customer" | "clinic" | "operator";

export type DemoPersona = {
  id: string;
  label: string;
  kind: DemoPersonaKind;
  /** Customer personas only: the language of the customer screen. */
  locale?: Locale;
  hint: string;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "yuki", label: "Yuki", kind: "customer", locale: "ja", hint: "일본 · 29세 · 온보딩부터 시작" },
  { id: "lin", label: "Lin", kind: "customer", locale: "zh-CN", hint: "중국 · 33세 · 리쥬란 3회 코스" },
  { id: "emily", label: "Emily", kind: "customer", locale: "en", hint: "미국 · 26세 · 처음 받는 K시술" },
  { id: "jisoo", label: "지수", kind: "customer", locale: "ko", hint: "한국 거주 · 기록 중심 홈, 매칭 없음" },
  { id: "clinic", label: "병원 계정", kind: "clinic", hint: "서울글로우의원 요청함" },
  { id: "operator", label: "운영자", kind: "operator", hint: "대행 응답 큐" },
];

/** The customer screen shown in the left frame. Only onboarding exists so far, home and chat follow. */
export function customerScreenPath(persona: DemoPersona): string {
  return `/${persona.locale ?? "ja"}/onboarding`;
}

export const DEMO_CLOCK_PRESETS = [
  { value: OPS_NOW, label: "11/12 10:00", hint: "방한 전날 (기본)" },
  { value: "2026-11-14T13:00:00+09:00", label: "11/14 13:00", hint: "시술 당일" },
  { value: "2026-11-21T10:00:00+09:00", label: "11/21 10:00", hint: "D7 체크인" },
  { value: "2026-12-14T10:00:00+09:00", label: "12/14 10:00", hint: "2회차 예정일" },
];

export type DemoBookingState = "pending" | "confirmed" | "rejected" | "proposed";

export const DEMO_BOOKING_STATE_LABEL: Record<DemoBookingState, string> = {
  pending: "확인 대기",
  confirmed: "확정",
  rejected: "거절",
  proposed: "시간 제안함",
};

export type DemoBooking = {
  id: string;
  mode: OperationMode;
  clinicId: string;
  guestName: string;
  agentId: string;
  summary: string;
  slot: string;
  state: DemoBookingState;
  /** Hidden until this many calls of Yuki's request have been replayed in the log. */
  revealAtStep?: number;
};

/** Yuki's request (demo scenario steps 2 to 5): the calls up to the booking request are replayed. */
export const YUKI_CONTEXT_ID = "req_01J9Z8";
export const YUKI_BOOKING_STEP = 7;

export function buildDemoBookings(): DemoBooking[] {
  const proxy = PROXY_BOOKINGS.filter((booking) => booking.state === "waiting_clinic").map(
    (booking): DemoBooking => ({
      id: booking.id,
      mode: "proxy",
      clinicId: booking.clinicId,
      guestName: booking.guest.displayName,
      agentId: booking.guest.agentId,
      summary: `${booking.procedure} ${booking.amountText}`,
      slot: booking.slot,
      state: "pending",
    }),
  );
  return [
    {
      id: "bk_demo_yuki",
      mode: "clinic",
      clinicId: "cln_seoul_glow",
      guestName: "Yuki T.",
      agentId: "cag_7f3k2",
      summary: "리쥬란 힐러 2cc",
      slot: "2026-11-14T11:00:00+09:00",
      state: "pending",
      revealAtStep: YUKI_BOOKING_STEP,
    },
    ...proxy,
  ];
}

// ---- Operator accounts (mock until the platform has staff accounts) ----
// Demo sign-in for /ops/login and the profile in /ops/account. Permissions are a read-only summary;
// nothing in the console checks them yet.

export type OperatorRole = "admin" | "operator" | "viewer";

export const OPERATOR_ROLE_LABEL: Record<OperatorRole, string> = {
  admin: "관리자",
  operator: "운영 담당",
  viewer: "조회 전용",
};

export type OpsPermission = "clinics_edit" | "proxy_confirm" | "rules_approve" | "a2a_log_read" | "operators_manage";

export const OPS_PERMISSION_LABEL: Record<OpsPermission, { label: string; description: string }> = {
  clinics_edit: { label: "병원 레지스트리 편집", description: "운영 모드, 등록 상태, 검증일 변경" },
  proxy_confirm: { label: "대행 예약 확정", description: "병원 확인 뒤 대행 응답 큐에서 확정 또는 거절" },
  rules_approve: { label: "연결 규칙 승인", description: "제안된 규칙 승인, 반려, 폐기" },
  a2a_log_read: { label: "A2A 로그 조회", description: "요청·응답 원문 열람 (개인정보는 마스킹)" },
  operators_manage: { label: "운영자 관리", description: "운영자 초대, 역할 변경, 세션 종료" },
};

export const ROLE_PERMISSIONS: Record<OperatorRole, OpsPermission[]> = {
  admin: ["clinics_edit", "proxy_confirm", "rules_approve", "a2a_log_read", "operators_manage"],
  operator: ["clinics_edit", "proxy_confirm", "a2a_log_read"],
  viewer: ["a2a_log_read"],
};

export type OperatorAccount = {
  id: string;
  name: string;
  email: string;
  role: OperatorRole;
  team: string;
  lastSignInAt: string;
};

export const OPERATOR_ACCOUNTS: OperatorAccount[] = [
  { id: "opr_jiyeon", name: "한지연", email: "jiyeon@pibook.example", role: "admin", team: "플랫폼 운영", lastSignInAt: "2026-11-11T18:42:00+09:00" },
  { id: "opr_minho", name: "오민호", email: "minho@pibook.example", role: "operator", team: "대행 응답", lastSignInAt: "2026-11-12T08:55:00+09:00" },
  { id: "opr_yuna", name: "서유나", email: "yuna@pibook.example", role: "viewer", team: "데이터 분석", lastSignInAt: "2026-11-10T14:10:00+09:00" },
];
