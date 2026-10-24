# 10 · 빌드 플랜 (Sonnet 실행용)

이 문서는 빌드를 맡은 Claude Sonnet이 위에서부터 순서대로 실행하는 작업 지시서다. README.md의 기존 "Claude Code에게 (빌드 순서)"는 이 문서로 대체된다.

## 작업 규칙

1. **태스크 하나 = 커밋 하나 이상.** 태스크 시작 전에 "읽을 문서"를 읽는다. 기억이나 추측으로 필드 이름을 만들지 않는다.
2. **수용 기준을 실제로 실행**하고 통과한 뒤에만 다음 태스크로 간다. 실패를 통과로 적지 않는다. 같은 에러가 3번 반복되면 멈추고 상황을 `docs/spec/BUILD-LOG.md`에 적는다.
3. 스펙과 구현이 충돌하면 스펙을 조용히 바꾸지 않는다. `docs/spec/BUILD-LOG.md`의 "스펙 이슈"에 적고, 가장 보수적인 해석으로 진행한다.
4. 라이브러리 API는 `node_modules` 안의 타입 정의가 정본이다. 특히 `@a2a-js/sdk`는 [09-architecture.md](09-architecture.md)의 "SDK 함정"을 먼저 읽는다.
5. UI: 토큰만, 이모지·엠대시·엔대시 금지, 틴트 알약 배지 금지 ([05-screens.md](05-screens.md) UI 규칙). `npm run check:tokens`가 막는다.
6. AI는 Claude만 (`@anthropic-ai/sdk`). 키가 없어도 픽스처로 데모가 돌아야 한다.
7. 비밀값 커밋 금지. `.env`는 `.gitignore`. 스테이징은 파일명을 명시한다 (`git add -A` 금지).
8. 커밋 메시지는 영어 Conventional Commits (`feat(platform): add fairness verdict`).
9. 매 태스크 끝에 `npm run gate` (T00 이후 존재). 화면 태스크는 추가로 `npm run e2e -- --grep <태스크 id>`.

## 태스크 순서

의존: T00 → T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → (T11, T12 병렬 가능) → T13 → T14 → T15 → T16 → T17 → T18 (T16~T18은 ZK 확장, T08~T10 이후 아무 때나 시작 가능하고 T14 시나리오에 4행·6행·린 행을 더한다. T05와 T06은 서로의 스킬을 A2A로 부르므로 직렬)

### T00 · 프로젝트 셋업

- 읽을 문서: [09-architecture.md](09-architecture.md) 스택·디렉토리·스크립트·환경 변수
- 할 일: `npx create-next-app@16` (TypeScript, App Router, Tailwind, ESLint, `src/` 없음) 결과를 리포 루트에 병합 (기존 README.md·PLANNING.md·docs/ 보존). 의존성 설치: `@a2a-js/sdk zod jose @anthropic-ai/sdk next-intl`, dev: `vitest @playwright/test`. `.env.example`, `.gitignore`(`.env`, `.data/`), `package.json` 스크립트 표 전부 (아직 없는 스크립트 파일은 통과하는 빈 검사로 생성 후 해당 태스크에서 채움)
- 수용 기준: `npm run typecheck` 0 에러 · `npm run build` 성공 · `npm test -- --passWithNoTests` 성공

### T01 · 디자인 토큰과 UI 기초

- 읽을 문서: [05-screens.md](05-screens.md) UI 규칙·공통 컴포넌트
- 할 일: `app/globals.css`에 토큰 `:root` 변수 + Tailwind v4 `@theme` 매핑 (라이트 테마, 무채색 코어, `--brand` 1색). `components/ui/` 공통 컴포넌트 전부. `scripts/check-tokens.mjs` (검사 대상 `app/`, `components/`: `#[0-9a-fA-F]{3,8}` · `\[\d+px\]` · `(bg|text|border)-(red|pink|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|slate|gray|zinc|neutral|stone)-\d` · 이모지 유니코드 범위 · U+2014 · U+2013. 단 `globals.css`의 토큰 정의는 hex 허용). `/demo/ui` 페이지에 모든 컴포넌트 나열
- 수용 기준: `npm run check:tokens` 통과 · 검사 스크립트의 양성 대조 테스트 (`tests/check-tokens.test.ts`: 위반 픽스처 문자열은 잡힘) · `/demo/ui`가 390px·1280px에서 콘솔 에러 0 (`e2e/t01-ui.spec.ts`)

