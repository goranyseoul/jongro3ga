# ZK 레이어 연동 가이드 (A2A 에이전트 담당자용)

> 한 줄 요약: **에이전트는 차트를 주고받지 않는다. 오퍼 ID + ZK 증명만 주고받는다.**
> 유저 에이전트는 `prove-offer`로 증명을 만들어 A2A 메시지에 첨부하고, 병원 에이전트는 `verify-offer`로 검증한다.

## 1. 실행

```bash
# 최초 1회
(cd zk && npm i) && (cd chain && npm i) && (cd app && npm i)
# 서버 (http://localhost:3000)
cd app && node server.mjs
```

- 컴파일된 회로(`zk/*/target/*.json`)와 컨트랙트 ABI(`chain/build/`)가 커밋돼 있어서 **Noir 설치 없이 `npm i`만으로 동작**합니다.
  회로를 고칠 때만 nargo **1.0.0-beta.20** (`noirup -v 1.0.0-beta.20`) + bb.js `5.0.0-nightly.20260324` 조합이 필요합니다 (다른 조합은 깨짐).
- 체인 기록 발급(`/api/visit`)만 relayer 키가 필요합니다(`chain/.env`의 `DEPLOYER_PRIVATE_KEY`). 증명·검증·리뷰는 키 없이 동작합니다.
- 페르소나 지갑(비공개 차트)은 `chain/wallets/<persona>.json`에 있고 gitignore입니다. 데모 머신 1대에서 서버를 돌리는 것을 전제로 합니다.

## 2. HTTP API

모든 요청/응답은 JSON. `persona` ∈ `yuki | lin | emily`, `clinicId` ∈ `glow | lumiere | apgujeong`.

### 유저 에이전트 측 (on-device 역할)

| Method | Path | Body | 설명 |
|---|---|---|---|
| GET | `/api/wallet/:persona` | – | **비공개** 지갑: 프로필·체류·예산·목표·시술 이력(며칠 전). 유저 에이전트만 읽고 병원에 전달 금지 |
| POST | `/api/zk/match-offers` | `{persona}` | 모든 병원 오퍼를 기기 안에서 매칭 → `[{clinicId, offerId, title, eligible}]` |
| POST | `/api/zk/prove-offer` | `{persona, offerId}` | 오퍼 조건 ZK 증명 번들 생성 (약 0.4초/조건) → **`bundle`** |

### 병원 에이전트 측

| Method | Path | Body | 설명 |
|---|---|---|---|
| GET | `/clinics/:clinicId/.well-known/agent-card.json` | – | A2A Agent Card (서비스·가격·다운타임·**공개 오퍼 규칙**) |
| POST | `/api/zk/verify-offer` | `{clinicId, bundle}` | 번들 검증 → `{ok, reason, commitment, today}`. 온체인 commitment를 직접 읽어 비교 |

### 플랫폼

| Method | Path | Body | 설명 |
|---|---|---|---|
| POST | `/api/visit` | `{persona, clinicId, procedure}` | 시술 완료 → append 증명 생성 → Base Sepolia 기록 + 리뷰 티켓 발급 (약 0.00002 ETH) |
| POST | `/api/review` | `{persona, clinicId, procedure, rating, text}` | Semaphore 익명 리뷰 (방문 티켓 필요, 시술당 1회) |
| GET | `/api/ranking` | – | 병원 순위 (검증 방문 수, 평점, 공개 리뷰) |

`procedure` ∈ `REJURAN | FILLER | BOTOX | THERMAGE | ULTHERA | EXOSOME | LASER_TONING`

### bundle 형식 (prove-offer 응답 = verify-offer 입력)

```json
{
  "subjectId": "0xf512…",          // 유저 가명 (체인 키)
  "offerId": "apgujeong-switch-ulthera",
  "today": 29880232,                // 데모 시계 day (1 day = 60초)
  "proofs": [                       // 오퍼 조건(clause)마다 1개
    { "proof": "0x…(약 14KB)", "publicInputs": ["commitment", "today", "type", "minDays", "maxDays", "minCount", "maxCount"] }
  ]
}
```

번들을 열어도 알 수 있는 것은 "이 가명이 이 오퍼 조건을 만족한다"뿐입니다. 시술 날짜·횟수·병원은 들어있지 않습니다.

