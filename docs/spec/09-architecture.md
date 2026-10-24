# 09 · 기술 아키텍처

README.md의 스택(Next.js App Router + TypeScript + Tailwind, `@anthropic-ai/sdk`, Vercel)을 유지하고 A2A 계층을 더한다.

## 스택과 버전 (2026-10-24 npm 최신 확인)

| 영역 | 패키지 | 확인 버전 | 비고 |
| --- | --- | --- | --- |
| 프레임워크 | `next` | 16.4.3 | App Router. `create-next-app@16`으로 시작 |
| UI | `react` | 19.3.1 | |
| 스타일 | `tailwindcss` | 4.3.3 | **v4는 `tailwind.config.ts`가 아니라 `app/globals.css`의 `@theme` 블록으로 토큰 정의** |
| 다국어 | `next-intl` | 4.14.9 | `/[locale]` 세그먼트, 메시지 `messages/{ja,zh-CN,en,ko}.json` |
| A2A | `@a2a-js/sdk` | 1.3.0 | 프로토콜 1.0 구현 (`A2A_PROTOCOL_VERSION = "1.0"`) |
| 검증 | `zod` | 4.6.7 | `pibu/*@1` 스키마 |
| 토큰 | `jose` | 6.2.13 | 에이전트 JWT, 추천 토큰 ES256, JWKS |
| LLM | `@anthropic-ai/sdk` | 1.3.0 | 서버(API 라우트)에서만 호출 |
| 테스트 | `vitest` 5.0.5, `@playwright/test` 1.64.1 | | 단위 + 데모 시나리오 E2E |

버전은 설치 시점 최신으로 두되, 메이저가 바뀌어 있으면 이 표를 갱신하고 시작한다.

## 런타임 구성

```
                     ┌──────────────── Next.js 앱 (하나의 배포) ────────────────┐
 브라우저             │                                                          │
 고객 웹앱 ──────────→│ app/[locale]/*  ──→ app/api/customer/*  ─┐                 │
 병원 콘솔 ──────────→│ app/clinic/*    ──→ app/api/clinic/*    ─┤  (UI용 BFF)     │
 운영 콘솔 ──────────→│ app/ops/*       ──→ app/api/ops/*       ─┘                 │
                     │                         │                                │
                     │          lib/agents/customer   lib/agents/platform   lib/agents/clinic
                     │                 │  ▲                 │  ▲                  │  ▲
                     │                 ▼  │   A2A JSON-RPC over HTTP (PUBLIC_BASE_URL)  │
                     │   app/a2a/customers/[agentId]/rpc   app/a2a/platform/rpc   app/a2a/clinics/[slug]/rpc
                     │                                                          │
                     │   lib/store (메모리 + 시드, 네임스페이스 분리)   lib/llm (Claude)  │
                     └──────────────────────────────────────────────────────────┘
```

- UI는 자기 표면의 BFF(`app/api/customer/*` 등)만 부른다. BFF는 자기 에이전트 모듈만 부른다.
- 에이전트 모듈끼리는 `lib/a2a/client.ts`로 **HTTP A2A 호출**만 한다. 같은 프로세스여도 함수 직접 호출 금지.
- 고객 에이전트의 오케스트레이션(매칭 → 병렬 견적 → 판정)은 BFF 요청 안에서 끝까지 기다리지 않는다. `CustomerRequest.status`를 단계별로 갱신하고, 화면은 `GET /api/customer/requests/[id]`를 2초 간격으로 폴링한다 (P0). SSE는 P1.

## 디렉토리

