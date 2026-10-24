# 배포 가이드

배포는 **`main` 머지 → Vercel Git 연동 자동 배포**로만 한다. 로컬에서 `vercel deploy --prod` 같은 수동 프로덕션 배포는 하지 않는다 (팀 규칙: 배포 경로를 하나로 유지해 어떤 커밋이 떠 있는지 항상 `main`으로 설명되게).

## 구성 요소

| 대상 | 위치 | 배포 방식 | 비고 |
| --- | --- | --- | --- |
| 웹 앱 (고객 웹, 병원 콘솔, 운영 콘솔, 데모) | 리포 루트 Next.js | Vercel | `vercel.json`: `main`만 배포, 다른 브랜치 프리뷰 끔 |
| GlowPass ZK 데모 서버 | `glowpass/` (+ `zk/`, `chain/`) | 데모 맥에서 직접 실행 | Yuki·Lin 증명은 지갑 파일이 있는 데모 맥에서만 성공 ([INTEGRATION.md](INTEGRATION.md) 1절) |

## 0. 현재 연결 상태 (2026-10-24)

- Vercel 프로젝트: `ironact-projects/jongro3ga`
- 연결된 Git 리포: **`makim-414/jongro3ga` (포크)**. 원본 `goranyseoul/jongro3ga`는 개인 계정 소유라 Vercel GitHub 앱이 접근하지 못해 직접 연결이 실패했다.
- 정본은 계속 `goranyseoul/jongro3ga`다. 포크는 배포용 거울이고 직접 커밋하지 않는다.
- 배포 절차: 원본에 PR 머지 → `gh repo sync makim-414/jongro3ga` (포크 `main`을 원본과 맞춤) → Vercel이 포크 `main` 푸시를 받아 프로덕션 빌드.
- 원본 리포 소유자가 Vercel GitHub 앱에 이 리포 접근을 허용하면, `vercel git connect https://github.com/goranyseoul/jongro3ga.git`로 원본에 직접 연결하고 포크 단계를 없앤다.

## 1. Vercel 프로젝트 연결 (오너 1회)

1. Vercel 대시보드 → Add New → Project → GitHub `goranyseoul/jongro3ga` Import. Vercel GitHub 앱이 `goranyseoul` 계정 리포에 접근할 수 있어야 하므로, 리포 소유자 계정에서 앱 접근을 허용해야 할 수 있다.
2. 설정: Framework `Next.js`, Root Directory `./`, Build Command 기본값(`npm run build`, `prebuild` 토큰 검사 포함), Node.js 22.x.
3. 환경 변수 (Production):

| 이름 | 지금 필요 | 값 |
| --- | --- | --- |
| `FOREIGN_PATIENT_AGENCY_REG_NO` | 선택 | 비워 두면 화면에 "데모" 표기 |
| `DEMO_MODE` | 선택 | `true` |
| `ANTHROPIC_API_KEY` | 에이전트 로직 연결 후 | Vercel 대시보드에만 입력. 리포·채팅에 쓰지 않는다 |
| `A2A_TOKEN_SECRET`, `REFERRAL_PRIVATE_JWK`, `REFERRAL_PUBLIC_JWK` | A2A 백엔드 연결 후 | 스펙 [09-architecture.md](spec/09-architecture.md) 환경 변수 절 |

4. 연결 후 `main`에 머지될 때마다 프로덕션이 갱신된다.

## 2. 지금 배포본의 한계

- 화면은 전부 목데이터(`lib/ui-data/*`)와 브라우저 데모 상태로 동작한다. 그래서 지금은 서버리스(Vercel)에서도 그대로 돈다.
- 에이전트 로직(A2A rpc, 메모리 저장소, 태스크 폴링)이 붙으면 서버리스 인스턴스 간 메모리가 공유되지 않아 깨진다 ([09-architecture.md](spec/09-architecture.md) 배포 절). 그 시점에는 Postgres 저장소를 먼저 붙이거나, 발표용은 데모 맥에서 `npm run build && npm start` 단일 프로세스로 띄운다.
- 랜딩 글꼴 Non Bureau는 라이선스 글꼴이라 리포에 없다 (`.gitignore`의 `public/fonts/NonBureau-*`). 배포본은 시스템 글꼴로 대체되고 브라우저 콘솔에 글꼴 404가 1건 남는다.

## 3. 발표 당일 데모 맥 실행

```bash
# 웹 앱 (단일 프로세스)
npm ci && npm run build && PORT=3000 npm start

# ZK 데모 서버 (다른 터미널)
(cd zk && npm i) && (cd chain && npm i) && (cd glowpass && npm i)
cd glowpass && PORT=4000 npm start
```

같은 와이파이의 다른 기기에서 ZK 서버를 부르려면 `http://<데모 맥 IP>:4000`, 다른 네트워크면 터널(ngrok 등)을 연다.

## 4. 머지 전 확인

- PR의 `ci` 워크플로가 초록 (`npm ci` → `typecheck` → `test` → `build` → `node scripts/verify-spec.mjs all`).
- 로컬 확인: `npm run build && npx next start -p 3400` 후 화면 22개가 열리는지.
