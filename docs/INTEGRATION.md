# PiBoo-K ZK 프라이버시 레이어 — A2A 에이전트 연동 가이드

> 한 줄 요약: **병원은 차트를 보지 않고, 증명만 본다.**
> 고객 에이전트는 기록 기반 오퍼(2회차·첫 방문·단골가)를 **기기 안에서 매칭**하고, 해당될 때만 ZK 증명을 A2A 메시지에 붙인다.
> 병원 에이전트는 증명을 검증하고, 맞으면 할인을 적용한다. 날짜·병원·횟수 원본은 병원에 가지 않는다.

DEMO.md 장면과의 매핑:

| 장면 | DEMO.md | ZK가 하는 일 | API |
| --- | --- | --- | --- |
| ① | 유키 ⑥ "2회차 하실래요?" | "쥬베룩 볼륨 정확히 1회 · 최근 27일 기록 0건" 증명 → 강남 B·홍대 A가 2회차 오퍼로 경쟁 | `prove-offer` → `verify-offer` |
| ② | 지수 ④ "첫 방문 10% 할인" | "역삼 I의원 기록 0건" 증명. 시술 후 기록이 체인에 앵커돼 같은 할인 재사용 불가 | `prove-offer` → `verify-offer` → `records/visit` |
| ③ | "피북 사용자 N명 받음", 후기 | 방문 수 = 병원 확인 방문 티켓 수, 후기 = 티켓 보유자만 익명 1회 (Semaphore) | `stats`, `reviews` |
| ④ | 지수 ① 메모장 가져오기 | 메모 기록은 "자기 신고"로 지갑에만 저장. 증명에는 병원 확인 기록만 사용 | `wallet/:id/self-reported` |

