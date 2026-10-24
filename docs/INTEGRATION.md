# ZK 기록 레이어 연동 가이드 (A2A 에이전트 담당자용)

> 한 줄 요약: **에이전트는 차트를 주고받지 않는다. 오퍼 ID + ZK 증명만 주고받는다.**
> 고객 에이전트는 기록 기반 오퍼(2회차·첫 방문)를 **차트가 있는 곳에서 매칭**하고, 해당될 때만 증명을 `clinic.quote` 메시지의 `metadata.zkOfferProof`에 붙인다.
> 병원 에이전트는 증명을 검증하고, 맞으면 이벤트가를 적용한다. 날짜·병원·횟수 원본은 병원에 가지 않는다.
> 시나리오·id의 정본은 `docs/spec/`이다. ZK 서버(GlowPass)와 회로·컨트랙트는 팀원 Gorany의 `feat/zk-record-registry` 작업이고, PibooK 앱과의 연결(1~4절)은 병렬 빌드 트랙 ZK가 붙였다.

## 0. 스펙 데모와의 매핑

| 스펙 데모 행 (10-build-plan) | ZK가 하는 일 | API |
| --- | --- | --- |
| 4 비교 화면: 민트 "첫 방문 1cc 이벤트" | 유키가 "민트 기록 0건"을 증명 → 민트가 검증 → 이벤트가 견적 | `match-offers` → `prove-offer` → `verify-offer` |
| 5~6 서울글로우 예약 → D0 기록 | D0 제출 시 지갑이 append 증명을 만들고 플랫폼 relayer가 체인에 기록. 후기 티켓 1장 발급 | `records/visit` (P1: `platform.anchor_record`) |
| 린의 2회차 (01 페르소나) | "리쥬란 정확히 1회" 증명 → 서울글로우 2회차 패키지·한빛 이어서 2회차가 경쟁 | `prove-offer` → `verify-offer` |
| 비교 화면 "피북 사용자 N명" · 검증 후기 | 방문 수 = 병원 확인 티켓 수. 후기 = 티켓 보유자만 익명 1회 (Semaphore). 공개 피드 없음, 집계만 | `stats`, `reviews` (P1: `platform.submit_review`) |
| 지수 기록 화면 | 직접 입력 기록은 "자기 신고"로 지갑에만. 증명에는 병원 확인 기록만 | `wallet/:id` |

## 1. 실행 (GlowPass 서버)

```bash
(cd zk && npm ci) && (cd chain && npm ci) && (cd glowpass && npm ci)
cd glowpass && PORT=4007 npm start     # 병렬 빌드 포트. 포트를 안 주면 4000
# 앱 쪽 (.env.local, 커밋 금지)
ZK_SERVER_URL=http://localhost:4007
```

- 리포 배치 그대로 동작한다: `glowpass/`는 `../zk/codes.json`, `../zk/*/target/*.json`(커밋된 회로 산출물), `../chain/build`·`../chain/deployments`(ABI·주소), `../chain/records.mjs`를 `import.meta.url` 기준으로 읽는다. Noir 설치는 필요 없다. 회로를 고칠 때만 nargo **1.0.0-beta.20** + bb.js `5.0.0-nightly.20260324` (다른 조합은 깨짐).
- Node 22.9 이상 (`npm start`가 `--env-file-if-exists`를 쓴다). 확인한 버전: 22.22.0.
- 체인 읽기는 공개 RPC(`https://sepolia.base.org`, `BASE_SEPOLIA_RPC`로 교체 가능)라 키 없이 된다. 체인 기록 발급(`records/visit`)만 relayer 키가 필요하다 (`chain/.env`의 `DEPLOYER_PRIVATE_KEY`). 키와 지갑은 커밋하지 않는다: 루트 `.gitignore`의 `.env*`가 `chain/.env`를, `chain/.gitignore`의 `wallets/`가 지갑 파일을 막는다.
- 데모 콘솔 `http://localhost:4007/`, 공개 원장 화면 `http://localhost:4007/ledger`. 앱이 부른 호출은 `x-client-id: pibook-app`으로 콘솔 로그에 구분돼 보인다.

