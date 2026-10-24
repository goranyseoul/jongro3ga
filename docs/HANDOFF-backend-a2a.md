# 핸즈오프: 백엔드와 A2A 이어받기

> 작성: 2026-10-24, 백엔드 세션(`2-backend`)
> 받는 사람: gorany님, 그리고 이 일을 이어서 맡길 Claude
> 코드 기준: 브랜치 `feat/integration-r2` (기준 `feat/integration-2`, 그 위에 이 세션의 커밋). 백엔드 원본은 `feat/backend-skeleton`
> 한 줄 상태: 화면 22개는 목데이터로 돌고, 데이터 모델·A2A 메시지 스키마·로그·시계·시술 마스터와 필터까지 있다. **A2A 서버, 클라이언트, 에이전트 3종, API, 시드, LLM 계층은 없다.**

이 문서는 스펙(`docs/spec/`)을 대체하지 않는다. 스펙이 말하지 않거나 스펙과 달라진 결정, 지금까지의 시행착오, 남은 일의 순서를 적었다. 스펙과 구현이 다르면 [BUILD-LOG](spec/BUILD-LOG.md)에 먼저 적는다.

## 0. 한 장 요약

**만들 것.** 환자는 자기 정보를 넣고, 병원은 병원 정보와 제품(가격, 이벤트, 예약 시간)을 넣는다. 그 사이에서 우리 에이전트가 대화해 견적 비교, 가격 판정, 예약까지 해주고, 시술 후 피드백과 결과를 모아 매칭 규칙을 계속 고친다. 서비스 이름은 **PibooK**(한글 피북).

**지금 있는 것.** 타입과 스키마(`lib/domain`, `lib/a2a/schemas.ts`), 와이어 JSON 헬퍼, 에이전트 타임라인 로그, 마스킹, 데모 시계, 메모리 저장소, 시술 마스터 27종, 시술 필터. 테스트 128개가 통과한다.

**없는 것.** `app/a2a/**`, `app/api/**`, `lib/a2a/{auth,cards,server,client}.ts`, `lib/agents/{customer,clinic}`, `lib/agents/platform`의 판정·매칭·규칙·결과·제안, `lib/llm`, 병원·페르소나·슬롯·가격 기록 시드, 영속 저장소.

**먼저 할 일.** 6절의 작업 묶음 WP0(의존성과 스크립트 정리) 다음 WP2(A2A 코어). 나머지가 전부 이 위에 선다.

**읽을 순서.** 이 문서, [09-architecture](spec/09-architecture.md)의 "SDK 함정", [03-a2a-protocol](spec/03-a2a-protocol.md), [10-build-plan](spec/10-build-plan.md), 그다음 [BUILD-LOG](spec/BUILD-LOG.md)와 [DEMO.md](../DEMO.md).

## 1. 제품 방향 (오너 확정)

### 1.1 세 곳에서 데이터가 들어오고, 가운데에서 루프가 돈다

```
 환자 (고객 에이전트)                 플랫폼 에이전트                 병원 (병원 에이전트)
 -----------------                    ---------------                 --------------------
 프로필, 동의, 시술 기록 입력  --A2A-->  매칭, 가격 판정, 레시피  <--A2A--  병원 정보, 제품, 가격,
 (채팅 온보딩, 메모장 가져오기)              ^          |                   이벤트, 예약 시간 입력
        |                                    |          v                   (병원 콘솔, 가격표 업로드)
        |                                    |   견적 비교, 예약
        |                                    |
        +-- 시술 후 체크인, 결과, 피드백 ---> 결과 수집 -> 신호 -> 규칙 제안 -> 운영자 승인
                                             (이 결과가 다음 매칭과 판정을 바꾼다)
```

- 환자가 넣는 것은 고객 에이전트 저장소(`customer` 네임스페이스)에 있고, 동의한 필드만 A2A로 나간다.
- 병원이 넣는 것은 병원 에이전트 저장소(`clinic`)에 있고, 플랫폼은 `clinic.offers` 호출로만 읽는다.
- 플랫폼이 쌓는 것(`platform`)은 가격 기록, 결과, 신호, 규칙, 매칭 로그다.
- 에이전트끼리는 같은 서버 안에 있어도 **A2A HTTP로만** 대화한다. 병원이 카드를 가져가 직접 운영하고 고객이 에이전트를 옮길 수 있어야 한다는 제품의 약속 때문이다.

### 1.2 응답은 에이전트 중심 (오너 지시)

