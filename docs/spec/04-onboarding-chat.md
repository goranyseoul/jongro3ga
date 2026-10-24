# 04 · 채팅 온보딩

고객과 병원 모두 **폼이 아니라 채팅**으로 가입 후 온보딩한다. 대화는 자유롭지만 결과물은 구조화된 프로필이다. 핵심 장치는 **슬롯(slot) + 도구 호출**: Claude가 대화하면서 `update_profile` 도구를 호출해 슬롯을 채우고, 화면은 채워진 슬롯을 실시간 카드로 보여준다.

## 공통 설계

### 대화 엔진

| 요소 | 내용 |
| --- | --- |
| 엔드포인트 | 고객 `POST /api/onboarding/customer`, 병원 `POST /api/onboarding/clinic`. 요청: `{ sessionId, message, widgetValue? }`. 응답: SSE 스트림 (`text` 토큰, `profile_patch`, `widget`, `done`) |
| 모델 | `CLAUDE_MODEL_CHAT` (기본 `claude-sonnet-5-5`) |
| 도구 | `update_profile({ patch })`: 슬롯 부분 갱신 (서버가 zod로 검증 후 저장, 실패 시 도구 에러로 반환해 Claude가 다시 묻게 함) · `show_widget({ type, slot, options? })`: 채팅 안에 입력 위젯 표시 · `request_consent({ consentType })`: 동의 카드 표시 · `finish_onboarding()`: 필수 슬롯이 다 찼을 때만 성공 |
| 시스템 프롬프트 | `lib/llm/prompts/onboarding-customer.ts`, `onboarding-clinic.ts`. 슬롯 목록·순서·금지 사항·현재 채워진 프로필 JSON을 매 턴 주입 |
| 상태 | `onboarding_session { id, kind, locale, profileDraft, filledSlots[], transcript[], status }` |
| 이어하기 | 중간에 나가도 `sessionId`로 이어서 진행. 처음 메시지는 "지난번에 여기까지 했어요" 요약 |

### 대화 규칙 (프롬프트에 그대로 넣는다)

1. 한 번에 한 가지만 묻는다. 고객이 한 문장에 여러 정보를 주면 모두 `update_profile`로 한 번에 저장하고 다음 빈 슬롯으로 넘어간다.
2. 선택지가 정해진 슬롯은 `show_widget`으로 칩·날짜·슬라이더를 띄운다. 자유 입력도 항상 허용한다.
3. 민감 정보(피부 상태, 과거 시술, 안전 정보)는 **민감정보 동의 전에는 묻지 않는다.**
4. 진단·권유를 하지 않는다. "그 증상이면 ○○를 받으세요" 금지. 정보 수집 단계임을 유지한다.
5. 고객 언어로 말한다. 고객이 언어를 바꾸면 따라간다.
6. 짧게. 한 메시지 2문장 이내. 이모지 금지.
7. 끝에 요약 카드를 보여주고 수정 기회를 준 뒤 `finish_onboarding`.

### 화면 구조

- **데스크톱 (≥ 1024px):** 왼쪽 채팅 (폭 60%), 오른쪽 "내 에이전트 카드" 실시간 미리보기 (40%). 슬롯이 채워질 때마다 해당 줄이 갱신된다.
- **모바일 (< 1024px):** 상단에 접힌 진행 바 ("에이전트 완성도 62%") + 탭하면 카드 시트. 하단 고정 입력창, 위젯은 입력창 바로 위에 뜬다.
- 진행률 = 채워진 필수 슬롯 수 / 전체 필수 슬롯 수.

## 고객 온보딩

목표 시간 3분. 결과: `CustomerProfile` + 고객 에이전트 생성 (`cag_` id 발급, Agent Card 활성화).

### 단계와 슬롯

`*` = 필수 (`finish_onboarding` 조건).

