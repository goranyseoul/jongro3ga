# 02 · 에이전트 3종

각 에이전트는 **내부 기능**(자기 사용자·운영자와만 하는 일)과 **A2A 스킬**(다른 에이전트가 요청할 수 있는 일)을 가진다. A2A 스킬은 [03-a2a-protocol.md](03-a2a-protocol.md)의 Agent Card `skills[]`와 1:1로 일치해야 한다 (검증: `node scripts/verify-spec.mjs skills`).

## 공통 규칙

- 에이전트 간 호출은 A2A 1.0 JSON-RPC (`SendMessage`, `GetTask`)로만 한다. 같은 프로세스여도 HTTP로 부른다.
- 요청·응답 본문은 `DataPart`(Part의 `data` 필드)에 `pibu/*@1` 스키마 객체로 담는다. 사람에게 보여줄 문장은 같은 메시지의 `text` Part에 고객 언어로 함께 담는다.
- 모든 A2A 호출은 A2A 로그(`a2a_log`)에 저장되어 운영 콘솔과 고객 진행 화면에서 보인다.
- LLM은 Claude만 쓴다. 모델 선택은 [09-architecture.md](09-architecture.md)의 LLM 표.

## 1. 고객 에이전트 (Pibu 실장)

- **소유자:** 고객. 호스팅은 Pibu가 하지만 저장소는 고객 단위로 분리되고, 고객이 내보내기·삭제할 수 있다.
- **Agent Card:** 고객마다 1개. 공개 디렉토리에 노출하지 않으며, 인증된 병원·플랫폼 에이전트만 조회한다.
- **얼굴:** 고객과 대화하는 "Pibu 실장". 고객 언어(ja / zh-CN / en / ko)로 말한다.

### 내부 기능

| 기능 | 설명 | 우선순위 |
| --- | --- | --- |
| 온보딩 | 채팅으로 프로필 구축 ([04-onboarding-chat.md](04-onboarding-chat.md)) | P0 |
| 요청 정리 | 한마디("리주란 받고 싶어")를 `pibu/procedure-request@1`로 정리. 빠진 필수 슬롯만 되묻는다. 기본값 규칙: 용량을 말하지 않으면 `platform.recipe`의 통상 용량 **최솟값**(`typicalAmount.min`), 지역은 숙소 지역이 속한 **지역 그룹 전체** (예: 신사 → 신사·강남·압구정, [07-platform-intelligence.md](07-platform-intelligence.md) 지역 그룹), 예산은 `prefs.budgetKrw`, 날짜는 체류 기간, 언어는 `prefs.languagesNeeded` | P0 |
| 대화 대행 | 플랫폼에 매칭 요청 → 후보 병원들에 병렬 견적 요청 → 플랫폼에 판정 요청 → 결과를 고객 언어로 요약. 병원이 20초 안에 답하지 않거나 거절하면 `platform.report_signal`로 알린다 | P0 |
| 예약 대행 | 고객이 고른 견적으로 병원에 예약 요청. 병원이 추가 정보를 요구하면(`TASK_STATE_INPUT_REQUIRED`) 프로필에서 동의된 값으로 답하거나 고객에게 묻는다 | P0 |
| 내 시술 기록 | 예약으로 받은 시술은 자동 기록, 그 외는 3초 수동 기록. 다음 회차 계산 (주기 규칙은 `data/seed/procedures.json`) | P0 |
| 결과 기록 | D0(실결제·실용량) P0, D7·D30 체크인 P1. 고객이 확인하면 플랫폼 `platform.submit_outcome`으로 전송 | P0 / P1 |
| 동의 관리 | 어떤 필드를 누구에게 보낼 수 있는지 동의 원장(consent ledger)으로 관리. 보내기 전 항상 원장을 확인 | P0 |
| 데이터 이식 | 내 프로필·기록·대화 JSON 내보내기, 전체 삭제 | P1 |
| 기록 지갑과 오퍼 증명 (ZK 확장) | 지갑이 비공개 차트(시술 이력)를 보관한다. 병원 오퍼의 `event.zkClauses`를 **기기 안에서** 매칭하고, 해당되는 오퍼만 증명을 만들어 `clinic.quote` 메시지에 붙인다. 이력 원본은 어떤 메시지에도 보내지 않는다 ([INTEGRATION.md](../INTEGRATION.md)) | P0 |
| 후기 제출 (ZK 확장) | 시술 완료 후 받은 Semaphore 방문 티켓으로 후기를 익명 제출한다. 방문 1회 = 후기 1회 | P0 |

