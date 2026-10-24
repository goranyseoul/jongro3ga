# BUILD-LOG

빌드 중 발견한 스펙과 현실의 차이, 결정, 막힌 지점을 적는다. 스펙 문서(00~10)는 고치지 않는다.

## 스펙 이슈 (통합 시점 2026-10-24 13:20 KST, `feat/integration`)

| # | 영역 | 스펙 | 현재 코드 | 채택한 해석 / 다음 할 일 |
| --- | --- | --- | --- | --- |
| 1 | 스타일 | Tailwind v4, `@theme` 토큰 (09) | Tailwind 3.4 + `tailwind.config.ts`가 `globals.css` 변수를 매핑 (앱 스캐폴드 세션) | 토큰 단일 출처(`globals.css`)라는 목적은 같아서 3.4 유지. 스펙 09의 v4 문구는 현실과 다름 |
| 2 | 컴포넌트 카탈로그 | `/demo/ui` (10 T01) | `/ui-kit` | `/ui-kit` 유지 |
| 3 | 브랜드 | Pibu | **결정됨 (2026-10-24, 오너): 화면에 보이는 이름은 전부 `PibooK`, 하이픈 없음, 한글은 `피북`.** 로고 마크 `app/icon.svg`(PK 모노그램), 공유 이미지, 스플래시의 K 강조 모션. `scripts/rename-brand.mjs`가 README, `PLANNING.md`, `DEMO.md`까지 옛 표기를 치환하고, `prebuild`가 옛 표기(`Pibuk`, `Pibu-k`, `PiBoo-K`)가 돌아오면 빌드를 실패시킴 | 프로토콜 식별자(`pibu/*@1` 스키마, `https://pibu.app/ext/*` 확장 URI, `pibuBearer`)와 코드 식별자(`PibuSchemaName` 등)는 스펙·메시지 규약과 맞추기 위해 유지. `docs/spec` 00~10은 이 문서 규칙대로 고치지 않아 아직 `Pibu` |
| 4 | 테마 | 무채색 코어 + `--brand` 1색 | 랜딩은 sunrise 그라데이션 라이트, 나머지는 다크 | 오너 결정 대기 |
| 5 | 의존성 | `@a2a-js/sdk`, `@anthropic-ai/sdk`, `jose`, `@playwright/test` (09) | 없음 | 에이전트 로직(T04~T08)을 붙이는 세션이 추가 |
| 6 | 백엔드 | `app/a2a/**`, `app/api/**`, `lib/agents/**`, `data/seed`, `lib/clock.ts` | 있음: `lib/store`, `lib/domain`(06 엔티티), `lib/a2a/{schemas,wire,mask,log}`, 시술 마스터 `data/seed/procedures.json`(27종), `lib/agents/platform/procedure-filter.ts`. 없음: `lib/clock.ts`, 병원·슬롯·가격 기록·결과 시드, `lib/a2a/{auth,cards,server,client}`, 에이전트 3종, `app/a2a/**`, `app/api/**` | T03 나머지와 T04~T08 담당 세션 필요. 시드 날짜와 07 판정은 스펙 갱신까지 보류 중 (백엔드 세션 `2-backend`) |
| 7 | 화면 데이터 | 스펙 06 필드명 | `lib/ui-data/*` 목데이터, `lib/domain`의 일부 타입만 import | 백엔드 연결 때 어댑터만 교체 |
| 8 | 온보딩 라우트 | `/[locale]/onboarding` 별도 화면 (05) | 랜딩이 곧 온보딩 채팅, `/[locale]/onboarding`은 랜딩으로 이동 | 앱 스캐폴드 세션 결정 채택 |
| 9 | ZK 레이어 | 스펙에 없음 | 팀원 `feat/zk-record-registry`를 `glowpass/`·`zk/`·`chain/`으로 통합 | 연동 방식은 [docs/INTEGRATION.md](../INTEGRATION.md). 스펙 반영은 별도 결정 |
| 10 | 시술 마스터 | 06 `Procedure`: 6종, 제품 단위 id (`rejuran_healer` 등) | `PLANNING.md` 부록 A 27종, 시술 단위 id (`rejuran` 등)로 교체. `lib/domain/procedure.ts`, `data/seed/procedures.json` | 03 예시와 06의 제품 단위 id는 마스터에 없다. 와이어 `procedureId`는 자유 문자열이라 동작은 깨지지 않지만 id 체계는 스펙 갱신 때 하나로 정해야 함. 값은 참고용 일반값이라 `verified: false` |
| 11 | 단위 | `Unit` = cc, shot, unit, line, session | `vial` 추가 (`lib/domain/common.ts`, `UnitSchema`) | 부록 A가 쥬베룩과 스컬트라를 바이알로 표기. 06 갱신 필요 |
| 12 | 지역 | 07 2절: 지역 하드 필터와 적합도 점수, 03: 후보 최대 5곳 | 오너 의견(2026-10-24): 지역은 조건이 아니라 위치 정보, 옵션은 3곳. 코드는 `areas`가 선택 필드이고 후보 상한 5라서 그대로 호환 | 07 갱신 필요: 지역 필터 제거, 적합도 재가중, 후보 3곳. 10의 데모 3행(한빛·다혜를 지역 필터로 제외)과 T06 수용 기준은 재계산 |
| 13 | 데모 기준 | 10: Yuki 리쥬란 11/13~15, 서울글로우·민트·아라, 기준일 2026-11-12 | **결정됨 (2026-10-24, 오너 위임): `DEMO.md`가 데모 기준.** 말이 되는지 검증해 정한 것: (1) 데모 시계는 하나, `2026-10-24T10:00+09:00`(토). 오늘이라 발표일과 맞고 지수 메모 사진의 저장일과 같고 병원 콘솔이 이미 쓰는 값. (2) 이 시계로는 유키(10/11~13)와 그레이스(10/20~27)가 과거라서 요일을 유지한 채 +28일: 유키 11/8(일)~11/10(화), 첫 시술 11/10, 2회차 12/10. 그레이스 11/17(화)~11/24(화), 상담 11/18 14:00. 지수와 린은 그대로. (3) 유키 2회차는 원문(10/13 다음 11/13)이 30일 규칙이면 11/12로 하루 어긋났는데, 이동 후에는 12/10으로 30일 규칙과 달력 한 달이 일치. (4) 지수 리쥬란 다음 시기는 30일 규칙 12/10~1/9, 달력 3~4개월 12/11~1/11로 원문 "12월 중순~1월 중순"과 1~2일 차이. 스케줄 구현 때는 달력 월 계산을 쓴다 | `DEMO.md`의 유키·그레이스 날짜를 위 값으로 고쳐야 함(기획자 문서라 아직 안 고침). 병원 시드는 `DEMO.md`의 가상 병원으로 새로 만들어야 함 |
| 14 | 다운타임과 출국일 | 06: 출국 전 다운타임 미종료는 경고만. `PLANNING.md` 8-8: 제외 | **결정됨 (2026-10-24, 오너): 출국일을 넘으면 체류 연장이 가능한지 확인하라고 안내.** 필터는 가장 빠른 경우(도착일 시술, 최소 다운타임)에도 안 끝나면 제외하고 `extendDays`(연장해야 가능한 날수)를, 최대값 기준으로만 겹치면 경고와 `daysOver`를 돌려줌. `lib/agents/platform/procedure-filter-copy.ts`가 ko, ja, en, zh-CN 문장으로 바꿈 | 일본어와 중국어 문구는 원어민 검수 필요 |
| 15 | 시술 필터 | 스펙 02, 03, 07에 없음 (`PLANNING.md` 8-8 신규) | `lib/agents/platform/procedure-filter.ts`: 영역 40, 부위 20, 한국 여성 선택률 20, 예산 10, 통증 10 | 선택률 데이터(`kr-patterns`)는 아직 없어 호출자가 함수로 주입. 03에 해당 A2A 스킬이 없음: `platform.recipe`를 확장할지 새 스킬로 둘지 결정 필요 |
| 16 | 데모 시계 | 09: `lib/clock.ts` 하나, `DEMO_NOW` | `lib/clock.ts` 구현 완료(기본 2026-10-24T10:00+09:00). 화면 쪽 상수는 아직 따로: 고객 `DEMO_TODAY` 2026-11-12, 운영 `OPS_TODAY` 2026-11-12, 병원 `TODAY` 2026-10-24 | UI 세션이 세 상수를 `clock`과 같은 값으로 맞추고, 목데이터를 `DEMO.md` 시나리오(유키 쥬베룩 볼륨, 지수 메모장, 그레이스, 린)와 가상 병원으로 바꿔야 함. 지금 화면의 목데이터는 스펙 10의 리쥬란 데모 기준 |

