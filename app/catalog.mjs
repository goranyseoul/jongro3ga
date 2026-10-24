// PiBoo-K demo catalog for the ZK privacy layer, aligned with DEMO.md (personas, virtual clinics)
// and docs/spec/06-data-model.md (procedure ids). Numeric codes are what goes into the circuits;
// 0 is reserved for "empty slot" / "any".

export const PROCEDURES = {
  skin_booster_juvelook: { code: 1, ko: '쥬베룩 볼륨', en: 'Juvelook Volume' },
  rejuran_healer: { code: 2, ko: '리쥬란 힐러', en: 'Rejuran Healer' },
  thermage_flx: { code: 3, ko: '써마지 FLX', en: 'Thermage FLX' },
  ulthera: { code: 4, ko: '울쎄라', en: 'Ulthera' },
  botox_forehead: { code: 5, ko: '보톡스', en: 'Botox' },
  shrink_universe: { code: 6, ko: '슈링크', en: 'Shrink Universe' },
  rituo: { code: 7, ko: '리투오', en: 'Rituo' },
  skin_botox: { code: 8, ko: '스킨보톡스', en: 'Skin Botox' },
  aqua_peel: { code: 9, ko: '아쿠아필', en: 'Aqua Peel' },
  filler: { code: 10, ko: '필러', en: 'Filler' },
};

export const CLINICS = {
  cln_hongdae_a: { code: 1, ko: '홍대 A의원', area: '홍대', languages: ['ja', 'en'] },
  cln_gangnam_b: { code: 2, ko: '강남 B의원', area: '강남', languages: ['ja', 'en'] },
  cln_myeongdong_c: { code: 3, ko: '명동 C의원', area: '명동', languages: ['ja', 'zh-CN'] },
  cln_yeoksam_i: { code: 4, ko: '역삼 I의원', area: '역삼', languages: ['ko'] },
  cln_sinnonhyeon_d: { code: 5, ko: '신논현 D의원', area: '신논현', languages: ['ko', 'en'] },
  cln_gangnam_j: { code: 6, ko: '강남 J의원', area: '강남', languages: ['ko'] },
  cln_gangnam_k: { code: 7, ko: '강남 K의원', area: '강남', languages: ['en'] },
  cln_apgujeong_l: { code: 8, ko: '압구정 L의원', area: '압구정', languages: ['en', 'zh-CN'] },
  cln_myeongdong_m: { code: 9, ko: '명동 M의원', area: '명동', languages: ['en', 'zh-CN'] },
};

const P = (id) => PROCEDURES[id].code;
const C = (id) => CLINICS[id].code;

/** Offers whose conditions depend on the patient's history are proven with ZK, never by sharing the chart. */
export const OFFERS = [
  {
    id: 'ofr_gangnam_b_juvelook_package',
    clinicId: 'cln_gangnam_b',
    procedureId: 'skin_booster_juvelook',
    title: '쥬베룩 볼륨 2·3회차 패키지 15%',
    benefit: '2·3회차 묶음 15% 할인',
    scene: 1,
    // 1회차를 (어느 병원에서든) 정확히 1번 맞았고, 최근 27일 안에는 안 맞음 → 2회차 타이밍
    clauses: [
      { type: P('skin_booster_juvelook'), minCount: 1, maxCount: 1 },
      { type: P('skin_booster_juvelook'), maxDays: 27, maxCount: 0 },
    ],
  },
  {
    id: 'ofr_hongdae_a_juvelook_continue',
    clinicId: 'cln_hongdae_a',
    procedureId: 'skin_booster_juvelook',
    title: '쥬베룩 볼륨 이어서 2회차 10%',
    benefit: '같은 병원 연속 시술 10% 할인',
    scene: 1,
    clauses: [
      { type: P('skin_booster_juvelook'), clinic: C('cln_hongdae_a'), minCount: 1, maxCount: 1 },
      { type: P('skin_booster_juvelook'), maxDays: 27, maxCount: 0 },
    ],
  },
  {
    id: 'ofr_hongdae_a_first_visit',
    clinicId: 'cln_hongdae_a',
    procedureId: 'skin_booster_juvelook',
    title: '홍대 A의원 첫 방문 10%',
    benefit: '첫 방문 10% 할인',
    scene: 2,
    clauses: [{ clinic: C('cln_hongdae_a'), maxCount: 0 }],
  },
  {
    id: 'ofr_yeoksam_i_first_visit',
    clinicId: 'cln_yeoksam_i',
    procedureId: 'rituo',
    title: '역삼 I의원 첫 방문 10%',
    benefit: '첫 방문 10% 할인',
    scene: 2,
    clauses: [{ clinic: C('cln_yeoksam_i'), maxCount: 0 }],
  },
  {
    id: 'ofr_sinnonhyeon_d_rejuran_loyal',
    clinicId: 'cln_sinnonhyeon_d',
    procedureId: 'rejuran_healer',
    title: '리쥬란 3회 이상 고객 단골가',
    benefit: '리쥬란 단골가 적용',
    scene: 4,
    // 메모장(자기 신고)으로는 10번을 적어도 증명 못 함 — 병원 확인 기록만 센다
    clauses: [{ type: P('rejuran_healer'), minCount: 3 }],
  },
];

