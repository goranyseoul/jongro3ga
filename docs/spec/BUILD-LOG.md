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
| 9 | ZK 레이어 | 스펙에 없음 | 팀원 `feat/zk-record-registry`를 `glowpass/`·`zk/`·`chain/`으로 통합 | 연동 방식은 [docs/INTEGRATION.md](../INTEGRATION.md). **스펙 반영 완료 (2026-10-24)**: 02, 03, 05, 06, 07, 08, 09, 10에 ZK 확장 (INTEGRATION.md가 설계 출처) |
| 10 | 시술 마스터 | 06 `Procedure`: 6종, 제품 단위 id (`rejuran_healer` 등) | `PLANNING.md` 부록 A 27종, 시술 단위 id (`rejuran` 등)로 교체. `lib/domain/procedure.ts`, `data/seed/procedures.json`. 정렬 후: 스펙 6종과 겹치는 항목은 스펙 id, 나머지는 시술 단위 id (`juvelook_eye` 등) | 03 예시와 06의 제품 단위 id가 마스터에 없었다(와이어 `procedureId`는 자유 문자열이라 동작은 깨지지 않았음). **결정됨 (2026-10-24, 오너: 정본은 스펙): 스펙 6종 id로 마스터 id 정렬** (`rejuran` → `rejuran_healer`, `thermage` → `thermage_flx`, `shrink` → `shrink_universe`, `botox_wrinkle` → `botox_forehead`, `juvelook` → `skin_booster_juvelook` 5건, `ulthera`는 그대로, 이름·값은 안 바꿈). 나머지 21종 id 유지. 병원 콘솔 목데이터의 `shurink_universe`도 `shrink_universe`로 맞춤. 값은 참고용 일반값이라 `verified: false` |
| 11 | 단위 | `Unit` = cc, shot, unit, line, session | `vial` 추가 (`lib/domain/common.ts`, `UnitSchema`) | 부록 A가 쥬베룩과 스컬트라를 바이알로 표기. 06 갱신 필요 |
| 12 | 지역 | 07 2절: 지역 하드 필터와 적합도 점수, 03: 후보 최대 5곳 | 오너 의견(2026-10-24): 지역은 조건이 아니라 위치 정보, 옵션은 3곳. 코드는 `areas`가 선택 필드이고 후보 상한 5라서 그대로 호환 | **결정됨 (2026-10-24 14:27 KST, 오너): 지역은 위치 정보, 후보 3곳.** 07 2절 하드 필터에서 지역 삭제, 적합도는 언어만, 상위 3곳. 유키 데모는 언어 필터로 같은 3곳이라 10의 데모 3행 설명만 수정 |
| 13 | 데모 기준 | 10: Yuki 리쥬란 11/13~15, 서울글로우·민트·아라, 기준일 2026-11-12 | DEMO.md 기준 시절의 기록 (오른쪽 칸 끝의 오너 재결정으로 대체됨): **결정됨 (2026-10-24, 오너 위임): `DEMO.md`가 데모 기준.** 말이 되는지 검증해 정한 것: (1) 데모 시계는 하나, `2026-10-24T10:00+09:00`(토). 오늘이라 발표일과 맞고 지수 메모 사진의 저장일과 같고 병원 콘솔이 이미 쓰는 값. (2) 이 시계로는 유키(10/11~13)와 그레이스(10/20~27)가 과거라서 요일을 유지한 채 +28일: 유키 11/8(일)~11/10(화), 첫 시술 11/10, 2회차 12/10. 그레이스 11/17(화)~11/24(화), 상담 11/18 14:00. 지수와 린은 그대로. (3) 유키 2회차는 원문(10/13 다음 11/13)이 30일 규칙이면 11/12로 하루 어긋났는데, 이동 후에는 12/10으로 30일 규칙과 달력 한 달이 일치. (4) 지수 리쥬란 다음 시기는 30일 규칙 12/10~1/9, 달력 3~4개월 12/11~1/11로 원문 "12월 중순~1월 중순"과 1~2일 차이. 스케줄 구현 때는 달력 월 계산을 쓴다 | `DEMO.md`의 유키·그레이스 날짜를 위 값으로 고쳐야 함(기획자 문서라 아직 안 고침). 병원 시드는 `DEMO.md`의 가상 병원으로 새로 만들어야 함. **오너 재결정 2026-10-24: 정본은 docs/spec. DEMO.md는 기획 서사. 데모 데이터(시드·목데이터·ZK 카탈로그)는 스펙 id 기준**. 시계 기본값 `2026-11-12T10:00+09:00`(스펙 06)로 코드 반영 완료, 테스트 일정 재이동 (유키는 스펙 10의 11/13~11/15로 옮겨 기대 일수 그대로, 그레이스 11/17~11/24는 새 시계 뒤라 유지) |
| 14 | 다운타임과 출국일 | 06: 출국 전 다운타임 미종료는 경고만. `PLANNING.md` 8-8: 제외 | **결정됨 (2026-10-24, 오너): 출국일을 넘으면 체류 연장이 가능한지 확인하라고 안내.** 필터는 가장 빠른 경우(도착일 시술, 최소 다운타임)에도 안 끝나면 제외하고 `extendDays`(연장해야 가능한 날수)를, 최대값 기준으로만 겹치면 경고와 `daysOver`를 돌려줌. `lib/agents/platform/procedure-filter-copy.ts`가 ko, ja, en, zh-CN 문장으로 바꿈 | 일본어와 중국어 문구는 원어민 검수 필요 |
| 15 | 시술 필터 | 스펙 02, 03, 07에 없음 (`PLANNING.md` 8-8 신규) | `lib/agents/platform/procedure-filter.ts`: 영역 40, 부위 20, 한국 여성 선택률 20, 예산 10, 통증 10 | 선택률 데이터(`kr-patterns`)는 아직 없어 호출자가 함수로 주입. 03에 해당 A2A 스킬이 없음: `platform.recipe`를 확장할지 새 스킬로 둘지 결정 필요 |
| 16 | 데모 시계 | 09: `lib/clock.ts` 하나, `DEMO_NOW` | `lib/clock.ts` 구현 완료(기본 2026-11-12T10:00+09:00, 스펙 06). 화면 쪽 상수는 아직 따로지만 값은 같음: 고객 `DEMO_TODAY`, 운영 `OPS_TODAY`, 병원 `TODAY` 모두 2026-11-12. 병원 목데이터 날짜는 +19일 옮겨 오늘과의 간격 유지, 민트 첫 방문 1cc 이벤트는 스펙 06 기간(11-01~11-30) | 세 상수의 값은 `clock`과 맞춤. 상수를 `clock`에서 읽도록 묶는 일은 UI 세션 몫으로 남음. 목데이터는 스펙 10 데모 기준이라 그대로. **2026-10-24 재결정에 따라 UI 목데이터는 당분간 스펙 시나리오(리쥬란, 스펙 id) 그대로 둔다** |
| 17 | 후기 공개 | 08 38행·42행: 후기 비공개 | glowpass는 원문 공개 (11fe512에서 잠시 집계만으로 바뀌었다가 복원) | **결정됨 (2026-10-24 13:23 KST 오너, 14:18 재확인): 후기 공개.** 로그인 고객·비교 화면에 원문과 집계, 랜딩 제외, 익명 집합 3명 이상, 보상 없음. 같은 날 docs/spec-zk-extension이 '집계만'으로 적은 것은 서브에이전트의 보수적 해석이었고 오너 결정이 아니었음 |