## 통합 기록

- `main`(스펙) 위에 `feat/app-scaffold` → `feat/ui-customer` → `feat/ui-clinic` → `feat/ui-ops` → `feat/backend-skeleton` → `origin/feat/zk-record-registry` 순서로 머지. `feat/mvp-build`(스캐폴드 중복)는 제외.
- 충돌 해소: 랜딩·권익 안내·온보딩은 앱 스캐폴드 쪽(최신, 오너 지시 반영) 채택 후 고객 세션의 온보딩 완료 버튼·데모 날짜 고정을 다시 적용. `package.json`은 양쪽 의존성 합집합. README는 양쪽 절 유지.
- 팀원 GlowPass 서버는 `app/`(Next.js App Router 디렉토리와 충돌)에서 `glowpass/`로 이동. 경로가 `import.meta.url` 기준이라 동작 동일.
- 2026-10-24 재통합 (`feat/integration-r2`): `feat/integration-2` 위에 BUILD-LOG 기록, `feat/backend-skeleton` 최신(시술 마스터, 시술 필터, 데모 시계, 체류 연장 안내), `origin/main`(배포 메모), 브랜드 치환(`PibooK`)과 옛 표기 가드를 얹음. 게이트: typecheck, test, build, `verify-spec all`, 전 경로 스모크.