## 3. A2A 메시지 규약 (제안)

증명은 A2A 메시지의 `data` part로 첨부합니다. 이 데모의 `app/agents.mjs`가 이 형태로 구현돼 있으니 참고하세요.

```json
{
  "role": "user",
  "messageId": "…",
  "contextId": "…",
  "parts": [
    { "kind": "text", "text": "Hi! Visiting Nov 3–5, interested in jawline lifting, budget ~₩2M." },
    { "kind": "data", "data": { "zkOfferProof": { /* bundle */ } } }
  ]
}
```

병원 에이전트 처리 순서:
1. `data.zkOfferProof`가 있으면 **LLM에 넘기기 전에** `verify-offer` 호출 (검증은 코드로, 판단은 LLM으로)
2. 결과를 `[VERIFICATION] offer "<id>": VALID | INVALID (<reason>)` 같은 한 줄로 LLM 입력에 붙임
3. LLM은 VALID일 때만 할인 적용

## 4. 에이전트 프롬프트에 꼭 넣을 규칙

유저 에이전트 (이게 제품의 핵심이라 데모에서 깨지면 안 됨):
- 시술 이력·날짜·이전 병원은 **어떤 메시지에도** 넣지 않는다 (요약·암시 포함).
- 이력 기반 오퍼는 `offerId` + 증명으로만 주장한다.
- 병원에 보내는 것은 목표·체류 일정·예산·언어뿐.
- 오퍼 매칭은 기기 안에서(`match-offers`) 하고, 대상이 아닌 병원에는 증명을 요청하지도 보내지도 않는다 → "증명 실패" 자체로 정보가 새는 것을 막음.

병원 에이전트:
- 차트를 요구하지 않는다. 받은 메시지 + 검증 결과만으로 영업·견적.
- 검증 VALID일 때만 오퍼 할인 적용.

## 5. 데모 데이터 (Base Sepolia)

- Registry: [`0x8f9d9665d7bc1a19606a1f1302d29df353e6f241`](https://sepolia.basescan.org/address/0x8f9d9665d7bc1a19606a1f1302d29df353e6f241) · 데모 시계 1 day = 60초
- 오퍼 규칙과 병원 데이터: `app/clinics.mjs`

| 페르소나 | 이력 | 대상 오퍼 |
|---|---|---|
| 🇯🇵 Yuki | 리쥬란 ×2 (2번째는 13:23 KST 기록) | 글로우 레이저 첫 시술 / **뤼미에르 리쥬란+엑소좀 (14:23 KST 이후)** |
| 🇨🇳 Lin | 써마지 ×1 | 글로우 레이저 첫 시술 / **압구정 써마지→울쎄라 첫 시술** |
| 🇺🇸 Emily | 없음 | 글로우 레이저 첫 시술 |

## 6. 구조와 보장 범위

```
병원 서명 기록 ──▶ 유저 지갑(차트 원본, 기기) ──append 증명──▶ RecordRegistry (Base Sepolia)
                         │                                   가명 → 차트 해시만 저장
                         └─offer 증명──▶ 병원 에이전트 ──검증──▶ 온체인 해시와 비교
```

- `zk/eligibility`: 오퍼 조건 증명 (특정 시술을 기간 내 N회 이상/이하)
- `zk/append`: 기록 추가 증명 (기존 차트 + 1건, 삭제·위조 불가, 신규 유저는 빈 차트에서 시작)
- `chain/contracts/RecordRegistry.sol`: append 증명을 **컨트랙트가 직접 검증**, 오늘 날짜가 아닌 기록 거부(소급 불가)
- `chain/reviews.mjs`: Semaphore 익명 리뷰 (방문자만, 시술당 1회, 방문자 3명 이상일 때 공개)

알려진 한계 (질문 대비):
- 가명을 새로 만들면 빈 차트로 첫 방문 오퍼를 다시 받을 수 있음 → 로드맵: 여권 ZK(ZKPassport/Self)로 여권 1개당 가명 1개
- 기록 발급 권한은 플랫폼 relayer가 가짐 → 로드맵: 병원 서명 검증을 회로 안으로
- 데모에선 "기기" 역할을 서버가 대신함 (지갑 로직은 그대로 모바일로 이동 가능)
