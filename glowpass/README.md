# glowpass: ZK 기록 레이어 데모 서버

Pibu의 시술 기록·오퍼·후기를 ZK로 보호하는 레이어의 HTTP API + 데모 콘솔. 제품 스펙과 시나리오의 정본은 `docs/spec/`이고, A2A 에이전트가 이 레이어를 부르는 방법은 [docs/INTEGRATION.md](../docs/INTEGRATION.md)에 있다.

**병원은 차트를 보지 않고, 증명만 본다.**

- 고객 에이전트가 병원들의 공개 오퍼 조건(`event.zkClauses`)을 기기 안에서 매칭하고, 해당되는 오퍼만 ZK 증명으로 주장한다
- 병원 에이전트는 "리쥬란 정확히 1회"(2회차), "우리 병원 기록 0건"(첫 방문) 같은 조건 충족 여부만 검증한다
- 시술 기록은 병원이 확인하고 고객 지갑에 저장된다. 체인(Base Sepolia)에는 가명 → 차트 해시만 올라가고, 기록 추가마다 컨트랙트가 ZK 증명을 검증한다 (누락·소급 불가)
- 후기는 Semaphore로 실제 방문자만 익명 1회. 순위 신호는 검증된 방문 수

| 디렉터리 | 내용 |
| --- | --- |
| `zk/` | Noir 회로: `eligibility`(오퍼 조건), `append`(기록 추가), `commit`, `record_hash`. `codes.json`은 시술·병원 id의 회로 코드 |
| `chain/` | `RecordRegistry.sol` + 자동 생성 검증 컨트랙트, 지갑·증명 로직(`records.mjs`), 후기(`reviews.mjs`), 로컬 e2e(`e2e.mjs`) |
| `glowpass/` | 이 서버: ZK HTTP API + 데모 콘솔 + 공개 원장 화면(`/ledger`). `catalog.mjs`가 스펙 id·오퍼·시드의 정본 |

```bash
(cd zk && npm i) && (cd chain && npm i) && (cd glowpass && npm i)
cd glowpass && npm start        # http://localhost:4000 (Next.js 앱은 3000)
```

검증: `cd chain && anvil & node e2e.mjs`. 2회차·첫 방문 오퍼 증명, 소급 기록·롤백·증명 재사용 거부까지 로컬 체인에서 확인한다.

페르소나 지갑(`chain/wallets/*.json`)은 의료 차트라 git에 없다. 데모 맥 1대에서 서버를 돌리고, 다른 머신의 에이전트는 그 서버를 호출한다 (INTEGRATION.md 1절).
