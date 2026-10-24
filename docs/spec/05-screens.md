# 05 · 화면과 라우트

세 개의 표면: **고객 웹앱** (모바일 우선, 다국어), **병원 콘솔** (데스크톱 우선, 한국어), **운영 콘솔** (데스크톱, 한국어). 그리고 데모용 **데모 컨트롤**.

## UI 규칙 (전 화면 공통)

후기 공개 피드는 두지 않는다 (PLANNING.md 8-7의 후기 피드·보상은 규제 검토로 보류, [08-compliance.md](08-compliance.md)). PLANNING.md의 "맛집 예약 앱 스타일" (병원 = 레스토랑, 시술 패키지 = 코스 메뉴)을 따르되, 시각 규칙은 아래가 우선한다.

1. **토큰만 사용.** 색·간격·radius·폰트 크기·그림자는 `app/globals.css`의 CSS 변수만 쓴다. Tailwind v4는 `app/globals.css`의 `@theme` 블록에서 이 변수에 매핑한 이름만 쓴다 (`tailwind.config.ts` 없음) (`bg-bg`, `bg-elev`, `text-muted`, `p-sp-4` 등). `#hex`, 임의 px(`w-[37px]`), 기본 팔레트 색(`bg-pink-500`) 금지.
2. 토큰 이름 (IRONACT 디자인 시스템 어휘를 로컬 정의):
   - 면 `--bg` `--bg-elev` `--bg-sunken` · 선 `--border` `--border-soft` · 글자 `--text` `--text-muted` `--text-subtle`
   - 강조 `--brand` `--highlight` · 의미색 `--success` `--warning` `--danger` `--info` (플랫하게만)
   - 타이포 `--t-display` `--t-h1` `--t-h2` `--t-title` `--t-body` `--t-sm` `--t-xs` · 굵기 `--w-reg` `--w-med` `--w-semi`
   - 간격 `--sp-1` ~ `--sp-16` · 모서리 `--r-sm` `--r-md` `--r-card` `--r-xl` `--r-pill` · 그림자 `--sh-card` `--sh-pop`
   - 무채색이 코어, 브랜드색은 `--brand` 한 겹으로만.
3. **금지 패턴:** 이모지(전부), 엠대시·엔대시(범위는 `~`), 틴트 알약 배지·아웃라인 알약 배지, 틴트 경고 배너, 컬러 상태 점, 카드 좌측 두꺼운 강조 보더, 채움 원 안 체크 글리프, UI 라벨 monospace, 올캡+넓은 자간.
   - 판정 라벨("적정", "용량 부족")은 **무채색 텍스트 라벨 + 의미색 텍스트 한 단어**로 표시한다. 배경 틴트 알약 금지.
4. 반응형: breakpoint sm 640 · md 768 · lg 1024 · xl 1280. 모바일 우선. 표는 md 미만에서 카드로 바꾼다.
5. 텍스트 위계는 한 블록에 최대 3단 (타이틀 → 서브 → 캡션).
6. 숫자는 `font-variant-numeric: tabular-nums`. 금액은 `₩340,000` + 고객 통화 참고값 `(約 ¥37,000)`.
7. 터치 영역 최소 44px.

## 고객 웹앱 (`/[locale]/...`, locale ∈ `ja` · `zh-CN` · `en` · `ko`)