```
app/
  [locale]/                      # 고객 웹앱 (05-screens.md)
    page.tsx  signup/  onboarding/  home/  chat/  requests/[id]/  bookings/[id]/
    records/  records/new/  outcomes/[bookingId]/  settings/data/  legal/patient-rights/
  clinic/                        # 병원 콘솔
  ops/                           # 운영 콘솔
  demo/                          # 데모 컨트롤
  api/
    onboarding/customer/route.ts  onboarding/clinic/route.ts      # SSE 채팅
    customer/...  clinic/...  ops/...  demo/{reset,clock,confirm-booking,inject-outcomes}/route.ts  # demo/*는 DEMO_MODE=true에서만 동작
  a2a/
    platform/agent-card.json/route.ts   platform/rpc/route.ts   platform/jwks.json/route.ts
    clinics/[slug]/agent-card.json/route.ts   clinics/[slug]/rpc/route.ts
    customers/[agentId]/agent-card.json/route.ts   customers/[agentId]/rpc/route.ts
  globals.css                    # 토큰 (:root 변수 + @theme)
components/ui/                   # 05-screens.md 공통 컴포넌트
lib/
  a2a/
    schemas.ts                   # pibu/*@1 zod + 타입 + parsePibuData
    cards.ts                     # Agent Card 생성 (03 문서 예시와 같은 모양)
    server.ts                    # SDK 래퍼: makeRpcRoute(card, executor)
    client.ts                    # fetch 기반 JSON-RPC 클라이언트 + A2A 로그 기록
    auth.ts                      # 에이전트 JWT 발급·검증, 추천 토큰 ES256
    mask.ts                      # 로그 마스킹
    log.ts                       # A2ALogEntry 저장·조회, humanSummary 생성
  agents/
    customer/  executor.ts  orchestrator.ts  intent.ts  consent.ts  records.ts  schedule.ts
    (공통) lib/clock.ts            # 고정 가능한 시계 (06-data-model.md 시계)
    platform/  executor.ts  matching.ts  fairness.ts  fairness-copy.ts  rules.ts  outcomes.ts  proposer.ts  eligibility.ts
    clinic/    executor.ts  quote.ts  booking.ts  proxy.ts
  domain/                        # 06-data-model.md 타입
  store/     types.ts  memory.ts  seed.ts
  llm/       client.ts  prompts/  tools/
  zk/        codes.ts  clauses.ts  client.ts  types.ts   # ZK 확장 공용 라이브러리 (아래 모듈 경계)
  i18n/
data/seed/                       # 06-data-model.md 시드 파일
messages/                        # next-intl
tests/                           # vitest
e2e/                             # playwright 데모 시나리오
scripts/check-boundaries.mjs     # 모듈 경계 검사
glowpass/                        # ZK 확장: 데모 서버 (지갑, 오퍼 매칭·증명·검증, relayer, 후기 집계, 공개 원장 화면). 데모 맥에서 실행
zk/                              # ZK 확장: Noir 회로 (eligibility, append)와 회로 코드 표 codes.json
chain/                           # ZK 확장: RecordRegistry 컨트랙트 (Base Sepolia), relayer 키(chain/.env), 지갑 파일(git 제외)
```

`lib/zk/` 파일 역할: `codes.ts`는 id와 회로 코드 변환(`zk/codes.json` 기준), `clauses.ts`는 `clauseHolds`(기기 안 오퍼 매칭), `client.ts`는 `ZK_SERVER_URL` fetch 래퍼, `types.ts`는 `ZkClause`와 증명 번들 타입.

`next.config.ts`의 `rewrites`: `/.well-known/agent-card.json` → `/a2a/platform/agent-card.json`.

## 모듈 경계 (원칙 2 강제)

`scripts/check-boundaries.mjs`가 import 그래프를 검사하고 `npm run check:boundaries`로 실행한다. 위반 시 exit 1.

| 모듈 | import 금지 대상 |
| --- | --- |
| `lib/agents/platform/**` | `lib/agents/customer/**`, `lib/agents/clinic/**`, 정산 모듈 (`lib/agents/platform/settlement*`는 `matching.ts`·`fairness.ts`에서 금지) |
| `lib/agents/customer/**` | `lib/agents/platform/**`, `lib/agents/clinic/**` |
| `lib/agents/clinic/**` | `lib/agents/customer/**`, `lib/agents/platform/**` |
| `app/[locale]/**`, `app/api/customer/**` | `lib/agents/platform/**`, `lib/agents/clinic/**` |
| `lib/zk/**` | `lib/agents/**` 전부 (ZK 확장). `lib/zk`는 세 에이전트 모듈이 모두 import할 수 있는 **공용 라이브러리**이고, 에이전트 모듈을 import하지 않는다 |

