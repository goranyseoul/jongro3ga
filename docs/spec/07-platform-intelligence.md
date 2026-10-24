# 07 · 플랫폼 지능: 판정, 추천, 연결 규칙, 개선 루프

플랫폼 에이전트의 가치는 세 가지다. ① 이 가격에 이 용량이 적정한가 **판정**, ② 맞는 병원 **추천**, ③ 결과를 보고 연결 규칙을 **계속 고치기**. 판정과 추천은 **결정론적 코드**(테스트 가능)로 하고, LLM은 규칙 제안의 문장화와 고객 언어 요약에만 쓴다. (근거: 가격 판정이 매번 달라지면 신뢰가 무너지고, 데모 재현성이 깨진다)

모듈: `lib/agents/platform/fairness.ts`, `matching.ts`, `rules.ts`, `outcomes.ts`, `proposer.ts`. 각 모듈은 순수 함수 + 저장소 어댑터로 분리하고, 순수 함수에 단위 테스트를 둔다.

## 1. 가격·용량 판정 (`platform.judge_quote`)

### 입력 정규화

1. `normalizedTotalKrw = vatIncluded ? priceKrw : round(priceKrw × 1.1)`
2. `normalizedUnitKrw = round(normalizedTotalKrw / amount.value)`
3. 포함 항목 차이(마취크림, 진정팩)는 P0에서 금액 보정하지 않고 비교 화면에 표시만 한다.

### 기준 표본 R

- `PriceRecord` 중 `procedureId` 일치, `verified = true`, `source ≠ public_offer`, `clock.now()` 기준 최근 **120일** (now - 120일 이상, 경계 포함) ([06-data-model.md](06-data-model.md) 시계).
- 지역 그룹: `gangnam_sinsa` = {gangnam, sinsa, apgujeong} · `myeongdong` · `hongdae` · `other`. 견적 병원의 지역 그룹으로 먼저 거르고, n < 5면 서울 전체로 넓힌다 (`priceReference.region = "seoul"`).
- 견적에 `product`가 있고 같은 제품 표본이 5건 이상이면 제품으로 한 번 더 거른다.
- 이상치: 단위가격이 `p75 + 3 × IQR` 초과 또는 `p25 - 3 × IQR` 미만인 기록은 표본에서 빼고 `Signal`로 남긴다.

### 계산

| 단계 | 규칙 |
| --- | --- |
| 표본 수 | `n = |R|`. n < 5면 `priceBand = "insufficient"` |
| 분위수 | R의 `normalizedUnitKrw`로 p25, p50, p75, p90 (선형 보간) |
| 가격 구간 | x < p25 → `low` · p25 ≤ x ≤ p75 → `mid` · p75 < x ≤ p90 → `high` · x > p90 → `very_high` |
| 통상 용량 | n ≥ 10이면 R의 `amount.value` p25~p75 (0.5 단위 반올림), 아니면 시술 마스터 `typicalAmount` |
| 용량 플래그 | 견적 용량 < 통상 min → `below_typical` · > 통상 max × 1.5 → `above_typical` · 그 외 `within` |
| 병원 플래그 | 최근 90일 그 병원 결과 중 `quoteGapRatio` 평균 > 0.10 이고 n ≥ 3 → `{ code: "paid_more_than_quoted", avgGapPct }` · 대행 운영이면 `{ code: "indicative_price" }` |
| 라벨 | `below_typical` → `underdosed` 우선 · 그다음 `insufficient` → `insufficient_data` · 그 외 `low`→`good_deal`, `mid`→`fair`, `high`→`high`, `very_high`→`very_high` |
| 신뢰도 | n ≥ 30 `high` · 10~29 `medium` · 5~9 `low` · n < 5 `none` |
| 설명 | 템플릿 문장 4개 언어 (`lib/agents/platform/fairness-copy.ts`). LLM 쓰지 않음 |

`quoteGapRatio = (paidKrw - quotedKrw) / quotedKrw`, 둘 다 VAT 포함으로 정규화한 값.

### 병원 에이전트의 견적 항목 선택 (`clinic.quote`, `lib/agents/clinic/quote.ts`)

