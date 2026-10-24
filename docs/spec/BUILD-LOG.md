# BUILD-LOG

빌드 중 발견한 스펙과 현실의 차이, 결정, 막힌 지점을 적는다. 스펙 문서(00~10)는 고치지 않는다.

## 스펙 이슈 (통합 시점 2026-10-24 13:20 KST, `feat/integration`)

| # | 영역 | 스펙 | 현재 코드 | 채택한 해석 / 다음 할 일 |
| --- | --- | --- | --- | --- |
| 1 | 스타일 | Tailwind v4, `@theme` 토큰 (09) | Tailwind 3.4 + `tailwind.config.ts`가 `globals.css` 변수를 매핑 (앱 스캐폴드 세션) | 토큰 단일 출처(`globals.css`)라는 목적은 같아서 3.4 유지. 스펙 09의 v4 문구는 현실과 다름 |
| 2 | 컴포넌트 카탈로그 | `/demo/ui` (10 T01) | `/ui-kit` | `/ui-kit` 유지 |
| 3 | 브랜드 | Pibu | 전 화면 `Pibuk` (프로토콜 식별자 `pibu/*@1`, `pibu.app`은 그대로) | 오너 결정 2026-10-24, `feat/integration-2`에서 일괄 치환 |
| 4 | 테마 | 무채색 코어 + `--brand` 1색 | 랜딩은 sunrise 그라데이션 라이트, 나머지는 다크 | 오너 결정 대기 |
| 5 | 의존성 | `@a2a-js/sdk`, `@anthropic-ai/sdk`, `jose`, `@playwright/test` (09) | 없음 | 에이전트 로직(T04~T08)을 붙이는 세션이 추가 |
| 6 | 백엔드 | `app/a2a/**`, `app/api/**`, `lib/agents/**`, `data/seed`, `lib/clock.ts` | 없음. `lib/a2a/{schemas,wire,mask,log}`, `lib/store`, `lib/domain`까지 | T03~T08 담당 세션 필요 (현재 아무도 안 맡음) |
| 7 | 화면 데이터 | 스펙 06 필드명 | `lib/ui-data/*` 목데이터, `lib/domain`의 일부 타입만 import | 백엔드 연결 때 어댑터만 교체 |
| 8 | 온보딩 라우트 | `/[locale]/onboarding` 별도 화면 (05) | 랜딩이 곧 온보딩 채팅, `/[locale]/onboarding`은 랜딩으로 이동 | 앱 스캐폴드 세션 결정 채택 |
| 9 | ZK 레이어 | 스펙에 없음 | 팀원 `feat/zk-record-registry`를 `glowpass/`·`zk/`·`chain/`으로 통합 | 연동 방식은 [docs/INTEGRATION.md](../INTEGRATION.md). 스펙 반영은 별도 결정 |

## 통합 기록

- `main`(스펙) 위에 `feat/app-scaffold` → `feat/ui-customer` → `feat/ui-clinic` → `feat/ui-ops` → `feat/backend-skeleton` → `origin/feat/zk-record-registry` 순서로 머지. `feat/mvp-build`(스캐폴드 중복)는 제외.
- 충돌 해소: 랜딩·권익 안내·온보딩은 앱 스캐폴드 쪽(최신, 오너 지시 반영) 채택 후 고객 세션의 온보딩 완료 버튼·데모 날짜 고정을 다시 적용. `package.json`은 양쪽 의존성 합집합. README는 양쪽 절 유지.
- 팀원 GlowPass 서버는 `app/`(Next.js App Router 디렉토리와 충돌)에서 `glowpass/`로 이동. 경로가 `import.meta.url` 기준이라 동작 동일.

## 통합 2 (2026-10-24, `feat/integration-2`)

- `origin/main`(PR #2) 위에 그 뒤 쌓인 `feat/app-scaffold`, `feat/backend-skeleton`, `origin/feat/zk-record-registry`를 머지. `feat/mvp-build`는 이번에도 제외 (스캐폴드 중복).
- 충돌: `app/[locale]/onboarding/onboarding-chat.tsx`의 import 한 곳. 고객 세션의 `DEMO_TODAY`를 살리고 쓰지 않게 된 `cn`·`wordBreak` import는 뺐다.
- 브랜드: 고객·병원·운영·데모·메시지의 `Pibu` 88곳을 `Pibuk`으로 바꿨다. 한국어 조사는 받침에 맞춰 바꿨다 (가 → 이, 는 → 은 등).
- 반응형 게이트 (20개 화면 × 9개 폭, 맥 글꼴과 CI 한글 폭): 푸터 언어 링크 터치 영역(앱 스캐폴드)과 운영 콘솔 탭의 폰 폭 옆 스크롤(`components/ops/ops-nav.tsx`)을 고쳤다. 남은 예외는 `/clinic/agent`의 JSON 코드 보기 영역의 옆 스크롤 하나 (코드 줄이라 의도된 동작).
- 이번 PR 스크린샷: `docs/screenshots/integration-2/`.