| 단계 | 슬롯 | 타입 · 값 | 위젯 | 비고 |
| --- | --- | --- | --- | --- |
| 0. 언어 | `locale`* | `ja` · `zh-CN` · `en` · `ko` | 칩 | 브라우저 언어로 기본값, 첫 메시지에서 확인 |
| 1. 동의 | `consents.terms`*, `consents.privacy`* | bool | 동의 카드 | 필수 동의 없으면 진행 불가 |
| 1. 동의 | `consents.sensitiveHealth`* | bool | 동의 카드 (별도) | 피부·시술·안전 정보 수집 동의. 거부 시 온보딩은 기본 정보까지만 하고 매칭 기능 제한 안내 |
| 1. 동의 | `consents.crossBorder`* | bool | 동의 카드 (별도) | 국외 거주자 정보 처리·이전 고지 ([08-compliance.md](08-compliance.md)) |
| 1. 동의 | `consents.shareAnonymizedRecords` | bool | 동의 카드 | 내 기록을 익명화해 가격 판정 표본으로 쓰는 것. 선택 |
| 2. 기본 | `nickname`* | string | 자유 | "뭐라고 부를까요?" |
| 2. 기본 | `nationality`* | `JP` · `CN` · `US` · `KR` · 기타 ISO | 칩 | |
| 2. 기본 | `residency`* | `short_term_visitor` · `resident` | 칩 | 외국 국적만 질문: "한국에 외국인등록(또는 거소신고)을 하고 살고 계신가요?" `resident`면 매칭·예약이 안 된다고 안내하고 기록 기능 중심으로 온보딩 ([08-compliance.md](08-compliance.md) 2절). `KR`은 생략 |
| 2. 기본 | `ageBand`* | `20-24` · `25-29` · `30-34` · `35-39` · `40+` | 칩 | 생년월일은 받지 않는다 |
| 3. 일정 | `trip.arrival`*, `trip.departure`* | date | 날짜 범위 | `KR`·`resident`는 생략 |
| 3. 일정 | `trip.stayArea` | `gangnam` · `sinsa` · `apgujeong` · `myeongdong` · `hongdae` · `other` | 칩 | 숙소 지역 = 기본 선호 지역 |
| 3. 일정 | `trip.flightTimeHome` | time | 시간 | 출국일 시술 가능 여부 판단용 |
| 4. 피부 | `skin.type` | `dry` · `oily` · `combination` · `sensitive` · `unknown` | 칩 | |
| 4. 피부 | `skin.concerns`* | 다중: `elasticity` · `fine_lines` · `pores` · `acne_scars` · `pigmentation` · `redness` · `dryness` · `contour` | 칩 (다중) | 최소 1개 |
| 4. 피부 | `skin.photo` | 이미지 | 업로드 | P2. 분석하지 않고 병원 전달용으로만 보관 |
| 5. 과거 시술 | `history[]` | `{ procedureId, approxDate, clinicName?, amount?, priceKrw?, satisfaction? }` | 자유 + 칩 | "없음"도 유효 값. 있으면 내 시술 기록에 자동 등록 |
| 6. 안전 | `safety.pregnantOrBreastfeeding`* | bool | 예/아니오 | 병원 전달용. 에이전트는 판단하지 않음 |
| 6. 안전 | `safety.allergies` | string[] (예: lidocaine) | 자유 | |
| 6. 안전 | `safety.anticoagulants`, `safety.recentIsotretinoin`, `safety.keloidHistory` | bool | 예/아니오 | |
| 7. 선호 | `prefs.budgetKrw` | `{ max }`, 고객 통화로 입력 가능 | 금액 입력 (통화 전환) | 환율은 `data/seed/fx.json` 고정값, "참고 환율" 표기 |
| 7. 선호 | `prefs.downtimeToleranceDays` | 0 · 1 · 3 · 7 | 슬라이더 | |
| 7. 선호 | `prefs.painTolerance` | `low` · `mid` · `high` | 칩 | |
| 7. 선호 | `prefs.languagesNeeded`* | locale[] | 칩 | 기본 = `locale` |
| 7. 선호 | `prefs.doctorGender` | `any` · `female` | 칩 | |
| 8. 연락 | `contact.channel`* | `email` · `line` · `wechat` · `whatsapp` | 칩 | P0는 화면 내 알림만 실제 동작 |
| 8. 연락 | `contact.handle`* | string | 자유 | |
| 9. 첫 요청 | `firstIntent` | string | 자유 | "지금 받고 싶은 시술이 있나요?" 있으면 완료 후 바로 요청 정리로 이어짐 |

### 대화 예시 (일본어 고객, 화면엔 일본어만 보임)

```text
Pibu: はじめまして、Pibuの担当エージェントです。日本語で進めてもいいですか？ [日本語] [English] [中文] [한국어]
Yuki: 日本語で
Pibu: (동의 카드 4장: 利用規約 · 個人情報 · 肌と施術の情報 · 海外からの情報処理)
Yuki: (모두 동의, 익명 기록 공유는 동의)
Pibu: ありがとうございます。何とお呼びすればいいですか？
Yuki: ゆきです。29歳、東京から来週の金曜から日曜まで行きます
   → update_profile { nickname: "ゆき", nationality: "JP", ageBand: "25-29", trip: { arrival: "2026-11-13", departure: "2026-11-15" } }
Pibu: 11月13日~15日ですね。帰りの飛行機は何時ごろですか？
...
Pibu: (요약 카드) この内容でエージェントを作りますか？ [作成する] [修正する]
```

### 완료 시 처리

1. `CustomerProfile` 저장 (고객 에이전트 저장소).
2. `consent_ledger`에 동의 항목별 행 생성 (항목, 범위, 수신자 역할, 시각, 문구 버전).
3. `history[]` → `treatment_record` 생성, 다음 회차 계산.
4. 고객 에이전트 Agent Card 활성화, 에이전트 토큰 발급.
5. `firstIntent`가 있으면 `/[locale]/chat?intent=...`로 이동해 요청 정리 시작. 없으면 `/[locale]/home`.