### 판단하지 않는 것

- 시술이 고객에게 맞는지 의학적으로 판단하지 않는다. "한국 20대 후반 여성 기록에서는 이 고민에 이 시술을 가장 많이 받았어요" 같은 **데이터 인용**까지만 한다.
- 가격 적정성을 스스로 판단하지 않는다. 플랫폼 판정을 그대로 전한다.

### A2A 스킬 (고객 에이전트가 받는 요청)

| 스킬 id | 호출자 | 입력 | 출력 | 우선순위 |
| --- | --- | --- | --- | --- |
| `customer.notify` | 병원, 플랫폼 | `pibu/notification@1` (예약 확정·변경·리마인드·규칙 변경 안내) | 수신 확인 text | P0 |
| `customer.checkin` | 플랫폼 | `pibu/checkin-request@1` (예: "견적과 실결제가 달랐나요?") | `pibu/outcome@1` 또는 `TASK_STATE_INPUT_REQUIRED`(고객 응답 대기) | P1 |

## 2. 플랫폼 에이전트

- **소유자:** Pibu.
- **Agent Card:** 1개, 공개. 루트 `/.well-known/agent-card.json`에서도 제공.
- **데이터:** 시술 마스터, 병원 레지스트리, 가격 기록(익명), 결과·후기, 연결 규칙, 매칭 로그.

### 내부 기능

| 기능 | 설명 | 우선순위 |
| --- | --- | --- |
| 병원 레지스트리 | 병원별 Agent Card URL, 운영 모드(대행/직접), 등록 상태, 데이터 신선도 | P0 |
| 대행 병원 운영 | 대행 모드 병원 에이전트의 데이터(가격·이벤트·시간)를 운영자가 관리. 문자·공개 정보 붙여넣기 → Claude 추출 → 운영자 확인 | P0 (시드) / P1 (추출) |
| 규칙 엔진 | 연결 규칙 평가, 버전 관리, 매칭마다 적용 규칙 기록 ([07-platform-intelligence.md](07-platform-intelligence.md)) | P0 |
| 규칙 제안 | 결과 신호를 모아 Claude가 규칙 후보와 근거를 제안 → 운영자 승인 | P1 (데모에선 버튼으로 실행) |
| 유치 실적 원장 | 추천 토큰으로 귀속된 예약·결제 기록 (법정 실적 보고용) | P0 |
| 기록 앵커 relayer (ZK 확장) | 고객 지갑이 만든 append 증명을 가스를 내며 체인에 대신 제출한다. 예약이 호출 고객의 것이고 완료 상태인지, 기록 해시가 맞는지 확인한 뒤에만 보낸다 | P0 |
| 검증 방문·후기 집계 (ZK 확장) | 앵커된 방문마다 후기 티켓 1장을 발급하고, 후기를 집계(`n`, 평균 평점)한다. 원문과 집계는 로그인 고객 화면과 비교 화면에 공개한다 ([07-platform-intelligence.md](07-platform-intelligence.md)) | P0 |

### A2A 스킬 (플랫폼 에이전트가 받는 요청)

| 스킬 id | 호출자 | 입력 | 출력 | 우선순위 |
| --- | --- | --- | --- | --- |
| `platform.recipe` | 고객 | `pibu/recipe-query@1` (고민, 나이대, 시술 후보) | `pibu/recipe@1` (한국 여성 선택 조합, 통상 용량, 주기, 다운타임, 효과 시기) | P0 |
| `platform.match_clinics` | 고객 | `pibu/procedure-request@1` | `pibu/clinic-shortlist@1` (후보 병원 최대 5곳, 이유, 추천 토큰, 가격 기준 분포). 한국인·국내 거주 외국인은 `TASK_STATE_REJECTED` | P0 |
| `platform.judge_quote` | 고객 | `pibu/judge-request@1` (견적 1~N개) | `pibu/fairness-verdict-list@1` (견적별 `pibu/fairness-verdict@1`) | P0 |
| `platform.report_booking` | 병원 | `pibu/booking@1` (추천 토큰 포함) | 접수 확인 text | P0 |
| `platform.submit_outcome` | 고객 | `pibu/outcome@1` | 접수 확인 + 반영 여부 text | P0 |
| `platform.report_signal` | 고객 | `pibu/signal-report@1` (병원 응답 시간초과, 거절) | 접수 확인 text | P0 |
| `platform.anchor_record` | 고객 | `pibu/record-anchor@1` (시술 완료 후 기록 앵커) | text (`anchored <tx>` 또는 거부 사유) | P0 |
| `platform.submit_review` | 고객 | `pibu/review@1` (ZK 방문 증명 포함 후기) | text (접수와 집계 n, 또는 거부 사유) | P0 |

