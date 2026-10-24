# 06 · 데이터 모델

## 저장소 구조와 소유 경계

저장소는 **소유자별 네임스페이스 3개 + 공용 1개**로 나뉜다. 한 에이전트 모듈은 자기 네임스페이스만 읽고 쓴다. 다른 에이전트의 데이터가 필요하면 A2A로 요청한다. (원칙 2, [00-overview.md](00-overview.md))

| 네임스페이스 | 소유 모듈 | 엔티티 |
| --- | --- | --- |
| `customer` | `lib/agents/customer` | `CustomerAccount`, `CustomerProfile`, `ConsentEntry`, `TreatmentRecord`, `CustomerRequest`, `ReceivedQuote`, `CustomerBooking`, `OutcomeDraft`, `OnboardingSession` |
| `platform` | `lib/agents/platform` | `Procedure`, `ClinicRegistryEntry`, `ClinicOfferCache`, `PriceRecord`, `JudgedQuote`, `Outcome`, `RoutingRule`, `MatchLog`, `AttributionEntry`, `Signal` |
| `clinic` | `lib/agents/clinic` | `ClinicProfile`, `MenuItem`, `Offer`, `SlotPolicy`, `Slot`, `ClinicBooking`, `ClinicTask` |
| `shared` | `lib/a2a` | `A2ALogEntry`, `AgentIdentity` |

예외: 공개 참조 데이터인 시술 마스터(`data/seed/procedures.json`)와 병원 이름·지역 목록(`data/seed/clinics.json`의 `id`, `name`, `area`만)은 고객·병원 모듈도 **읽기 전용 시드 파일**로 직접 읽을 수 있다. (3초 기록의 병원 자동완성용. 가격·메뉴 필드는 읽지 않는다)

## 시계 (`lib/clock.ts`)

모든 "최근 N일" 집계, 오퍼 유효기간, 데이터 신선도, 결과 체크포인트는 `clock.now()` 하나만 쓴다. `Date.now()` 직접 호출 금지.

- `DEMO_MODE=true`면 `DEMO_NOW` (기본 `2026-11-12T10:00:00+09:00`, Yuki 방한 전날)에서 시작하는 **고정 시계**. 데모 컨트롤의 [시계 이동]으로만 바뀐다 (`POST /api/demo/clock { "to": "2026-11-14T13:00:00+09:00" }`).
- 테스트는 `setClock(...)`으로 고정한다.
- 시드 날짜는 절대값으로 저장하되, 모두 기준일 **2026-11-12** 기준으로 생성한다 (아래 시드 표의 날짜 범위).

P0 구현: `lib/store/`의 `Store` 인터페이스 + 메모리 구현 (프로세스 싱글턴, 부팅 시 `data/seed/*.json` 로드, 개발 모드에선 `.data/store.json`에 디바운스 저장). Postgres 구현은 P1.

```ts
// lib/store/types.ts
export interface Store {
  get<T>(ns: Namespace, collection: string, id: string): Promise<T | undefined>;
  list<T>(ns: Namespace, collection: string, filter?: Partial<T>): Promise<T[]>;
  put<T extends { id: string }>(ns: Namespace, collection: string, value: T): Promise<void>;
  remove(ns: Namespace, collection: string, id: string): Promise<void>;
}
export type Namespace = "customer" | "platform" | "clinic" | "shared";
```

## 공통 타입