## 릴리스 브랜치 `feat/release` (2026-10-24 오후)

`feat/integration` 위에 올린 배포 후보. 같은 날 부분 브랜치에 생긴 커밋과 오너 지시를 반영했다.

- 머지: `feat/app-scaffold`(랜딩 히어로 2건, 충돌은 온보딩 파일의 가입 시트와 임포트 한 곳), `feat/backend-skeleton`(시술 마스터 27종, 플랫폼 시술 필터). 아직 커밋되지 않은 부분 세션 작업(앱 스캐폴드의 히어로 수정, 백엔드의 `lib/agents`와 `data/`)은 넣지 않았다.
- 가입: 랜딩의 [회원가입]을 누르면 로그인 블록이 가운데 모달로 열린다 (`components/customer/auth-dialog.tsx`). 이메일, 비밀번호, 가입 버튼, Google 버튼, 로그인 전환 링크, 데모 계정. 계정 백엔드가 없어서 모든 경로는 채팅 시작으로 이어진다. 디자인은 오너가 준 shadcn Login 블록의 구조를 따르되, 이 리포는 shadcn이 아니라서 기존 `components/ui`와 토큰으로 다시 만들었다. 의존성은 `react-icons`(Google 아이콘) 하나만 추가.
- 기본 언어: `/`는 항상 `/en`으로 간다 (오너 지시). 브라우저 언어 감지(04 문서)는 일부러 껐다. 되돌리려면 이전 `app/page.tsx`의 `pickLocale()`을 복원한다.
- 접근성: 푸터 언어 링크 폭을 44px로 맞췄다.
- 알려진 남은 것: 병원 콘솔 `/clinic/inbox` 데스크톱 폭의 체크박스 20px (병원 콘솔 세션 영역). 채팅 입력창은 바 전체가 터치 영역이다.
- 검사: CI와 같은 순서(`npm ci`, `typecheck`, `test` 112개, `build`와 가드 3종, `verify-spec`) 통과. 55개 라우트를 3개 폭으로 연 브라우저 검사에서 pageerror 0, 가로 넘침 0.