화면용 CRUD 모양이 아니라 에이전트가 한 일을 중심으로 응답을 만든다. 이미 있는 `agentTimeline()`(`lib/a2a/log.ts`)이 그 틀이다. 예를 들어 요청 진행 화면 API는 이런 모양이어야 한다.

```json
{
  "request": { "id": "req_...", "status": "comparing" },
  "statusCopy": { "ko": "병원이 ...", "ja": "..." },
  "timeline": [
    { "at": "2026-11-08T10:02:00+09:00", "actor": { "agentId": "cag_...", "role": "customer" },
      "target": { "agentId": "cln_...", "role": "clinic" }, "skillId": "clinic.quote",
      "state": "TASK_STATE_COMPLETED", "summary": { "ko": "..." }, "raw": { "request": {}, "response": {} } }
  ],
  "options": [ { "quote": {}, "verdict": {}, "warnings": [] } ],
  "nextAction": "choose_option"
}
```

### 1.3 이미 정해진 것

| 결정 | 내용 | 근거 |
| --- | --- | --- |
| AI는 Claude만 | 키가 없어도 픽스처로 데모가 끝까지 돈다 | 해커톤 규칙, 09 LLM 절 |
| 판정과 매칭은 결정론 코드 | LLM은 문장화, 추출, 규칙 제안 문장에만 | 07 서문 |
| 데모 기준은 `DEMO.md` | 4개 시나리오(유키, 지수, 그레이스, 린) | 오너 위임, BUILD-LOG 13 |
| 데모 시계는 하나 | `2026-10-24T10:00+09:00`, 유키와 그레이스 일정은 +28일 | BUILD-LOG 13, `lib/clock.ts` |
| 브랜드는 `PibooK` | 하이픈 없음. `prebuild`가 옛 표기를 막는다 | BUILD-LOG 3 |
| 지역은 조건이 아니라 위치 정보 | 후보는 3곳 | 오너 의견, BUILD-LOG 12. 07 갱신 전 |
| 출국일을 넘으면 연장 확인 안내 | `daysOver`, `extendDays`와 4개 언어 문장 | BUILD-LOG 14 |
| 시드 병원, 인물, 통계는 전부 가상 | 실제 병원명과 개인정보를 저장소에 넣지 않는다 | README 규칙 |
| 배포는 PR, `main` 머지, 포크 동기화, Vercel 자동 | 로컬 `vercel deploy` 금지 | [DEPLOY](DEPLOY.md) |

## 2. 지금 상태

### 2.1 있는 것

| 경로 | 역할 | 테스트 |
| --- | --- | --- |
| `lib/domain/*.ts` | 06 문서의 엔티티 타입 전부, 시술 마스터 스키마(`procedure.ts`) | |
| `lib/domain/procedure-master.ts`, `data/seed/procedures.json` | 시술 27종(기획서 부록 A). 원문 셀은 `source`에 보존, 모르는 값은 `null` | 원문과 자동 대조 |
| `lib/a2a/schemas.ts` | `pibu/*@1` 메시지 20종 zod 스키마, 스킬 라우팅 표 13종, `parsePibuData` | 38개 |
| `lib/a2a/wire.ts` | A2A JSON 타입, `buildSendMessageRequest`, JSON-RPC 헬퍼, 태스크 상태 문구 | 13개 |
| `lib/a2a/log.ts`, `mask.ts` | 호출 로그(저장 시 마스킹), `agentTimeline`, 민감 필드 마스킹 | 17개 |
| `lib/store/*` | `Store` 인터페이스와 메모리 구현, `snapshot/restore`, `globalThis.__pibu` 싱글턴 | 14개 |
| `lib/clock.ts` | 데모 시계(`setClock`, `advanceClockHours`) | 9개 |
| `lib/agents/platform/procedure-filter.ts` | 영역, 부위, 조건으로 시술 카드를 걸러 점수화. 제외 사유와 체류 연장 안내 포함 | 27개 |

모든 테스트는 `lib/**/*.test.ts`에 코드 옆에 둔다(스펙의 `tests/`와 다르다). 의도적 버그를 넣어 테스트가 실제로 실패하는지 확인하는 방식으로 검증했다(8절).

### 2.2 없는 것 (10-build-plan 기준)

