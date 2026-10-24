# GlowPass — 의료관광객을 위한 프라이빗 뷰티 컨시어지

한국에 피부·미용 시술을 받으러 오는 일본·중국·미국 2030 여성을 위한 A2A 플랫폼.
**에이전트는 차트를 주고받지 않고, ZK 증명만 주고받는다.**

- 유저 에이전트가 병원들의 공개 오퍼 규칙을 **기기 안에서** 매칭하고, 해당되는 오퍼만 ZK 증명으로 주장
- 병원 에이전트는 "리쥬란 2회 이상 · 마지막 60일 경과" 같은 **세일즈 조건 충족 여부만** 검증 (날짜·병원·횟수 원본은 모름)
- 시술 기록은 병원이 발급 → 유저 지갑에 저장, 체인(Base Sepolia)에는 **가명 → 차트 해시**만. 기록 추가마다 ZK 증명을 컨트랙트가 검증 (누락·소급 불가)
- 리뷰는 Semaphore로 실제 방문자만 익명 1회, 순위는 검증된 방문 수

| 디렉터리 | 내용 |
|---|---|
| `zk/` | Noir 회로: `eligibility`(오퍼 조건 증명), `append`(기록 추가 증명), `commit`, `record_hash` |
| `chain/` | `RecordRegistry.sol` + 자동 생성 검증 컨트랙트, 지갑/증명 로직(`records.mjs`), 리뷰(`reviews.mjs`), 로컬 e2e(`e2e.mjs`) |
| `app/` | 데모 서버 + UI, Claude 기반 컨시어지/병원 에이전트 예시, ZK HTTP API |
| `docs/INTEGRATION.md` | **A2A 에이전트 연동 가이드 (HTTP API, 메시지 규약, 프롬프트 규칙)** |

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd app && npm i)
cd app && node server.mjs   # http://localhost:3000
```

검증: `cd chain && anvil & node e2e.mjs` — 오퍼 증명, 소급 기록·롤백·증명 재사용 공격 거부까지 로컬 체인에서 확인.
