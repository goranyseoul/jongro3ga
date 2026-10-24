# BUILD-LOG

빌드 중 발견한 스펙과 현실의 차이, 결정, 막힌 지점을 적는다. 스펙 문서(00~10)는 고치지 않는다.

## 스펙 이슈 (통합 시점 2026-10-24 13:20 KST, `feat/integration`)

| # | 영역 | 스펙 | 현재 코드 | 채택한 해석 / 다음 할 일 |
| --- | --- | --- | --- | --- |
| 1 | 스타일 | Tailwind v4, `@theme` 토큰 (09) | Tailwind 3.4 + `tailwind.config.ts`가 `globals.css` 변수를 매핑 (앱 스캐폴드 세션) | 토큰 단일 출처(`globals.css`)라는 목적은 같아서 3.4 유지. 스펙 09의 v4 문구는 현실과 다름 |
| 2 | 컴포넌트 카탈로그 | `/demo/ui` (10 T01) | `/ui-kit` | `/ui-kit` 유지 |
| 3 | 브랜드 | Pibu | **결정됨 (2026-10-24, 오너): 영문 표기 `PibooK`, 하이픈 없음, 한글은 `피북`.** 화면, 메시지, README, `PLANNING.md`, `DEMO.md`는 `scripts/rename-brand.mjs`로 치환 완료. `prebuild`가 옛 표기(`Pibuk`, `Pibu-k`, `PiBoo-K`)가 돌아오면 빌드를 실패시킴 | `docs/spec` 00~10은 이 문서 규칙대로 고치지 않아 아직 `Pibu`. 프로토콜 식별자(`pibu/*@1`, `pibu.app`, `pibuBearer`)는 브랜드가 아니라 버전이 붙은 와이어 이름이라 유지. 바꿀지는 별도 결정 |
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