| 영역 | 빠진 것 | 태스크 |
| --- | --- | --- |
| 시드 | 병원, 병원 프로필·메뉴·오퍼, 슬롯, 가격 기록, 결과, 페르소나, 규칙, `kr-patterns`, `fx` | T03 나머지 |
| A2A 코어 | `auth.ts`(에이전트 JWT, 추천 토큰 ES256, JWKS), `cards.ts`, `server.ts`, `client.ts`, `app/a2a/**` 라우트, `/.well-known/agent-card.json` rewrite | T04 |
| 병원 에이전트 | `lib/agents/clinic/*`: 견적, 예약, 대행 확정 | T05 |
| 플랫폼 에이전트 | `eligibility`, `recipe`, `matching`, `fairness`(+문구), `rules`, `outcomes`, `proposer` | T06, T13 |
| LLM 계층 | `lib/llm/*`: 클라이언트, 프롬프트, 도구, 픽스처 | T07 |
| 고객 에이전트 | `consent`, `intent`, `orchestrator`, `records`, `schedule`, executor | T08 |
| API | `app/api/{customer,clinic,ops,demo,onboarding}/**` | T09 이후 |
| 의존성 | `@a2a-js/sdk`, `jose`, `@anthropic-ai/sdk`, `@playwright/test` | T00 |
| 스크립트 | `npm run gate`, `check:boundaries`, `e2e`, `.env.example` | T00 |
| 영속화 | Postgres 저장소와 태스크 저장소 | P1 |

`CLAUDE.md`는 `npm run gate`와 `npm run check:boundaries`를 요구하지만 `package.json`에 없다. 문서와 구현이 어긋난 상태다.

### 2.3 화면

고객, 병원, 운영, 데모 화면 22개는 전부 `lib/ui-data/{customer,clinic,ops}.ts`의 목데이터와 브라우저 상태로 돈다. API가 생기면 이 파일을 화면 단위로 하나씩 API 호출로 바꾼다. 화면 세션과 겹치지 않게 한 화면씩 합의하고 바꾼다. 알려진 불일치는 세 가지다.

- 데모 시계 상수가 셋이다. 고객 `DEMO_TODAY`와 운영 `OPS_TODAY`는 2026-11-12, 병원 `TODAY`는 2026-10-24. `lib/clock.ts`로 하나로 모은다.
- 목데이터가 스펙 10의 리쥬란 데모(서울글로우, 민트, 아라) 기준이다. `DEMO.md` 시나리오로 다시 만든다.
- 랜딩의 예시 문구가 아직 "11/13부터 15일"이다.

### 2.4 ZK 레이어 (별개 서버)

팀원이 만든 GlowPass가 `glowpass/`(Node 서버, 포트 4000), `zk/`(회로), `chain/`(Base Sepolia 컨트랙트)로 들어와 있다. 시술 이력을 공개하지 않고 오퍼 자격을 증명하고, 방문자만 익명 후기를 남기는 구조다. 자체 Claude 에이전트와 A2A 모양의 카드를 갖고 있고, 우리 스펙의 A2A와는 별개로 구현돼 있다. 연동 규약은 [INTEGRATION](INTEGRATION.md). 환자 차트 원본(지갑 파일)은 데모 맥에만 있어서 다른 기기에서는 Yuki, Lin 증명이 실패한다.

## 3. 누가 무엇을 입력하나

### 3.1 환자 (고객 에이전트가 받는다)

| 입력 | 엔티티 | 받는 방법 | 상태 |
| --- | --- | --- | --- |
| 언어, 닉네임, 국적, 나이대, 거주 구분 | `CustomerProfile` | 채팅 온보딩, 슬롯과 도구 호출([04](spec/04-onboarding-chat.md)) | 화면만 있음 |
| 동의 4종(필수)와 선택 | `ConsentEntry` | 동의 카드. 민감정보 동의 전에는 피부 질문을 하지 않는다 | 화면만 있음 |
| 방한 일정, 피부 고민, 안전 정보, 선호 | `CustomerProfile.trip/skin/safety/prefs` | 온보딩 | 화면만 있음 |
| 시술 기록 | `TreatmentRecord` | 3초 기록, **메모장 통째로 붙여넣기**(Claude가 날짜, 시술, 용량, 병원, 가격으로 정리, 연도 생략은 추정 후 확인), 예약에서 자동 | 메모장 가져오기는 기획서에만 있음 |
| 조건 정리 | `CustomerRequest` | 한마디를 필터 조건으로 변환("1년에 한 번밖에 못 와요" 는 주기 연 1회) | 스키마와 필터까지 |
| 시술 후 반응, 결과 | `OutcomeDraft`, `OutcomeV1` | 시술 직후 한 줄, 효과 시점 체크인, D0·D7·D30 | 스키마만 |

