# PiBoo-K ZK 프라이버시 레이어

피북(PiBoo-K) A2A 플랫폼의 기록·오퍼·후기를 ZK로 보호하는 레이어. 제품 기획과 데모 시나리오는 `main`의 PLANNING.md · DEMO.md.
**병원은 차트를 보지 않고, 증명만 본다.**

- 고객 에이전트가 병원들의 공개 오퍼 규칙을 **기기 안에서** 매칭하고, 해당되는 오퍼만 ZK 증명으로 주장
- 병원 에이전트는 "쥬베룩 1회 완료 · 28일 경과"(2회차), "우리 병원 첫 방문" 같은 **조건 충족 여부만** 검증
- 시술 기록은 병원이 발급 → 유저 지갑에 저장, 체인(Base Sepolia)에는 **가명 → 차트 해시**만. 기록 추가마다 ZK 증명을 컨트랙트가 검증 (누락·소급 불가)
- 리뷰는 Semaphore로 실제 방문자만 익명 1회, 순위는 검증된 방문 수

| 디렉터리 | 내용 |
|---|---|
| `zk/` | Noir 회로: `eligibility`(오퍼 조건 증명), `append`(기록 추가 증명), `commit`, `record_hash` |
| `chain/` | `RecordRegistry.sol` + 자동 생성 검증 컨트랙트, 지갑/증명 로직(`records.mjs`), 리뷰(`reviews.mjs`), 로컬 e2e(`e2e.mjs`) |
| `app/` | ZK HTTP API + 데모 콘솔 (DEMO.md 장면 ①~④) + 공개 원장 화면 (`/ledger`) |
| `docs/INTEGRATION.md` | **A2A 에이전트 연동 가이드 (HTTP API, 메시지 규약, 프롬프트 규칙)** |

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd app && npm i)
cd app && node server.mjs   # http://localhost:3000
```

검증: `cd chain && anvil & node e2e.mjs` — 2회차·첫 방문 오퍼 증명, 소급 기록·롤백·증명 재사용 공격 거부까지 로컬 체인에서 확인.
