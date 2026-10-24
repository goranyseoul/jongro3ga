# ZK 기록 레이어 연동 가이드 (A2A 에이전트 담당자용)

> 한 줄 요약: **에이전트는 차트를 주고받지 않는다. 오퍼 ID + ZK 증명만 주고받는다.**
> 고객 에이전트는 기록 기반 오퍼(2회차·첫 방문)를 **기기 안에서 매칭**하고, 해당될 때만 증명을 `clinic.quote` 메시지에 붙인다.
> 병원 에이전트는 증명을 검증하고, 맞으면 이벤트가를 적용한다. 날짜·병원·횟수 원본은 병원에 가지 않는다.
> 시나리오·id의 정본은 `docs/spec/`이다 (03 "ZK 확장", 06 "ZK 기록", 07 "검증 방문과 후기", 10 T16~T18).

## 0. 스펙 데모와의 매핑

| 스펙 데모 행 (10-build-plan) | ZK가 하는 일 | API |
| --- | --- | --- |
| 4 비교 화면: 민트 "첫 방문 1cc 이벤트" | 유키가 "민트 기록 0건"을 증명 → 민트가 검증 → `quote.offerApplied` | `match-offers` → `prove-offer` → `verify-offer` |
| 5~6 서울글로우 예약 → D0 기록 | D0 제출 시 지갑이 append 증명을 만들고 플랫폼 relayer가 체인에 기록. 후기 티켓 1장 발급 | `records/visit` (→ `platform.anchor_record`) |
| 린의 2회차 (01 페르소나) | "리쥬란 정확히 1회" 증명 → 서울글로우 2회차 패키지·한빛 이어서 2회차가 경쟁 | `prove-offer` → `verify-offer` |
| 비교 화면 "피북 사용자 N명" · 검증 후기 | 방문 수 = 병원 확인 티켓 수. 후기 = 티켓 보유자만 익명 1회 (Semaphore). 원문과 집계를 로그인 고객·비교 화면에 공개 (랜딩 제외, 익명 집합 3명 이상) | `stats`, `reviews` (→ `platform.submit_review`) |
| 지수 기록 화면 | 직접 입력 기록은 "자기 신고"로 지갑에만. 증명에는 병원 확인 기록만 | `wallet/:id` |