### 3.2 병원 (병원 에이전트가 받는다)

| 입력 | 엔티티 | 받는 방법 | 상태 |
| --- | --- | --- | --- |
| 기관 정보, 의료기관 번호, 사업자번호, 외국인환자 유치기관 등록 서류, 의사(전문의 여부), 담당자 | `ClinicProfile` | 병원 콘솔, 채팅 온보딩(P1) | 화면만 있음 |
| **제품과 메뉴**: 시술, 제품, 용량, 가격, VAT, 포함 항목, 외국인 동일가 | `MenuItem` | 콘솔 입력, 가격표 업로드(P1, Claude 비전 추출 `extract_menu_items`) | 화면만 있음 |
| 이벤트: 제목, 정가, 기간, 조건 **전부 필수** | `Offer` | 콘솔 | 스키마에 필수 검증 있음(의료법 시행령 제23조) |
| 예약 가능 시간, 자동 확정 여부 | `SlotPolicy`, `Slot` | 콘솔 | 화면만 있음 |
| 언어 지원 수준: 원장 직접, 코디네이터 동행, 통역, 없음. 영어권 환자 비율, 상담 방식(무료, 유료, 당일 시술 가능) | `ClinicProfile.languages` 확장 | 콘솔 | 기획서 8-1-4에만 있고 타입에는 아직 없음 |
| 대행 병원: 문자, 홍보물 붙여넣기 | `ClinicRegistryEntry` | 운영 콘솔(`/ops/clinics/new`, P1) | 화면만 있음 |

병원이 넣는 **제품**은 스펙에 제품 마스터가 없다(시술 마스터 27종만 있음). 6절 WP3 전에 결정이 필요하다(7절).

### 3.3 플랫폼이 쌓는 것

가격 기록(`PriceRecord`: 결과나 공유 기록에서), 결과(`Outcome`, 견적 대비 실결제 차이 `quoteGapRatio`), 신호(`Signal`), 규칙(`RoutingRule`), 매칭 로그(`MatchLog`), 유치 실적(`AttributionEntry`), 병원 오퍼 캐시(`ClinicOfferCache`).

## 4. 에이전트 대화 흐름 (요약)

스킬 13개와 입출력 스키마는 `lib/a2a/schemas.ts`의 `SKILL_ROUTES`가 정본이고 [03](spec/03-a2a-protocol.md)과 일치한다. 흐름은 고객 에이전트가 이끈다.

1. `platform.recipe`: 용량을 모를 때 한국 여성의 통상 선택을 받는다.
2. `platform.match_clinics`: 후보와 추천 토큰(ES256, 72시간)을 받는다. 한국인과 국내 거주 외국인은 `TASK_STATE_REJECTED`.
3. `clinic.quote`: 후보 병원에 병렬 요청(20초 제한, `Promise.allSettled`). 시간초과와 거절은 `platform.report_signal`로 알린다.
4. `platform.judge_quote`: 견적 전부를 판정에 보낸다.
5. 고객이 고르면 `clinic.book`(`returnImmediately: true`), 이후 `GetTask` 폴링. 확정 시 병원이 `platform.report_booking`을 호출한다.
6. 시술 후 `platform.submit_outcome`.

코드 위치는 [09](spec/09-architecture.md)의 디렉터리 절을 따른다: `lib/agents/{customer,platform,clinic}/executor.ts`, `lib/a2a/{server,client,auth,cards}.ts`, `app/a2a/**`. 모듈 경계(고객, 플랫폼, 병원 모듈끼리 직접 import 금지)는 `scripts/check-boundaries.mjs`로 강제한다. 이 스크립트도 아직 없다.

## 5. 개선 루프

```
수집 -> 집계 -> 제안 -> 승인 -> 적용 -> 측정
```

| 단계 | 내용 | 코드와 근거 |
| --- | --- | --- |
| 수집 | 결과(실결제, 실용량, 만족도, 통증, 한 줄), 시술 직후 체크인, 효과 시점 체크인, 병원 응답 시간초과와 거절 | `platform.submit_outcome`, `customer.checkin`(P1), `platform.report_signal` |
| 집계 | 병원 x 국적 x 시술 30일 세그먼트, 견적 대비 실결제 차이, 가격 분포(p25, p50, p75, p90) | `outcomes.ts`, `fairness.ts`. [07](spec/07-platform-intelligence.md) 3절 |
| 제안 | 결정론 트리거 5종(실결제 상승, 낮은 만족도, 응답 없음, 지역 선호, 부작용 보고)이 후보를 만들고 Claude가 근거 문장을 쓴다. API 실패 시 템플릿 문장 | `proposer.ts`, 07 4절 |
| 승인 | 운영자가 `/ops/rules`에서 승인, 반려, 폐기. 자동 적용은 부작용 긴급 건 하나뿐 | 07 가드레일 |
| 적용 | 다음 매칭에서 규칙을 적용하고 `MatchLog`에 `appliedRuleIds` 기록 | `matching.ts`, `rules.ts` |
| 측정 | 규칙 전후 30일 만족도, 견적 차이, 예약 전환(P1) | 07 효과 측정 |