## 통합 기록

- `main`(스펙) 위에 `feat/app-scaffold` → `feat/ui-customer` → `feat/ui-clinic` → `feat/ui-ops` → `feat/backend-skeleton` → `origin/feat/zk-record-registry` 순서로 머지. `feat/mvp-build`(스캐폴드 중복)는 제외.
- 충돌 해소: 랜딩·권익 안내·온보딩은 앱 스캐폴드 쪽(최신, 오너 지시 반영) 채택 후 고객 세션의 온보딩 완료 버튼·데모 날짜 고정을 다시 적용. `package.json`은 양쪽 의존성 합집합. README는 양쪽 절 유지.
- 팀원 GlowPass 서버는 `app/`(Next.js App Router 디렉토리와 충돌)에서 `glowpass/`로 이동. 경로가 `import.meta.url` 기준이라 동작 동일.
- 2026-10-24 재통합 (`feat/integration-r2`): `feat/integration-2` 위에 BUILD-LOG 기록, `feat/backend-skeleton` 최신(시술 마스터, 시술 필터, 데모 시계, 체류 연장 안내), `origin/main`(배포 메모), 브랜드 치환(`PibooK`)과 옛 표기 가드를 얹음. 게이트: typecheck, test, build, `verify-spec all`, 전 경로 스모크.

