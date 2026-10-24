# Pibu (피부)

**내 시술 기록부터 다음 병원까지** · The skin log Korean women actually use

> 한국 여성이 쓰는 **3초 시술 트래커**로 진짜 시술 데이터를 모으고, 그 데이터를 바탕으로 외국인에게 **상담실장 AI**가 시술·용량·주기를 추천하고, **병원 에이전트**들과 조건을 맞춰 방한 일정에 맞는 병원·가격을 찾아 예약하고 기록까지 관리하는 의료관광 A2A 앱.

- 기획 문서: [PLANNING.md](PLANNING.md)
- 해커톤 규칙: AI는 **Claude만** 사용
- 사용자: ① 한국 20~50대 여성 (시술 기록) ② 일본·중국·미국 20~50대 여성 의료관광객

---

## MVP 기능 (해커톤 데모 범위)

- [ ] **시술 트래커 (한국 여성):** 시술·용량·병원·가격·날짜 3초 기록 (+ 선택: 한 줄 후기, 별점)
- [ ] **다음 시술 알림:** 주기 규칙으로 다음 회차 계산, 알림에서 계속 / 쉬기 / 그만 선택
- [ ] **이달 이벤트 비교:** 가장 싼 곳(단위가격) · 많이 받은 곳 · 후기 좋은 곳 필터
- [ ] **상담실장 에이전트:** 고민 입력 → 시술·적정 용량·주기·효과 시기·다운타임 추천 (영어/일본어/중국어), 한국 여성 패턴 데이터 인용
- [ ] **스케줄러:** 시술 주기 규칙 + 방한 일정 → 회차 날짜 (다운타임 고려)
- [ ] **병원 에이전트 3~5개** (목업) → 견적 응답
- [ ] **병원 비교:** 단위당 가격 정렬, 용량 부족 경고, 이벤트, 언어 지원
- [ ] **병원 상세:** 랭킹, 패키지 구성·항목별 가격, 구매 수, 후기
- [ ] **내 시술 기록:** 예약 → 자동 저장 → 다음 회차 알림 미리보기

## 아키텍처

```
[Next.js UI]
    │
    ▼
/api/consultant-agent  ── Claude (tool use)
    │   tools: recommend_procedures · get_kr_patterns · build_schedule · request_quotes
    │
    ├─ lib/schedule.ts   (주기 규칙 → 회차 날짜)
    ├─ lib/price.ts      (단위가격, 용량 경고)
    └─ request_quotes ─▶ /api/clinic-agent/[id] × N ── Claude (병원 데이터를 시스템 프롬프트로)
                              │
                              ▼
                        data/clinics.json
```

### 에이전트 메시지

```json
// 상담실장 → 병원
{ "type": "quote_request", "procedure": "rejuran", "amount": { "value": 2, "unit": "cc" }, "dates": ["2026-11-10", "2026-11-14"], "language": "ja" }
// 병원 → 상담실장
{ "type": "quote", "clinic_id": "c-003", "procedure": "rejuran", "amount": { "value": 2, "unit": "cc" }, "price_krw": 350000, "unit_price_krw": 175000, "event": "첫 방문 10% 할인", "slots": ["2026-11-11T14:00"], "language_support": ["ja", "en"] }
```

## 데이터 (목업, `data/`)

| 파일 | 스키마 |
| --- | --- |
| `procedures.json` | `id, name{ko,en,ja,zh}, type(주사/레이저/리프팅), concerns[], unit, recommended_amount, effect_onset, downtime_days, cycle{initial{count, interval_months}, maintenance{interval_months[]}}` |
| `clinics.json` | `id, name, area, rank, foreigner_friendly, events[{procedure, month, price_krw}], procedures[{id, amount, unit, price_krw, event}], packages[{name, items[{procedure, amount, price_krw}]}], purchase_count, reviews[], languages, slots[]` |
| `kr_patterns.json` | `age_group, concern, top_combinations[{procedures[], share}], typical_amount, sample_size` |
| `treatment_log` (메모리/로컬) | `user_id, procedure, clinic_id, date, amount, price_krw, note?, rating?, next_due, status(계속/쉬기/그만)` |

시술 주기 규칙 (확정분):
- 리쥬란: 한 달 간격 3회 연속 → 이후 약 4개월(3~4개월)마다
- 써마지: 연 1회 (1~2회)
- 울쎄라: 연 1회
- 그 외 시술·적정 용량: `TODO` (기획팀 확인)

병원은 **가상 이름**만 쓴다. 한국 여성 패턴은 **데모용 가상 통계**다.

## 화면

맛집 예약 앱 스타일 (레스토랑 → 병원, 코스 메뉴 → 시술 패키지)

0. 내 시술 기록 (한국 여성 홈): 3초 기록 버튼, 타임라인, 다음 회차, 이달 이벤트
1. 홈 (외국인): 언어·국가 선택, 시술 카테고리
2. 상담: 상담실장 채팅 + 고민 칩(탄력/모공/주름/색소)
3. 추천 결과: 시술 카드 (이유, 적정 용량, 주기, 단위 가격대, 한국 여성 선택률)
4. 스케줄: 방한 날짜 → 캘린더에 회차 표시
5. 병원 비교: 랭킹순·단위가격순, 할인, 구매 수
6. 병원 상세: 패키지, 후기, 예약 버튼
7. 내 시술 기록: 기록 목록 + 다음 회차 알림

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind
- `@anthropic-ai/sdk` (Claude tool use), 기본 모델 Sonnet
- Vercel 배포

## 실행

```bash
git clone https://github.com/goranyseoul/jongro3ga.git
cd jongro3ga
npm install
cp .env.example .env   # ANTHROPIC_API_KEY=...
npm run dev
```

- `.env`는 커밋 금지 (`.gitignore` 포함). 레포는 Public.
- Claude 호출은 서버(API 라우트)에서만.

## 데모 시나리오

0. [한국 여성] 지수(34)가 리쥬란 2cc·○○의원·35만 원 3초 기록 → 2회차 알림 → "계속" → 이달 이벤트 단위가격순
1. Yuki(29, 일본)가 일본어로 "볼 탄력이 떨어지고 잔주름이 신경 쓰여요"
2. 상담실장: 한국 30대 여성 선택 조합(리쥬란 + 써마지) + 적정 용량·주기
3. 방한 11/10~11/14 → 1회차 + 12월·1월 회차 자동 생성
4. 병원 에이전트 4곳 견적 → 단위가격순, "1cc 이벤트는 용량 부족" 경고
5. 병원 상세 → 예약 → 내 시술 기록 저장, "리쥬란 2회차: 12월 10일"

---

## Claude Code에게 (빌드 순서)

1. Next.js + TypeScript + Tailwind 세팅, `.env.example`·`.gitignore`
2. `data/` 목업 3종 생성 (위 스키마, 가상 병원·가상 통계)
3. `lib/schedule.ts` (주기 + 다운타임) + 단위 테스트
3-1. 트래커 화면 + `treatment_log` 저장, 알림(계속/쉬기/그만)
4. `lib/price.ts`: 단위가격 계산, 적정 용량 미만 경고
5. `app/api/consultant-agent`: Claude tool use (tools 4개)
6. `app/api/clinic-agent/[id]`: 병원 데이터로 quote JSON 응답
7. 화면 1~7, 데모 시나리오가 끝까지 돌아가게
8. 기획 의도는 `PLANNING.md` 참고
