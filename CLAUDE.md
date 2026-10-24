# CLAUDE.md (jongro3ga · Pibu)

> UI는 IRONACT 디자인 시스템 어휘를 따른다. 토큰(`app/globals.css`) 외 색·간격 하드코딩 금지 · BANNED 패턴(틴트 알약, 좌측 강조 보더, 이모지, 엠·엔대시, 올캡 넓은 자간) 금지 · 무채색 코어. 상세: docs/spec/05-screens.md

- 스펙 정본은 `docs/spec/` (00 → 10 순서). 빌드는 `docs/spec/10-build-plan.md`의 태스크 순서와 수용 기준을 따른다. 기획 배경은 `PLANNING.md`.
- AI는 Claude만 (해커톤 규칙). 키 없이도 픽스처로 데모가 돌아야 한다 (09-architecture.md LLM 절).
- 에이전트끼리는 A2A HTTP로만 대화한다. 모듈 간 직접 import는 `npm run check:boundaries`가 막는다 (이유: 병원 인수·고객 이식이 제품의 약속, 00-overview.md 원칙 1·2).
- 한국인·국내 거주 외국인에게 매칭·예약을 열지 않는다 (의료법 제27조, 08-compliance.md 2절).
- `@a2a-js/sdk`는 내부 타입과 와이어 JSON 모양이 다르다. 손대기 전 09-architecture.md "SDK 함정"을 읽는다.
- 완료 전 `npm run gate`. 스펙과 구현이 다르면 `docs/spec/BUILD-LOG.md`에 적는다.
- `.env` 커밋 금지, `git add -A` 금지.