## 트랙 A2A (A2A 코어 · 플랫폼 에이전트 · 시드, `feat/track-a2a`, 2026-10-24)

| # | 영역 | 스펙 | 구현 | 이유 / 다른 트랙이 알 것 |
| --- | --- | --- | --- | --- |
| A1 | A2A 서버 | 09: SDK `DefaultRequestHandler` + `InMemoryTaskStore` + `JsonRpcTransportHandler` | **SDK를 쓰지 않고 스펙 준수 핸들러를 직접 구현** (`lib/a2a/server.ts`). `@a2a-js/sdk` 1.3.0의 d.ts를 읽고 판단 | SDK는 태스크와 blocking 대기를 프로세스 메모리(`InMemoryTaskStore`, `ExecutionEventBus`)에 두어 서버리스 인스턴스 사이 `GetTask` 폴링이 깨지고, 실행기 안에서 SDK 내부 타입(`$case` Part, 숫자 상태)을 써야 하며, `-32602` 라우팅 실패를 태스크 생성 전에 답하기 어렵다. 직접 구현은 와이어 JSON만 다루고 태스크를 `getStore()`에 둔다. 메서드는 `SendMessage`, `GetTask`, `CancelTask`. 스트리밍·푸시·`ListTasks`는 `-32004` |
| A2 | 태스크 저장 | 09 함정 4: 에이전트별 `InMemoryTaskStore` | `shared` 네임스페이스 `a2a_tasks` 컬렉션 (`lib/a2a/tasks.ts`). 레코드마다 `owner`(답하는 에이전트)와 `caller`(토큰의 호출자) 저장 | AUTH가 Postgres 저장소를 붙이면 인스턴스 사이에서도 폴링이 동작. 다른 호출자의 태스크는 `-32001`(존재 여부도 숨김). 나중 완료는 `taskCompleter.complete(self, taskId, result)`: `self`가 owner가 아니면 throw, terminal이면 throw |
| A3 | 로그 중복 | 10 T04: rpc 라우트에 직접 POST하면 `A2ALogEntry` 1건. 09: 클라이언트가 모든 호출 기록 | 서버와 클라이언트가 **같은 id**로 기록한다. 클라이언트가 `Pibu-Log-Id` 헤더로 id를 보내고, 서버가 그 id로 먼저 쓰고, 클라이언트가 같은 id로 덮어쓴다 | 같은 프로세스에서도 호출 1건 = 로그 1건. 외부에서 직접 POST해도 서버 기록 1건이 남는다. 시간초과·JSON-RPC 에러도 기록 (`response.error`) |
| A4 | 에러 코드 | 03: `-32602`만 명시 | 토큰 없음·무효 HTTP 401 + `-32010`, 역할 불가 HTTP 403 + `-32011` (둘 다 JSON-RPC 서버 범위의 구현 정의 코드, A2A의 -32001~-32009와 겹치지 않음). `A2A-Version` 헤더 없음 또는 1.0 아님 `-32009`(헤더 없음은 0.3으로 읽는다는 A2A 규칙). terminal 태스크에 이어 보내기 `-32004`, 취소 불가 `-32002`, 파싱 실패 `-32700` | 다른 트랙은 `lib/a2a/client.ts`만 쓰면 헤더가 자동으로 붙는다. 에러는 `A2AError { code, data, httpStatus }`, 시간초과는 `A2ATimeoutError` |
| A5 | 호출자 역할 | 03: 병원 토큰으로 `customer.checkin` 거절 | `ALLOWED_CALLERS` 표 (`server.ts`): recipe·match·judge·submit_outcome·report_signal은 customer, report_booking은 clinic, clinic.offers는 platform·customer, clinic.availability는 customer·platform, quote·book·cancel은 customer, customer.notify는 clinic·platform, customer.checkin은 platform | 역할은 토큰에서만 읽는다. 스킬 안에서도 다시 검사 (예: submit_outcome은 예약의 customerAgentId와 토큰 sub 비교) |
| A6 | returnImmediately | 03: false면 terminal 또는 interrupted까지 응답 보류 | false면 핸들러 실행 후 상태가 WORKING이면 저장소를 250ms 간격으로 보며 최대 `A2A_BLOCKING_WAIT_MS`(기본 15초, 클라이언트 20초 제한보다 짧게) 기다린 뒤 현재 상태로 답한다. true면 핸들러가 돌려준 상태로 즉시 답한다 | 무한 대기는 서버리스에서 불가능해서 상한을 뒀다. `clinic.book`, `customer.checkin`은 클라이언트가 항상 true로 보낸다 (`buildSendMessageRequest`) |
| A7 | 시계와 시드 날짜 | 06: 시드는 기준일 2026-11-12로 생성 | **시드는 실제 시계 `lib/clock.ts` DEFAULT_DEMO_NOW 2026-10-24에 맞추되, 06 기준일 2026-11-12에서도 같은 결과가 나오는 날짜만 썼다.** 리쥬란 표본 42건 2026-07-16~10-22 (두 시계 모두 120일 안), 아라 JP 결과 4건 2026-08-16~09-20 (두 시계 모두 31~90일 전), 민트 1cc 이벤트 2026-10-01~11-30 (06의 11-01~11-30이면 10-24에 이벤트가 없어 민트가 견적을 거절), 슬롯 2026-10-26~11-30 매일 4개 (06은 11-10~11-30), `cus_yuki_done` 체류 2026-11-08~11-10 (BUILD-LOG 13의 +28일 이동, 06은 11-13~11-15) | 다른 트랙 테스트가 어느 시계를 고정해도 n = 42, 아라 플래그, 민트 이벤트가 유지된다. `data/seed/seed.test.ts`가 두 시계 모두 검사 |
| A8 | 시술 id | 03·06 예시 `rejuran_healer` | 시드와 판정은 마스터 id `rejuran` (제품명은 `product: "Rejuran Healer"`) | HANDOFF 7절 결정 6 권하는 안. 와이어 픽스처(`lib/a2a/__fixtures__/wire.ts`)는 그대로 둠 |
| A9 | 통상 용량 | 07: n < 10이면 시술 마스터 `typicalAmount` | 27종 마스터에 `typicalAmount`가 없어 `fairness.ts`의 `FALLBACK_TYPICAL_AMOUNT`(리쥬란 2~3cc 등, 데모용 값) 사용. 모르는 시술은 견적 용량을 통상으로 봐 `within` | 마스터에 필드가 생기면 그쪽으로 교체 |
| A10 | 이상치 신호 | 07: 이상치는 표본에서 빼고 `Signal`로 남김 | 표본에서만 뺀다. `Signal.kind`에 이상치 종류가 없고 `lib/domain`은 공통 파일이라 추가하지 않았다 | 시드에는 이상치가 없다. 종류 추가는 계약 변경 요청 |
| A11 | 제품 필터 | 07: 견적에 product가 있으면 같은 제품 표본으로 한 번 더 거름 | `pibu/judge-request@1`의 quotes에 product 필드가 없어 적용 불가 (`buildSample`은 product 인자를 받을 수 있게 둠) | 스키마에 product가 생기면 연결 |
| A12 | 매칭 세부 | 07 2절 | 지역 하드 필터와 후보 상한 5는 07 그대로 (BUILD-LOG 12의 3곳·지역 제거는 07 갱신 전이라 미적용, 유키는 어차피 3곳). 07에 없는 세부: 요청 지역이 비면 지역 점수 1.0, 결과·신뢰성은 그 병원의 전체 결과, 시간초과 비율 = `response_timeout` 신호 수 / 과거 shortlist 등장 횟수, `priceReference`는 요청 첫 지역의 그룹(n < 5면 seoul), 점수는 소수 4자리로 정렬 후 출력 2자리, `filtered`는 clinicId 순 | 유키 요청: 서울글로우 0.79, 민트 0.66, 아라 0.66 순 (규칙 전 0.7946 · 0.6630 · 0.6628), `appliedRuleIds = []`, 한빛(지역)·다혜(일본어 app_translation만) 제외 |
| A13 | 병원 라우트 세그먼트 | 03: `/a2a/clinics/{slug}` | slug(`mint`)와 clinic id(`cln_mint`) 둘 다 받는다. 라우트가 clinic id로 바꿔 `definition.exists/card(clinicId)`와 `SkillContext.self.agentId`에 넘긴다 | `cardUrl(base, { role: "clinic", agentId: "cln_mint" })`가 만드는 id 경로도 동작. CLINIC 트랙의 정의는 clinic id 기준으로 구현하면 된다 |
| A14 | 유치 귀속 | 03: 추천 토큰 72시간 | `platform.report_booking`은 서명·aud·sub만 보고 만료는 허용 (`verifyReferralTokenForAttribution`) | 병원이 유효할 때 받은 토큰이므로 확정 보고가 늦어도 귀속한다. 견적·예약 검증은 만료를 거절하는 `verifyReferralToken` |
| A15 | 결과 제출 | 07 3절 | 귀속(report_booking)이 먼저 있어야 받는다. 없으면 REJECTED. 재제출은 같은 Outcome id로 덮어쓰고 이전 값은 `platform/outcome_history`. PriceRecord는 예약당 1건(`pr_<bookingId>`), 신호 id는 `sig_<outcomeId>_<kind>`라 재제출에 중복되지 않는다. 견적가는 `JudgedQuote`(matchId + clinicId), 없으면 예약의 priceKrw | |
| A16 | 비밀값 | 09 env | `A2A_TOKEN_SECRET`(32자 이상), `REFERRAL_PRIVATE_JWK`/`REFERRAL_PUBLIC_JWK`가 없으면 `DEMO_MODE=true`에서만 프로세스별 랜덤 비밀·키쌍을 만든다. 아니면 에러 | 여러 인스턴스 배포에서는 env 필수 (인스턴스마다 키가 다르면 토큰 검증 실패) |
| A17 | 저장소 컬렉션 | 06에 이름 없음 | `data/seed/load.ts`의 `SEED_COLLECTIONS`가 정본. platform: `clinic_registry, price_records, outcomes, outcome_history, rules, signals, match_logs, attributions, judged_quotes, offer_cache` · clinic: `profiles, menu_items, offers, slot_policies(id = clinicId), slots` · customer: `accounts, profiles, consents, records` · shared: `a2a_log, a2a_tasks, meta` | `ensureSeeded(store)`가 `shared/meta/seed` 표식이 없을 때 한 번 시드한다. A2A 라우트가 매 요청 호출. 데모 리셋은 `resetStore()` 후 다음 요청에서 다시 시드되거나 `loadSeed` 직접 호출 |
| A18 | 시드 파일 | 06 시드 표 | `clinics.json`(레지스트리+프로필+메뉴+오퍼+슬롯 정책, 실명·실주소 없음), `slots.json`(규칙만 적고 로더가 720개로 펼침), `price-records.json`(`scripts/gen-price-records.mjs`), `outcomes.json`·`outcomes-ara-burst.json`(`scripts/gen-outcomes.mjs`, 버스트는 `araBurstOutcomes(clock.now())`로 날짜 계산), `customers.json`, `rules.json`, `fx.json`(데모용 고정 환율) | 생성 스크립트는 `--check`로 파일이 최신인지 검사 (seed 테스트가 실행). 명동 리쥬란 14건은 p75 204,000 < 210,000 <= p90 211,800이 되게 만들어, 07 표의 한빛(2cc 420,000) `high`가 고정 표본뿐 아니라 실제 시드 판정에서도 나온다 |
| A19 | 테스트 위치·별칭 | | 테스트는 코드 옆 `*.test.ts`. vitest 설정이 없어 `@/` 별칭이 테스트에서 풀리지 않으므로 이 트랙 파일은 상대 경로 import | `vitest.config.ts`에 `@` 별칭 추가를 오케스트레이터에 요청 |