- 2026-10-24 스펙 개정 (`docs/spec-zk-extension`): ZK 기록 레이어를 스펙에 반영 (02, 03, 05, 06, 07, 08, 09, 10에 "ZK 확장": 새 스킬 `platform.anchor_record`·`platform.submit_review`, 확장 `zk-offer-proof/v1`, 스키마 3종, T16~T18). 시나리오·id의 정본은 docs/spec으로 재결정 (13행). 후기는 원문과 집계를 로그인 고객·비교 화면에 공개 (익명 집합 3명 이상, 오너 결정). 코드는 건드리지 않았다.

## 릴리스 브랜치 `feat/release` (2026-10-24 오후)

`feat/integration` 위에 올린 배포 후보. 같은 날 부분 브랜치에 생긴 커밋과 오너 지시를 반영했다.

- 머지: `feat/app-scaffold`(랜딩 히어로 2건, 충돌은 온보딩 파일의 가입 시트와 임포트 한 곳), `feat/backend-skeleton`(시술 마스터 27종, 플랫폼 시술 필터). 아직 커밋되지 않은 부분 세션 작업(앱 스캐폴드의 히어로 수정, 백엔드의 `lib/agents`와 `data/`)은 넣지 않았다.
- 가입: 랜딩의 [회원가입]을 누르면 로그인 블록이 가운데 모달로 열린다 (`components/customer/auth-dialog.tsx`). 이메일, 비밀번호, 가입 버튼, Google 버튼, 로그인 전환 링크, 데모 계정. 계정 백엔드가 없어서 모든 경로는 채팅 시작으로 이어진다. 디자인은 오너가 준 shadcn Login 블록의 구조를 따르되, 이 리포는 shadcn이 아니라서 기존 `components/ui`와 토큰으로 다시 만들었다. 의존성은 `react-icons`(Google 아이콘) 하나만 추가.
- 기본 언어: `/`는 항상 `/en`으로 간다 (오너 지시). 브라우저 언어 감지(04 문서)는 일부러 껐다. 되돌리려면 이전 `app/page.tsx`의 `pickLocale()`을 복원한다.
- 접근성: 푸터 언어 링크 폭을 44px로 맞췄다.
- 알려진 남은 것: 병원 콘솔 `/clinic/inbox` 데스크톱 폭의 체크박스 20px (병원 콘솔 세션 영역). 채팅 입력창은 바 전체가 터치 영역이다.
- 검사: CI와 같은 순서(`npm ci`, `typecheck`, `test` 112개, `build`와 가드 3종, `verify-spec`) 통과. 55개 라우트를 3개 폭으로 연 브라우저 검사에서 pageerror 0, 가로 넘침 0.

## 트랙 ZK

- GlowPass(`glowpass/**`)와 `zk/codes.json`을 팀원 `origin/feat/zk-record-registry` 최신(f8c0312, 스펙 id 정렬판)으로 맞췄다. 기준 브랜치에는 옛 가상 병원 판(`cln_hongdae_a` 등)이 들어 있었다. 팀원 파일에 한 변경은 `glowpass/wallet.mjs`의 `match-offers` 응답에 `procedureId` 추가 하나.
- `lib/zk`: GlowPass HTTP 클라이언트(타임아웃, 실패 시 `null`)와 PibooK 고객 id·고객 에이전트 id·병원 id → GlowPass id 표(`lib/zk/identity.ts`). `cus_jisoo`는 국내 거주라 표에서 뺐다.
- A2A 확장 `https://pibu.app/ext/zk-offer-proof/v1`: 증명은 `clinic.quote`의 `metadata.zkOfferProof`. 팀원 초안의 `metadata.offerProof` 봉투와 `EventSchema.zkClauses`·`offerApplied`는 `lib/a2a/schemas.ts`(공통, strict)를 바꿔야 해서 제안으로 남김. 할인 적용은 지금 스키마의 `event`로 표현. 상세: `docs/INTEGRATION.md` 3·4절.
- 스모크에서 찾은 것: 체인 기록이 없는 가명(유키·에밀리)은 온체인 commitment가 0이라 첫 방문 증명이 회로에서 실패한다 (`match-offers`는 `eligible: true`). 팀원 결정 필요. `docs/INTEGRATION.md` 7절.
## 트랙 CLINIC (2026-10-24, `feat/track-clinic`)