export const PERSONAS = {
  cus_yuki: { id: 'cus_yuki', name: '유키', flag: '🇯🇵', age: 29, home: '도쿄', note: '피부과 처음 · 팔자 고민 → 쥬베룩 볼륨 1회차 (10/13 홍대 A의원)' },
  cus_jisoo: { id: 'cus_jisoo', name: '지수', flag: '🇰🇷', age: 34, home: '서울', note: '매달 피부과 · 아이폰 메모장에 2년치 기록' },
  cus_grace: { id: 'cus_grace', name: '그레이스', flag: '🇺🇸', age: 48, home: '뉴욕', note: '연 1회 방한 · 영어 직접 상담' },
  cus_lin: { id: 'cus_lin', name: '린', flag: '🇨🇳', age: 38, home: '상하이', note: '3·7·11월 방한 · 연간 플랜' },
};

// memo lines that carried an explicit year ("26/…"); the rest were year-inferred by the import
const EXPLICIT_YEAR = new Set(['2026-02-15', '2026-03-21', '2026-04-30', '2026-09-11']);

/** Clinic-confirmed records a persona starts from (re-anchored on reset under a fresh pseudonym). */
export const BASELINE_RECORDS = {
  cus_yuki: [['cln_hongdae_a', 'skin_booster_juvelook']], // DEMO.md ⑤ 1회차
  cus_jisoo: [['cln_sinnonhyeon_d', 'rejuran_healer']], // 자주 가는 곳
  cus_grace: [],
  cus_lin: [],
};

/** Records a patient typed in herself (memo import). Shown, but never anchored and never provable. */
export const SELF_REPORTED = {
  cus_jisoo: [
    ['2024-11-02', 'skin_booster_juvelook', '2cc', '플래져'],
    ['2024-12-21', 'skin_booster_juvelook', '2cc', '플래져'],
    ['2025-01-25', 'skin_booster_juvelook', '2cc', '플래져 강남'],
    ['2025-04-21', 'skin_booster_juvelook', '3cc', '데이뷰 여의도 (+보톡스)'],
    ['2025-09-09', 'skin_booster_juvelook', '3cc', '뷰티라운지 잠실 (5만/1cc)'],
    ['2025-10-24', 'skin_booster_juvelook', '3cc', '뷰티라운지 잠실'],
    ['2025-12-07', 'rejuran_healer', '2cc', '밴스 (쥬베룩스킨 1 · 피코토닝)'],
    ['2026-01-11', 'rejuran_healer', '', '밴스'],
    ['2025-04-21', 'rejuran_healer', '2cc', '데이뷰 (+LDM)'],
    ['2025-08-09', 'rejuran_healer', '4cc', '유앤아이'],
    ['2026-02-15', 'rejuran_healer', '2cc', '나비존 밴스 일산 (14만)'],
    ['2026-04-30', 'rejuran_healer', '2cc', '밴스 성수 (+스킨보톡스 3cc, 슈링크 400샷)'],
    ['2026-09-11', 'rejuran_healer', '2cc + 아이 1cc', '유앤아이 여의도 (26만, 50+5권)'],
    ['2025-08-09', 'shrink_universe', '400샷', '유앤아이 (약 7만)'],
    ['2026-03-21', 'thermage_flx', '450샷', '툰페이스'],
    ['2025-04-21', 'botox_forehead', '미간', '데이뷰'],
    ['2025-08-09', 'botox_forehead', '미간', '유앤아이'],
  ].map(([date, procedureId, amount, where]) => ({ date, procedureId, amount, where, yearInferred: !EXPLICIT_YEAR.has(date) })),
};