> ### 데모 맥 주의: 증명은 데모 맥 서버에서만 성공한다
> 체인(Base Sepolia)에는 페르소나의 **차트 해시**만 있고, **차트 원본(지갑 파일 `chain/wallets/*.json`)은 데모 맥에만** 있다 (의료 차트라 git 제외).
> 다른 머신에서 띄운 서버는 지갑이 없어서 `match-offers`는 "기록 없음" 기준으로 답하고(린도 첫 방문 대상으로 나온다), `prove-offer`는 `Cannot satisfy constraint`로 실패한다. 버그가 아니다.
> 데모 때는 앱의 `ZK_SERVER_URL`을 데모 맥 서버로 둔다: 같은 와이파이면 `http://<데모 맥 IP>:4007`, 아니면 터널. IP는 담당자(Gorany)에게 확인.

### 서버가 꺼졌거나 느릴 때

- `lib/zk`는 예외를 던지지 않는다. 설정 없음·연결 실패·타임아웃·이상한 응답이면 `null`을 돌려주고, 고객 에이전트는 증명 없이 견적을 요청하고 병원 에이전트는 정가로 견적한다. 데모는 ZK 장면만 빠진 채 끝까지 돈다.
- 리허설 중에 ZK를 확실히 끄려면 `ZK_SERVER_URL`을 지우고 앱을 다시 띄운다. `/api/zk/*`는 `status: "off"`를 돌려준다.
- 데모 맥 서버가 죽으면 그 맥에서 `cd glowpass && PORT=4007 npm start`로 다시 띄운다. 지갑 파일이 그대로 있으면 상태도 그대로다.
- 타임아웃 기본값: 매칭 5초, 증명 20초(서버 시작 후 첫 증명은 prover 초기화로 약 7초), 검증 15초, 원장 10초(첫 조회가 체인 로그를 훑는다, 실측 약 6초). `ZK_TIMEOUT_MS`로 모두 덮어쓸 수 있다.

## 2. PibooK 앱 연결 (`lib/zk`)

### 환경 변수

| 이름 | 예시 | 뜻 |
| --- | --- | --- |
| `ZK_SERVER_URL` | `http://localhost:4007` | GlowPass 주소. 없으면 `zkEnabled() === false`, 모든 함수가 `null` |
| `ZK_TIMEOUT_MS` | `8000` | (선택) 모든 호출의 타임아웃을 이 값으로 |

### 식별자 매핑 (정본: `lib/zk/identity.ts`, 표는 이것 하나)

| PibooK 고객 id | PibooK 고객 에이전트 id (`SessionUser.customerAgentId`) | GlowPass 페르소나 | 비고 |
| --- | --- | --- | --- |
| `cus_yuki`, `cus_yuki_done` | `cag_7f3k2` | `cus_yuki` | 미완료·완료 프로필이 같은 지갑. 로그인 없이 `DEMO_MODE=true`면 `/api/zk/*`가 이 사람으로 본다 |
| `cus_lin` | `cag_4n8vd` | `cus_lin` | 리쥬란 1회 @ 한빛 (데모 맥 지갑) |
| `cus_emily` | `cag_2q9wk` | `cus_emily` | 기록 없음 |
| `cus_jisoo` | `cag_8h3tb` | (없음) | 국내 거주라 매칭·예약 대상 아님 (08 2절). 직접 입력 기록만 있어 증명 불가 |

| PibooK 병원 id | GlowPass 병원 id |
| --- | --- |
| `cln_seoul_glow` · `cln_mint` · `cln_hanbit` · `cln_ara` · `cln_dahye` | 같은 id (GlowPass `catalog.mjs`가 스펙 레지스트리를 따른다) |

- 함수는 고객 id, 고객 에이전트 id, GlowPass 페르소나 중 무엇을 받아도 된다. 표에 없는 고객(새로 가입한 계정)은 지갑이 없으므로 GlowPass를 부르지 않고 `null`.
- 고객 에이전트 id는 `lib/ui-data/customer.ts` 목데이터 값이다. 시드(`data/seed`)가 다른 `cag_` 값을 쓰게 되면 이 표만 고친다.
- 회로 코드(`zk/codes.json`)는 와이어에 나오지 않는다. 와이어에는 항상 id를 쓴다.