병원 에이전트(`lib/agents/clinic/**`)와 병원 콘솔 연결(`app/clinic/**`, `app/api/clinic/**`, `components/clinic/**`, `lib/ui-data/clinic.ts`).

| # | 영역 | 스펙 | 구현 | 이유 / 다른 트랙이 할 일 |
| --- | --- | --- | --- | --- |
| C1 | 병원 저장소 컬렉션 | 06: 엔티티 이름만 | 네임스페이스 `clinic`의 컬렉션: `profiles`, `operation`(카드 확장 params), `menu_items`, `offers`(+ `active`), `slot_policies`(id = 병원 id), `slots`, `bookings`, `tasks`, `quotes`. `CLINIC_COLLECTIONS`(`lib/agents/clinic/store.ts`) | A2A 트랙의 `loadSeed`는 `writeClinicSeed(store, seeds, slots)`(`lib/agents/clinic/seed.ts`)를 부르면 된다. 시드가 아직 없으면 `DEMO_MODE=true`에서만 06 시드 값(`fixtures.ts`)을 한 번 넣는다 |
| C2 | 시술 id | 06·03 예시는 `rejuran_healer`, 마스터는 `rejuran` (BUILD-LOG 10) | 픽스처는 06 값(`rejuran_healer`). 견적은 `procedureId` 문자열 일치로 고른다 | 시드와 고객 요청이 같은 id 체계를 써야 한다. 통일은 결정 6 이후 |
| C3 | 민트 메뉴 | 06: "1cc 이벤트만" | 이벤트(99,000, 정상가 150,000) + 같은 용량 정가 메뉴 1cc 150,000 | `Offer`에 `vatIncluded`, `product`, `includes`가 없어서 견적의 이 필드를 같은 시술·용량 메뉴에서 가져온다. 이벤트가 끝나면 정가 1cc로 답한다 |
| C4 | 카드 URL | 03: `/a2a/clinics/{slug}`, `cardUrl()`은 병원 id를 경로에 씀 | `card(agentId)`는 요청받은 경로 조각을 그대로 rpc URL에 쓰고, `exists`·`card`·스킬은 id와 slug를 모두 받는다 | 어느 쪽으로 불러도 그 카드의 rpc URL이 실제로 닿는다 |
| C5 | 추가 정보 요청 | 02: "추가 정보 필요 시 INPUT_REQUIRED" | `safetyInfo` 없이 온 `clinic.book`은 `INPUT_REQUIRED`(임신·수유, 알레르기). 콘솔의 [시간 제안]·[추가 정보 요청]도 `taskCompleter.complete`로 `INPUT_REQUIRED`를 써 넣고, 고객 답(`pibu/input-response@1`)을 받으면 다시 `WORKING` | `TaskCompleter.complete`를 종료 아닌 상태 전이에도 쓴다. A2A 코어 구현이 `INPUT_REQUIRED`와 `inputRequest`(status.message DataPart)를 받아야 한다 |
| C6 | 추천 토큰 검사 | 03: 서명·만료·aud | 더해서 `scope`(quote/book), `requestId` 일치, 견적은 `sub` = `customerAgentId` 일치. 검증 함수가 예외를 던지면 `FAILED` | 토큰은 요청 단위로 발급되므로 다른 요청에 재사용하면 거절 |
| C7 | ZK 오퍼 증명 | INTEGRATION 4절: `offerApplied` 필드 | `zkEnabled()`이고 `metadata.zkOfferProof`(번들 또는 `pibu/offer-proof@1` 래퍼)가 있을 때만 `verifyOffer` 후 `ok`면 이벤트가, 아니면 정가. ZK가 꺼져 있으면 동작 변화 없음 | `QuoteV1Schema`가 strict라 `offerApplied`를 넣지 못한다. 이벤트 유무가 할인 적용 여부. 필드가 필요하면 `lib/a2a/schemas.ts` 변경 요청 |
| C8 | 견적 유효기간 | 03 예시만 | 오늘 + 7일, 이벤트 종료일이 더 빠르면 종료일 | |
| C9 | 콘솔 되돌리기 | 목업: 확정 후 8초 되돌리기 | 제거 | 확정은 A2A 태스크 완료, 플랫폼 보고, 고객 알림까지 실제로 일어나서 되돌릴 수 없다 |
| C10 | 테스트 alias | | vitest 설정이 없어 `@/` alias가 테스트에서 안 풀린다. `lib/agents/clinic/**`는 상대 경로 import | 오케스트레이터가 `vitest.config.ts`(tsconfig paths)를 추가하면 다른 트랙도 편해진다 |
## 트랙 OPS (2026-10-24, `feat/track-ops`)