## 병원 온보딩

목표 시간 10분. 결과: `ClinicProfile` + 메뉴 + 예약 운영 설정 + Agent Card 초안. 언어는 한국어 기본.

### 시작 분기

- 가입 시 병원명·주소로 레지스트리 검색 → **대행 운영 중인 에이전트가 있으면** "Pibu가 이미 대신 운영 중인 에이전트가 있어요. 넘겨받으시겠어요?" → 인수 모드 (대행 데이터로 슬롯을 미리 채우고 확인만 받음).
- 없으면 신규 모드.

### 단계와 슬롯

| 단계 | 슬롯 | 타입 | 위젯 | 비고 |
| --- | --- | --- | --- | --- |
| 1. 담당자 | `contactPerson.name`*, `contactPerson.role`* | string | 자유 | 실장·원장·코디 |
| 2. 기관 | `clinicName`*, `address`*, `area`* | string · area enum | 자유 + 칩 | 주소에서 지역 자동 추정 후 확인 |
| 2. 기관 | `medicalInstitutionId`* | string | 자유 | 의료기관 개설 신고 번호 또는 요양기관 기호 |
| 2. 기관 | `businessRegistrationNo`* | string | 자유 | |
| 3. 서류 | `docs.openingCertificate`* | 파일 | 업로드 | 의료기관 개설신고증명서 |
| 3. 서류 | `docs.foreignPatientFacilityRegistration`* | 파일 + 등록번호 | 업로드 | 외국인환자 유치 의료기관 등록증. 없으면 매칭 노출 불가 안내 ([08-compliance.md](08-compliance.md)) |
| 4. 의료진 | `doctors[]`* | `{ name, boardCertifiedDermatology: bool, yearsOfPractice? }` | 자유 | 최소 1명 |
| 5. 언어 | `languages[]`* | `{ locale, mode: "staff" \| "interpreter" \| "app_translation" }` | 칩 | |
| 6. 메뉴 | `menu[]`* | `{ procedureId, product, amount, unit, priceKrw, vatIncluded, includes[], foreignerSamePrice: bool }` | **가격표 업로드** 또는 자유 입력 | 업로드 시 Claude 비전 추출 → 표로 확인·수정 |
| 6. 메뉴 | `offers[]` | `{ procedureId, title, amount, priceKrw, regularPriceKrw, validFrom, validUntil, conditions }` | 자유 | 이달 이벤트. 정상가·기간·조건 필수 (할인 표시 규정) |
| 7. 예약 | `hours`* | 요일별 시간 | 주간 시간표 위젯 | |
| 7. 예약 | `slotPolicy`* | `{ durationMinByProcedure, foreignSlotsPerDay, autoConfirm: bool }` | 자유 + 토글 | `autoConfirm=false`면 요청함에서 수동 확정 |
| 7. 예약 | `confirmChannel` | `console` · `kakao` · `phone` | 칩 | 콘솔 외 채널은 P1 |
| 8. 정산 | `commissionAgreement`* | bool + 버전 | 동의 카드 | 수수료율은 규정 확인 후 고정 ([08-compliance.md](08-compliance.md)) |
| 9. 확인 | Agent Card 미리보기 | | 카드 뷰 + JSON 토글 | [운영 시작] 버튼 |

### 가격표 추출 (P1, 데모에선 시드)

1. 이미지·PDF 업로드 → `CLAUDE_MODEL_CHAT`에 이미지 입력, 도구 `extract_menu_items({ items[] })` 강제.
2. `procedureId`는 시술 마스터(`data/seed/procedures.json`)의 id 중에서만 고르게 한다. 매칭 안 되면 `unknown`으로 두고 병원에게 묻는다.
3. 추출 결과를 표로 보여주고 행마다 확인 체크. 확인 안 된 행은 저장하지 않는다.

### 완료 시 처리

1. `ClinicProfile`, `menu_item`, `offer`, `slot_policy` 저장.
2. 인수 모드면 레지스트리의 `operationMode`를 `clinic`으로, Agent Card `provider`·확장 params 갱신, `version` minor 증가.
3. `docs.foreignPatientFacilityRegistration`이 확인 전이면 상태 `pending_verification`: 카드는 활성화하되 플랫폼 매칭 후보에서 제외.
4. `/clinic/dashboard`로 이동.

## 운영자용: 대행 병원 생성 (P1, 데모는 시드)

`/ops/clinics/new`: 병원 문자·카톡 홍보 메시지나 홈페이지 가격표 텍스트를 붙여넣기 → 같은 `extract_menu_items` 도구로 추출 → 운영자 확인 → 대행 모드 병원 에이전트 생성 (`dataSources`에 `sms` 또는 `public_web`, `lastVerifiedAt` = 오늘).