시나리오가 요구하는 루프도 같은 틀에 얹는다.

- **시술 마스터 보정**: 기록이 쌓이면 권장 주기와 용량 옆에 "한국 여성 실제 평균"을 함께 보여준다(기획서 11절). 마스터의 `verified: false` 값이 이 보정과 의료진 검수로 바뀌어야 한다.
- **한국 여성 선택률**: 시술 필터의 `selectionRate` 입력은 `kr-patterns`와 공유 기록에서 계산해 넣는다. 지금은 호출자가 주입한다.
- **체크인 일정**: 시술 직후, 효과 체감 시점(마스터의 `effectOnset`), 다음 회차에 알림을 예약한다. 시계는 `lib/clock.ts`만 쓴다.
- **병원 데이터 신선도**: `lastVerifiedAt`이 30일을 넘으면 운영 콘솔에 경고 문장.

지켜야 할 가드레일은 다음과 같다.

- 국적 조건은 언어·지역 선호나 실제 피해가 확인된 병원 제외에만 쓴다. 건강 정보는 규칙 조건에 쓸 수 없다(`RuleCondition` 타입에 필드가 없다).
- 병원은 집계(같은 병원 결과 n이 5 이상)만 본다. 개별 후기와 점수는 병원에 보내지 않는다.
- 병원이 낸 돈은 매칭 점수와 판정에 어떤 경로로도 들어가지 않는다.

## 6. 해야 할 일

의존: WP0, WP2가 먼저고 나머지는 그 위에 선다. 각 묶음은 별도 worktree와 브랜치에서 하고 끝에 게이트를 통과시킨다. 수용 기준은 [10-build-plan](spec/10-build-plan.md)의 해당 태스크를 따른다.

| 묶음 | 내용 | 수용 기준 (요약) |
| --- | --- | --- |
| **WP0** 정리 | 의존성 추가(`@a2a-js/sdk`, `jose`, `@anthropic-ai/sdk`, `@playwright/test`), `scripts/check-boundaries.mjs`, `npm run gate`, `.env.example`, `CLAUDE.md`와 `package.json` 맞추기 | `npm run gate`가 있고 통과 |
| **WP1** 시드 (T03 나머지) | 7절 결정 1이 먼저. 병원·메뉴·오퍼·슬롯·가격 기록·결과·페르소나·규칙·`kr-patterns`·`fx`, 로더(`lib/store/seed.ts`), 개발 모드 `.data/store.json` 저장 | 시드가 zod 검증을 통과, 실명 패턴 없음, 시계 고정 상태에서 표본 수와 분위수 일치 |
| **WP2** A2A 코어 (T04) | `auth.ts`, `cards.ts`, `server.ts`(SDK 래퍼), `client.ts`(fetch, 로그 기록, 20초 제한, 카드 60초 캐시), `app/a2a/**`, rewrite | 토큰 없는 rpc는 401, 병원 토큰으로 고객 `customer.checkin` 호출 거절, 추천 토큰 서명·만료·aud 검증, `SendMessage` 와이어 예시로 라우트 통합 테스트 |
| **WP3** 병원 에이전트 (T05) | 스킬 5개, 견적 항목 선택 규칙, `indicative`, 대행 예약(`WORKING` 유지, `confirmProxyBooking`), 병원 입력 API(프로필, 메뉴, 오퍼, 슬롯) | 대행 병원 견적은 `indicative: true`, 추천 토큰 없거나 만료면 `REJECTED`, 확정 후 `COMPLETED` |
| **WP4** 플랫폼 에이전트 (T06, T13) | `eligibility`, `recipe`, `matching`(3곳, 지역 필터 제거, 07 갱신 후), `fairness`와 4개 언어 문구, `rules`, `outcomes`, `proposer` | 07 기준 테스트 케이스와 경계값, 점수 결정론, 병원 토큰으로 결과 제출 거절 |
| **WP5** LLM 계층 (T07) | 클라이언트(키 없으면 픽스처), 프롬프트와 의료 경계 블록, 도구(`update_profile`, `show_widget`, `request_consent`, `finish_onboarding`, `draft_procedure_request`, `extract_menu_items`, `propose_rules`), **메모장 가져오기** 추출 도구 | 도구 입력 검증 실패 시 도구 에러, 픽스처 출력에 진단·권유 표현 없음, 키 없이 의도 파악이 `procedure-request`를 만든다 |
| **WP6** 고객 에이전트 (T08) | `consent`, `intent`, `orchestrator`, `records`, **`schedule`**, executor, 체크인 예약 | 다음 회차 계산(**달력 월 기준**), 병원 쪽 요청에서 `notes`, `ageBand` 제거, 응답 없는 병원이 있어도 나머지로 진행 |
| **WP7** API 연결 | `app/api/**`를 에이전트 중심 응답(1.2절)으로 만들고 `lib/ui-data`를 화면 단위로 교체. 온보딩 SSE | 화면 e2e, 콘솔 에러 0 |
| **WP8** 영속화 | 7절 결정 5 | 선택한 방식으로 폴링이 인스턴스 사이에서 깨지지 않는다 |
| **WP9** 마감 | e2e 데모 시나리오, BUILD-LOG 정리, README | `npm run gate`와 e2e 통과 |

