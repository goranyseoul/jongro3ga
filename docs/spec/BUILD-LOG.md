# BUILD-LOG

빌드 중 발견한 스펙과 현실의 차이, 결정, 막힌 지점을 적는다. 스펙 문서(00~10)는 고치지 않는다.

## 스펙 이슈

| # | 태스크 | 내용 | 채택한 해석 |
| --- | --- | --- | --- |
| 1 | T00 | `create-next-app@16`의 기본 템플릿이 `next.config.ts`에 `cacheComponents: true`, `partialPrefetching: true`를 켠다. 스펙 09는 이 설정을 언급하지 않는다 | 둘 다 끄고 시작한다. 이 앱은 상태 있는 메모리 저장소, 고정 시계, JSON-RPC 라우트가 요청 시점 렌더링에 의존한다 (가장 보수적인 해석) |
| 2 | T00 | 템플릿이 `next/font/google`(빌드 시 네트워크 필요)을 쓴다 | 제거하고 시스템 폰트 스택 토큰을 쓴다 (T01) |
| 3 | T00 | `vitest@5.0.5`의 peer가 `@types/node@^22 \|\| >=24`라 템플릿의 `@types/node@^20`과 충돌한다 | `@types/node@^22`로 올린다 (Node 22 런타임과 일치) |
| 4 | T00 | `vitest run`은 테스트 파일이 없으면 기본으로 exit 1이다. `npm run gate`의 `npm test`는 T00에서 통과해야 한다 | `vitest.config.mts`에 `passWithNoTests: true` |

## 작업 메모

- T00: 스캐폴드는 `/tmp/pibu-scaffold`에서 생성 후 병합 (README.md, CLAUDE.md, PLANNING.md, docs/, scripts/verify-spec.mjs 보존).
- T00: `.next`를 `rm -rf`로 지운 일이 한 번 있었다 (빌드 산출물, 리포 밖 아님, 추적 파일 아님). 이후 사용하지 않는다.