```ts
// lib/domain/common.ts
export type Locale = "ja" | "zh-CN" | "en" | "ko";
export type Nationality = "JP" | "CN" | "US" | "KR" | (string & {});
export type AgeBand = "20-24" | "25-29" | "30-34" | "35-39" | "40+";
export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
export type Unit = "cc" | "shot" | "unit" | "line" | "session";
export type Concern = "elasticity" | "fine_lines" | "pores" | "acne_scars" | "pigmentation" | "redness" | "dryness" | "contour";
export interface Amount { value: number; unit: Unit }
export type Krw = number; // 원 단위 정수
export type IsoDate = string; // YYYY-MM-DD
export type IsoDateTime = string; // ISO 8601 with offset
export type I18nText = Partial<Record<Locale, string>>;

// ZK 확장: 오퍼 조건 1개 (INTEGRATION.md 3절, 03 메시지 스키마). 모든 필드 선택이되 minCount, maxCount 중 하나는 필수.
export interface ZkClause {
  type?: string;       // 시술 id ("rejuran_healer"). 없으면 시술 무관
  clinicId?: string;   // 병원 id ("cln_hanbit"). 없으면 병원 무관
  minDays?: number;    // 오늘 기준 며칠 전부터
  maxDays?: number;    // 오늘 기준 며칠 전까지
  minCount?: number;
  maxCount?: number;
}
```

회로 코드 표는 `zk/codes.json`에 있고, 와이어와 저장소는 항상 id만 쓴다 (코드 변환은 `lib/zk`가 한다).

## 시술 마스터 (`data/seed/procedures.json`)

```ts
export interface Procedure {
  id: string;                    // "rejuran_healer"
  name: I18nText;
  category: "injection" | "laser" | "lifting" | "skin_booster";
  products: string[];            // ["Rejuran Healer", "Rejuran HB"]
  unit: Unit;
  concerns: Concern[];
  typicalAmount: { min: number; max: number }; // 시드 기본값. 실데이터 쌓이면 PriceRecord에서 재계산
  downtimeDays: { min: number; max: number };
  onsetDays: { min: number; max: number };
  cycle: {
    initial?: { count: number; intervalDays: number };
    maintenanceIntervalDays: { min: number; max: number };
  };
  dataStatus: "confirmed_by_planner" | "demo_assumption";
}
```

시드 시술과 주기 (PLANNING.md 확정분만 `confirmed_by_planner`):

| id | 주기 | 상태 |
| --- | --- | --- |
| `rejuran_healer` | 30일 간격 3회 → 이후 90~120일 | 주기 `confirmed_by_planner`, 용량·다운타임은 `demo_assumption` |
| `thermage_flx` | 연 1회 (300~400일) | 주기 `confirmed_by_planner` |
| `ulthera` | 연 1회 (300~400일) | 주기 `confirmed_by_planner` |
| `botox_forehead` | 90~120일 | `demo_assumption` |
| `shrink_universe` | 30~60일 | `demo_assumption` |
| `skin_booster_juvelook` | 30일 간격 3회 → 180일 | `demo_assumption` |

다음 회차 계산 (`lib/agents/customer/schedule.ts`):
- `initial`이 있고 `sessionNumber < initial.count`면 `nextDue = date + initial.intervalDays`, 다음 회차 번호 = `sessionNumber + 1`.
- 그 외 `nextDue = date + maintenanceIntervalDays.min`.
- 예: 리쥬란 1회차 2026-11-14 → 2회차 2026-12-14.
- 출국 전 다운타임 경고: 시술일 + `downtimeDays.max` > 출국일이면 비교 화면 슬롯에 경고 문장 ("출국 전에 다운타임이 끝나지 않을 수 있어요"). 막지는 않는다.

`demo_assumption` 값은 기획팀 확인 전까지 화면에 "데모용 값" 캡션을 단다 (README의 TODO와 동일 상태).

## 고객 네임스페이스