시나리오가 요구하지만 10-build-plan에 없는 기능은 위 묶음에 이렇게 넣는다.

| 기능 | 어디에 | 비고 |
| --- | --- | --- |
| 메모장 가져오기 | WP5, WP6 | 지수 시나리오. 연도 추정 확인, 1cc당 가격, 회차권 잔여, 예약 일정 인식 |
| 상황을 필터로 변환 | WP5 | "연 1회", "여행도 즐기고 싶어요", "보수적", "영어만 돼요"가 `minMaintenanceDays`, `maxDowntimeDays`, `excludeMethods`, 언어로. 필터 함수는 이미 있다 |
| 주기와 방한 일정 불일치, 대체 시술, 연간 방한 플랜 | WP6 `schedule` | 린 시나리오. 필터의 `visitGapDays`가 감지 부분. 대체 추천과 플랜은 없음 |
| 상담 우선 예약, 질문 리스트 | WP3, WP6 | 그레이스 시나리오. 새 A2A 스킬이 필요한지 결정 |
| 시술 필터를 A2A 스킬로 | WP4 | 03에 스킬이 없다. `platform.recipe` 확장 또는 새 스킬 |
| 후기 검색과 요약 | 보류 | 7절 결정 8 |

## 7. 열린 결정

각 항목에 권하는 안을 적었다. 결정자는 오너 또는 gorany님.