1. 요청 시술의 이달 이벤트(`clock.now()`가 `validFrom`~`validUntil` 안)가 있으면 그 이벤트 항목으로 견적 (요청 용량과 달라도 이벤트 용량 그대로. 그래서 민트는 2cc 요청에 1cc 이벤트로 답한다).
2. 없으면 메뉴 중 요청 용량에 가장 가까운 항목 (동률이면 큰 용량).
3. 해당 시술 메뉴가 없으면 `TASK_STATE_REJECTED`.
4. 슬롯은 `dateWindow` 안의 비어 있는 슬롯 전부.

### 기준 테스트 케이스 (시드 기준, `tests/fairness.test.ts`에 그대로)

기준 표본: 리쥬란 `gangnam_sinsa`, n = 42, p25 = 140,000 · p50 = 160,000 · p75 = 185,000 · p90 = 210,000, 통상 용량 2~3cc. (시드 `price-records.json`은 이 분위수가 나오도록 만든다)

| 병원 | 견적 | 정규화 단위가격 | 가격 구간 | 용량 | 병원 플래그 | 라벨 |
| --- | --- | --- | --- | --- | --- | --- |
| 민트 | 1cc · 99,000 · VAT 포함 | 99,000 | low | below_typical | indicative_price | `underdosed` |
| 서울글로우 | 2cc · 340,000 · VAT 포함 | 170,000 | mid | within | 없음 | `fair` |
| 아라 | 2cc · 300,000 · VAT 별도 | 165,000 | mid | within | paid_more_than_quoted, indicative_price | `fair` (+ 경고 문장) |
| 한빛 | 2cc · 420,000 · VAT 포함 | 210,000 | high | within | indicative_price | `high` |

이 표는 **기준 표본을 고정해 넣는 순수 함수 테스트**다. 실제 데모에서 Yuki(일본어)의 요청은 언어 하드 필터 때문에 같은 서울글로우·민트·아라 3곳만 견적을 받는다 (한빛은 중국어 응대, 다혜는 영어 응대). 한빛 행은 `high` 구간 검증용.

경계값 테스트도 둔다: x = p75 정확히 → `mid`, x = p90 정확히 → `high`, n = 4 → `insufficient_data`, n = 5 → 판정.

## 2. 병원 추천 (`platform.match_clinics`)

플랫폼은 병원 저장소를 직접 읽지 않는다. 언어 `mode`는 레지스트리(`ClinicRegistryEntry.languages`)에 있다. 병원 에이전트의 `clinic.offers`를 A2A로 받아 `ClinicOfferCache`(플랫폼 네임스페이스)에 저장하고, 매칭은 이 캐시와 레지스트리로 한다. 캐시는 부팅 시 + 운영 콘솔 [오퍼 새로고침] + 6시간마다 갱신.

### 하드 필터 (하나라도 실패하면 후보 제외)

1. `verificationStatus = "verified"` 그리고 `foreignPatientFacilityRegistered = true`
2. 요청 시술을 메뉴 또는 이달 오퍼로 제공
3. 요청 `languages` 중 하나 이상을 `staff` 또는 `interpreter`로 지원 (`app_translation`만이면 제외, 단 요청이 `ko`면 무관)

지역은 조건이 아니라 위치 정보다 (오너 결정 2026-10-24, BUILD-LOG 12). 요청 `areas`는 필터와 점수에 쓰지 않고, reasons 템플릿 문장("숙소 근처")과 화면 표시에만 쓴다. 규칙 `prefer_area`로 지역을 올릴 수는 있지만 하드 제외는 아니다.

### 점수 (0~1)

| 요소 | 가중치 | 계산 |
| --- | --- | --- |
| 적합도 | 0.35 | 언어만 (staff 1.0 · interpreter 0.6) |
| 가격 | 0.25 | 요청 용량에 가장 가까운 메뉴의 단위가격 u로 `clamp((p75 - u) / (p75 - p25), 0, 1)`. 표본 부족 시 0.5. 메뉴 용량이 통상 min 미만뿐이면 최대 0.3 |
| 결과 | 0.25 | 베이지안 평균 만족도 `(5 × 4.0 + Σs) / (5 + n)` 를 `(x - 1) / 4` 로 정규화 |
| 신뢰성 | 0.15 | `(1 - min(1, 평균 quoteGapRatio × 2)) × (1 - 응답 시간초과 비율)` (음수 gap은 0으로) |