## 3. 병원 에이전트

- **소유자:** 병원. 초기에는 Pibu가 대행 운영한다 (`operation.mode = "proxy"`).
- **Agent Card:** 병원마다 1개, 공개. 대행이든 직접이든 **같은 URL, 같은 스킬 id, 같은 스키마**를 유지한다. 그래서 인수할 때 고객·플랫폼 쪽 코드는 바뀌지 않는다.
- **운영 모드 표시:** Agent Card의 확장 `https://pibu.app/ext/clinic-operation/v1` ([03-a2a-protocol.md](03-a2a-protocol.md))

### 내부 기능

| 기능 | 대행 모드 | 직접 모드 | 우선순위 |
| --- | --- | --- | --- |
| 메뉴·가격·이벤트 | 운영자가 문자·공개 정보로 입력 | 병원 콘솔에서 병원이 입력 | P0 |
| 예약 가능 시간 | 운영자가 주 단위 입력 (참고) | 병원이 입력 | P0 |
| 견적 응답 | 메뉴 데이터로 자동 응답, `indicative: true` (참고가) | 메뉴 데이터로 자동 응답, `indicative: false` | P0 |
| 예약 확정 | 운영자 대행 응답 큐에서 병원 확인 후 확정 | 병원 요청함에서 확정 (자동 확정 옵션) | P0 |
| 추천 토큰 검증 | 플랫폼 공개키로 서명 검증, 만료·병원 id 확인 | 동일 | P0 |
| 예약 보고 | 확정 시 플랫폼 `platform.report_booking` 호출 | 동일 | P0 |
| 오퍼 증명 검증 (ZK 확장) | `clinic.quote`의 `metadata.offerProof`를 검증해 맞으면 이벤트가를 적용, 아니면 정가 견적. 차트를 요구하지 않는다 | 동일 | P0 |

### A2A 스킬 (병원 에이전트가 받는 요청)

| 스킬 id | 호출자 | 입력 | 출력 | 우선순위 |
| --- | --- | --- | --- | --- |
| `clinic.offers` | 플랫폼, 고객 | `pibu/offers-query@1` (`month` 선택) | `pibu/offers@1` (이달 이벤트·정가 메뉴) | P0 |
| `clinic.quote` | 고객 | `pibu/procedure-request@1` + 추천 토큰 | `pibu/quote@1` | P0 |
| `clinic.availability` | 고객 | `pibu/availability-query@1` (`procedureId`, `from`, `to`) | `pibu/availability@1` | P0 |
| `clinic.book` | 고객 | `pibu/booking-request@1` + 추천 토큰 | `pibu/booking@1` (상태 `confirmed`) · 대행이면 `TASK_STATE_WORKING` 유지 후 확정 시 완료 · 추가 정보 필요 시 `TASK_STATE_INPUT_REQUIRED` | P0 |
| `clinic.cancel` | 고객 | `pibu/cancel-request@1` | `pibu/booking@1` (상태 `canceled`) | P1 |

## 누가 무엇을 아는가 (정보 경계)

| 정보 | 고객 에이전트 | 플랫폼 에이전트 | 병원 에이전트 |
| --- | --- | --- | --- |
| 고객 실명·연락처 | 보유 | 모름 (가명 id만) | 예약 확정 시 동의 범위만 |
| 피부 고민·나이대·국적 | 보유 | 요청 단위로 받음 (매칭용) | 견적 요청에 필요한 범위만 |
| 안전 정보 (임신, 알레르기 등) | 보유 | 받지 않음 | 예약 요청 시 동의하면 전달 |
| 견적 | 받음 | 판정 요청 시 받음 | 생성 |
| 실결제·만족도 | 보유 | 결과 제출 시 받음 | 개별 값은 모름, 집계(n ≥ 5)만 |
| 시술 이력 (날짜·횟수·병원) | 보유 (지갑) | 가명 → 차트 해시만 | 오퍼 조건 충족 여부만 |
| 연결 규칙 | 모름 (매칭 이유만 받음) | 보유 | 모름 |