```ts
export interface CustomerAccount { id: string; email?: string; demoPersona?: string; agentId: string; createdAt: IsoDateTime }

export interface CustomerProfile {
  id: string;                    // = CustomerAccount.id
  agentId: string;               // "cag_7f3k2" 가명
  locale: Locale;
  nickname: string;
  nationality: Nationality;
  residency?: "short_term_visitor" | "resident"; // 외국 국적만. KR은 undefined
  ageBand: AgeBand;
  trip?: { arrival: IsoDate; departure: IsoDate; stayArea?: Area; flightTimeHome?: string };
  skin: { type?: "dry" | "oily" | "combination" | "sensitive" | "unknown"; concerns: Concern[] };
  safety: { pregnantOrBreastfeeding: boolean; allergies: string[]; anticoagulants?: boolean; recentIsotretinoin?: boolean; keloidHistory?: boolean };
  prefs: { budgetKrw?: { max: Krw }; downtimeToleranceDays?: number; painTolerance?: "low" | "mid" | "high"; languagesNeeded: Locale[]; doctorGender?: "any" | "female" };
  contact: { channel: "email" | "line" | "wechat" | "whatsapp"; handle: string };
  completedAt?: IsoDateTime;
}

export interface ConsentEntry {
  id: string;                    // "cns_0091"
  customerId: string;
  type: "terms" | "privacy" | "sensitiveHealth" | "crossBorder" | "shareAnonymizedRecords" | "shareWithClinic";
  granted: boolean;
  scope: string[];               // 공유 가능한 필드 경로, 예: ["safetyInfo.*", "contact.handle"]. 와이어 `safetyInfo`는 프로필 `safety`와 같은 필드명 (`pregnantOrBreastfeeding`, `allergies` 빈 배열 = 없음)
  recipientRole?: "platform" | "clinic";
  textVersion: string;           // 동의 문구 버전 "2026-10-24.v1"
  at: IsoDateTime;
}

export interface TreatmentRecord {
  id: string;
  customerId: string;
  procedureId: string;
  date: IsoDate;
  amount?: Amount;
  priceKrw?: Krw;
  clinicId?: string;             // 레지스트리에 있으면
  clinicName?: string;           // 없으면 자유 텍스트
  source: "manual" | "booking" | "onboarding_history";
  receiptImage?: string;         // 저장 경로, P1
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  sessionNumber: number;         // 같은 시술의 연속 회차 (1부터). 직전 기록과의 간격이 maintenanceIntervalDays.max × 1.5 초과면 1로 리셋
  nextDue?: IsoDate;             // schedule.ts 규칙 (아래)
  status: "active" | "paused" | "stopped"; // 계속 / 쉬기 / 그만
  stopReason?: "no_effect" | "expensive" | "side_effect" | "other";
  sharedToPlatform: boolean;
  anchor?: { subjectId: string; version: number; tx: string; recordHash: string }; // ZK 확장: 병원 확인 시술이 체인에 앵커된 기록. 없으면 "직접 입력" (증명에 쓰이지 않음)
}

// ZK 확장: 기록 지갑. 차트는 기기(지갑)에만 있고 어떤 메시지로도 나가지 않는다
export interface RecordWallet {
  id: string;                    // = customerId
  subjectId: string;             // 체인 가명
  chart: unknown;                // private, never leaves the device
  version: number;               // 앵커된 기록 수 (체인 기록 v{n})
}

// ZK 확장: 방문 티켓. 후기 1회를 증명하는 Semaphore identity
export interface VisitTicket {
  id: string;
  customerId: string;
  clinicId: string;
  procedureId: string;
  identity: unknown;             // private
  used: boolean;                 // 후기를 냈으면 true (방문 1회 = 후기 1회)
}

export interface CustomerRequest {
  id: string;                    // "req_..." = A2A contextId
  customerId: string;
  rawUtterance: string;
  request: ProcedureRequestV1;   // lib/a2a/schemas.ts
  status: "draft" | "matching" | "quoting" | "judging" | "comparing" | "booking" | "booked" | "closed" | "failed";
  matchId?: string;
  createdAt: IsoDateTime;
}

export interface ReceivedQuote { id: string; requestId: string; quote: QuoteV1; verdict?: FairnessVerdictV1; taskId: string; receivedAt: IsoDateTime }
export interface CustomerBooking { id: string; requestId: string; clinicId: string; clinicTaskId: string; booking?: BookingV1; status: BookingV1["status"] | "requested" }
export interface OutcomeDraft { id: string; bookingId: string; checkpoint: "D0" | "D7" | "D30"; dueAt: IsoDateTime; outcome?: OutcomeV1; sentAt?: IsoDateTime }
```

## 플랫폼 네임스페이스