### 함수 (계약: `lib/zk/index.ts`)

| 함수 | 호출자 | GlowPass | 돌려주는 것 |
| --- | --- | --- | --- |
| `zkEnabled()` | 모두 | 없음 | `ZK_SERVER_URL` 설정 여부 |
| `matchOffers(persona)` | 고객 에이전트 | `POST /api/zk/match-offers` | `{clinicId, offerId, title, eligible}[]` 또는 `null` |
| `matchOffersDetailed(persona)` | 고객 에이전트, 화면 | 같음 | 위 + `procedureId`, `benefit`, `conditions` |
| `proveOffer(persona, offerId)` | 고객 에이전트 | `POST /api/zk/prove-offer` | `ZkOfferProofBundle` 또는 `null` (조건 불충족·지갑 없음 포함) |
| `verifyOffer(clinicId, bundle)` | 병원 에이전트 | `POST /api/zk/verify-offer` | `{ok, reason}`. 서버 연결 실패·타임아웃이면 `null`. 모르는 병원·깨진 번들은 서버에 묻지 않고 `{ok: false}` |
| `readOfferProof(metadata)` | 병원 에이전트 | 없음 | `metadata.zkOfferProof`의 모양을 검사한 번들 또는 `null` |
| `publicOffers()` | 병원 에이전트 | `GET /api/offers` | 공개 오퍼 규칙 `{offerId, clinicId, procedureId, title, benefit, conditions}[]` |
| `ledgerSummary(limit)` | 화면 | `GET /api/ledger` | 공개 원장 요약 (기록 수, 가명 수, 최근 tx). 페르소나 이름은 빼고 돌려준다 |

### 앱 라우트 (읽기 전용, 화면이 나중에 쓴다)

| 라우트 | 인증 | 응답 |
| --- | --- | --- |
| `GET /api/zk/offers` | `getSessionUser()`. 로그아웃이고 `DEMO_MODE=true`면 유키(`cag_7f3k2`), 아니면 401. 고객 계정이 아니면 403 | `{status: "ok", offers: ZkOfferMatch[]}` (해당되는 오퍼만). 그 밖의 `status`: `off`(ZK 설정 없음), `no_wallet`(표에 없는 고객), `unavailable`(서버 응답 없음). 이때 `offers: []` |
| `GET /api/zk/ledger?limit=10` | 없음 (체인에 이미 공개된 값만) | `{status: "ok", ledger: ZkLedgerSummary}`. `limit`은 0~50. `off`·`unavailable`이면 `ledger: null` |

## 3. A2A 확장 `https://pibu.app/ext/zk-offer-proof/v1`

03-a2a-protocol.md 확장 표에 들어갈 행:

| URI | 선언 위치 | required | 내용 |
| --- | --- | --- | --- |
| `https://pibu.app/ext/zk-offer-proof/v1` | 병원 카드, 고객 카드 | false | 고객은 `clinic.quote` 요청의 `metadata.zkOfferProof`에 오퍼 증명 번들을 실을 수 있고, 이 확장을 선언한 병원은 할인 전에 그 번들을 검증한다. `params`: `{ "chainId": 84532, "registry": "0xcf47152e720508bf8c757a55aa30956ca8b58857" }` |

`required: false`인 이유는 referral 확장과 같다: 증명 없는 견적 요청도 정상 요청이다.

### 메시지 (고객 → 병원 `clinic.quote`)