| 라우트 | 화면 | 핵심 요소 | 우선순위 |
| --- | --- | --- | --- |
| `/[locale]` | 랜딩 | 한 줄 가치 ("あなたの代わりに、エージェントが韓国のクリニックと話します"), 3단계 설명, [시작하기]. **병원명·가격·후기 노출 금지** ([08-compliance.md](08-compliance.md) 3절). 푸터: 유치사업자 등록번호, 권익 보호 안내 링크 | P0 |
| `/[locale]/legal/patient-rights` | 외국인환자 권익 보호 안내 | 용역 내용·조건, 분쟁해결 절차, 개인정보보호 (en 필수 + ja·zh-CN·ko) | P0 |
| `/[locale]/signup` | 가입 | 이메일 입력 또는 **데모 계정 선택** (Yuki · Lin · Emily · 지수) | P0 |
| `/[locale]/onboarding` | 채팅 온보딩 | 채팅 + 에이전트 카드 미리보기 ([04-onboarding-chat.md](04-onboarding-chat.md)) | P0 |
| `/[locale]/home` | 내 에이전트 홈 | 에이전트 카드 요약, 입력창 "무엇을 받고 싶으세요?", 진행 중 요청, 다가오는 예약, 다음 회차. `KR`·`resident` 고객은 입력창 대신 기록·다음 회차 중심 홈 (매칭 불가) | P0 |
| `/[locale]/chat` | 실장과 대화 | 자유 대화. 요청이 감지되면 **조건 카드** (시술 · 용량 · 예산 · 지역 · 언어 · 날짜, 각 항목 탭해서 수정) + [이 조건으로 찾기] | P0 |
| `/[locale]/requests/[id]` | 요청 진행 + 견적 비교 | 상단: 에이전트 대화 타임라인 (사람이 읽는 문장, 펼치면 원본 A2A JSON). 하단: 견적 비교 (아래 상세) | P0 |
| `/[locale]/bookings/[id]` | 예약 상세 | 병원·시간·주소·지도 링크, 주의사항, 상태 (`pending_clinic` → `confirmed`), [D0 기록하기] | P0 |
| `/[locale]/records` | 내 시술 기록 | 타임라인, 시술별 다음 회차, [+ 3초 기록] | P0 |
| `/[locale]/records/new` | 3초 기록 | 시술 칩 → 용량 → 병원(자동완성) → 가격 → 날짜, 선택: 영수증 사진·별점 | P0 |
| `/[locale]/outcomes/[bookingId]` | 결과 기록 | D0: 실결제, 실용량, 정품 확인 방식, 만족도, 통증, 한 줄. D7·D30(P1): 다운타임 실제, 효과 체감, 재방문 의향 | P0 / P1 |
| `/[locale]/settings/data` | 내 데이터 | 동의 항목 on/off, 내 Agent Card 보기, 내보내기(JSON), 전체 삭제 | P1 (카드 보기는 P0) |

### 견적 비교 상세 (`/[locale]/requests/[id]` 하단)

| 열 | 내용 |
| --- | --- |
| 병원 | 이름, 지역, 운영 모드 표시 ("Pibu가 대신 답변 중 · 참고가" 캡션) |
| 총액 | `priceKrw` + 고객 통화 참고값, VAT 포함 여부. 이벤트가면 정상가·기간·조건을 같은 칸에 표시 |
| 단위가격 | `normalizedUnitKrw` / unit (판정에서 받은 값) |
| 용량 | 견적 용량 · 통상 범위 ("通常 2~3cc") |
| 판정 | 라벨 한 단어 + 근거 한 줄 + 신뢰도 (`n=42`) |
| 포함 | 마취크림, 진정팩 등 |
| 가능 시간 | 슬롯 칩 (탭하면 선택) |
| 언어 | 지원 언어 |
| 행동 | [이 병원으로 예약] |

- 정렬 기본값: 플랫폼 매칭 점수순. 토글: 단위가격순, 총액순.
- `label = underdosed` 이거나 `clinicFlags`에 `paid_more_than_quoted`가 있는 행은 맨 아래가 아니라 **원래 순서에 두되 경고 문장을 행 안에 표시**한다 (숨기지 않는다, 원칙 6 "가격은 투명하게").
- md 미만: 병원별 카드, 카드 안에 위 항목을 3단 위계로.

### 판정 라벨 문구

| `label` | ko | ja | en | zh-CN |
| --- | --- | --- | --- | --- |
| `fair` | 적정 | 適正 | Fair | 合理 |
| `good_deal` | 저렴 | お得 | Good deal | 划算 |
| `high` | 높음 | 高め | High | 偏高 |
| `very_high` | 매우 높음 | かなり高め | Very high | 过高 |
| `underdosed` | 용량 부족 | 量が少なめ | Low dose | 剂量偏少 |
| `insufficient_data` | 판정 불가 | 判定不可 | Not enough data | 数据不足 |

## 병원 콘솔 (`/clinic/...`, 한국어)