```ts
export interface ClinicRegistryEntry {
  id: string;                    // "cln_mint"
  slug: string;                  // "mint"
  name: I18nText;
  area: Area;
  agentCardUrl: string;
  operationMode: "proxy" | "clinic";
  dataSources: ("sms" | "public_web" | "clinic_input")[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
  verificationStatus: "verified" | "pending_verification" | "suspended";
  languages: { locale: Locale; mode: "staff" | "interpreter" | "app_translation" }[]; // 매칭 하드 필터·적합도에 mode 필요
}

export interface PriceRecord {
  id: string;
  procedureId: string;
  product?: string;
  area: Area;
  amount: Amount;
  paidKrw: Krw;                  // VAT 포함으로 정규화된 실결제
  normalizedUnitKrw: Krw;        // paidKrw / amount.value
  source: "outcome" | "shared_record" | "public_offer"; // public_offer는 판정 표본에서 제외, 참고로만
  verified: boolean;             // 영수증 또는 예약 연계 결제
  ageBand?: AgeBand;
  nationalityGroup?: "KR" | "foreign";
  clinicId?: string;
  date: IsoDate;
}

export interface ClinicOfferCache { id: string; clinicId: string; offers: OffersV1; fetchedAt: IsoDateTime } // clinic.offers A2A 응답 캐시
export interface JudgedQuote { id: string; quoteId: string; matchId: string; clinicId: string; quote: JudgeRequestV1["quotes"][number]; verdict: FairnessVerdictV1; at: IsoDateTime } // 결과의 quoteGapRatio 계산용

export interface Outcome extends OutcomeV1 { id: string; receivedAt: IsoDateTime; quotedKrw?: Krw; quoteGapRatio?: number }

export interface RoutingRule {
  id: string;                    // "rule_012"
  version: number;
  status: "proposed" | "active" | "rejected" | "retired";
  when: RuleCondition;
  then: RuleAction;
  reason: string;                // 사람이 읽는 근거 (ko)
  evidence: { outcomeIds: string[]; signalIds: string[]; summary: string };
  source: "operator" | "auto_proposal";
  proposedBy?: string;           // "claude-opus-5-5" 또는 운영자 id
  approvedBy?: string;
  createdAt: IsoDateTime;
  activatedAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
  appliedCount: number;
}
export interface RuleCondition {
  // when은 "요청"에만 대어 평가한다. 병원 지정은 RuleAction(then)의 clinicIds로만 한다.
  procedureIds?: string[]; nationalities?: Nationality[]; languages?: Locale[];
  areas?: Area[]; ageBands?: AgeBand[]; firstKProcedure?: boolean; budgetMaxBelowKrw?: Krw;
}
export type RuleAction =
  | { kind: "exclude_clinic"; clinicIds: string[] }
  | { kind: "boost_clinic"; clinicIds: string[]; delta: number }      // 점수 +delta (0~0.3)
  | { kind: "demote_clinic"; clinicIds: string[]; delta: number }
  | { kind: "prefer_area"; areas: Area[]; delta: number }
  | { kind: "require_language"; languages: Locale[] };

export interface MatchLog {
  id: string;                    // "mt_4401"
  requestId: string;
  customerAgentId: string;
  request: ProcedureRequestV1;
  candidatesBeforeRules: { clinicId: string; score: number }[];
  appliedRuleIds: string[];
  result: ClinicShortlistV1;
  at: IsoDateTime;
}

export interface AttributionEntry {
  id: string; bookingId: string; clinicId: string; customerAgentId: string; matchId: string;
  referralTokenJti: string; status: BookingV1["status"]; priceKrw: Krw; nationality?: Nationality; reportedAt: IsoDateTime;
}

// ZK 확장: 검증 방문 수와 후기 집계. 후기 원문은 저장하지 않는다 (1:1 요약 때만 쓰고 폐기, 08)
export interface VerifiedVisitStat { id: string; clinicId: string; procedureId: string; count: number }
export interface ReviewStat { id: string; clinicId: string; procedureId: string; n: number; avgRating: number; nullifiers: string[] }
export interface AnchorLog { id: string; bookingId: string; subjectId: string; tx: string; day: number; at: IsoDateTime }

export interface Signal {
  id: string;
  clinicId: string;
  kind: "quote_gap" | "low_satisfaction" | "response_timeout" | "rejection" | "no_show" | "side_effect_report" | "underdosed_offer";
  value: number;
  context: { nationality?: Nationality; procedureId?: string; outcomeId?: string; taskId?: string };
  at: IsoDateTime;
}
```