```json
{
  "message": {
    "messageId": "msg_c_0003",
    "contextId": "req_01J9Z8",
    "role": "ROLE_USER",
    "parts": [{ "data": { "schema": "pibu/procedure-request@1", "...": "..." }, "mediaType": "application/json" }],
    "metadata": {
      "skillId": "clinic.quote",
      "referralToken": "eyJ...",
      "zkOfferProof": {
        "subjectId": "0x5c0d...9988",
        "offerId": "ofr_mint_rejuran_first_visit",
        "today": 29880272,
        "proofs": [{ "proof": "0x...", "publicInputs": ["0x...commitment", "29880272", "0", "2", "0", "100000", "0", "0"] }]
      }
    },
    "extensions": ["https://pibu.app/ext/referral/v1", "https://pibu.app/ext/zk-offer-proof/v1"]
  }
}
```

- `zkOfferProof`의 값은 `proveOffer()`가 돌려준 `ZkOfferProofBundle` 그대로다. DataPart가 아니라 `metadata`에 두는 이유: 03 라우팅 규칙("서버는 첫 DataPart만 신뢰")과 `pibu/*@1` strict 스키마를 건드리지 않고, `referralToken`과 같은 자리라서.
- `publicInputs` 순서는 회로와 같다: `[commitment, today, type, clinic, min_days, max_days, min_count, max_count]` (type·clinic은 회로 코드, 0은 "무관").
- 증명 1개 약 14KB. A2A 로그에 저장할 때 `proofs[].proof`는 `"[proof 14KB]"`처럼 줄여도 된다 (개인정보가 아니라 크기 때문).
- 번들로 알 수 있는 건 "이 가명이 이 오퍼 조건을 만족한다"뿐이다. 이름·시술일·이전 병원은 들어 있지 않다.
- `lib/a2a/client.ts`의 `SendOptions`에는 `extensions`가 없다. 증명이 붙은 메시지의 `extensions`에 이 URI를 넣는 일은 A2A 코어가 `metadata.zkOfferProof` 유무로 처리한다 (트랙 A2A에 요청. 안 넣어도 `required: false`라 동작은 같다).

### 고객 에이전트가 할 일 (트랙 CUSTOMER, `lib/agents/customer`)

`zkEnabled()`가 참일 때만:

1. 후보 병원들에 `clinic.quote`를 보내기 전에 `matchOffersDetailed(customerAgentId)`를 한 번 부른다. `null`이면 ZK 없이 진행.
2. 후보 병원마다 `eligible && clinicId === 후보 && procedureId === 요청 시술`인 오퍼를 고른다 (여럿이면 첫 번째).
3. 고른 오퍼가 있는 병원에만 `proveOffer(customerAgentId, offerId)`를 부르고, 결과가 있으면 그 병원 메시지의 `metadata.zkOfferProof`에 넣는다. `null`이면 증명 없이 보낸다.
4. **해당 없는 병원에는 증명을 만들지도 보내지도 않는다.** "증명 실패" 자체가 정보 유출이다.
5. 시술 이력·날짜·이전 병원은 어떤 메시지에도 넣지 않는다 (요약·암시 포함). 기록 기반 혜택은 `offerId` + 증명으로만 주장한다.

### 병원 에이전트가 할 일 (트랙 CLINIC, `lib/agents/clinic`)

`clinic.quote`에서 추천 토큰 검증 직후, LLM 호출 전에:

1. `const bundle = readOfferProof(ctx.metadata)`. 없거나 `zkEnabled()`가 거짓이면 평소 견적.
2. `const v = await verifyOffer(selfClinicId, bundle)`. 검증은 코드, 판단은 LLM.
3. `v?.ok === true`일 때만 오퍼를 적용한다. 오퍼 조건은 `publicOffers()`에서 `offerId`로 찾는다 (`title`, `benefit`, `conditions`, `procedureId`). 요청 시술과 오퍼의 `procedureId`가 다르면 적용하지 않는다.
4. 적용 방법은 지금 스키마 안에서: `pibu/quote@1`의 `event`에 `title` = 오퍼 `title`, `conditions` = 오퍼 조건 텍스트, `regularPriceKrw` = 정가, 기간은 병원 이벤트 기간을 넣고, `priceKrw`를 이벤트가로 낮춘다. `v`가 `null`이거나 `ok: false`면 `event` 없이 정가 견적.
5. 차트를 요구하지 않는다. 받은 메시지 + 검증 결과만으로 견적한다. 검증 결과(`ok`, `reason`)는 A2A 로그에 남겨도 된다.