### T02 · 도메인 타입과 A2A 스키마

- 읽을 문서: [03-a2a-protocol.md](03-a2a-protocol.md) 스킬 라우팅 표·메시지 스키마, [06-data-model.md](06-data-model.md)
- 할 일: `lib/domain/*.ts`, `lib/a2a/schemas.ts` (스키마마다 zod + 타입, `parsePibuData(skillId, data)`). 03 문서의 JSON 예시를 `tests/fixtures/wire/*.json`으로 복사
- 수용 기준: `tests/schemas.test.ts`: 모든 와이어 픽스처가 해당 스키마로 통과 · 필수 필드를 하나씩 지운 변형은 실패 · `event`에 `regularPriceKrw` 없는 오퍼는 실패 · `skillId`와 `schema` 불일치는 실패

### T03 · 저장소와 시드

- 읽을 문서: [06-data-model.md](06-data-model.md) 저장소·시드, [01-users-journeys.md](01-users-journeys.md) 페르소나·병원
- 할 일: `lib/clock.ts` (06 시계), `lib/store/` (메모리 구현, `globalThis.__pibu` 싱글턴, 개발 모드 `.data/store.json` 저장), `data/seed/*.json` 전부. `price-records.json`은 [06-data-model.md](06-data-model.md) 시드 표의 조건(정확히 42건, 날짜 범위, 단위가격 분위수 4개, 용량 p25·p75)을 만족하도록 생성 스크립트 `scripts/gen-price-records.mjs`로 만든다. 병원 메뉴·슬롯·결과·규칙·고객도 06 시드 표 그대로
- 수용 기준: `tests/seed.test.ts` (시계 고정 2026-11-12): 시드 로드 후 엔티티 수 · 리쥬란 120일 표본 n = 42, 단위가격 분위수 4개, 용량 p25 = 2 · p75 = 3 일치 · 아라 기본 결과 4건이 90일 윈도우 안, 30일 윈도우 밖 · 모든 시드 JSON이 해당 zod/타입 검증 통과 · 실명·실전화번호 패턴 없음

### T04 · A2A 기반

- 읽을 문서: [03-a2a-protocol.md](03-a2a-protocol.md) 전체, [09-architecture.md](09-architecture.md) A2A 서버·클라이언트·SDK 함정
- 할 일: `lib/a2a/{auth,cards,server,client,log,mask}.ts`, `app/a2a/**` 라우트 (카드, rpc, jwks), `/.well-known/agent-card.json` rewrite. 이 단계의 executor는 스킬마다 "not implemented"를 `TASK_STATE_FAILED`로 답하는 스텁
- 수용 기준: `tests/a2a-cards.test.ts`: 플랫폼·병원 5곳·고객 카드가 A2A 1.0 필수 필드 보유, 스킬 id가 [02-agents.md](02-agents.md)와 일치 · `tests/a2a-auth.test.ts`: 토큰 없는 rpc 401, 고객 카드 토큰 없이 401, 병원 토큰으로 고객 rpc의 `customer.checkin` 호출 시 거절 · 추천 토큰 서명·만료·aud 검증 · `tests/mask.test.ts` · 라우트 통합 테스트: `SendMessage` 와이어 요청(03 문서 예시)을 rpc 라우트 `POST`에 직접 넣어 JSON-RPC 응답과 `A2ALogEntry` 1건 생성 확인

### T05 · 병원 에이전트

- 읽을 문서: [02-agents.md](02-agents.md) 3절, [03-a2a-protocol.md](03-a2a-protocol.md) 응답 형태·태스크 상태·대행 운영
- 할 일: `lib/agents/clinic/*` 스킬 5개, 견적 항목 선택 규칙 ([07-platform-intelligence.md](07-platform-intelligence.md)), 추천 토큰 검증, 대행 모드 `indicative`, `clinic.book` 흐름 (`WORKING` 유지 → `confirmProxyBooking()`(대행) 또는 `confirmClinicBooking()`(직접) → `COMPLETED`), 확정 시 `platform.report_booking` 호출 (이 시점 플랫폼은 T04 스텁이라 `FAILED`가 와도 된다. 호출이 로그에 남는지만 본다)
- 수용 기준: `tests/clinic-agent.test.ts`: 민트에 2cc 요청 → 1cc 이벤트 견적 (정상가·기간·조건 포함) · 서울글로우 2cc 요청 → 2cc 340,000 · 대행 병원 견적 `indicative: true` · 직접 병원 `false` · `clinic.book`을 `returnImmediately: true`로 보내면 즉시 `TASK_STATE_WORKING` 태스크가 온다 · 추천 토큰 없음/만료/다른 병원 aud → `TASK_STATE_REJECTED` · 대행 예약 → `WORKING` → `confirmProxyBooking()` → `GetTask`가 `COMPLETED` + `pibu/booking@1` · 확정 시 플랫폼 rpc로 report_booking 호출 기록이 A2A 로그에 남음