## 병원 네임스페이스

```ts
export interface ClinicProfile {
  id: string; slug: string; name: I18nText; address: string; area: Area;
  medicalInstitutionId: string; businessRegistrationNo: string;
  foreignPatientFacilityRegNo?: string;
  doctors: { name: string; boardCertifiedDermatology: boolean; yearsOfPractice?: number }[];
  languages: { locale: Locale; mode: "staff" | "interpreter" | "app_translation" }[];
  operationMode: "proxy" | "clinic";
  contactPerson?: { name: string; role: string };
}
export interface MenuItem { id: string; clinicId: string; procedureId: string; product: string; amount: Amount; priceKrw: Krw; vatIncluded: boolean; includes: string[]; foreignerSamePrice: boolean }
export interface Offer { id: string; clinicId: string; procedureId: string; title: string; amount: Amount; priceKrw: Krw; regularPriceKrw: Krw; validFrom: IsoDate; validUntil: IsoDate; conditions: string; zkClauses?: ZkClause[] } // zkClauses가 있어도 conditions 텍스트는 필수 (의료법 시행령 제23조)
export interface SlotPolicy { clinicId: string; durationMinByProcedure: Record<string, number>; foreignSlotsPerDay: number; autoConfirm: boolean; hours: Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", { open: string; close: string } | null> }
export interface Slot { id: string; clinicId: string; start: IsoDateTime; procedureIds: string[]; held: boolean }
export interface ClinicBooking { id: string; clinicId: string; a2aTaskId: string; request: BookingRequestV1; status: BookingV1["status"]; confirmedBy?: "clinic_staff" | "pibu_operator" | "auto"; referralJti: string }
export interface ClinicTask { id: string; clinicId: string; a2aTaskId: string; skillId: string; state: string; summary: string; at: IsoDateTime }
```

## 공용

```ts
export interface A2ALogEntry {
  id: string;
  at: IsoDateTime;
  contextId?: string;            // requestId
  taskId?: string;
  from: { agentId: string; role: "customer" | "platform" | "clinic" };
  to: { agentId: string; role: "customer" | "platform" | "clinic"; url: string };
  method: "SendMessage" | "GetTask" | "CancelTask";
  skillId?: string;
  request: unknown;              // JSON-RPC 요청 전문 (민감 필드 마스킹: safetyInfo.*, guest.contactHandle, passportName, contact.*)
  response?: unknown;
  state?: string;                // 응답 태스크 상태
  latencyMs?: number;
  humanSummary: I18nText;        // 진행 화면용 한 줄 ("병원 4곳에 견적을 요청했어요")
}
export interface AgentIdentity { agentId: string; role: "customer" | "platform" | "clinic"; cardUrl: string; ownerId: string; tokenIssuedAt: IsoDateTime }
```

## A2A 스키마 (`lib/a2a/schemas.ts`)

[03-a2a-protocol.md](03-a2a-protocol.md)의 `pibu/*@1` 와이어 예시마다 zod 스키마 1개와 `z.infer` 타입 1개를 둔다. 이름 규칙: `ProcedureRequestV1Schema` → `type ProcedureRequestV1`. 모든 스키마는 `schema` 리터럴 필드를 갖고, `parsePibuData(skillId, data)`가 스킬 라우팅 표에 따라 맞는 스키마로 검증한다.

## 시드 파일 (`data/seed/`)