고객 에이전트는 자기가 증명을 보낸 병원의 견적에 그 오퍼 `title`의 `event`가 있으면 "증명으로 적용됨"으로 표시한다.

### 알려진 한계

- 번들은 호출한 고객 에이전트와 묶이지 않는다. 다른 사람이 번들을 가로채 재사용하면 통과한다. 완화: 증명의 `today`는 체인 시계(1일 = 60초)로 오늘·어제만 받는다 (약 2분). 로드맵: 증명 공개 입력에 고객 에이전트 id 해시를 넣는다.
- 가명을 새로 만들면 첫 방문 할인을 다시 노릴 수 있다. 로드맵: 여권 ZK로 여권당 가명 1개.

## 4. 스키마 확장 제안 (아직 계약 아님)

`lib/a2a/schemas.ts`는 공통 파일이고 모든 `pibu/*@1` 객체가 strict라서 아래 필드는 지금 넣으면 검증에서 떨어진다. 팀원 초안을 계약 변경 요청으로 남긴다.

- `EventSchema.zkClauses?: ZkClause[]`: 병원 이벤트가 증명으로만 적용되는 조건. `ZkClause = { type?, clinicId?, minDays?, maxDays?, minCount?, maxCount? }` ("`type` 시술을 `clinicId`에서 받은 기록 중 오늘 기준 `minDays`~`maxDays`일 전에 든 것의 개수가 `minCount`~`maxCount`개"). 첫 방문 = `{ clinicId, maxCount: 0 }` · 2회차 = `{ type, minCount: 1, maxCount: 1 }`. 데모 오퍼는 날짜 조건을 쓰지 않는다 (체인 시계와 앱 데모 시계가 독립).
- `QuoteV1Schema.offerApplied?: { offerId, verified: true }`: 지금은 `event.title`로 대신한다.
- `pibu/clinic-shortlist@1`의 `candidates[].verifiedVisits?` · `reviewStats?` (`n >= 5`일 때만, 08 집계 원칙). 매칭 점수에는 넣지 않는다.
- 새 스킬 `platform.anchor_record` (`pibu/record-anchor@1`: D0 뒤 지갑이 만든 append 증명을 플랫폼 relayer가 체인에 제출, 후기 티켓 1장 추가)와 `platform.submit_review` (`pibu/review@1`: Semaphore v4 방문 증명 + 평점·텍스트, 집계만 공개). 지금은 GlowPass의 `records/visit`·`reviews`가 같은 일을 한다.
- 팀원 초안은 증명을 `metadata.offerProof`에 `schema: "pibu/offer-proof@1"`, `clinicId`, `chainId`, `registry`를 더한 봉투로 실었다. 병렬 빌드는 계약(`lib/zk/index.ts`)에 맞춰 `metadata.zkOfferProof` + 번들 그대로로 정했다. `readOfferProof`는 여분 필드를 무시하므로 나중에 봉투를 더해도 호환된다.

## 5. GlowPass HTTP API

### 고객 에이전트 (on-device 역할)

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/wallet/:customerId` | 없음 | **비공개** 지갑: `verifiedRecords`(병원 확인, 체인 앵커) · `selfReported`(직접 입력) · `onchain { subjectId, commitment, version }` · `pendingReviews`. 고객 에이전트만 읽는다 |
| POST | `/api/wallet/:customerId/self-reported` | `{records:[{date, procedureId, amount, where, yearInferred}]}` | 직접 입력·메모장 가져오기 저장. 체인·증명에 안 들어감 |
| POST | `/api/zk/match-offers` | `{persona}` | 모든 공개 오퍼를 지갑 안에서 매칭 → `[{offerId, clinicId, procedureId, title, benefit, conditions, eligible}]` |
| POST | `/api/zk/prove-offer` | `{persona, offerId}` | 증명 번들 (조건당 약 0.4초) → `{subjectId, offerId, today, provingMs, proofs}`. 조건 불충족이면 500 `Cannot satisfy constraint` |

### 병원 에이전트

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/offers` | 없음 | 공개 오퍼 규칙 (`id`, `clinicId`, `procedureId`, `title`, `benefit`, `clauses`(회로 코드), `conditions`) |
| POST | `/api/zk/verify-offer` | `{clinicId, bundle}` | `{ok, reason, commitment, today, conditions}`. 온체인 해시를 직접 읽어 비교 |