/** Seed for verified-visit groups (DEMO.md "피북 사용자 N명") and public reviews. */
export const VERIFIED_VISITS = {
  cln_hongdae_a: { skin_booster_juvelook: 1240 },
  cln_gangnam_b: { skin_booster_juvelook: 980 },
  cln_myeongdong_c: { skin_booster_juvelook: 640 },
  cln_yeoksam_i: { rituo: 210 },
  cln_sinnonhyeon_d: { rituo: 450, rejuran_healer: 380 },
  cln_gangnam_j: { rituo: 180 },
  cln_gangnam_k: { ulthera: 160, thermage_flx: 140 },
  cln_apgujeong_l: { ulthera: 95, thermage_flx: 70 },
  cln_myeongdong_m: { thermage_flx: 40, skin_botox: 60, aqua_peel: 90 },
};
export const SEED_REVIEWS = [
  ['cln_hongdae_a', 'skin_booster_juvelook', 5, '팔자가 서서히 차오르는 게 보여요. 일본어 코디 친절했어요.'],
  ['cln_hongdae_a', 'skin_booster_juvelook', 4, '붓기 이틀. 2회차도 여기서 할 예정.'],
  ['cln_gangnam_b', 'skin_booster_juvelook', 5, '3회 패키지로 하니 가격 괜찮았어요.'],
  ['cln_myeongdong_c', 'skin_booster_juvelook', 4, '명동이라 쇼핑 동선이 좋았어요.'],
  ['cln_yeoksam_i', 'rituo', 4, '아파요… 그래도 3주 뒤 결이 매끈해짐.'],
  ['cln_sinnonhyeon_d', 'rituo', 5, '자주 가는 곳. 리투오도 무난했어요.'],
  ['cln_gangnam_k', 'ulthera', 5, 'The doctor explained everything in English. Visible lift after 2 months.'],
  ['cln_apgujeong_l', 'thermage_flx', 5, 'Coordinator came with me the whole time. Back to sightseeing next day.'],
  ['cln_myeongdong_m', 'aqua_peel', 4, '出差中也很方便，当天就有光泽。'],
];

export const procedureById = (id) => PROCEDURES[id];
export const clinicById = (id) => CLINICS[id];
export const offerById = (id) => OFFERS.find((o) => o.id === id);
const byCode = (table) => Object.fromEntries(Object.entries(table).map(([id, v]) => [v.code, id]));
export const procedureIdByCode = byCode(PROCEDURES);
export const clinicIdByCode = byCode(CLINICS);

/** Human-readable clause, e.g. "쥬베룩 볼륨 정확히 1회" / "역삼 I의원 기록 0건". */
export function describeClause({ type = 0, clinic = 0, maxDays, minCount = 0, maxCount }) {
  const what = [type ? PROCEDURES[procedureIdByCode[type]].ko : '시술 무관', clinic ? `@ ${CLINICS[clinicIdByCode[clinic]].ko}` : ''].filter(Boolean).join(' ');
  const window = maxDays !== undefined ? ` (최근 ${maxDays}일)` : '';
  if (maxCount === 0) return `${what}${window} 기록 0건`;
  if (minCount === maxCount) return `${what}${window} 정확히 ${minCount}회`;
  return `${what}${window} ${minCount}회 이상`;
}