개선 루프(07 4절), 운영 API, 데모 컨트롤. 스펙과 다르거나 스펙이 정하지 않은 것만 적는다.

| # | 영역 | 스펙 | 구현 | 다음 할 일 |
| --- | --- | --- | --- | --- |
| O1 | 저장소 컬렉션 이름 | 06에 없음 | `platform`: `clinic_registry`, `outcomes`, `signals`, `routing_rules`, `routing_rule_history`, `match_logs`, `attributions`, `price_records` (`lib/agents/platform/signals.ts`의 `PLATFORM_COLLECTIONS`). `clinic`: `bookings`, `profiles` (`app/api/ops/_lib/bookings.ts`) | 시드 로더(A2A)와 병원 에이전트(CLINIC)가 같은 이름을 써야 운영 화면에 데이터가 보인다. 합칠 때 한 곳으로 모은다 |
| O2 | 규칙 버전 | 07 가드레일 5: 변경마다 버전 증가 + 이력 | 상태가 바뀔 때마다 `version + 1`, 전체 사본을 `routing_rule_history`(`<id>@v<n>`)에 저장. `exclude_clinic`은 승인 시 `expiresAt = 승인 + 90일`, 지나면 다음 조회나 제안 실행 때 `system`이 `retired`로 바꾼다 | 매칭(`rules.ts`)은 `status = active`만 읽으면 된다 |
| O3 | 국적 가드레일 해석 | 07 가드레일 1 | 국적 조건이 있으면 `boost_clinic` 금지, `exclude_clinic`·`demote_clinic`은 그 병원·그 국적의 피해 근거(실결제 +10% 초과, 만족도 2 이하, 부작용, 또는 그 병원의 피해 신호)가 있어야 통과. `require_language`·`prefer_area`는 근거 없이 허용. 건강 정보 키나 가격 관련 키·행동은 어디에 있어도 버린다 | |
| O4 | Claude 출력 | 07: 사유·요약 작성, 추가 제안 2개 | 후보의 `when`/`then`을 바꾼 초안은 버리고, 요약이 트리거의 숫자(예: 31, 20)를 그대로 담지 않으면 템플릿 요약을 쓴다. 픽스처 키 `proposer`, 도구 `propose_rules({ rules: [{ candidateKey?, when, then, reason, evidence }] })`, 후보 키 형식 `quote_gap:cln_ara:JP` | LLM 트랙 픽스처가 이 모양을 따라야 `mode: "claude"`가 된다. 다르면 템플릿으로 떨어진다 |
| O5 | 긴급 정지 | 07 가드레일 4 | 부작용 트리거는 레지스트리 `verificationStatus`를 즉시 `suspended`로 바꾸고 긴급 제안(`urgent: true`)을 만든다. 운영자가 반려하거나 폐기하면 이전 상태로 되돌린다. 같은 근거로 반려된 규칙은 다시 제안하지 않는다 | |
| O6 | 응답 없음 비율 | 07: 시간초과 비율 | 분모는 A2A 로그의 `clinic.quote` 호출 수(국적은 요청 `visitorProfile.nationality`), 분자는 `response_timeout` 신호(국적이 없으면 `taskId`로 로그에서 찾음) | |
| O7 | 결과 주입 | 06: `outcomes-ara-burst.json` | 파일이 있으면 필드를 쓰되 날짜·간격·실결제는 주입 시점 `clock.now()` 기준으로 다시 계산. 없으면 코드에서 같은 20건을 만든다(`procedureId: "rejuran"`, 견적 330,000원 VAT 포함 기준). 신호 `quote_gap` 20건도 함께, `PriceRecord`는 만들지 않는다 | |
| O8 | 예약 거절 | 계약에 `confirmBooking`만 있음 | 병원 모듈이 `rejectBooking(clinicId, bookingId, by, reason)`을 내보내면 그것을 부르고, 없으면 `taskCompleter.complete(..., REJECTED)` 후 예약을 `canceled`로 저장 | CLINIC 트랙에 `rejectBooking` 추가 요청 |
| O9 | 운영 접근 | 운영자만 | `getSessionUser()`가 `operator`면 통과. `DEMO_MODE=true`면 로그인 여부와 관계없이 `demo_operator`로 통과(데모 iframe이 고객으로 로그인해 같은 쿠키를 쓰기 때문). 데모가 아니면 비로그인 401, 다른 역할 403 | |
| O10 | 데모 시계 프리셋 | 05·10: 11/12, 11/14 | `lib/clock.ts` 기본값(10/24) 기준으로 10/24 시작, 11/10 13:00(유키 시술, BUILD-LOG 13), 11/14 13:00(10의 6행), 12/10 10:00 | 10의 시나리오 표가 BUILD-LOG 13으로 갱신되면 프리셋도 맞춘다 |
| O11 | 데모 오른쪽 패널 | 05: 병원 요청함 [확정] [시간 제안] [거절] | 직접 운영 병원은 [확정]만 두고 시간 제안·거절은 `/clinic/inbox` 링크로 보낸다(그 API는 CLINIC 트랙). 가운데 로그는 재생 목업 대신 `GET /api/ops/a2a-log`를 2초마다 읽는다 | |
| O12 | 테스트 import | | vitest 설정에 `@/` 별칭이 없어 이 트랙의 서버 코드와 테스트는 상대 경로를 쓴다 | `vitest.config.ts`에 tsconfig 경로를 넣으면 정리 가능 |
## 트랙 AUTH (계정·DB, `feat/track-auth`, 2026-10-24)

