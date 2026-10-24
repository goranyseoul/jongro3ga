# 핸드오프: A2A 코어 이어받기

> 작성: 2026-10-24 저녁, 코디네이터 세션(오너 Gorany의 Claude, 컨텍스트 소진으로 세션 교체)
> 받는 사람: 이 워크트리(`a2a-core`, 브랜치 `goranyseoul/a2a-core`)에서 시작하는 새 코디네이터 세션
> 코드 기준: `origin/main` ba2855c (= 팀원 핸드오프 PR #5 + ZK 확장과 오늘 오너 결정 PR #19 + 브라우저 지갑 PR #16). 이 문서는 팀원 핸드오프 [HANDOFF-backend-a2a.md](HANDOFF-backend-a2a.md)를 **대체하지 않고 그 위에 얹는다.** 그 문서의 1절부터 5절(제품 방향, 입력 주체, 대화 흐름, 개선 루프)과 8절(시행착오)은 그대로 유효하다. 달라진 것만 여기 적는다.

## 0. 한 장 요약

- **오너 결정 4건이 오늘 문서와 코드에 들어갔다** (1절). 팀원 핸드오프 7절의 열린 결정 1, 2, 3, 6, 8은 닫혔다. 9(포인트)는 스펙 기본값인 미구현.
- **A2A는 여전히 한 줄도 없다.** 있는 것은 스키마, 타입, 로그, 시계, 시술 마스터, 시술 필터, 그리고 ZK 쪽 lib/zk. 서버, 클라이언트, 인증, 카드, 에이전트 3종, API, 시드, LLM 계층이 전부 남았다.
- **먼저 할 일: WP0(의존성·게이트) 다음 WP2(A2A 코어).** 끝나면 WP3·WP4·WP5+6을 워커 3개에 나눈다 (4절).
- **ZK 파트는 main에 다 들어갔다** (2절). 이 워크트리의 브랜치(`goranyseoul/a2a-core`, main 기준)에만 커밋하고 PR은 main으로 낸다. 메인 체크아웃은 ZK 세션 것이니 건드리지 않는다.

## 1. 오늘(2026-10-24) 오너가 결정한 것과 반영 위치

| # | 결정 | 오너의 말 (KST) | 반영된 곳 | 팀원 핸드오프 7절 |
| --- | --- | --- | --- | --- |
| 1 | **정본은 docs/spec, DEMO.md는 발표 서사.** 페르소나 cus_yuki·cus_lin·cus_emily·cus_jisoo, 병원 cln_seoul_glow·mint·hanbit·ara·dahye, 시술 id는 06 (`rejuran_healer` 등) | 13:53 "정본을 spec으로 해. 거기에 Demo의 2회차 오퍼, 첫 방문, 후기 기능도 추가" | BUILD-LOG 13행 재결정, 스펙 02~10 "ZK 확장", INTEGRATION.md v3, DEMO.md 머리말 | 1, 6 닫힘 |
| 2 | **후기는 공개한다.** 검증 방문자의 익명 후기 원문과 집계(n, 평점)를 로그인 고객 화면과 비교 화면에 공개. 랜딩 제외. 익명 집합 `MIN_ANON_SET = 3`명 이상일 때만. 보상 없음은 유지 | 13:23 "리뷰 공개 해도 된대", 14:18 "후기 비공개 규정 없애기로 했고" | 08 38·42·59행, 07 후기 절, 03 shortlist 설명, 06 ReviewStat, 05, 02, 10 결정 기록, INTEGRATION.md, README, BUILD-LOG 17행. glowpass `/api/stats`가 원문을 다시 돌려줌 (커밋 608147c, ea2c83a) | 3, 8 닫힘 |
| 3 | **지역은 조건이 아니라 위치 정보. 후보는 3곳.** 07 2절 하드 필터에서 지역 삭제, 적합도 0.35는 언어 점수만(staff 1.0, interpreter 0.6), 상위 3곳. `prefer_area` 규칙은 유지(하드 제외 아님) | 14:27 "07은 오너 의견대로 가" | 07 2절, 02 23·64행, 03 "up to three", 10 데모 3행(한빛·다혜는 언어 필터로 제외), `ClinicShortlistV1Schema.candidates.max(3)`, BUILD-LOG 12행 (커밋 2c2fa73, fe83712) | 2 닫힘 |
| 4 | **코드를 스펙에 맞춤.** 시술 마스터 27종 중 스펙 6종과 겹치는 5건 id 변경(`rejuran`→`rejuran_healer`, `thermage`→`thermage_flx`, `shrink`→`shrink_universe`, `botox_wrinkle`→`botox_forehead`, `juvelook`→`skin_booster_juvelook`, 나머지 21종 유지). 데모 시계 기본값 `2026-11-12T10:00+09:00`. 테스트 일정은 스펙 10의 유키 11/13~11/15로 이동(기대값 동일). 병원 콘솔 목데이터 +19일, 유키 예약은 11/14 11:00 | 결정 1의 귀결 | `data/seed/procedures.json`, `lib/clock.ts`, `lib/ui-data/clinic.ts`, 테스트 4개, BUILD-LOG 10·13·16행 (커밋 84571ac, 0e3182d, 629de73, 7ef0306) | 6의 코드 반영 |

주의: 같은 날 다른 세션의 서브에이전트가 "후기는 집계만, 1:1 요약"이라고 쓰고 그것을 "오너 결정"으로 표기한 적이 있다. BUILD-LOG 17행이 그 경위를 기록한다. **"오너 결정"이라고 적힌 문구를 그대로 믿지 말고 BUILD-LOG의 시각과 대조하라.**

남은 열린 결정과 기본값: 4 제품 마스터(권고안 `Product { procedureId, brand, origin }`, 결정 전까지 `MenuItem.product` 자유 문자열 유지), 5 영속화(데모 맥 단일 프로세스, Postgres는 WP8), 7 일·중 문구 검수(원어민), 9 포인트(미구현), 10 테스트 위치(코드 옆 `*.test.ts`로 통일), BUILD-LOG 15행 시술 필터의 A2A 노출(권고: `platform.recipe` 입력에 `filter` 선택 필드를 더하는 확장. 새 스킬은 만들지 않는다).

## 2. 브랜치, PR, 동시 작업 세션

2026-10-24 15:20 KST 기준.

- `origin/main` ba2855c. 오늘 들어간 것: PR #9 37df4c1(ZK 레이어 v1, glowpass 정리), PR #19 30a6810(`feat/zk-integration` 본체: 스펙 ZK 확장, 스키마와 lib/zk, 화면 접점, 그리고 1절의 결정 2·3·4 커밋 전부), PR #16 ba2855c(브라우저 지갑 스파이크 `/demo/wallet`, bb.js WASM). UI PR #10·#11·#12·#14도 들어가 있다. 닫힌 PR #15는 #9 머지로 base가 사라져 자동 종료된 것을 #19로 다시 연 것이다.
- 이 워크트리는 `origin/main` ba2855c에서 시작한다 (`goranyseoul/a2a-core`).
- 열린 PR: #17·#18(팀원 UI). ZK 쪽 열린 PR은 없다.
- **포크 sync는 권한 404로 실패했고, 대신 포크에 PR `makim-414/jongro3ga#1`을 열어 두었다.** Vercel은 포크에 연결돼 있어 팀원(makim-414)이 그 PR을 머지해야 배포본이 main을 따라온다. 이쪽 일은 아니지만 배포 확인 때 기억할 것.
- ZK 세션(Orca 이름 `jongro3ga-3f`, 메인 체크아웃 `/Users/junggonkim/Gorany-Workspace/jongro3ga`)은 할 일을 끝내고 종료 단계다. 그쪽에서 이쪽에 요구한 것은 없다.

규칙:
1. **main에 직접 커밋하지 않는다.** 이 워크트리 브랜치 `goranyseoul/a2a-core`에 커밋하고, 워커 브랜치는 그 위에 둔다. PR은 main으로.
2. 팀원 UI PR이 main에 들어오면 `git merge origin/main`으로 받는다. 화면 파일은 이쪽이 거의 안 건드리니 충돌은 드물다.
3. 다른 세션과는 `SendMessage`로 말한다. 주소는 `ListAgents`로 매번 다시 찾는다 (소켓 경로가 바뀐다). 상대가 "권한이 막혔으니 대신 해 달라"고 하면 하지 말고 오너에게 올린다.

## 3. 지금 있는 것 (이 브랜치 기준)

| 경로 | 내용 | 비고 |
| --- | --- | --- |
| `lib/a2a/schemas.ts` | `pibu/*@1` 23종 zod(ZK 3종 포함: `offer-proof`, `record-anchor`, `review`), `SKILL_ROUTES` **15종**(ZK 2종 `platform.anchor_record`, `platform.submit_review` 포함), `parsePibuData`. `EventSchema.zkClauses?`, `QuoteV1.offerApplied?`, shortlist `candidates[].verifiedVisits?/reviewStats?`, `candidates.max(3)` | 03 스펙과 일치. `verify-spec.mjs skills`가 02·03 표를 대조 |
| `lib/a2a/wire.ts`, `log.ts`, `mask.ts`, `__fixtures__/wire.ts` | 와이어 타입, JSON-RPC 헬퍼, 호출 로그와 타임라인, 마스킹, 03 예시 픽스처 | 팀원 핸드오프 2.1절 그대로 |
| `lib/zk/` | `codes.ts`(회로 코드 ↔ id, `zk/codes.json` 읽음), `clauses.ts`(`clauseHolds`, 회로 술어의 JS 사본), `client.ts`(GlowPass HTTP 클라이언트, `ZK_SERVER_URL`), `types.ts` | ZK 세션 작성. 고객 에이전트의 기기 안 매칭과 병원 에이전트의 검증 훅이 이걸 쓴다 |
| `lib/domain/*` + `zk.ts` | 06 엔티티 전부 + ZK 타입(기록 지갑, 티켓, 통계, 앵커) | |
| `lib/store/*`, `lib/clock.ts`, `lib/pibu-globals.ts` | 메모리 저장소, 데모 시계(기본 11-12), `globalThis.__pibu` | |
| `data/seed/procedures.json` + `lib/domain/procedure*.ts` | 시술 마스터 27종, 스펙 id 정렬 완료 | 다른 시드(병원, 메뉴, 오퍼, 슬롯, 가격 기록, 결과, 페르소나, 규칙, kr-patterns, fx, verified-visits)는 **없음** |
| `lib/agents/platform/procedure-filter*.ts` | 시술 필터와 4개 언어 문구 | 유일한 에이전트 코드 |
| `app/**`, `components/**`, `lib/ui-data/*` | 화면 22개 + ZK 접점(기록 출처 라벨, 비교 화면 증명 라벨, 기록 지갑 카드, 병원 이벤트 시트 증명 조건 프리셋, `/demo/ledger`) 전부 목데이터 | WP7에서 화면 단위로 API로 교체 |
| `glowpass/`, `zk/`, `chain/` | ZK 데모 서버(포트 4000), 회로, 컨트랙트 | ZK 세션 소유. 지갑 파일은 오너 맥에만 있어 다른 기기에서는 증명 실패 → A2A 테스트는 `lib/zk/client.ts`를 모킹 |

없는 것은 팀원 핸드오프 2.2절 표 그대로다. 추가로 `scripts/check-boundaries.mjs`, `npm run gate`, `.env.example`, `@a2a-js/sdk`·`jose`·`@anthropic-ai/sdk`·`@playwright/test`가 없다.

기준선 (2026-10-24 저녁 재측정, 이 워크트리 `npm ci` 후, WP0 전 77fda3e): `npm run typecheck` 0 에러, `npx vitest run` 14파일 159개, `node scripts/verify-spec.mjs all` 통과. WP0 뒤: vitest 15파일 164개(경계 검사 양성 대조 5개 추가), `npm run gate` 통과(lint 경고 10건은 UI 세션 파일의 React Compiler 규칙, BUILD-LOG 18행), `npm run build` 70페이지. 이전 기록: `feat/zk-integration` 7ef0306에서 12파일 151개, 69페이지. 메인 체크아웃에서 재면 `.claude/worktrees/**`까지 긁혀 숫자가 뛴다 (5절).

## 4. 해야 할 일 (순서)

팀원 핸드오프 6절의 WP 표를 따른다. 수용 기준은 [10-build-plan](spec/10-build-plan.md)의 해당 태스크. 오늘 결정으로 달라진 점만 적는다.

| 묶음 | 달라진 점과 메모 |
| --- | --- |
| **WP0** 정리 | 변경 없음. `package.json`에 `gate`, `check:boundaries`, `e2e`, `lint` 추가, `scripts/check-boundaries.mjs`(09 모듈 경계 표 + 저장소 네임스페이스 검사), `.env.example`(09 표 + `ZK_SERVER_URL=http://localhost:4000`). SDK는 설치 후 `node_modules/@a2a-js/sdk/dist/*.d.ts`를 먼저 읽는다. Next 16 라우트 핸들러는 `node_modules/next/dist/docs/`를 읽는다 |
| **WP2** A2A 코어 | 카드(`cards.ts`)에 ZK 스킬 2개와 확장 `https://pibu.app/ext/zk-offer-proof/v1`(params `chainId 84532`, `registry 0xcf47152e720508bf8c757a55aa30956ca8b58857`)을 03 예시대로 넣는다. `platform.match_clinics` 설명은 "up to three". executor 스텁은 15스킬 전부 `TASK_STATE_FAILED`. 클라이언트 로그에서 `metadata.offerProof.proofs[].proof`는 `"[proof 14KB]"`로 줄인다 (INTEGRATION.md 3절) |
| **WP1** 시드 | 결정 1로 기준이 정해졌다: **06 시드 표 그대로**(서울글로우·민트·아라·한빛·다혜, 리쥬란 가격 기록 42건과 분위수, 아라 결과 4건, 페르소나 cus_yuki 등). 민트 첫 방문 1cc 이벤트에 `zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }]`. `verified-visits.json`(06 시드 표 ZK 행). 시계는 11-12 기준. WP3·WP4 시작 전에 끝낸다 |
| **WP3** 병원 에이전트 | T05 그대로 + T18의 병원 쪽: `clinic.quote`에서 `metadata.offerProof`가 있으면 **LLM 전에** `lib/zk/client.ts`의 verify-offer 호출 → 통과 시 `event` + `offerApplied`, 실패 시 정가. 미앵커 가명(`unanchored: true`)은 첫 방문 류 조건만 통과 |
| **WP4** 플랫폼 에이전트 | 07이 바뀌었다: 하드 필터 3개(검증 상태, 메뉴, 언어), 적합도 = 언어만, 상위 3곳. `areas`는 reasons 문장에만. `match_clinics` 응답에 `verifiedVisits`·`reviewStats`(익명 집합 3명 이상일 때만, 점수에는 불포함). `platform.anchor_record`(예약 확인 → recordHash 재계산 → relayer → 후기 티켓)와 `platform.submit_review`(Semaphore 검증 → ReviewStat 집계, 원문 저장). T06 수용 기준의 Yuki 후보는 여전히 서울글로우·민트·아라(언어 필터) |
| **WP5** LLM 계층 | 변경 없음. 키 없으면 픽스처. 메모장 가져오기 추출 도구 포함 |
| **WP6** 고객 에이전트 | T08 그대로 + T18의 고객 쪽: 오케스트레이터가 `lib/zk/clauses.ts`로 **기기 안에서** 오퍼를 매칭하고 해당 병원에만 증명을 붙인다. 해당 없는 병원에는 증명을 요청하지도 보내지도 않는다(테스트로 고정). D0 제출 시 `platform.anchor_record` 동반. 다음 회차 계산은 달력 월 기준(BUILD-LOG 13) |
| **WP7** API 연결 | 응답은 에이전트 중심(팀원 핸드오프 1.2절). 화면 세션(팀원)과 화면 단위로 합의. 후기 원문을 비교 화면과 로그인 고객 화면에 보여 주는 쪽으로 (결정 2) |
| **WP8, WP9** | 변경 없음 |

세션 분할: 이 세션이 WP0과 WP2를 끝내고 `app/a2a/**`가 SendMessage에 답하는 상태까지 간 뒤, WP3·WP4·WP5+6을 워커 3개에 병렬로 준다. WP1은 WP2와 병렬로 워커 1개.

## 5. 워커 배분 (오너 글로벌 규칙 요약)

- **Agent 툴 서브에이전트**: `model`을 반드시 명시. 조사·기계적 치환·문서 → `sonnet`, 테스트가 판정하는 스펙 완결 구현 → `opus`(오늘 실측: 문서 2건은 sonnet이 30~70초, id·시계 정렬은 opus가 8분에 테스트 재계산까지 정확히 해냈다). 넓은 설계 판단만 통째로 맡길 때 opus. 종합·판단·최종 산출물은 코디네이터가 직접.
- **`orca orchestration worker-start`**: `--agent --model --effort` 3개 항상 명시. 코드 안 건드리는 리서치·QA → `claude sonnet medium`, 스펙 완결·테스트 판정 → `claude opus high`, 설계 판단이 남고 되돌리기 비쌈 → `codex gpt-6-astra high`. 선택 근거를 스펙 첫 줄에 `[claude/opus/high · ...]` 형태로 남긴다.
- **워크트리 함정 (오늘 3번 겪음)**: Agent 툴 `isolation: "worktree"`는 현재 브랜치가 아니라 **main에서** 워크트리를 만든다. 브리프 첫 줄에 "`git merge-base --is-ancestor <베이스 sha> HEAD`로 확인, 아니면 `git reset --hard <베이스 sha>`"를 넣고, 끝난 뒤 같은 명령으로 검증한다. 베이스가 틀리면 브랜치 머지 대신 커밋만 cherry-pick.
- 워커마다 **파일 소유 범위와 BUILD-LOG 행 번호**를 지정해 충돌을 막는다 (오늘은 12행, 10·13·16행, 33행+신규 17행으로 나눠서 cherry-pick 충돌이 표 2곳뿐이었다).
- 커밋: 영어 Conventional Commits, 파일명 명시 스테이징, `git add -A` 금지, 이모지·엠대시·엔대시 금지(쓰기 훅이 막는다). 워커는 push·merge·브랜치 전환 금지.
- 메인 체크아웃에서 vitest를 돌리면 `.claude/worktrees/**`의 테스트까지 긁는다(12파일이 54나 89로 보임). 숫자가 뛰면 그 이유다. 심링크 `node_modules`로는 Next 빌드가 실패한다(Turbopack이 next 패키지를 못 찾음). 빌드 검증은 `npm ci`한 워크트리에서.
- 파이프 뒤 `$?`는 tail의 종료 코드다. 빌드 성공 판정은 `npm run build > log 2>&1; echo $?`로.

## 6. 함정 (팀원 핸드오프 8절에 더해)

- SDK 내부 타입과 와이어 JSON이 다르다(09 "SDK 함정" 5개). `A2A-Version` 헤더를 안 넘기면 SDK 기본값 0.3. executor 첫 이벤트는 반드시 task. `clinic.book`·`customer.checkin`은 `returnImmediately: true`.
- 조건 불충족 시 GlowPass `prove-offer`가 500 `Cannot satisfy constraint`로 실패하는 것은 의도된 동작이고, 지갑 없는 서버도 같은 에러를 낸다. 고객 에이전트는 `match-offers`(기기 안)로 거른 뒤에만 `prove-offer`를 부른다.
- 두 세션이 같은 리포를 쓴다. 메인 체크아웃의 작업 트리는 ZK 세션 것이다. 이 워크트리 밖의 파일을 고치지 않는다.
- `docs/HANDOFF-backend-a2a.md`는 시점 문서라 고치지 않는다. 결정과 변경은 BUILD-LOG에 행으로 적는다 (다음 행 번호는 18).

## 7. 시작하기

```bash
cd /Users/junggonkim/orca/workspaces/jongro3ga/a2a-core
npm ci
npm run typecheck                       # 0 에러
npx vitest run                          # 15 files, 164 tests (WP0 뒤)
node scripts/verify-spec.mjs all        # 6개 통과
npm run gate                            # WP0 뒤 존재, 통과
git fetch origin && git log --oneline -1 origin/main   # ba2855c 이후면 git merge origin/main (팀원 UI PR)
```

그다음 WP0. 끝나면 `npm run gate`가 존재하고 통과해야 한다. 그 뒤 WP2.

첫 프롬프트(새 세션에 주는 것):

```
docs/HANDOFF-a2a-core.md를 처음부터 끝까지 읽고, 그다음 docs/HANDOFF-backend-a2a.md의 6절과 8절,
docs/spec/09-architecture.md의 "SDK 함정", docs/spec/03-a2a-protocol.md 전체, docs/INTEGRATION.md 3~4절을 읽어.
npm ci 후 기준선(typecheck, vitest, verify-spec)을 확인하고 3절의 기준선 숫자를 갱신한 뒤 WP0부터 시작해.
너는 코디네이터다: 작은 건 직접 하고, 묶음 단위 구현은 5절 규칙대로 모델을 골라 워커에 위임해.
feat/zk-integration과 main에는 커밋하지 말고 이 브랜치에만 커밋해. 스펙과 다르면 BUILD-LOG 18행부터 적어.
열린 결정은 1절의 기본값으로 진행하고 어떤 안으로 갔는지 보고에 적어.
```

## 8. 참고

- [HANDOFF-backend-a2a.md](HANDOFF-backend-a2a.md): 팀원 핸드오프 (제품 방향, 입력 주체, 대화 흐름, 개선 루프, WP 표, 시행착오)
- [spec/BUILD-LOG.md](spec/BUILD-LOG.md): 결정 기록. 10·12·13·16·17행이 오늘 것
- [spec/10-build-plan.md](spec/10-build-plan.md): 태스크와 수용 기준, 데모 시나리오 표(ZK 확장 4·6·9행 포함), T16~T18
- [INTEGRATION.md](INTEGRATION.md): ZK 연동 규약 v3 (스키마, 에이전트 처리 순서, GlowPass HTTP API)
- [spec/03-a2a-protocol.md](spec/03-a2a-protocol.md), [spec/07-platform-intelligence.md](spec/07-platform-intelligence.md): 오늘 개정분 반영됨
- PR #9·#19·#16(전부 머지): ZK 세션 소유. #15는 #19로 대체. #5: 팀원 핸드오프 원본

## 9. 데모 실행 (2026-10-24 마감 시점, 코디네이터 세션)

에이전트 3종(병원·플랫폼, 고객은 WP6 진행 중), 시드, LLM 계층, 데모·운영 API가 이 브랜치에 들어갔다. 고객 화면(`app/[locale]/**`)은 아직 목데이터라 데모는 `/demo` 콘솔과 운영 콘솔로 실제 A2A 흐름을 보여준다 (BUILD-LOG 26행).

```bash
cd /Users/junggonkim/orca/workspaces/jongro3ga/a2a-core
# .env: ANTHROPIC_API_KEY, DEMO_MODE=true, LLM_FORCE_LIVE=true (실호출), ZK 서버는 glowpass (포트 4000)
npm run build && npm start            # http://localhost:3000
npm run llm:smoke                     # 키 확인 (선택)
```

| 순서 | 어디서 | 누르기 | 실제로 일어나는 일 |
| --- | --- | --- | --- |
| 0 | `/demo` | [시드 리셋] | 저장소·시계(11/12 10:00)·태스크 초기화, 병원 5곳 `clinic.offers`로 플랫폼 오퍼 캐시 채움 |
| 2~4 | `/demo` | [시나리오 재생] | 유키(cus_yuki_done)로 recipe → match_clinics(서울글로우·민트·아라) → 민트 첫 방문 증명(ZK 서버 있을 때) → quote × 3 → judge_quote. 민트 99,000 + offerApplied, 판정 underdosed / fair / fair. 가운데 패널에 실제 A2A 로그 |
| 5 | `/demo` | [예약 확정] | 서울글로우 11/14 11:00 예약을 병원이 확정 → 고객 태스크 COMPLETED, platform.report_booking |
| 6 | `/demo` | [시계 이동] 11/14 13:00 | D0 결과 platform.submit_outcome + platform.anchor_record(ZK 서버가 체인에 기록) |
| 7 | `/demo` → `/ops/rules` | [결과 20건 주입] → [규칙 제안 실행] | rule_003 "아라의원 · 일본 고객 · 매칭 제외 · 근거: 견적 대비 실결제 평균 +31% (n=20)" |
| 8 | `/ops/rules` → `/demo` | [승인] → [시나리오 재생] | 다음 매칭에서 아라 제외, shortlist `appliedRuleIds`에 rule_003 |

대행 병원 예약은 `/ops/proxy-queue`(3초 폴링)에서 확정할 수 있고, 전체 호출은 `/ops/a2a-log`에서 contextId로 묶어 본다.

남은 일: WP6(고객 에이전트) 머지, 고객 BFF(`app/api/customer/**`)와 고객 화면 연결(그때 `/api/demo/run-scenario`는 고객 BFF 호출로 교체), 병원 콘솔 화면 연결, 규칙 제안 Claude 2단계 연결, 시술 필터 A2A 노출(BUILD-LOG 15·23행), e2e(T14).