예산: 메뉴 총액이 `budgetKrw.max × 1.1` 초과면 점수 -0.1, reasons에 "예산을 넘을 수 있음".

### 규칙 적용과 결과

1. 하드 필터 → 점수 계산 → `candidatesBeforeRules` 기록
2. 활성 규칙 중 `when`이 **요청**과 맞는 것 평가 (모든 지정 필드가 일치해야 매치, 미지정 필드는 와일드카드. 병원은 `when`에 없고 `then.clinicIds`로만 지정). 순서: `require_language` → `exclude_clinic` → `boost`/`demote`/`prefer_area` (점수 0~1로 clamp)
3. 점수 내림차순 상위 3곳. 동점은 `clinicId` 사전순 (결정론)
4. 후보마다 추천 토큰 발급 (ES256, 72시간), `reasons`는 상위 기여 요소 2개 + 규칙 기인 사유를 템플릿 문장으로 (규칙 내용 자체는 노출하지 않는다)
5. `MatchLog` 저장, 규칙 `appliedCount` 증가

## 3. 결과 수집 (`platform.submit_outcome`)

| 단계 | 규칙 |
| --- | --- |
| 호출자 검증 | 토큰 `role = customer`, `sub`가 예약의 `customerAgentId`와 같아야 한다. 병원 토큰은 거절 (후기는 병원이 아니라 고객에게서만) |
| 중복 | 같은 `bookingId` + `checkpoint`는 1건. 재제출은 덮어쓰기 + 이력 |
| 연결 | `AttributionEntry`로 예약 확인 → `JudgedQuote`에서 견적가 → `quoteGapRatio` 계산 |
| 가격 기록 | `PriceRecord` 생성 (`source = outcome`, 예약 연계면 `verified = true`, 아니면 영수증 첨부 시 운영자 확인 후 true). 시드 `outcomes.json`과 데모 주입 결과는 `PriceRecord`를 만들지 않는다 (판정 표본 n = 42 유지) |
| 신호 | `quote_gap`(> 0.10), `low_satisfaction`(≤ 2), `side_effect_report`(sideEffects 비어 있지 않음) |
| 병원 노출 | 병원은 집계만 (`/clinic/insights`, 같은 병원 결과 n ≥ 5). 개별 코멘트·점수는 병원에 보내지 않는다 |
| 공개 노출 | 결과(수치)는 매칭·판정 신호로만 쓴다. 검증 방문자의 익명 후기는 원문과 집계를 로그인 고객 화면과 비교 화면에 공개한다 (랜딩 제외, 익명 집합 3명 이상, [08-compliance.md](08-compliance.md)) |

## 4. 연결 규칙과 개선 루프

```
결과·신호 수집 → 주기적 집계 (병원 × 국적 × 시술, 30일)
      ↓
트리거 평가 (결정론) → 규칙 후보
      ↓
Claude가 근거 요약·사유 문장 작성 + 추가 패턴 제안 (proposer)
      ↓
운영자 검토 (/ops/rules) → 승인 = active, 반려 = rejected
      ↓
매칭에 적용 (MatchLog에 appliedRuleIds) → 효과 측정 (P1) → 만료·폐기
```

### 결정론 트리거 (proposer 1단계)

| 트리거 | 조건 (30일, 세그먼트 = 병원 × 국적) | 제안 규칙 |
| --- | --- | --- |
| 견적 대비 실결제 상승 | 평균 `quoteGapRatio` > 0.20, n ≥ 5 | `exclude_clinic` (그 국적만), 만료 90일 |
| 낮은 만족도 | `low_satisfaction` 비율 > 0.4, n ≥ 5 | `demote_clinic` 0.2 |
| 응답 없음 | 시간초과 비율 > 0.5, n ≥ 5 | `demote_clinic` 0.15 |
| 지역 선호 | 같은 국적에서 지역 그룹별 만족도 차이 ≥ 0.8점, 각 n ≥ 8 | `prefer_area` 0.1 |
| 부작용 보고 | `side_effect_report` ≥ 2 (모든 국적) | `exclude_clinic` 전체 + **긴급** 표시 |