## 1. 실행

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd app && npm i)
cd app && node server.mjs   # http://localhost:3000  (데모 콘솔 + API), /ledger (공개 원장 화면)
```

- 컴파일된 회로(`zk/*/target`)와 컨트랙트 ABI(`chain/build`)가 커밋돼 있어서 Noir 설치 없이 동작합니다.
  회로를 고칠 때만 nargo **1.0.0-beta.20** + bb.js `5.0.0-nightly.20260324` (다른 조합은 깨짐).
- 체인 기록 발급(`records/visit`)만 relayer 키 필요 (`chain/.env`의 `DEPLOYER_PRIVATE_KEY`, 1건 ≈ 0.00002 ETH).
- CORS 허용(`*`). Next.js 앱의 서버 라우트에서 그대로 `fetch` 하면 됩니다.

> ### ⚠️ 이 서버는 데모 맥 1대에서만 돌리세요
> 체인(Base Sepolia)에는 페르소나의 **차트 해시**만 있고, **차트 원본(지갑 파일 `chain/wallets/`)은 데모 맥에만** 있습니다 (의료 차트라 git 제외).
> clone한 서버는 지갑이 비어 있어 `prove-offer`가 `Cannot satisfy constraint`로 실패합니다.
> **에이전트는 데모 맥의 서버를 호출하세요**: 같은 와이파이면 `http://<데모 맥 IP>:3000`, 아니면 터널. IP는 담당자에게 확인.

## 2. 식별자 (docs/spec과 정렬)

- 고객: `cus_yuki` · `cus_jisoo` · `cus_grace` · `cus_lin`
- 시술: spec 06의 id (`skin_booster_juvelook`, `rejuran_healer`, `thermage_flx`, `ulthera`, `botox_forehead`, `shrink_universe`) + DEMO.md 추가분 (`rituo`, `skin_botox`, `aqua_peel`, `filler`)
- 병원: DEMO.md 가상 병원 `cln_hongdae_a`, `cln_gangnam_b`, `cln_myeongdong_c`, `cln_yeoksam_i`, `cln_sinnonhyeon_d`, `cln_gangnam_j`, `cln_gangnam_k`, `cln_apgujeong_l`, `cln_myeongdong_m`
- 정본: `app/catalog.mjs` (오퍼 규칙·검증 방문 수·시드 후기 포함). 팀 시드와 id가 다르면 여기만 고치면 됩니다.

## 3. HTTP API

### 고객 에이전트 (on-device 역할)

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/wallet/:customerId` | – | **비공개** 지갑: `verifiedRecords`(병원 확인, 체인 앵커) · `selfReported`(메모 등) · `onchain` · `pendingReviews`. 고객 에이전트만 읽고 병원에 전달 금지 |
| POST | `/api/wallet/:customerId/self-reported` | `{records:[{date, procedureId, amount, where, yearInferred}]}` | 메모장 가져오기 결과 저장 (Claude 파싱은 고객 에이전트 몫). 체인·증명에 안 들어감 |
| POST | `/api/zk/match-offers` | `{persona}` | 모든 공개 오퍼를 **기기 안에서** 매칭 → `[{offerId, clinicId, title, benefit, conditions, eligible}]` |
| POST | `/api/zk/prove-offer` | `{persona, offerId}` | 증명 번들 (조건당 ~0.4초) → **`bundle`**. 조건 불충족이면 500 `Cannot satisfy constraint` (만들 수 없음) |

### 병원 에이전트

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| GET | `/api/offers` | – | 공개 오퍼 규칙 (병원 Agent Card의 `clinic.offers`에 실을 내용) |
| POST | `/api/zk/verify-offer` | `{clinicId, bundle}` | `{ok, reason, commitment, today, conditions}` — 온체인 해시를 직접 읽어 비교 |

### 플랫폼

| Method | Path | Body | 응답 |
| --- | --- | --- | --- |
| POST | `/api/records/visit` | `{persona, clinicId, procedureId}` | 병원 확인 시술 → append 증명 → Base Sepolia 기록 (~10초) + 리뷰 티켓 → `{tx, day}` |
| POST | `/api/reviews` | `{persona, clinicId, procedureId, rating, text}` | Semaphore 익명 리뷰. 티켓 없으면/두 번째면 거부 |
| GET | `/api/stats` | – | `verifiedUsersByProcedure` ("피북 사용자 N명 받음"), 병원별 검증 방문·평점·후기 |
| GET | `/api/ledger` | – | 체인에 공개된 전체 이벤트 (가명·해시·버전·tx) |
| GET | `/api/events` | – | SSE. 외부 에이전트의 검증·기록도 데모 콘솔 로그에 표시됨 |

### bundle

```json
{
  "subjectId": "0x…",                // 고객 가명 (체인 키). 이름·여권과 무관
  "offerId": "ofr_yeoksam_i_first_visit",
  "today": 29880272,                 // 데모 시계 day (1일 = 60초)
  "provingMs": 458,
  "proofs": [                        // 오퍼 조건마다 1개, 각 ~14KB
    { "proof": "0x…", "publicInputs": ["commitment", "today", "type", "clinic", "minDays", "maxDays", "minCount", "maxCount"] }
  ]
}
```
`type`/`clinic`이 0이면 "무관". 번들로 알 수 있는 건 "이 가명이 이 오퍼 조건을 만족한다"뿐입니다.

## 4. A2A에 얹는 방법 (spec 03 형식 제안)

**확장** (병원 카드와 고객 카드에 선언, `required: false`):

| URI | 선언 위치 | 내용 |
| --- | --- | --- |
| `https://pibu.app/ext/zk-offer-proof/v1` | 병원 카드 | `params.offers[]`: 오퍼 id·혜택·조건(`clauses`). 이 확장을 선언한 병원은 `pibu/offer-proof@1`을 받는다 |
| 〃 | 고객 카드 | 고객 에이전트가 증명을 만들 수 있음 (`params.registry` = Base Sepolia 레지스트리 주소) |

**메시지 스키마** `pibu/offer-proof@1` (고객 → 병원, `clinic.quote` 요청에 data part로 동봉):

```json
{ "kind": "data", "data": { "schema": "pibu/offer-proof@1", "bundle": { /* prove-offer 응답 */ } } }
```

병원 에이전트 처리:
1. `pibu/offer-proof@1`이 있으면 **LLM 호출 전에** `verify-offer` (검증은 코드, 판단은 LLM)
2. `pibu/quote@1`에 `offerApplied: { offerId, verified: true }` 반영. 실패면 정가
3. 검증 결과를 A2A 로그에 남길 때 `bundle.proofs`는 길어서 생략 가능 (마스킹 대상 아님 — 개인정보 없음)

## 5. 에이전트 프롬프트에 꼭 넣을 규칙

고객 에이전트:
- 시술 이력·날짜·이전 병원은 **어떤 메시지에도** 넣지 않는다 (요약·암시 포함). 기록 기반 혜택은 `offerId` + 증명으로만.
- 오퍼 매칭은 `match-offers`(기기 안)로 하고, **해당 없는 병원에는 증명을 요청하지도 보내지도 않는다** — "증명 실패" 자체가 정보 유출이 되기 때문.
- 메모장 기록(자기 신고)은 상담·추천에는 써도 되지만, 혜택 자격 주장에는 못 쓴다.

병원 에이전트:
- 차트를 요구하지 않는다. 받은 메시지 + 검증 결과만으로 견적.

## 6. 데모 상태 (Base Sepolia)

- Registry v2: [`0xcf47152e720508bf8c757a55aa30956ca8b58857`](https://sepolia.basescan.org/address/0xcf47152e720508bf8c757a55aa30956ca8b58857) · 1일 = 60초
- `cus_yuki`: 쥬베룩 볼륨 1회 @ 홍대 A의원 (2026-10-24 13:29 KST) → **13:57 KST 이후** 장면 ① 2회차 오퍼 대상
- `cus_jisoo`: 리쥬란 1회 @ 신논현 D의원 + 메모장 자기 신고 17건 → 장면 ②(역삼 I 첫 방문)·④(단골가 불가) 바로 가능
- `cus_grace`, `cus_lin`: 기록 없음

## 7. 구조와 한계

```
병원 확인 시술 ──append 증명──▶ RecordRegistry (Base Sepolia): 가명 → 차트 해시만
        │                          (컨트랙트가 증명 검증 · 소급/누락 불가)
        ▼
고객 지갑 (차트 원본, 기기) ──offer 증명──▶ 병원 에이전트 ──검증──▶ 온체인 해시와 대조
```

- `zk/eligibility`: 기록 (시술, 날짜, 병원) 중 조건에 맞는 개수가 범위 안임을 증명
- `zk/append`: 기존 차트 + 1건 (삭제·병원 바꿔치기 불가, 신규 가명은 빈 차트에서 시작)
- 알려진 한계: 가명을 새로 만들면 첫 방문 할인을 다시 노릴 수 있음 → 로드맵: 여권 ZK(ZKPassport/Self)로 여권당 가명 1개. 기록 발급은 플랫폼 relayer 권한 → 로드맵: 병원 서명을 회로 안에서 검증.