| 라우트 | 화면 | 핵심 요소 | 우선순위 |
| --- | --- | --- | --- |
| `/clinic/signup` | 가입 | 이메일, 병원명 검색 (대행 에이전트 있으면 인수 안내) | P1 (데모는 데모 계정) |
| `/clinic/onboarding` | 채팅 온보딩 | 채팅 + Agent Card 미리보기, 가격표 업로드 | P1 |
| `/clinic/dashboard` | 대시보드 | 오늘 견적 요청 수, 예약 대기, 이번 주 예약, 응답률 | P0 |
| `/clinic/inbox` | 요청함 | A2A 태스크 목록 (견적·예약), 예약 요청은 [확정] [시간 제안] [거절], 추가 정보 요청 | P0 |
| `/clinic/menu` | 메뉴·가격 | 시술별 가격표 편집, 이달 이벤트 | P0 |
| `/clinic/schedule` | 예약 시간 | 주간 슬롯 편집 | P1 |
| `/clinic/agent` | 내 에이전트 | Agent Card 뷰 + JSON, 운영 모드, 엔드포인트 URL | P0 |
| `/clinic/insights` | 집계 피드백 | 만족도 평균, 견적 대비 실결제 차이, 재방문 의향. **n < 5면 "표본 부족"으로 가림** | P1 |

## 운영 콘솔 (`/ops/...`, 한국어)

| 라우트 | 화면 | 핵심 요소 | 우선순위 |
| --- | --- | --- | --- |
| `/ops` | 개요 | 오늘 요청·매칭·예약·결과 수 | P1 |
| `/ops/clinics` | 병원 레지스트리 | 병원별 운영 모드, 등록 상태, 데이터 신선도 (`lastVerifiedAt` 30일 초과 시 경고 문장) | P0 |
| `/ops/clinics/new` | 대행 병원 생성 | 문자·가격표 붙여넣기 → 추출 → 확인 | P1 |
| `/ops/proxy-queue` | 대행 응답 큐 | 대행 병원 예약 요청 목록, [병원 확인 완료 → 확정] [병원 거절] | P0 |
| `/ops/rules` | 연결 규칙 | 탭: 제안 · 활성 · 폐기. 규칙별 조건·행동·근거(결과 id 링크)·적용 횟수. [승인] [반려] [폐기]. [규칙 제안 실행] 버튼 (P0 데모용) | P0 |
| `/ops/signals` | 결과 신호 | 병원별 견적 대비 실결제 차이, 만족도, 응답 시간, 노쇼 | P1 |
| `/ops/prices` | 가격 분포 | 시술·지역별 단위가격 p25/p50/p75, 표본 수 | P1 |
| `/ops/a2a-log` | A2A 로그 | 전체 A2A 호출 시간순. 필터: 에이전트, 스킬, 상태, contextId. 행 펼치면 요청·응답 JSON | P0 |

## 데모 컨트롤 (`/demo`)

| 요소 | 동작 |
| --- | --- |
| [시드 리셋] | 저장소를 `data/seed/`로 초기화 |
| 페르소나 전환 | Yuki · Lin · Emily · 지수 / 병원 계정 / 운영자 |
| 3분할 뷰 | 왼쪽 고객 화면(iframe, 390px 폭) · 가운데 A2A 로그 실시간 · 오른쪽 병원 요청함 또는 운영 큐 |
| [결과 20건 주입] | 아라의원 견적 대비 실결제 상승 결과를 시드에서 주입 (규칙 제안 데모용, `POST /api/demo/inject-outcomes`) |
| [시계 이동] | 고정 시계를 시술 당일 11/14 13:00 등으로 이동 (`POST /api/demo/clock`) |
| [예약 확정] | 대기 중인 예약을 대행·직접 구분해 확정 (`POST /api/demo/confirm-booking`) |

## 공통 컴포넌트 (Sonnet이 먼저 만들 것)

`components/ui/`: `Button`, `Input`, `Chip`, `ChipGroup`, `Card`, `Sheet`, `Table`(md 미만 카드 전환 내장), `Label`(판정 라벨), `Stat`, `Timeline`, `ChatBubble`, `ChatInput`, `WidgetDateRange`, `WidgetSlider`, `WidgetCurrency`, `ConsentCard`, `AgentCardView`, `JsonViewer`, `Money`(KRW + 참고 통화).
모두 토큰만 쓰고, 새 색이 필요하면 토큰을 먼저 추가한다.