## 1. 실행

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd glowpass && npm i)
cd glowpass && npm start        # http://localhost:4000 (데모 콘솔 + API), /ledger (공개 원장 화면)
```

- 컴파일된 회로(`zk/*/target`)와 컨트랙트 ABI(`chain/build`)가 커밋돼 있어서 Noir 설치 없이 동작한다.
  회로를 고칠 때만 nargo **1.0.0-beta.20** + bb.js `5.0.0-nightly.20260324` (다른 조합은 깨짐).
- 체인 기록 발급(`records/visit`)만 relayer 키가 필요하다 (`chain/.env`의 `DEPLOYER_PRIVATE_KEY`, 1건 약 0.00002 ETH).
- CORS 허용(`*`). Next.js 서버 라우트에서 `ZK_SERVER_URL`로 그대로 `fetch` 하면 된다 (`lib/zk/client.ts`).

> ### 이 서버는 데모 맥 1대에서만 돌린다
> 체인(Base Sepolia)에는 페르소나의 **차트 해시**만 있고, **차트 원본(지갑 파일 `chain/wallets/`)은 데모 맥에만** 있다 (의료 차트라 git 제외).
> clone한 서버는 지갑이 비어 있어 `prove-offer`가 `Cannot satisfy constraint`로 실패한다.
> 에이전트는 데모 맥의 서버를 호출한다: 같은 와이파이면 `http://<데모 맥 IP>:4000`, 아니면 터널. 로드맵은 지갑을 브라우저(localStorage + bb.js WASM)로 옮기는 것이다 (10 T18).

## 2. 식별자 (docs/spec과 동일)

- 고객(페르소나): `cus_yuki`(= `cus_yuki_done`, 같은 지갑) · `cus_lin` · `cus_emily` · `cus_jisoo`
- 시술: 06 시술 마스터 6종 (`rejuran_healer`, `thermage_flx`, `ulthera`, `botox_forehead`, `shrink_universe`, `skin_booster_juvelook`)
- 병원: 01 레지스트리 5곳 (`cln_seoul_glow`, `cln_mint`, `cln_hanbit`, `cln_ara`, `cln_dahye`)
- 회로 코드 매핑: `zk/codes.json` (와이어에는 항상 id를 쓰고, 코드 변환은 `lib/zk`·`glowpass/catalog.mjs`만 한다)
- 오퍼·기본 기록·시드 통계의 정본: `glowpass/catalog.mjs`

## 3. 와이어 스키마 (`lib/a2a/schemas.ts`에 추가)

### `ZkClause` (오퍼 조건 1개)

```json
{ "type": "rejuran_healer", "clinicId": "cln_hanbit", "minDays": 0, "maxDays": 100000, "minCount": 1, "maxCount": 1 }
```

- 모두 선택 필드이되 `minCount`·`maxCount` 중 하나는 있어야 한다. `type` 없음 = 시술 무관, `clinicId` 없음 = 병원 무관.
- 뜻: "`type` 시술을 `clinicId`에서 받은 기록 중, 오늘 기준 `minDays`~`maxDays`일 전에 든 것의 개수가 `minCount`~`maxCount`개".
- 첫 방문 = `{ "clinicId": "cln_mint", "maxCount": 0 }` · 2회차 = `{ "type": "rejuran_healer", "minCount": 1, "maxCount": 1 }` · 단골 = `{ "type": "rejuran_healer", "minCount": 3 }`.
- 데모 오퍼는 날짜 조건을 쓰지 않는다 (체인 시계와 앱 데모 시계가 독립이라서).

### `pibu/offers@1` · `pibu/quote@1`의 `event.zkClauses?`

`EventSchema`에 선택 필드 `zkClauses: ZkClause[]`를 더한다. 의료법 시행령 제23조 때문에 사람이 읽는 `conditions` 텍스트는 그대로 필수다. `zkClauses`가 있는 이벤트는 "증명으로만 적용되는 이벤트"다.

### `pibu/quote@1`의 `offerApplied?`

```json
{ "offerId": "ofr_mint_rejuran_first_visit", "verified": true }
```

병원이 증명을 검증해 이벤트가를 적용했을 때만 넣는다. 검증 실패나 증명 없음이면 `event`·`offerApplied` 없이 정가 견적.

### `pibu/clinic-shortlist@1`의 `candidates[].verifiedVisits?` · `candidates[].reviewStats?`

```json
{ "clinicId": "cln_seoul_glow", "verifiedVisits": 1240, "reviewStats": { "n": 18, "avgRating": 4.6 } }
```

플랫폼이 후보마다 넣는다. `reviewStats`는 (병원, 시술) 익명 집합이 3명 이상일 때만 (`MIN_ANON_SET = 3`). 후기 원문은 별도 조회 경로로 공개한다. 매칭 점수에는 넣지 않는다 (07 점수표 불변).

### `pibu/offer-proof@1` (고객 → 병원, `clinic.quote` 메시지의 `metadata.offerProof`)

```json
{
  "schema": "pibu/offer-proof@1",
  "offerId": "ofr_mint_rejuran_first_visit",
  "clinicId": "cln_mint",
  "subjectId": "0x5c0d6f0a8c2e4b1f9d3a7e6c5b4a39281716050403020100ffeeddccbbaa9988",
  "chainId": 84532,
  "registry": "0xcf47152e720508bf8c757a55aa30956ca8b58857",
  "today": 29880272,
  "proofs": [
    { "proof": "0x…", "publicInputs": ["0x…commitment", "29880272", "0", "2", "0", "100000", "0", "0"] }
  ]
}
```

- DataPart가 아니라 `metadata`에 둔다: 03 라우팅 규칙 4번("서버는 첫 DataPart만 신뢰")을 건드리지 않고, `metadata.referralToken`과 같은 자리다. 메시지 `extensions`에 `https://pibu.app/ext/zk-offer-proof/v1`을 넣는다.
- `publicInputs` 순서는 회로와 같다: `[commitment, today, type, clinic, min_days, max_days, min_count, max_count]` (type·clinic은 회로 코드).
- 증명 1개 약 14KB. A2A 로그에 저장할 때 `proofs[].proof`는 `"[proof 14KB]"`로 줄인다 (개인정보 아님, 크기 때문).
- 이 번들로 알 수 있는 건 "이 가명이 이 오퍼 조건을 만족한다"뿐이다.
- **앵커된 적 없는 가명** (체인 `commitmentOf == 0`, 기록이 하나도 없는 신규 고객): 체인에 비교할 해시가 없으므로 지갑은 빈 차트의 로컬 해시로 증명을 만들고(`bundle.unanchored: true`), 병원은 "체인에 기록 없음 = 빈 차트"로 간주해 **빈 차트가 만족하는 조건(첫 방문, 기록 0건)만** 통과시킨다 (`verify-offer` 응답 `unanchored: true`, 사유 "빈 차트로 간주"). 기록이 필요한 조건(2회차·단골)은 불가. 새 가명을 만들면 첫 방문을 다시 노릴 수 있다는 기존 한계와 같은 신뢰 수준이다 (8절).

### `pibu/record-anchor@1` (고객 → 플랫폼, 새 스킬 `platform.anchor_record`)

```json
{
  "schema": "pibu/record-anchor@1",
  "bookingId": "bkg_5521",
  "clinicId": "cln_seoul_glow",
  "procedureId": "rejuran_healer",
  "subjectId": "0x5c0d…9988",
  "record": { "day": 29880272, "recordNonce": "1234567890123456789012345678901234567890" },
  "oldCommitment": "0x0",
  "newCommitment": "0x1a2b…",
  "recordHash": "0x3c4d…",
  "proof": "0x…"
}
```

- 시술 완료(D0) 뒤 고객 지갑이 append 증명을 만들고, 플랫폼이 가스를 내며 `RecordRegistry.append`를 대신 제출한다.
- 플랫폼 검사: 그 `bookingId`가 호출 고객 에이전트의 것이고 상태가 `completed`(또는 D0 결과 접수)인지, `recordHash == record_hash(procedureCode, clinicCode, day, recordNonce)`인지 (플랫폼은 예약을 이미 알고 있으므로 새는 정보가 없다). 통과하면 relayer 전송, 출력 text `anchored <tx>`.
- 체인에 올라가는 것: `subjectId`, `newCommitment`, `recordHash`, `day`. 시술·병원·이름은 없다.
- 플랫폼은 같은 호출에서 (병원, 시술) 후기 그룹에 방문 티켓(Semaphore identity commitment)을 1장 추가한다. 티켓 commitment는 `record.ticketCommitment`로 함께 보낸다 (가명과 연결 불가한 새 identity).

### `pibu/review@1` (고객 → 플랫폼, 새 스킬 `platform.submit_review`)

```json
{
  "schema": "pibu/review@1",
  "clinicId": "cln_hanbit",
  "procedureId": "rejuran_healer",
  "rating": 4,
  "text": "中文沟通没问题，第二次也打算来。",
  "visitProof": { "merkleTreeDepth": 10, "merkleTreeRoot": "…", "nullifier": "…", "message": "…", "scope": "…", "points": ["…", "…", "…", "…", "…", "…", "…", "…"] }
}
```

- `visitProof`는 Semaphore v4 증명 (`@semaphore-protocol/core` `generateProof` 결과 그대로). `scope = hash("review:<clinicId>:<procedureId>")`, `message = hash({rating, text})`.
- 플랫폼 검사: 그룹 멤버십, nullifier 미사용(방문 1회 = 후기 1회), 증명 검증. 통과하면 `ReviewStat`에 집계. 거부 사유는 text로.
- 08 규제: 후기 텍스트와 `reviewStats`(n, 평점)는 로그인 고객 화면과 비교 화면에 공개한다. 랜딩 제외, 익명 집합 3명 이상일 때만. 제출 시 "공개됨 + 익명(Semaphore)"을 고지한다 (오너 결정 2026-10-24).
- 한계: A2A 호출은 bearer 토큰이 있어 플랫폼은 발신 에이전트를 안다. 플랫폼에 대한 익명성은 P1(릴레이 제출)이고, P0에서 Semaphore가 보장하는 것은 "검증된 방문자, 1회"다.

### 새 스킬 2개 (02·03 표와 플랫폼 카드에 추가)

| 스킬 id | 호출자 | 입력 | 출력 |
| --- | --- | --- | --- |
| `platform.anchor_record` | 고객 | `pibu/record-anchor@1` | text (`anchored <tx>` 또는 거부 사유) |
| `platform.submit_review` | 고객 | `pibu/review@1` | text (접수 + 집계 n, 또는 거부 사유) |

### 확장 URI (03 확장 표)

| URI | 선언 위치 | required | 내용 |
| --- | --- | --- | --- |
| `https://pibu.app/ext/zk-offer-proof/v1` | 병원 카드, 고객 카드 | false | `params`: `{ "chainId": 84532, "registry": "0x…" }`. 선언한 병원은 `clinic.quote`의 `metadata.offerProof`를 검증한다. 미선언 병원에는 증명을 보내지 않는다 |

## 4. 에이전트 처리 순서

고객 에이전트 (`lib/agents/customer`, 지갑 역할):
1. `platform.match_clinics` 결과의 후보마다 `clinic.offers` 캐시에서 `event.zkClauses`를 읽는다.
2. **기기 안에서** `clauseHolds`로 매칭한다 (`lib/zk/clauses.ts`). 아무것도 밖으로 나가지 않는다.
3. 해당되는 오퍼만 `prove-offer`로 증명을 만들어 그 병원의 `clinic.quote` 메시지 `metadata.offerProof`에 붙인다. **해당 없는 병원에는 증명을 요청하지도 보내지도 않는다** ("증명 실패" 자체가 정보 유출).
4. D0 결과를 제출할 때 `platform.anchor_record`를 함께 보낸다. 후기는 고객이 원할 때 `platform.submit_review`.

병원 에이전트 (`lib/agents/clinic`):
1. `clinic.quote`에서 추천 토큰 검증 직후 `metadata.offerProof`가 있으면 `verify-offer` (검증은 코드, 판단은 LLM).
2. 통과하면 `event` + `offerApplied: { offerId, verified: true }`, 실패면 정가 견적. 차트를 요구하지 않는다.
3. A2A 로그에는 proof 바이트를 줄여 저장한다.

플랫폼 에이전트 (`lib/agents/platform`):
1. `platform.anchor_record`: 예약 확인 → recordHash 재계산 → relayer 전송 → 후기 티켓 추가.
2. `platform.submit_review`: Semaphore 검증 → `ReviewStat` 집계.
3. `platform.match_clinics` 응답에 `verifiedVisits`·`reviewStats`를 넣는다.

모듈 경계: ZK 코드는 `lib/zk/`(공용 라이브러리)에 두고 세 에이전트 모듈이 import한다. `lib/zk`는 에이전트 모듈을 import하지 않는다.

## 5. HTTP API (glowpass 서버, P0 과도기)

에이전트 로직이 붙기 전까지는 Next.js 서버 라우트가 `ZK_SERVER_URL`로 이 API를 부른다. `lib/zk/client.ts`가 래퍼다.

### 고객 에이전트 (on-device 역할)

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/wallet/:customerId` | – | **비공개** 지갑: `verifiedRecords`(병원 확인, 체인 앵커) · `selfReported`(직접 입력) · `onchain { subjectId, commitment, version }` · `pendingReviews`. 고객 에이전트만 읽는다 |
| POST | `/api/wallet/:customerId/self-reported` | `{records:[{date, procedureId, amount, where, yearInferred}]}` | 직접 입력·메모장 가져오기 저장. 체인·증명에 안 들어감 |
| POST | `/api/zk/match-offers` | `{persona}` | 모든 공개 오퍼를 기기 안에서 매칭 → `[{offerId, clinicId, title, benefit, conditions, eligible}]` |
| POST | `/api/zk/prove-offer` | `{persona, offerId}` | 증명 번들 (조건당 약 0.4초) → `pibu/offer-proof@1`에 넣을 `bundle`. 조건 불충족이면 500 `Cannot satisfy constraint` |

### 병원 에이전트

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/offers` | – | 공개 오퍼 규칙 (`clinic.offers`의 `event.zkClauses`에 실을 내용) |
| POST | `/api/zk/verify-offer` | `{clinicId, bundle}` | `{ok, reason, commitment, today, conditions}`. 온체인 해시를 직접 읽어 비교 |

### 플랫폼

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| POST | `/api/records/visit` | `{persona, clinicId, procedureId}` | 병원 확인 시술 → append 증명 → Base Sepolia 기록 (약 10초) + 후기 티켓 → `{tx, day}` |
| POST | `/api/reviews` | `{persona, clinicId, procedureId, rating, text}` | Semaphore 익명 후기. 티켓 없으면/두 번째면 거부 |
| GET | `/api/stats` | – | `verifiedUsersByProcedure`, 병원별 `verifiedVisits`·`avgRating`·후기 수 |
| GET | `/api/ledger` | – | 체인에 공개된 전체 이벤트 (가명·해시·버전·tx) |
| GET | `/api/events` | – | SSE. 외부 에이전트의 검증·기록도 데모 콘솔 로그에 표시 |
| POST | `/api/wallet/:customerId/reset` | – | **리허설용 초기화**: 새 가명 + 기본 기록 재앵커 (약 10초/건) |

### bundle (= `pibu/offer-proof@1`에서 `schema`·`clinicId`·`chainId`·`registry`를 뺀 것)

```json
{ "subjectId": "0x…", "offerId": "ofr_mint_rejuran_first_visit", "today": 29880272, "provingMs": 458, "proofs": [{ "proof": "0x…", "publicInputs": ["…"] }] }
```

## 6. 에이전트 프롬프트에 꼭 넣을 규칙

고객 에이전트:
- 시술 이력·날짜·이전 병원은 **어떤 메시지에도** 넣지 않는다 (요약·암시 포함). 기록 기반 혜택은 `offerId` + 증명으로만.
- 오퍼 매칭은 기기 안에서 하고, 해당 없는 병원에는 증명을 요청하지도 보내지도 않는다.
- 직접 입력 기록은 상담·추천에는 써도 되지만, 혜택 자격 주장에는 못 쓴다.

병원 에이전트:
- 차트를 요구하지 않는다. 받은 메시지 + 검증 결과만으로 견적. 검증 통과일 때만 이벤트가.

## 7. 데모 상태 (Base Sepolia)

- Registry v2: [`0xcf47152e720508bf8c757a55aa30956ca8b58857`](https://sepolia.basescan.org/address/0xcf47152e720508bf8c757a55aa30956ca8b58857) · 1일 = 60초
- `cus_lin`: 리쥬란 1회 @ 한빛의원 (예약 기록) → 2회차 오퍼 대상, 한빛 첫 방문 불가
- `cus_yuki`, `cus_emily`: 기록 없음 → 첫 방문 오퍼 전부 대상. 장면 ①-b로 서울글로우 D0 기록을 올리면 2회차 대상이 된다
- `cus_jisoo`: 직접 입력 3건 (리쥬란 2, 보톡스 1), 병원 확인 0건

## 8. 구조와 한계

```
병원 확인 시술 ──append 증명──▶ RecordRegistry (Base Sepolia): 가명 → 차트 해시만
        │                          (컨트랙트가 증명 검증 · 소급/누락 불가)
        ▼
고객 지갑 (차트 원본, 기기) ──offer 증명──▶ 병원 에이전트 ──검증──▶ 온체인 해시와 대조
```

- `zk/eligibility`: 기록 (시술, 날짜, 병원) 중 조건에 맞는 개수가 범위 안임을 증명
- `zk/append`: 기존 차트 + 1건 (삭제·병원 바꿔치기 불가, 신규 가명은 빈 차트에서 시작). 차트는 8칸 (데모 제한)
- 알려진 한계: 가명을 새로 만들면 첫 방문 할인을 다시 노릴 수 있음 (앵커된 적 없는 가명은 빈 차트로 간주하므로 같은 한계) → 로드맵: 여권 ZK로 여권당 가명 1개. 기록 발급은 플랫폼 relayer 권한 → 로드맵: 병원 서명을 회로 안에서 검증. 지갑이 서버 파일 → 로드맵: 브라우저 지갑 + bb.js WASM 증명 (T18)