### T06 · 플랫폼 에이전트

- 읽을 문서: [07-platform-intelligence.md](07-platform-intelligence.md) 전체, [08-compliance.md](08-compliance.md) 2절·3절
- 할 일: `lib/agents/platform/{eligibility,recipe,matching,fairness,fairness-copy,rules,outcomes}.ts` (순수 함수 + 어댑터), 오퍼 캐시 (`clinic.offers` A2A로 수집), executor 스킬 6개 (`report_signal` 포함). 끝나면 T05의 report_booking 테스트가 `COMPLETED`로 바뀌는지 재확인
- 수용 기준: `tests/fairness.test.ts`: 07 문서 기준 테스트 케이스 4행 + 경계값 4개 · `tests/fairness-copy.test.ts`: 4개 언어 문구 존재, 병원 간 우열 표현 금지어(예: "より良い", "better than", "보다 낫") 없음 · `tests/eligibility.test.ts` · `tests/matching.test.ts`: 하드 필터, 점수 결정론(같은 입력 같은 출력), 동점 정렬, 규칙 적용 순서, 예산 감점 · `tests/outcomes.test.ts`: 병원 토큰 거절, 중복 덮어쓰기, quoteGapRatio, 신호 생성 · Yuki 요청(`cus_yuki_done`) 매칭 결과 `appliedRuleIds = []`, 후보 서울글로우·민트·아라 · `npm run check:boundaries` 통과

### T07 · LLM 계층

- 읽을 문서: [09-architecture.md](09-architecture.md) LLM 사용, [08-compliance.md](08-compliance.md) 6절, [04-onboarding-chat.md](04-onboarding-chat.md) 대화 규칙
- 할 일: `lib/llm/client.ts` (키 없거나 `DEMO_MODE=true`면 픽스처), 프롬프트 (`onboarding-customer`, `onboarding-clinic`, `intent`, `concierge`, `proposer`, `medical-boundary`), 도구 정의 (zod → JSON Schema), 픽스처 (`lib/llm/fixtures/`: Yuki 온보딩 대화, "リジュラン受けたい" intent, 규칙 제안)
- 수용 기준: `tests/llm-tools.test.ts`: 도구 입력 zod 검증 실패 시 도구 에러 반환 · `tests/medical-boundary.test.ts`: 픽스처 출력에 진단·권유 금지 패턴 없음 · 키 없이 픽스처 경로로 intent가 `pibu/procedure-request@1` 생성

### T08 · 고객 에이전트

- 읽을 문서: [02-agents.md](02-agents.md) 1절, [03-a2a-protocol.md](03-a2a-protocol.md) 전체 시퀀스, [06-data-model.md](06-data-model.md) 고객 네임스페이스
- 할 일: `lib/agents/customer/{consent,intent,orchestrator,records,schedule,executor}.ts`. 요청 정리 기본값 규칙은 [02-agents.md](02-agents.md) 1절. 오케스트레이터: recipe(용량 없을 때, 조건 카드 전) → match → 병렬 quote (20초 타임아웃, `Promise.allSettled`, 시간초과·거절은 `platform.report_signal`) → judge → `comparing` 상태. 예약 → 폴링. 결과 제출. `customer.notify` 스킬
- 수용 기준: `tests/schedule.test.ts`: 06 다음 회차 규칙 (리쥬란 1회차 11-14 → 2회차 12-14, 3회차 이후 +90일, `sessionNumber` 리셋), 써마지·울쎄라 연 1회, 출국 전 다운타임 경고 · `tests/consent.test.ts`: 병원으로 가는 요청에서 `notes`·`ageBand` 제거, 동의 없는 필드 미전송 · `tests/orchestrator.test.ts` (실제 rpc 라우트 사용): Yuki 요청 → 비교 단계 도달, 견적 3개 (서울글로우·민트·아라), 판정 라벨이 07 표와 일치, 응답 없는 병원 1곳 모의 시 나머지로 진행