| # | 질문 | 권하는 안 |
| --- | --- | --- |
| 1 | **시드 숫자의 기준.** 07의 판정 기준 케이스와 06의 시드 표는 리쥬란, 서울글로우·민트·아라 기준이다. `DEMO.md`는 쥬베룩 볼륨, 홍대 A·강남 B·명동 C에 가격 일부가 "○○만"(리투오)이다 | `DEMO.md` 기준으로 새로 만든다. 빈 숫자는 기획자에게 받거나 "데모용 값"으로 표시해 넣고, 07의 테스트 케이스 4행은 새 시드로 다시 계산해 갱신한다 |
| 2 | **07 갱신.** 지역 하드 필터와 적합도의 지역 요소 제거, 후보 3곳, 점수 재가중 | 오너가 07을 고치거나 BUILD-LOG 12를 근거로 구현 세션이 07 갱신안을 먼저 제출한다 |
| 3 | **ZK 레이어와 컴플라이언스.** ZK 서버의 `/api/ranking`은 병원 순위와 후기를 공개한다. [08](spec/08-compliance.md) 3절은 병원 순위·추천과 후기를 공개 페이지로 노출하지 않고 로그인 고객의 1:1 응답으로만 보이게 하라고 한다 | 순위와 후기 공개를 끄거나 로그인 뒤 1:1 응답으로 제한한다. ZK의 증명과 익명 후기 자체는 살리고, 후기는 플랫폼 결과 수집 경로(`Outcome`)에 신호로만 들어가게 한다 |
| 4 | **제품 마스터.** 병원이 넣는 "제품"(브랜드, 국산·수입, 허가 여부)의 정의가 없다. `MenuItem.product`는 자유 문자열이다 | 최소 `Product { procedureId, brand, origin }`(`origin`은 `domestic` 또는 `import`)를 도입하고 허가 여부는 의료진 검수 전까지 비운다 |
| 5 | **영속화와 배포.** 메모리 저장소는 서버리스에서 인스턴스 사이에 공유되지 않는다. 지금 Vercel 배포본은 목데이터 UI다 | 발표는 데모 맥에서 `npm run build && npm start` 단일 프로세스. 같은 `Store` 인터페이스로 Postgres 구현을 따로 만든다(WP8) |
| 6 | **시술 id 체계.** 03, 06과 픽스처의 `rejuran_healer` 같은 제품 단위 id와 마스터의 `rejuran` | 마스터 id를 정본으로 하고 제품은 `product` 필드로 분리한다. 03, 06 예시와 `lib/a2a/__fixtures__/wire.ts`를 함께 갱신 |
| 7 | **일본어, 중국어 문구 검수.** 체류 연장 안내 등 템플릿이 있다 | 원어민 확인 |
| 8 | **후기 요약과 사용자 수 표시.** `DEMO.md`의 "받은 사용자 수", "후기 요약"은 08의 후기 비공개 규정과 부딪힐 수 있다 | 1:1 응답 안의 집계 수치로 제한하고, 후기 원문 노출과 효과 오인 표현은 만들지 않는다. 법무 확인 전까지 보류 |
| 9 | **포인트 보상.** `DEMO.md` 유키 시나리오의 "기록하면 포인트"는 08이 "결과 제출에 보상을 걸지 않는다"고 한 것과 정면 충돌한다(대가를 받은 후기는 광고로 남는다) | 포인트는 구현하지 않는다. 데모 문구를 기획자와 조율 |
| 10 | **테스트 위치.** 스펙은 `tests/`, 구현은 코드 옆 `*.test.ts` | 코드 옆으로 통일하고 BUILD-LOG에 적는다 |

## 8. 이미 겪은 시행착오와 함정

- **통합 대상이 계속 움직인다.** 같은 브랜치를 몇 분 간격으로 합쳐도 결과가 달라진 적이 있다(프론트 세션이 계속 커밋한다). 합치기 전에 임시 worktree에서 먼저 시험한다.
- **처음부터 통과하는 테스트를 믿지 않는다.** 구현에 일부러 버그를 넣어 테스트가 실패하는지 본다. 필수 필드 테스트가 스키마 자신에게 필수 여부를 물어 "필수가 선택으로 바뀌어도" 통과한 적이 있어, 03 문서 기준의 필수 목록을 테스트에 손으로 적었다. 정렬 테스트에서 문자열 순서와 실제 시각 순서가 우연히 같은 값을 써서 변이를 놓친 적도 있다.
- **파일 쓰기 훅이 엠대시, 엔대시, 이모지가 들어간 내용을 막는다.** 정규식과 테스트 데이터에서도 마찬가지다. `scripts/check-tokens.mjs`처럼 `String.fromCodePoint`로 조립한다.
- **셸 함정.** macOS의 `sed`는 GNU 문법(`0,/pat/`)을 못 쓴다. zsh에서 `echo =====`는 에러다.
- **Vercel 프로젝트를 못 찾았다고 잘못 보고한 적이 있다.** 프로젝트는 `ironact-projects/jongro3ga`이고 원본이 아니라 포크 `makim-414/jongro3ga`에 연결돼 있다. 두 팀(`mark-2`, `ironact-projects`)을 모두 올바른 키워드로 검색해야 한다.
- **문서끼리 충돌한다.** 스펙 06은 출국 전 다운타임 미종료를 경고만 하라고 하고 기획서 8-8은 제외하라고 한다. 하나로 정해 BUILD-LOG에 적었다(14).
- **`"수일"`처럼 숫자가 없는 값**은 마스터에서 2~5일로 읽었다. 값 변환 규칙은 `lib/domain/procedure.ts` 맨 위에 적혀 있다.
- **SDK 내부 타입과 와이어 JSON이 다르다.** `AgentExecutor` 안에서는 SDK 타입, `client.ts`에서는 와이어 JSON을 쓰고 섞지 않는다. 그 밖의 SDK 함정 5개는 [09](spec/09-architecture.md)에 있다. 이 세션에서는 SDK를 아직 한 번도 설치하지 않았으므로 설치 후 `node_modules/@a2a-js/sdk` 타입 정의로 먼저 확인한다.
- **Next.js 16은 학습 데이터와 다르다.** 라우트 핸들러를 쓰기 전에 `node_modules/next/dist/docs/`를 읽는다(`AGENTS.md`).
- **프로토콜 식별자와 브랜드를 섞지 않는다.** `pibu/*@1`, `pibu.app`, `pibuBearer`는 버전이 붙은 와이어 이름이라 브랜드 변경(`PibooK`)에서 제외했다.
- **빌드 환경.** CI는 Node 22, Vercel 프로젝트는 24.x다. 로컬 빌드는 22에서 확인했다.