### 만든 것

- DB: Drizzle ORM. `DATABASE_URL`이 있으면 `@neondatabase/serverless` Pool(트랜잭션 가능), 없으면 PGlite를 `.data/pglite`에 저장. Vercel에서 `DATABASE_URL`이 없으면 메모리 PGlite + 경고 로그(인스턴스가 바뀌면 계정이 사라짐). 스키마 `lib/db/schema.ts`, 마이그레이션 `drizzle/`, 첫 사용 때 자동 적용(`lib/db/migrate.ts`, 기록 테이블 `__pibook_migrations`, advisory lock으로 동시 콜드 스타트 직렬화). 서버 번들이 폴더를 못 실을 수 있어 SQL을 `lib/db/migrations.gen.ts`에 임베드한다. 스키마를 바꾸면 `npx drizzle-kit generate` 다음 `node lib/db/embed-migrations.mjs`(검사: `--check`).
- 저장소: `lib/store/pg.ts`가 `Store` 계약을 JSONB 테이블 `store_items(namespace, collection, id, data, position)` 위에 구현. `getStore()`는 테스트(vitest)와 `next build`에선 메모리, 그 외(next start, next dev, Vercel)엔 Postgres. `PIBOOK_STORE=memory|pg`로 강제 가능. `resetStore()`는 시그니처 그대로 동기: Postgres에선 초기화를 큐에 넣고 이후 호출이 그걸 기다린다. 두 구현을 같은 계약 테스트로 돌린다(`lib/store/pg-contract.test.ts`).
- 계정: Better Auth 1.7.12, 이메일+비밀번호(8~128자), Google은 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`가 둘 다 있을 때만(버튼도 그때만 보임). 라우트 `/api/auth/*`, UI용 `/api/auth/options`. 쿠키 접두사 `pibook`. 가입하면 `cag_` + 10자 가명 에이전트 id를 만들고 역할 `customer`로 묶는다(가입 본문의 role·agent id는 무시). `customer/accounts/{userId}`에 `CustomerAccount`를 쓴다.
- 데모(`DEMO_MODE=true`): 계정 Yuki `cus_yuki`/`cag_7f3k2`, Lin `cus_lin`/`cag_4n8vd`, Emily `cus_emily`/`cag_2q9wk`, 지수 `cus_jisoo`/`cag_8h3tb`(UI 목데이터·A2A 픽스처와 같은 id), 병원 직원 `stf_seoul_glow`(clinic_staff, `cln_seoul_glow`), 운영자 `opr_demo`. 이메일은 전부 `*.demo@example.com`. 비밀번호 없는 데모 로그인 `POST /api/auth/demo/sign-in { "persona": "Yuki" | "lin" | "seoul_glow_staff" | "operator" ... }`, DEMO_MODE가 아니면 404.
- 화면: 랜딩 가입 모달(`components/customer/auth-dialog.tsx`, props 그대로), `/[locale]/signup`(비밀번호 칸 추가), 새 `/[locale]/login`. 문구는 `components/auth/copy.ts`(4개 언어). 브라우저 헬퍼 `components/auth/client.ts`(`signOut()`, `fetchMe()` 등 다른 트랙도 사용 가능).
- `proxy.ts`(Next 16): 로그아웃 상태로 고객 앱 경로(`/{locale}/home|chat|requests|bookings|records|outcomes|settings/**`)에 오면 `/{locale}?auth=login&next=...`로 보내고, 모달이 그 쿼리로 스스로 열려 로그인 뒤 `next`로 돌아간다. DEMO_MODE에서도 같다(데모 버튼이 비밀번호 없이 바로 로그인). `/clinic/**`·`/api/clinic/**`는 clinic_staff, `/ops/**`·`/demo/**`·`/api/ops/**`·`/api/demo/**`는 operator. 페이지는 `/ko/login?next=...`(역할이 틀리면 `&denied=1`), API는 401/403. DEMO_MODE면 열어 두고 요청에 `x-pibook-demo-as` 헤더를 붙여 `getSessionUser()`가 데모 직원·운영자를 돌려준다. 이 헤더는 모든 요청에서 먼저 지운다. proxy는 DB를 열지 않는다(Next 문서: proxy는 렌더 코드와 따로 돈다): Better Auth의 서명된 쿠키 캐시(5분)로 역할을 읽고, 만료됐으면 `/api/auth/get-session`에 묻는다.

### 다른 트랙용 계약

- `getSessionUser(headers?)`(`lib/auth/session.ts`, 시그니처 그대로): 인자 없으면 `next/headers`의 현재 요청 헤더. DB 세션을 직접 확인한다(쿠키 캐시 미사용이라 계정 삭제·로그아웃이 즉시 반영). DEMO_MODE의 콘솔 대체 사용자는 위 proxy 헤더가 있을 때만.
- `GET /api/me` → `{ account: { id, email, name, customerAgentId, role, clinicId?, createdAt }, profile: CustomerProfile | null }`, 로그아웃이면 401.
- `PUT /api/me/profile` 본문 = 06의 `CustomerProfile`(strict zod, `lib/auth/profile.ts`). `id`·`agentId`는 서버가 계정에서 채운다(보내려면 계정 값과 같아야 하고 다르면 403). 오타 필드·잘못된 enum·출국일<입국일은 400 + `issues`. customer 역할만. 저장 위치 `customer/profiles/{userId}`. **LLM 트랙: 온보딩 완료 시 여기로 저장한다.** 동의 원장·과거 시술은 이 API가 받지 않으니 고객 에이전트 쪽에서 `customer/consents`, `customer/records` 등에 `customerId = account.id`로 쓴다. `GET /api/me/profile` → `{ profile }`.
- `DELETE /api/me`: 세션 종료 쿠키 + 사용자·세션·로그인 연결 삭제 + `customer` 네임스페이스에서 이 고객 것 전부 삭제(`lib/auth/purge.ts`): `id == userId`, `customerId == userId`, `agentId`/`customerAgentId == cag`, 그리고 `requestId`·`bookingId`로 연결된 문서(견적·예약·결과 초안). **CUSTOMER 트랙: 고객 문서에는 `customerId`(계정 id)를 넣어야 삭제 대상에 잡힌다.** 다른 네임스페이스(플랫폼 익명 표본 등)는 건드리지 않는다.
- 데모 리셋(OPS): `resetStore()` 뒤 `loadSeed(getStore())`. Postgres에서도 동작한다. 계정 테이블은 리셋 대상이 아니다(데모 계정은 로그인할 때 없으면 다시 만든다).

### 환경 변수 (새로 씀, `.env.example`은 공용이라 여기만 적음)

| 이름 | 용도 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 연결 문자열. 없으면 PGlite |
| `PGLITE_DIR` | PGlite 폴더(기본 `.data/pglite`), `memory`면 메모리 |
| `BETTER_AUTH_SECRET` | 세션 서명 비밀값(32바이트 이상, `openssl rand -base64 32`). 비어 있으면 DEMO_MODE나 개발에서만 코드의 dev 전용 값을 쓰고 경고, 프로덕션이면서 DEMO_MODE가 아니면 첫 인증 요청에서 에러 |
| `BETTER_AUTH_URL` | 공개 주소(예: `https://pibook.vercel.app`). 비우면 요청에서 추론(로컬은 그대로 둬도 됨). Google 콜백이 정확하려면 배포에선 설정 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 둘 다 있을 때만 Google 로그인 |
| `PIBOOK_STORE` | `memory` 또는 `pg`로 저장소 강제(디버그용) |

### 오너가 할 일: Google OAuth 클라이언트 만들기

1. https://console.cloud.google.com/ 에서 프로젝트 선택(없으면 생성).
2. "API 및 서비스" > "OAuth 동의 화면": 사용자 유형 외부, 앱 이름 `PibooK`, 지원 이메일, 범위는 기본(`openid`, `email`, `profile`). 테스트 단계면 테스트 사용자에 시연 계정 추가.
3. "사용자 인증 정보" > "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" > 애플리케이션 유형 "웹 애플리케이션".
4. 승인된 자바스크립트 원본: `http://localhost:3000`(로컬), 배포 주소(예: `https://pibook.vercel.app`).
5. 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`, `https://<배포 주소>/api/auth/callback/google`. 포트를 바꿔 띄우면 그 포트도 추가.
6. 발급된 클라이언트 ID·보안 비밀을 `.env`(로컬)와 Vercel 환경 변수에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`로 넣고, 배포에는 `BETTER_AUTH_URL`도 넣는다. 저장소·문서에는 값을 쓰지 않는다.

### 스펙과 다른 점·결정

| # | 내용 | 결정 |
| --- | --- | --- |
| A1 | 06: Postgres는 P1 | 지금 붙임. 메모리 저장소는 테스트·빌드 전용 |
| A2 | 05: `/[locale]/signup`은 이메일만 | 실제 계정이라 비밀번호 칸 추가. 로그인 화면 `/[locale]/login` 신설(콘솔 직원 로그인 겸용) |
| A3 | 랜딩 문구 `demoNote`("실제 계정은 만들지 않음", `landing-copy.ts`)가 이제 틀림 | 모달은 내 문구(`components/auth/copy.ts`)를 쓴다. `landing-copy.ts`의 `demoNote`는 남는 값이라 소유 트랙이 지워도 됨 |
| A4 | 저장값 | JSON 왕복이라 `undefined` 값 키는 저장되지 않는다(메모리 저장소는 남김). 필터 결과는 같다. Date 객체 대신 ISO 문자열을 쓴다(스펙 타입이 이미 그렇다) |
| A5 | Better Auth 시간 | 세션 만료는 실제 시간(Date.now). 데모 고정 시계(`lib/clock.ts`)는 도메인 데이터에만 쓴다. `CustomerAccount.createdAt`은 `clock.nowIso()` |
| A7 | 로그아웃 뒤 열린 앱 화면 | 로그아웃한 화면이 그대로 열려 있으면 Next 링크 프리페치가 proxy 리다이렉트를 받아 콘솔에 404 리소스 오류가 남는다(실측). 로그아웃 버튼은 `signOutAndLeave(locale)`(`components/auth/client.ts`)로 전체 페이지 이동을 해야 한다. **CUSTOMER 트랙: 설정 화면 로그아웃에 이 함수를 쓴다** |
| A6 | 검증 범위 | Neon 경로는 타입·코드만 확인했고 실제 Neon DB로는 돌려보지 못했다(연결 문자열 없음). Vercel 서버리스에서 PGlite wasm 파일 추적도 미확인: 배포는 `DATABASE_URL` 설정을 권장 |
