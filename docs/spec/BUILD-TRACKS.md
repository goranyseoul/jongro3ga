# 병렬 빌드 트랙 (2026-10-24)

에이전트 7개가 각자 worktree·브랜치에서 동시에 만든다. 기준 브랜치는 `feat/build-base`(이 문서가 들어 있는 커밋). 충돌을 막는 장치는 **소유 경로**와 **공통 계약 파일**이다.

## 공통 계약 (기준 커밋에 이미 있음, 시그니처는 바꾸지 않는다)

| 파일 | 내용 | 구현 담당 |
| --- | --- | --- |
| `lib/a2a/contract.ts` | `AgentDefinition`, `SkillHandler`, `SkillContext`, `SkillResult`, `TaskCompleter` | 타입만 (모두 사용) |
| `lib/a2a/client.ts` | `sendMessage`, `getTask`, `cardUrl` | A2A 코어 |
| `lib/a2a/auth.ts` | `issueAgentToken`, `verifyReferralToken` | A2A 코어 |
| `lib/a2a/tasks.ts` | `taskCompleter` (WORKING 태스크를 나중에 완료) | A2A 코어 |
| `lib/agents/clinic/booking.ts` | `confirmBooking` (병원 콘솔·운영 대행 큐가 호출) | CLINIC |
| `data/seed/load.ts` | `loadSeed(store)` (부팅·데모 리셋) | A2A 코어 |
| `lib/agents/{platform,clinic,customer}/definition.ts` | 에이전트별 `AgentDefinition` (지금은 빈 스텁) | 각 에이전트 트랙 |
| `lib/agents/platform/recipe.ts` | `platform.recipe` 핸들러 | LLM |
| `lib/llm/index.ts` | `runClaude()` | LLM |
| `lib/auth/session.ts` | `getSessionUser()` | AUTH |
| `lib/zk/index.ts` | `matchOffers`, `proveOffer`, `verifyOffer` | ZK |
| `lib/store/types.ts` | `Store` 인터페이스 (비동기 키-값, 네임스페이스) | AUTH가 Postgres 구현 추가 |

시그니처를 꼭 바꿔야 하면 바꾸지 말고 자기 트랙 보고서에 "계약 변경 요청"으로 적는다. 오케스트레이터가 합칠 때 반영한다.

## 트랙과 소유 경로

| 트랙 | 브랜치 | 소유 경로 (여기만 쓴다) |
| --- | --- | --- |
| AUTH 계정·DB | `feat/track-auth` | `lib/db/**`, `lib/auth/**`, `lib/store/pg*.ts`, `lib/store/index.ts`, `app/api/auth/**`, `app/api/me/**`, `app/[locale]/login/**`, `app/[locale]/signup/**`, `components/customer/auth-dialog.tsx`, `components/auth/**`, `drizzle.config.ts`, `drizzle/**`, `proxy.ts` |
| A2A 코어·플랫폼 | `feat/track-a2a` | `lib/a2a/{server,client,auth,cards,tasks}.ts`, `app/a2a/**`, `app/.well-known/**`, `next.config.ts`, `lib/agents/platform/**` (단 `recipe.ts`, `proposer*`, `signals*` 제외), `data/seed/**` (단 `kr-patterns.json` 제외), `scripts/gen-*.mjs` |
| CLINIC 병원 에이전트·콘솔 | `feat/track-clinic` | `lib/agents/clinic/**`, `app/api/clinic/**`, `app/clinic/**`, `components/clinic/**`, `lib/ui-data/clinic.ts` |
| LLM Claude·온보딩·상담 | `feat/track-llm` | `lib/llm/**`, `app/api/onboarding/**`, `app/api/intent/**`, `app/[locale]/onboarding/**`, `lib/agents/platform/recipe.ts`, `data/seed/kr-patterns.json` |
| CUSTOMER 고객 에이전트·화면 연결 | `feat/track-customer` | `lib/agents/customer/**`, `app/api/customer/**`, `app/[locale]/{home,chat,requests,bookings,records,outcomes,settings}/**`, `components/customer/**` (단 `auth-dialog.tsx` 제외), `lib/ui-data/customer.ts`, `messages/**` |
| OPS 운영·개선 루프·데모 | `feat/track-ops` | `lib/agents/platform/proposer*.ts`, `lib/agents/platform/signals*.ts`, `app/api/ops/**`, `app/api/demo/**`, `app/ops/**`, `app/demo/**`, `components/ops/**`, `lib/ui-data/ops.ts` |
| ZK 프라이버시 연결 | `feat/track-zk` | `lib/zk/**`, `app/api/zk/**`, `glowpass/**`, `docs/INTEGRATION.md` |

공통 파일(`package.json`, `package-lock.json`, `app/globals.css`, `app/layout.tsx`, `components/ui/**`, `lib/domain/**`, `lib/a2a/schemas.ts`)은 수정하지 않는다. 의존성이 더 필요하면 설치는 하되 보고서에 적는다 (오케스트레이터가 lockfile을 다시 만든다). `docs/spec/BUILD-LOG.md`에는 자기 트랙 절(`## 트랙 <이름>`)만 추가한다.

## 머지 순서

AUTH → A2A → CLINIC → LLM → CUSTOMER → OPS → ZK. 각 트랙은 다른 트랙이 아직 없다고 가정하고, 계약 스텁을 목으로 대체한 테스트로 자기 완료를 증명한다.
