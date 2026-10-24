# PibooK

**내 시술 기록부터 다음 병원까지** · The skin log Korean women actually use

> 한국 여성이 쓰는 **3초 시술 트래커**로 진짜 시술 데이터를 모으고, 그 데이터를 바탕으로 외국인에게 **상담실장 AI**가 시술·용량·주기를 추천하고, **병원 에이전트**들과 조건을 맞춰 방한 일정에 맞는 병원·가격을 찾아 예약하고 기록까지 관리하는 의료관광 A2A 앱.

- 기획 문서: [PLANNING.md](PLANNING.md)
- **웹서비스 스펙 (정본): [docs/spec/](docs/spec/00-overview.md)** · 고객·플랫폼·병원 에이전트가 [A2A v1.0](https://github.com/a2aproject/A2A)으로 대화
- 해커톤 규칙: AI는 **Claude만** 사용
- 사용자: ① 한국 사용자 (시술 기록, 데이터 공급) ② 외국인 의료관광객 (일본·중국·미국 등)

---

## MVP 기능 (해커톤 데모 범위)

P0 전체 목록: [docs/spec/00-overview.md](docs/spec/00-overview.md#범위)

- [ ] **채팅 온보딩:** 고객이 채팅으로 일정·피부 고민·과거 시술·안전 정보·예산을 말하면 내 에이전트가 만들어진다
- [ ] **한마디 → 조건:** "리주란 받고 싶어" → 시술 · 용량 · 예산 · 지역 · 언어 · 날짜 조건 카드
- [ ] **A2A 대화 대행:** 내 에이전트가 플랫폼에 매칭을 묻고, 병원 에이전트들에 견적을 받고, 플랫폼에 판정을 받는다 (진행 화면에 실시간 표시)
- [ ] **가격·용량 판정:** 실제 결제 기록 분포 대비 적정 / 높음 / 용량 부족 / 판정 불가 + 근거
- [ ] **예약:** 직접 운영 병원은 병원 콘솔에서, 대행 운영 병원은 운영자 큐에서 확정
- [ ] **내 시술 기록:** 예약 자동 기록 + 3초 수동 기록, 다음 회차 계산 (한국 여성 트래커 포함)
- [ ] **결과 기록 → 개선 루프:** 후기는 플랫폼으로, 플랫폼 에이전트가 연결 규칙을 제안하고 운영자가 승인

## 아키텍처

세 에이전트가 각자 Agent Card를 들고 A2A 1.0 JSON-RPC로 대화한다. 상세: [docs/spec/03-a2a-protocol.md](docs/spec/03-a2a-protocol.md), [docs/spec/09-architecture.md](docs/spec/09-architecture.md)

```
[고객 에이전트 · PibooK 실장]  ──A2A──→  [플랫폼 에이전트]  매칭 · 가격/용량 판정 · 후기 수집 · 연결 규칙 개선
        │  (고객 소유)                    (PibooK 소유)
        └────────A2A (추천 토큰)────────→  [병원 에이전트 × N]  가격 · 용량 · 이벤트 · 예약
                                           (병원 소유, 초기엔 PibooK 대행 운영 → 병원이 인수)
```

## 데이터

시드 파일과 스키마: [docs/spec/06-data-model.md](docs/spec/06-data-model.md)

시술 주기 규칙 (확정분):
- 리쥬란: 한 달 간격 3회 연속 → 이후 약 4개월(3~4개월)마다
- 써마지: 연 1회 (1~2회)
- 울쎄라: 연 1회
- 그 외 시술·적정 용량: `TODO` (기획팀 확인)

병원은 **가상 이름**만 쓴다. 한국 여성 패턴은 **데모용 가상 통계**다.

## 화면

맛집 예약 앱 스타일 (레스토랑 → 병원, 코스 메뉴 → 시술 패키지)

0. 내 시술 기록 (한국 사용자 홈): 3초 기록 버튼, 타임라인, 다음 회차
1. 홈 (외국인): 언어·국가 선택, 시술 카테고리
2. 상담: 상담실장 채팅 + 고민 칩(탄력/모공/주름/색소)
3. 추천 결과: 시술 카드 (이유, 적정 용량, 주기, 단위 가격대, 한국 여성 선택률)
4. 스케줄: 방한 날짜 → 캘린더에 회차 표시
5. 병원 비교: 랭킹순·단위가격순, 할인, 구매 수
6. 병원 상세: 패키지, 후기, 예약 버튼
7. 내 시술 기록: 기록 목록 + 다음 회차 알림

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind
- `@anthropic-ai/sdk` (Claude tool use), 기본 모델 Sonnet
- Vercel 배포

## 실행

```bash
git clone https://github.com/goranyseoul/jongro3ga.git
cd jongro3ga
npm install
cp .env.example .env   # ANTHROPIC_API_KEY=...
npm run dev
```

- `.env`는 커밋 금지 (`.gitignore` 포함). 레포는 Public.
- Claude 호출은 서버(API 라우트)에서만.

## 데모 시나리오

3분 시나리오와 장면별 기대값: [docs/spec/10-build-plan.md](docs/spec/10-build-plan.md#데모-시나리오-3분-픽스처-모드-기준-기대값)

---

## Claude Code에게 (빌드 순서)

빌드 순서와 태스크별 수용 기준은 [docs/spec/10-build-plan.md](docs/spec/10-build-plan.md)를 따른다 (T00 ~ T15). 기획 의도는 `PLANNING.md`, 규제 근거는 [docs/spec/08-compliance.md](docs/spec/08-compliance.md).

## 개발

```bash
npm install
npm run dev          # http://localhost:3000, 공통 컴포넌트 카탈로그는 /ui-kit
npm run typecheck
npm run build        # prebuild가 토큰 가드와 컴포넌트 목록을 먼저 검사한다
```

디자인 값(색, 간격, 모서리, 타이포)은 `app/globals.css`의 CSS 변수가 유일한 출처이고, `tailwind.config.ts`는 그 변수만 매핑한다. 토큰 이름과 UI 규칙은 스펙의 `docs/spec/05-screens.md`를 따른다.

## ZK 기록 레이어 (ZK 확장)

병원은 차트를 보지 않고 증명만 본다. 고객 에이전트가 병원 이벤트의 조건(`event.zkClauses`)을 기기 안에서 매칭하고, 해당되는 오퍼만 ZK 증명으로 주장한다 (예: "리쥬란 정확히 1회" = 2회차 오퍼, "우리 병원 기록 0건" = 첫 방문). 시술 기록은 고객 지갑에, 체인(Base Sepolia)에는 가명 → 차트 해시만 저장한다. 후기는 Semaphore로 실제 방문자만 익명 1회, 화면에는 집계(n, 평점)만. 시나리오·id의 정본은 `docs/spec` (03 ZK 확장, 06, 07, 10 T16~T18), 연동 가이드: [docs/INTEGRATION.md](docs/INTEGRATION.md)

| 디렉터리 | 내용 |
| --- | --- |
| `zk/` | Noir 회로: `eligibility`(오퍼 조건 증명), `append`(기록 추가 증명), `commit`, `record_hash`. `codes.json`은 시술·병원 id의 회로 코드 |
| `chain/` | `RecordRegistry.sol` + 검증 컨트랙트, 지갑·증명 로직(`records.mjs`), Semaphore 익명 후기(`reviews.mjs`), 로컬 e2e(`e2e.mjs`) |
| `glowpass/` | ZK HTTP API 데모 서버 + 데모 콘솔 + 공개 원장 화면 `/ledger`. `catalog.mjs`가 스펙 id·오퍼·시드의 정본 |
| `lib/zk/` | Next.js 쪽 공용 라이브러리: 조건 매칭(`clauses.ts`), 회로 코드(`codes.ts`), glowpass 클라이언트(`client.ts`) |

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd glowpass && npm i)
cd glowpass && npm start                  # http://localhost:4000 (Next.js는 3000)
```

페르소나 증명은 차트 원본(지갑 파일)이 있는 데모 맥 서버에서만 성공한다 (docs/INTEGRATION.md 1절).