저장소 접근도 같은 규칙: 각 모듈은 `store.get("customer", ...)`처럼 자기 네임스페이스 문자열만 쓴다. `check-boundaries.mjs`가 `store\.(get|list|put|remove)\("(platform|clinic|customer)"` 패턴을 모듈 위치와 대조한다.

## A2A 서버 연결 (`lib/a2a/server.ts`)

SDK의 `DefaultRequestHandler` + `InMemoryTaskStore` + 에이전트별 `AgentExecutor`를 `JsonRpcTransportHandler`로 감싸 Next.js 라우트 핸들러로 노출한다.

```ts
// lib/a2a/server.ts (골격. 정확한 시그니처는 node_modules/@a2a-js/sdk/dist/server/index.d.ts 기준)
import { DefaultRequestHandler, JsonRpcTransportHandler, ServerCallContext, type AgentExecutor } from "@a2a-js/sdk/server";
import type { AgentCard } from "@a2a-js/sdk";

export function makeRpcRoute(getCard: (params: Record<string, string>) => Promise<AgentCard>, getExecutor: (params: Record<string, string>) => AgentExecutor) {
  return async function POST(req: Request, ctx: { params: Promise<Record<string, string>> }) {
    const params = await ctx.params;
    const caller = await verifyAgentToken(req.headers.get("authorization")); // lib/a2a/auth.ts, 실패 시 401
    const handler = new JsonRpcTransportHandler(
      new DefaultRequestHandler(await getCard(params), taskStoreFor(params), getExecutor(params)),
    );
    const context = new ServerCallContext({
      requestedVersion: req.headers.get("a2a-version") ?? "1.0", // 헤더 없으면 SDK 기본값이 "0.3"이므로 반드시 넘긴다
      user: toSdkUser(caller),
    });
    const result = await handler.handle(await req.json(), context);
    // result가 AsyncGenerator면 스트리밍 요청이다. P0는 SendStreamingMessage를 지원하지 않으므로 에러로 응답
    return Response.json(result);
  };
}
```

### SDK 함정 (반드시 읽을 것)

1. **SDK 내부 TS 타입과 와이어 JSON은 모양이 다르다.** SDK 타입의 Part는 `{ content: { $case: "data", value: {...} } }`, 상태는 숫자 enum `TaskState.TASK_STATE_COMPLETED`(= 3)다. 와이어 JSON은 `{ "data": {...} }`, `"TASK_STATE_COMPLETED"` 문자열이다. `AgentExecutor` 안에서는 SDK 타입을, `lib/a2a/client.ts`(fetch)에서는 와이어 JSON을 다룬다. 변환은 `JsonRpcTransportHandler`가 한다. 섞지 말 것.
2. `ServerCallContext`의 `requestedVersion` 기본값이 `"0.3"`이다. 클라이언트는 항상 `A2A-Version: 1.0` 헤더를 보내고, 서버는 위처럼 넘긴다.
3. `AgentExecutor.execute`는 **첫 이벤트로 반드시 `task` 또는 `message`를 publish**해야 한다 (`AgentEvent.task(...)`). `statusUpdate`로 시작하면 SDK가 거절한다. 끝나면 `eventBus.finished()`.
4. `InMemoryTaskStore`는 프로세스 메모리다. 에이전트마다(플랫폼 1, 병원 slug별, 고객 agentId별) 별도 인스턴스를 `Map`에 캐시한다. 그래야 `GetTask`가 같은 저장소를 본다.
5. Next.js dev 서버의 핫 리로드로 모듈 싱글턴이 재생성될 수 있다. 저장소·태스크 저장소 싱글턴은 `globalThis.__pibu`에 붙인다.

### `AgentExecutor` 공통 흐름 (`lib/agents/*/executor.ts`)