### T09 · 채팅 온보딩

- 읽을 문서: [04-onboarding-chat.md](04-onboarding-chat.md) 전체, [05-screens.md](05-screens.md)
- 할 일: `/[locale]/home`과 `/[locale]/chat` **스텁 페이지** (T10에서 채움), 이 태스크에 필요한 메시지 키 4개 언어, `app/api/onboarding/customer/route.ts` (SSE), `/[locale]/onboarding` (채팅 + 에이전트 카드 미리보기, 모바일 진행 바), 위젯, 동의 카드, 요약 카드, 완료 처리 (프로필·동의 원장·기록·카드 활성화). 병원 온보딩은 P1이라 이 태스크에서 제외
- 수용 기준: `e2e/t09-onboarding.spec.ts`: 픽스처 모드에서 `cus_yuki`(미완료) 온보딩 완주 (ja) → `/ja/home` 스텁 도착, 프로필 필수 슬롯 전부 채워짐 · 민감정보 동의 전 피부 질문이 나오지 않음 · `residency = resident` 선택 시 매칭 불가 안내 · 390px·1024px 스크린샷

### T10 · 고객 화면

- 읽을 문서: [05-screens.md](05-screens.md) 고객 웹앱·견적 비교·판정 라벨
- 할 일: 데모 API `POST /api/demo/confirm-booking` (DEMO_MODE에서만, 대행이면 `confirmProxyBooking`, 직접이면 `confirmClinicBooking` 호출), home, chat(조건 카드), requests/[id](진행 타임라인 + 비교), bookings/[id], records, records/new, outcomes/[bookingId] (D0), settings/data(카드 보기), legal/patient-rights, 4개 언어 메시지
- 수용 기준: `e2e/t10-customer.spec.ts`: `cus_yuki_done`으로 요청 → 비교 화면에서 민트 행 "量が少なめ", 아라 행 실결제 상승 경고 문장, 서울글로우 11/14 11:00 예약 → `POST /api/demo/confirm-booking` → 확정 표시 → 시계 이동 (11/14 13:00) → D0 기록 제출 → 내 기록에 "2回目: 2026-12-14" · 랜딩에 병원명·가격이 없음 · `tests/i18n.test.ts`: 4개 언어 키 집합 동일

### T11 · 병원 콘솔 (P0 범위)

- 읽을 문서: [05-screens.md](05-screens.md) 병원 콘솔
- 할 일: `/clinic/dashboard`, `/clinic/inbox` (직접 운영 병원 예약 확정), `/clinic/menu`, `/clinic/agent`
- 수용 기준: `e2e/t11-clinic.spec.ts`: 서울글로우 계정으로 예약 요청 확정 → 고객 쪽 확정 반영 · 메뉴 가격 수정 → 다음 견적에 반영

### T12 · 운영 콘솔 (P0 범위)

- 읽을 문서: [05-screens.md](05-screens.md) 운영 콘솔, [07-platform-intelligence.md](07-platform-intelligence.md) 4절
- 할 일: `/ops/clinics`, `/ops/proxy-queue`, `/ops/rules` (승인·반려·폐기, [규칙 제안 실행]), `/ops/a2a-log` (필터, JSON 펼치기, 마스킹 확인)
- 수용 기준: `e2e/t12-ops.spec.ts`: 대행 예약 확정 → 고객 확정 반영 · A2A 로그에 한 요청의 전체 호출(recipe, match, quote × N, judge, book, report_booking)이 `contextId`로 묶여 보임 · 로그 JSON에 `safety` 원문 없음

### T13 · 개선 루프와 데모 컨트롤

- 읽을 문서: [07-platform-intelligence.md](07-platform-intelligence.md) 4절, [05-screens.md](05-screens.md) 데모 컨트롤
- 할 일: `proposer.ts` (결정론 트리거 + Claude 2단계, 실패 시 템플릿), `/demo` (시드 리셋, 페르소나 전환, 3분할 뷰, [결과 20건 주입])
- 수용 기준: `tests/proposer.test.ts`: 아라 버스트 주입 후 트리거가 `exclude_clinic`(JP, cln_ara) 후보 생성 · 금지 조건(건강 정보, 국적별 가격) 제안은 버려짐 · `e2e/t13-loop.spec.ts`: 승인 전 Yuki 요청의 `appliedRuleIds`에 새 규칙 없음 → 주입 → 제안 ("+31% (n=20)") → 승인 → 같은 Yuki 요청 재실행 시 후보에서 아라 제외, `appliedRuleIds`에 새 규칙 id 포함