## 9. 작업 방식과 제약

- 병렬 작업은 `git worktree`로만 한다. 저장소 디렉터리 복제 금지.
- 커밋은 논리 단위로, 영어 Conventional Commits. 이름 변경과 동작 변경, 인프라와 기능을 섞지 않는다. 스테이징은 파일명을 명시한다(`git add -A`, `git add .` 금지).
- `main` 직접 푸시, 강제 푸시 금지. 배포는 PR과 머지, 포크 동기화, Vercel 자동 배포로만.
- 비밀값(API 키, JWK, 토큰 비밀)은 코드, 문서, 커밋에 쓰지 않는다. `.env`는 커밋하지 않는다.
- UI는 `app/globals.css` 토큰만 쓴다. 하드코딩 색과 간격, 이모지, 엠·엔대시, 틴트 알약 배지 금지. `prebuild`가 검사한다.
- 컴플라이언스: 한국인과 국내 거주 외국인은 매칭과 예약에서 제외, 진단과 권유 금지, 안전 정보는 예약 요청 시 동의한 범위만 병원에 전달, 병원끼리 우열 문구 금지, 후기 비공개와 보상 없음. 상세 [08](spec/08-compliance.md).
- 에이전트 모듈끼리 직접 import 금지. 저장소는 자기 네임스페이스만 쓴다.
- 스펙 문서(00 부터 10)는 고치지 않는다. 다르면 BUILD-LOG에 적고 가장 보수적인 해석으로 진행한다.
- 같은 에러가 3번 반복되면 우회하지 말고 상황을 BUILD-LOG에 적고 사람에게 넘긴다.
- 보고는 한국어, 코드와 식별자와 커밋 메시지는 영어.

## 10. 시작하기

### 10.1 확인 (현재 기준 기대값)

```bash
npm ci
npm run typecheck                      # 에러 0
npm test                               # 9 files, 128 tests passed
npm run build                          # prebuild 가드 4종 통과 후 빌드 성공
node scripts/verify-spec.mjs all       # 6개 검증 통과
```

### 10.2 Claude에게 줄 첫 프롬프트

```
docs/HANDOFF-backend-a2a.md를 처음부터 끝까지 읽고, docs/spec/09-architecture.md의
"SDK 함정"과 docs/spec/03-a2a-protocol.md를 읽어. 그다음 worktree를 새로 만들어
WP0부터 진행해. 각 묶음은 끝날 때 npm run gate를 통과시키고 논리 단위로 커밋해.
스펙과 다르면 docs/spec/BUILD-LOG.md에 적고, 7절의 열린 결정은 내가 답하기 전까지
권하는 안으로 진행하되 어떤 안으로 갔는지 보고에 적어.
```

### 10.3 나눠서 맡기는 순서

1. 세션 A: WP0, WP2. 끝나면 `app/a2a/**`가 SendMessage 요청에 답하는 상태에서 멈추고 보고.
2. 그 뒤 병렬: 세션 B는 WP3(병원), 세션 C는 WP4(플랫폼), 세션 D는 WP5와 WP6(LLM, 고객). 서로의 스킬을 A2A로 부르므로 통합 테스트는 A 이후에 한다.
3. 세션 E: WP7(화면 연결)은 화면 세션과 화면 단위로 합의하며 진행.
4. WP1(시드)은 7절 결정 1이 나는 대로 B, C가 쓰기 시작하기 전에 끝낸다.

## 11. 참고 문서

- [DEMO.md](../DEMO.md): 4개 시나리오 스크립트(데모 기준)
- [PLANNING.md](../PLANNING.md): 기획서, 부록 A 시술 데이터
- [BUILD-LOG](spec/BUILD-LOG.md): 스펙과 구현의 차이, 결정 기록 (행 3, 10부터 16이 이번 세션 내용)
- [DEPLOY](DEPLOY.md), [INTEGRATION](INTEGRATION.md): 배포와 ZK 연동
- 스펙 [00](spec/00-overview.md) 부터 [10](spec/10-build-plan.md)