| 파일 | 내용 | 규모 |
| --- | --- | --- |
| `procedures.json` | 시술 마스터 | 6종 |
| `clinics.json` | `ClinicRegistryEntry` + `ClinicProfile` + `MenuItem[]` + `Offer[]` + `SlotPolicy` | 5곳 ([01-users-journeys.md](01-users-journeys.md)). 서울글로우(일본어 staff, `autoConfirm=false`)·민트(일본어 interpreter)·아라(일본어 interpreter)는 일본어 하드 필터를 통과해야 한다. 리쥬란 메뉴: 서울글로우 2cc 340,000 VAT 포함 · 민트는 **1cc 이벤트만** (99,000 VAT 포함, 정상가 150,000, 2026-11-01 ~ 11-30, 첫 방문) · 아라 2cc 300,000 VAT 별도 · 한빛 2cc 420,000 VAT 포함 · 다혜 2cc 360,000 VAT 포함. ZK 확장: 이벤트 `Offer`는 `zkClauses`를 가질 수 있다 (민트 첫 방문 1cc 이벤트 = `[{ "clinicId": "cln_mint", "maxCount": 0 }]`) |
| `slots.json` | 2026-11-10 ~ 2026-11-30, 병원마다 매일 10:00 · 11:00 · 14:00 · 15:00 (KST) 4개 고정 | 병원 5곳 × 21일 × 4 |
| `price-records.json` | 가상 실결제 기록 (한국 여성 공유 기록 + 외국인 결과). 리쥬란 `gangnam_sinsa` verified 기록은 **정확히 42건**, 날짜 2026-07-16 ~ 2026-11-10 (기준일 119일 이내, 경계 해석과 무관), 단위가격 p25 140,000 · p50 160,000 · p75 185,000 · p90 210,000, 용량 p25 = 2 · p75 = 3 (0.5 반올림 후). 그 외 지역·시술은 10~20건씩 | 리쥬란 42 + 기타 |
| `outcomes.json` | 기본 결과. 아라의원 일본 고객 결과 4건은 평균 `quoteGapRatio` +0.15, 날짜 2026-08-14 ~ 2026-10-12 (기준일 31~90일 전: 90일 병원 플래그에는 들어가고 30일 규칙 트리거 윈도우에는 안 들어감) | 30건 |
| `outcomes-ara-burst.json` | 데모 주입용: 아라의원 일본 고객 결과. 날짜는 주입 시점 `clock.now()` 기준 1~29일 전으로 주입 때 계산. `quoteGapRatio`는 0.25 ~ 0.37 구간의 등간격 20개 값 (양 끝 포함, 평균 정확히 0.31) | 20건 |
| `customers.json` | `cus_yuki`: **미완료** (데모 1행에서 온보딩부터) · `cus_yuki_done`: Yuki 완료 프로필 (테스트용: `stayArea=sinsa`, `budgetKrw.max=450000`, `languagesNeeded=["ja"]`, 체류 2026-11-13 ~ 11-15, 출국 19:00) · `cus_lin`, `cus_emily`, `cus_jisoo`, `cus_sua`: 완료 | 6명 |
| `rules.json` | 활성 2개, 제안 0개. `rule_001`: when `{ nationalities: ["CN"] }` then `require_language ["zh-CN"]` · `rule_002`: when `{ procedureIds: ["ulthera"] }` then `demote_clinic ["cln_dahye"] 0.1`. 둘 다 Yuki 리쥬란 요청에는 매치되지 않는다 (`appliedRuleIds = []`) | 2개 |
| `kr-patterns.json` | 나이대·고민별 한국 여성 시술 조합 (PLANNING의 Pibu Recipe) | `demo_assumption` |
| `fx.json` | 참고 환율 (JPY, CNY, USD) | 고정값 |
| `verified-visits.json` | ZK 확장: 병원 × 시술별 `VerifiedVisitStat` 시드 (데모용 가상 통계. 예: 서울글로우 리쥬란 1,240명). 후기 시드 `ReviewStat`은 같은 방식으로 n >= 5인 병원에만 둔다 | 병원 5곳 × 시술 |

모든 시드 병원·인물·통계는 **가상**이다 (README 규칙).
