# BUILD-LOG

빌드 중 발견한 스펙과 현실의 차이, 결정, 막힌 지점을 적는다. 스펙 문서(00~10)는 고치지 않는다.

## 스펙 이슈

| # | 태스크 | 내용 | 채택한 해석 |
| --- | --- | --- | --- |
| 1 | T00 | `create-next-app@16`의 기본 템플릿이 `next.config.ts`에 `cacheComponents: true`, `partialPrefetching: true`를 켠다. 스펙 09는 이 설정을 언급하지 않는다 | 둘 다 끄고 시작한다. 이 앱은 상태 있는 메모리 저장소, 고정 시계, JSON-RPC 라우트가 요청 시점 렌더링에 의존한다 (가장 보수적인 해석) |
| 2 | T00 | 템플릿이 `next/font/google`(빌드 시 네트워크 필요)을 쓴다 | 제거하고 시스템 폰트 스택 토큰을 쓴다 (T01) |
| 3 | T00 | `vitest@5.0.5`의 peer가 `@types/node@^22 \|\| >=24`라 템플릿의 `@types/node@^20`과 충돌한다 | `@types/node@^22`로 올린다 (Node 22 런타임과 일치) |
| 4 | T00 | `vitest run`은 테스트 파일이 없으면 기본으로 exit 1이다. `npm run gate`의 `npm test`는 T00에서 통과해야 한다 | `vitest.config.mts`에 `passWithNoTests: true` |
| 5 | T01 | 스펙은 Turbopack 캐시를 언급하지 않는다. 템플릿 기본(`@tailwindcss/turbopack` 로더 + 파일시스템 캐시)에서 `app/globals.css`를 고쳐도 빌드 CSS가 옛 내용으로 재사용됐다 (T00 상태 CSS가 `/demo/ui`에 나감, e2e에서 body 배경이 투명으로 측정되어 발견) | `next.config.ts`의 `experimental.turbopackFileSystemCacheForBuild`, `...ForDev`를 `false`로 둔다. `.next`를 옮긴 뒤 재빌드하면 새 CSS가 나왔고, 캐시를 끈 뒤에는 CSS 수정이 즉시 반영됐다 |
| 6 | T01 | 05-screens.md의 토큰 이름 `--text-muted` 등은 Tailwind v4의 `--text-*`(글자 크기) 네임스페이스와 접두사가 겹친다 | `:root` 변수는 스펙 이름 그대로 두고, Tailwind 매핑 이름은 `text-text`(색), `text-muted`, `text-subtle`, `text-body`(크기)로 구분한다. 기본 팔레트·글자 크기·radius·그림자 네임스페이스는 `@theme`에서 `initial`로 비워 토큰만 남긴다 |

## 작업 메모

- T00: 스캐폴드는 `/tmp/pibu-scaffold`에서 생성 후 병합 (README.md, CLAUDE.md, PLANNING.md, docs/, scripts/verify-spec.mjs 보존).
- T00: `.next`를 `rm -rf`로 지운 일이 한 번 있었다 (빌드 산출물, 리포 밖 아님, 추적 파일 아님). 이후 사용하지 않는다.