```ts
// 의사 코드
execute(ctx, bus) {
  const msg = ctx.userMessage;
  const skillId = msg.metadata?.skillId;
  const data = firstDataPart(msg);                 // SDK 타입: part.content.$case === "data"
  const parsed = parsePibuData(skillId, data, ctx.task); // zod. 실패 시 JSON-RPC -32602 (태스크를 만들지 않는다). input-response 예외는 03 라우팅 규칙 3번
  bus.publish(AgentEvent.task(newTask(ctx, "TASK_STATE_WORKING")));
  const result = await skills[skillId](parsed, ctx); // 순수 도메인 함수
  bus.publish(AgentEvent.artifactUpdate(artifactOf(result)));
  bus.publish(AgentEvent.statusUpdate(status(ctx, result.state ?? "TASK_STATE_COMPLETED")));
  bus.finished();
}
```

`clinic.book` (호출자가 `returnImmediately: true`로 보냄): 대행 모드든 직접 모드(`autoConfirm=false`)든 태스크를 `TASK_STATE_WORKING`으로 두고 `ClinicBooking.status = pending_clinic` 저장 후 `finished()`. 대행이면 운영자가 `/ops/proxy-queue`에서(`confirmProxyBooking`), 직접이면 병원이 `/clinic/inbox`에서(`confirmClinicBooking`) 확정하면 `lib/agents/clinic/booking.ts`가 태스크 저장소의 그 태스크에 artifact와 `COMPLETED` 상태를 써 넣는다 (SDK `TaskStore.save`). 고객 에이전트는 `GetTask` 폴링으로 확정을 본다.

## A2A 클라이언트 (`lib/a2a/client.ts`)

SDK `ClientFactory` 대신 얇은 fetch 클라이언트를 쓴다. (이유: 로그 기록·마스킹·타임아웃을 한 곳에서 통제, 와이어 JSON을 그대로 다룸)

```ts
export async function sendMessage(opts: {
  from: AgentRef; toCardUrl: string; skillId: string; data: PibuData; text?: string;
  contextId: string; taskId?: string; metadata?: Record<string, unknown>; timeoutMs?: number; // 기본 20000
  returnImmediately?: boolean; // clinic.book, customer.checkin은 true (03 응답 형태 규칙)
}): Promise<WireTask>; // JSON-RPC result.task 를 꺼내 반환
export async function getTask(opts: { from: AgentRef; toCardUrl: string; taskId: string }): Promise<WireTask>;
```

- 카드 URL에서 카드를 받아(60초 캐시) `supportedInterfaces`에서 `protocolBinding = "JSONRPC"`, `protocolVersion = "1.0"`인 URL을 고른다.
- 헤더: `A2A-Version: 1.0`, `Authorization: Bearer <from 에이전트 토큰>`, 확장 사용 시 `A2A-Extensions`.
- 응답 `result`는 `SendMessage`면 `{ task }` 래퍼, `GetTask`면 Task 자체다.
- 요청·응답을 마스킹 후 `A2ALogEntry`로 저장, `humanSummary`는 스킬별 템플릿 (`lib/a2a/log.ts`).

## LLM 사용 (Claude만)

| 용도 | 위치 | 모델 환경 변수 (기본값) | 출력 강제 |
| --- | --- | --- | --- |
| 고객·병원 채팅 온보딩 | `app/api/onboarding/*` | `CLAUDE_MODEL_CHAT` (`claude-sonnet-5-5`) | 도구 `update_profile`, `show_widget`, `request_consent`, `finish_onboarding` |
| 요청 정리 ("리주란 받고 싶어" → 조건) | `lib/agents/customer/intent.ts` | `CLAUDE_MODEL_CHAT` | 도구 `draft_procedure_request` (zod 검증) |
| 실장 대화·결과 요약 | `lib/agents/customer/orchestrator.ts` | `CLAUDE_MODEL_CHAT` | 텍스트 (판정 수치는 프롬프트에 주입, 모델이 숫자를 만들지 않게) |
| 가격표·문자 추출 | `lib/agents/clinic/proxy.ts`, 병원 온보딩 | `CLAUDE_MODEL_CHAT` (이미지 입력) | 도구 `extract_menu_items` |
| 규칙 제안 | `lib/agents/platform/proposer.ts` | `CLAUDE_MODEL_REASONING` (`claude-opus-5-5`) | 도구 `propose_rules` |
| 짧은 번역·라벨 | `lib/llm/translate.ts` | `CLAUDE_MODEL_FAST` (`claude-haiku-5-5`) | 텍스트 |