### Claude 제안 (proposer 2단계, P0는 운영 콘솔 버튼으로 실행)

- 모델: `CLAUDE_MODEL_REASONING` (기본 `claude-opus-5-5`).
- 입력: 1단계 후보 + 세그먼트 집계 표 (개인 식별 정보 없음).
- 출력: 도구 `propose_rules({ rules: RoutingRuleDraft[] })` 강제. 서버가 zod 검증, 존재하지 않는 `clinicId` 참조나 금지 조건(아래)은 버린다.
- Claude가 하는 일: 각 후보의 `reason`·`evidence.summary` 한국어 작성, 1단계에 없는 패턴 최대 2개 추가 제안 (근거 outcomeId 필수).
- API 실패 시: 1단계 후보를 템플릿 사유로 그대로 제안 (데모가 LLM 상태에 의존하지 않게).

### 가드레일

1. 국적 조건은 **언어·지역 선호, 또는 그 국적에서 실제 피해가 확인된 병원 제외**에만 쓴다. 국적별 다른 가격 제시, 국적만으로 하는 불리한 처리는 금지 (proposer가 만들면 서버가 버림).
2. 건강 정보(안전 정보, 피부 상태)는 규칙 조건에 쓸 수 없다. `RuleCondition` 타입에 그 필드가 없다.
3. `exclude_clinic` 기본 만료 90일. 만료 7일 전 `/ops/rules`에 재검토 표시.
4. 승인 없이 자동 적용되는 것은 하나뿐: 외국인환자 유치기관 등록 취소 확인 또는 **긴급** 부작용 트리거 → `verificationStatus = suspended` (하드 필터로 빠짐) + 운영자 확인 요청.
5. 모든 규칙 변경은 버전 증가 + 이력 보존. 삭제 대신 `retired`.

### 효과 측정 (P1)

규칙 활성화 전후 30일, 영향 세그먼트의 평균 만족도·평균 `quoteGapRatio`·예약 전환율을 `/ops/rules` 규칙 상세에 표시.

## 5. 레시피 (`platform.recipe`)

`kr-patterns.json` + `shared_record` 출처 `PriceRecord`로, 요청 `ageBand`·`concerns`에 맞는 시술 조합 상위 3개와 share, 시술별 통상 용량·주기·다운타임·효과 시기를 돌려준다. 표본 n < 10이면 `disclaimer`에 "데이터가 적어요"를 넣는다. `demo_assumption` 시술은 `disclaimer`에 "데모용 값"을 넣는다. 의학적 권유 문장은 넣지 않는다.

## 검증 방문과 후기 집계 (ZK 확장)

ZK 기록 레이어가 만드는 두 가지 집계값을 `platform.match_clinics` 응답과 비교 화면에 보여주는 규칙이다 ([INTEGRATION.md](../INTEGRATION.md), [03-a2a-protocol.md](03-a2a-protocol.md) 메시지 스키마).

- `verifiedVisits`: `platform.anchor_record`로 방문 티켓이 발급된 수 (시드 `verified-visits.json` 포함). 병원과 시술별로 센다.
- `reviewStats`: `{ n, avgRating }`. (병원, 시술) 익명 집합이 **3명 이상일 때만** 응답에 넣는다 (`MIN_ANON_SET = 3`). 3명 미만이면 필드를 생략한다 ([08-compliance.md](08-compliance.md)).
- 둘 다 **매칭 점수에 들어가지 않는다** (2절 점수표 불변). 표시용 맥락이다. "방문 N명", "후기 n건 평점 x.x"처럼 사실만 쓰고, 병원끼리 우열을 말하는 문구("A보다 B가 낫다")는 쓰지 않는다 (금지어 테스트 대상).
- 후기 원문(`pibu/review@1`의 `text`)은 집계와 함께 로그인 고객 화면과 비교 화면에 공개한다 (랜딩 제외, 익명 집합 3명 이상, 오너 결정 2026-10-24). 원문은 매칭 점수에 들어가지 않는다.
- `offerApplied`가 붙은 견적도 다른 견적과 똑같이 판정한다. 용량·가격 판정은 증명과 독립이다. 예를 들어 민트의 첫 방문 1cc 이벤트(99,000원)는 증명이 통과해도 `underdosed` 라벨을 받는다.