### 플랫폼

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| POST | `/api/records/visit` | `{persona, clinicId, procedureId}` | 병원 확인 시술 → append 증명 → Base Sepolia 기록 (약 10초) + 후기 티켓 → `{tx, day}`. relayer 키 필요 |
| POST | `/api/reviews` | `{persona, clinicId, procedureId, rating, text}` | Semaphore 익명 후기. 티켓 없으면/두 번째면 거부 |
| GET | `/api/stats` | 없음 | `verifiedUsersByProcedure`, 병원별 `verifiedVisits`·`avgRating`·후기 수 |
| GET | `/api/ledger` | 없음 | 체인에 공개된 전체 이벤트 (가명·해시·버전·tx) + 배포 정보 |
| GET | `/api/events` | 없음 | SSE. 외부 에이전트의 검증·기록도 데모 콘솔 로그에 표시 |
| POST | `/api/wallet/:customerId/reset` | 없음 | **리허설용 초기화**: 새 가명 + 기본 기록 재앵커 (약 10초/건) |

## 6. 에이전트 프롬프트에 꼭 넣을 규칙

고객 에이전트:
- 시술 이력·날짜·이전 병원은 **어떤 메시지에도** 넣지 않는다 (요약·암시 포함). 기록 기반 혜택은 `offerId` + 증명으로만.
- 오퍼 매칭은 차트가 있는 곳에서 하고, 해당 없는 병원에는 증명을 요청하지도 보내지도 않는다.
- 직접 입력 기록은 상담·추천에는 써도 되지만, 혜택 자격 주장에는 못 쓴다.

병원 에이전트:
- 차트를 요구하지 않는다. 받은 메시지 + 검증 결과만으로 견적. 검증 통과일 때만 이벤트가.

## 7. 데모 상태 (Base Sepolia)

- Registry v2: [`0xcf47152e720508bf8c757a55aa30956ca8b58857`](https://sepolia.basescan.org/address/0xcf47152e720508bf8c757a55aa30956ca8b58857) · 1일 = 60초
- `cus_lin`: 리쥬란 1회 @ 한빛의원 (예약 기록) → 2회차 오퍼 대상, 한빛 첫 방문 불가
- `cus_yuki`, `cus_emily`: 기록 없음 → 첫 방문 오퍼 전부 대상. 서울글로우 D0 기록을 올리면 2회차 대상이 된다
- **확인 필요 (트랙 ZK 스모크, 2026-10-24):** 체인에 기록이 한 건도 없는 가명은 온체인 commitment가 0이다. `eligibility` 회로는 `commit(chart) == commitment`를 요구하고(`zk/eligibility/src/main.nr`) 빈 차트의 해시는 0이 아니므로, 유키·에밀리의 첫 방문 증명은 `match-offers`가 `eligible: true`라고 해도 `prove-offer`에서 `Cannot satisfy constraint`로 실패하고, `verify-offer`도 "온체인 기록이 없는 가명"으로 거절한다. 데모 맥 지갑에서도 같다. 해결안 (팀원 결정): 가입 때 빈 차트 commitment를 앵커하는 기록 0건 append를 허용하거나, `match-offers`가 commitment 0이면 `eligible: false`로 답한다. 그 전까지 유키 민트 장면은 정가로 흐른다 (데모는 안 깨진다)
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
- 알려진 한계: 가명을 새로 만들면 첫 방문 할인을 다시 노릴 수 있음 → 로드맵: 여권 ZK로 여권당 가명 1개. 기록 발급은 플랫폼 relayer 권한 → 로드맵: 병원 서명을 회로 안에서 검증. 지갑이 서버 파일 → 로드맵: 브라우저 지갑 + bb.js WASM 증명 (T18)