- 판정(`fairness.ts`)과 매칭(`matching.ts`)은 LLM을 쓰지 않는다.
- 모든 LLM 호출은 `lib/llm/client.ts` 하나를 거친다. `ANTHROPIC_API_KEY`가 없으면 **데모 모드 응답**(픽스처)으로 동작해 키 없이도 데모가 끝까지 돈다 (`lib/llm/fixtures/`).
- 프롬프트에는 [08-compliance.md](08-compliance.md) 6절 의료 경계 블록을 공통으로 넣는다.

## 환경 변수 (`.env.example`)

```text
ANTHROPIC_API_KEY=
CLAUDE_MODEL_CHAT=claude-sonnet-5-5
CLAUDE_MODEL_REASONING=claude-opus-5-5
CLAUDE_MODEL_FAST=claude-haiku-5-5
PUBLIC_BASE_URL=http://localhost:3000
A2A_TOKEN_SECRET=change-me-32-bytes-min
REFERRAL_PRIVATE_JWK=
REFERRAL_PUBLIC_JWK=
FOREIGN_PATIENT_AGENCY_REG_NO=
COMMISSION_RATE=
VAT_REFUND_ENABLED=false
DEMO_MODE=true
DEMO_NOW=2026-11-12T10:00:00+09:00
ZK_SERVER_URL=http://localhost:4000
ZK_CHAIN_ID=84532
ZK_REGISTRY_ADDRESS=
```

ZK 확장: relayer 키는 `chain/.env`의 `DEPLOYER_PRIVATE_KEY`에만 둔다. Next 앱의 환경 변수에는 절대 넣지 않는다.

`REFERRAL_*_JWK`가 비어 있으면 부팅 시 ES256 키쌍을 생성해 메모리에 둔다 (데모 전용, 재시작하면 기존 추천 토큰 무효).

## 배포

- 데모: 로컬 `npm run build && npm start` (단일 프로세스, 메모리 저장소 유지). 발표 화면은 이 방식으로 띄운다.
- ZK 확장: `glowpass/` 서버는 데모 맥에서 Next 앱 옆에서 함께 돈다 (`ZK_SERVER_URL`). 차트 원본(`chain/wallets/`)이 그 맥에만 있어서 다른 서버에서는 증명이 실패한다. 로드맵: 브라우저 지갑(localStorage + bb.js WASM 증명)으로 서버 지갑을 없앤다 (10 T18).
- Vercel: README대로 배포 가능하지만 서버리스 인스턴스 간 메모리가 공유되지 않아 태스크 폴링이 다른 인스턴스로 가면 깨진다. Vercel에서 시연하려면 P1의 Postgres 저장소(태스크 저장소 포함)가 먼저 필요하다.

## 스크립트 (`package.json`)

| 스크립트 | 내용 |
| --- | --- |
| `dev` | `next dev` |
| `build` · `start` | |
| `lint` | `eslint .` (Next 16에는 `next lint`가 없다) |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `e2e` | `playwright test` (데모 시나리오) |
| `check:boundaries` | `node scripts/check-boundaries.mjs` |
| `check:tokens` | `node scripts/check-tokens.mjs` (`#hex`, 임의 px, 기본 팔레트 색 클래스, 이모지, 엠·엔대시 검사, `app/`·`components/` 대상) |
| `gate` | `npm run lint && npm run typecheck && npm test && npm run check:boundaries && npm run check:tokens && npm run build` |