### T14 · 데모 시나리오 E2E

- 할 일: 아래 데모 시나리오 전체를 `e2e/demo.spec.ts` 하나로 (픽스처 모드)
- 수용 기준: `npm run e2e -- demo.spec.ts` 통과 · 각 장면 스크린샷 `e2e/artifacts/` · 전 페이지 콘솔 에러 0

### T15 · 마감

- 할 일: README.md 실행 방법·데모 계정 갱신, `docs/spec/BUILD-LOG.md` 정리 (구현과 스펙 차이), `.env.example` 최종
- 수용 기준: 새 클론에서 `npm install && npm run gate && npm run e2e` 통과

### T16 · ZK 스키마와 lib/zk

- 읽을 문서: [INTEGRATION.md](../INTEGRATION.md), [03-a2a-protocol.md](03-a2a-protocol.md) (ZK 확장 스키마), [06-data-model.md](06-data-model.md) (ZK 타입)
- 할 일: `lib/a2a/schemas.ts`에 스키마 3개 추가 (`pibu/offer-proof@1`, `pibu/record-anchor@1`, `pibu/review@1`), `zkClauses`·`offerApplied`·`verifiedVisits`·`reviewStats` 필드, `SKILL_ROUTES`에 `platform.anchor_record`·`platform.submit_review` 2개, `lib/zk/` (`codes.ts`, `clauses.ts` 의 `clauseHolds`, `client.ts`, `types.ts`)
- 수용 기준: 새 필드와 스키마의 스키마 테스트 · `clauseHolds` 테스트 (첫 방문, 2회차, 단골, 날짜 범위) · `npm run typecheck`, `npm test`, `npm run build` 통과

### T17 · ZK 화면 접점

- 읽을 문서: [05-screens.md](05-screens.md) (ZK 확장 표기), [INTEGRATION.md](../INTEGRATION.md) 0절
- 할 일: `/[locale]/records`의 출처 표시 ("병원 확인 · 체인 기록 v{n}" 또는 "직접 입력 · 증명에 쓰이지 않음"), `/[locale]/requests/[id]`의 오퍼 매칭·검증 타임라인 단계와 "조건 충족 증명됨" 라벨·병원 셀의 방문 수·후기 집계, `/[locale]/settings/data`의 기록 지갑 카드, 병원 콘솔 이벤트 시트의 증명 조건 프리셋, `/demo/ledger`, 메시지 키 4개 언어
- 수용 기준: 빌드 가드(`check:tokens`, `check:boundaries`) 통과 · 위 페이지가 4개 언어로 렌더링됨

### T18 · 에이전트 훅과 브라우저 지갑

- 읽을 문서: [INTEGRATION.md](../INTEGRATION.md) 4~6절, [09-architecture.md](09-architecture.md) (모듈 경계, 환경 변수)
- 할 일: 병원 에이전트 `clinic.quote`의 오퍼 증명 검증 훅 (통과 시 `event` + `offerApplied`, 실패 시 정가 견적), 고객 오케스트레이터의 기기 안 매칭과 증명 첨부 (해당 없는 병원에는 증명을 보내지 않음), 플랫폼 `platform.anchor_record`·`platform.submit_review` 실행기, `match_clinics` 응답의 `verifiedVisits`·`reviewStats`. 로드맵: 브라우저 지갑 (localStorage + bb.js WASM)으로 서버 지갑 제거
- 수용 기준: 데모 시나리오 4행·6행·린 행이 e2e로 통과 · 증명 검증 실패 시 정가 견적이 나오는 테스트

## 데모 시나리오 (3분, 픽스처 모드 기준 기대값)

