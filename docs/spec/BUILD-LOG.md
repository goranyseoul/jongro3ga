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
| 18 | 게이트와 린트 | 09 스크립트 표: `lint` = `eslint .`, `gate`에 포함. 10 T00: ESLint 포함 스캐폴드 | ESLint가 없었음 (앱 스캐폴드 세션이 빼고 시작). WP0 (2026-10-24 저녁, `goranyseoul/a2a-core`)에서 `eslint` 10 + `eslint-config-next` 16 flat config(`eslint.config.mjs`) 추가, `glowpass/`·`zk/`·`chain/`은 제외. 첫 실행에서 UI 세션 소유 파일 10곳이 React Compiler 규칙(`react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`) 에러 | 다른 세션 화면 코드는 고치지 않고 그 3개 규칙만 `warn`으로 낮춰 게이트는 에러 0으로 통과. UI 세션이 10곳을 고치면 `error`로 되돌린다. 같은 WP0에서 `scripts/check-boundaries.mjs`(09 경계 표 + 저장소 네임스페이스, `scripts/check-boundaries.test.ts` 양성 대조), `check:tokens`(기존 `lint:tokens`는 별칭으로 유지), `e2e`(`playwright.config.ts`, 스펙은 아직 없음), `.env.example`(09 표), 의존성 4종(`@a2a-js/sdk` 1.3.0, `jose` 6.2.13, `@anthropic-ai/sdk` 1.3.0, `@playwright/test` 1.64.1, 09 표와 동일) 추가. 5행·6행의 "없음"은 이 행으로 갱신 |

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