| # | 화면 | 동작 | 기대 결과 |
| --- | --- | --- | --- |
| 0 | `/demo` | [시드 리셋], 3분할 뷰 | 왼쪽 고객(390px), 가운데 A2A 로그 비어 있음, 오른쪽 운영 큐 |
| 1 | `/ja/onboarding` | Yuki 온보딩 (픽스처 대화 자동 진행 버튼 허용) | 오른쪽 에이전트 카드가 슬롯마다 채워짐, 완료 후 `/ja/home` |
| 2 | `/ja/chat` | "リジュラン受けたい" | 로그에 `platform.recipe`. 조건 카드: リジュラン 2cc (통상 최솟값) · ₩450,000 以下 · 新沙・江南・狎鴎亭 (숙소 지역 그룹) · 日本語 · 11/13~11/15 |
| 3 | `/ja/requests/[id]` | [この条件で探す] | 가운데 로그에 match_clinics → quote × 3 (서울글로우, 민트, 아라) → judge_quote 순서로 흐름 (recipe는 2행에서 이미 호출). 진행 문장 3줄. 언어 필터로 제외 (한빛 중국어, 다혜 영어) |
| 4 | 비교 화면 | 확인 | 민트 `量が少なめ` (1cc, 통상 2~3cc), 서울글로우 `適正`, 아라 `適正` + "見積もりより支払額が高かった記録があります". 민트 행에 조건 충족 증명됨 라벨, 서울글로우 행에 피북 사용자 1,240명 · 검증 후기 18건 (ZK 확장) |
| 5 | 비교 화면 | 서울글로우 11/14 11:00 [予約] | 상태 "クリニック確認中" → 오른쪽 병원 요청함에서 [확정] (또는 데모 확정 버튼) → "予約確定" |
| 6 | `/demo` → `/ja/outcomes/[bookingId]` | [시계 이동: 11/14 13:00] → D0: ₩340,000 · 2cc · 満足 5 | 플랫폼 로그에 submit_outcome, 내 기록에 "2回目: 2026-12-14". 로그에 platform.anchor_record, 내 기록에 병원 확인 · 체인 기록 v1 (ZK 확장) |
| 7 | `/demo` | [결과 20건 주입] → `/ops/rules` [규칙 제안 실행] | 제안: "아라의원 · 일본 고객 · 매칭 제외 · 근거: 견적 대비 실결제 평균 +31% (n=20)" |
| 8 | `/ops/rules` | [승인] → 고객 화면에서 같은 요청 재실행 | 후보에서 아라 제외, 로그의 shortlist에 `appliedRuleIds: ["rule_..."]` |
| 9 | `/zh-CN/requests/[id]` (ZK 확장, 린 2회차) | 린으로 리쥬란 요청 | 린의 기록 (리쥬란 1회 @ 한빛, 병원 확인)을 기기 안에서 매칭해 서울글로우 2회차 패키지와 한빛 이어서 2회차 오퍼 증명을 첨부. 병원은 검증 후 `offerApplied`, 이력 원본은 로그에 없음 |

## 결정 기록

| # | 항목 | 결정 (2026-10-24 오너) | 근거 |
| --- | --- | --- | --- |
| 1 | 수익 모델: PLANNING.md 13절의 리스팅·광고·상단 노출 | 보류. 매칭에 돈이 섞이지 않는 구조로 구현, 정산 비활성 | 비의료인 의료광고 금지 ([08-compliance.md](08-compliance.md) 3절) |
| 2 | 한국 사용자용 "이달 이벤트 비교" 화면 | 만들지 않는다. 메인 기능만 | 오너 지시 |
| 3 | 타깃 연령·성별 | 기능을 나누지 않는다 | 오너 지시 |
| 4 | 후기 공개·후기 보상 | 후기 공개 채택 (오너 2026-10-24), 보상은 없음 | [08-compliance.md](08-compliance.md) 3절 |
| 5 | 시나리오·id 정본 | `docs/spec`이 정본 (오너 2026-10-24). BUILD-LOG 13의 "`DEMO.md`가 데모 기준"을 재결정. DEMO.md는 기획 서사 | 구현과 데이터의 기준이 둘이면 갈라진다 |
| 6 | ZK 확장 | 채택: 2회차 오퍼, 첫 방문 오퍼, 검증 후기 (02, 03, 05~09의 ZK 확장 표기) | [INTEGRATION.md](../INTEGRATION.md) |
| 7 | 후기 처리 | 원문과 집계를 로그인 고객·비교 화면에 공개 (랜딩 제외, 익명 집합 3명 이상). 보상 없음 | [08-compliance.md](08-compliance.md) 3절 |

## 미결

| # | 질문 | 결정 전 기본값 | 근거 |
| --- | --- | --- | --- |
| 1 | 시술별 실제 통상 용량·다운타임 | 시드 `demo_assumption` + 화면 "데모용 값" 표기 | README TODO, PLANNING.md 10절 |
