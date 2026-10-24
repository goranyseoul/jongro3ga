// Demo catalog for the ZK record layer, aligned with docs/spec (the canonical scenario):
// personas from 01-users-journeys.md / lib/ui-data/customer.ts, clinics from the registry seed,
// procedure ids from 06-data-model.md. Numeric circuit codes live in zk/codes.json.
import { readFileSync } from 'node:fs';

const CODES = JSON.parse(readFileSync(new URL('../zk/codes.json', import.meta.url)));

export const PROCEDURES = {
  rejuran_healer: { code: CODES.procedures.rejuran_healer, ko: '리쥬란 힐러', en: 'Rejuran Healer' },
  thermage_flx: { code: CODES.procedures.thermage_flx, ko: '써마지 FLX', en: 'Thermage FLX' },
  ulthera: { code: CODES.procedures.ulthera, ko: '울쎄라', en: 'Ulthera' },
  botox_forehead: { code: CODES.procedures.botox_forehead, ko: '보톡스(이마)', en: 'Botox (forehead)' },
  shrink_universe: { code: CODES.procedures.shrink_universe, ko: '슈링크 유니버스', en: 'Shrink Universe' },
  skin_booster_juvelook: { code: CODES.procedures.skin_booster_juvelook, ko: '쥬베룩', en: 'Juvelook' },
};

export const CLINICS = {
  cln_seoul_glow: { code: CODES.clinics.cln_seoul_glow, slug: 'seoul-glow', ko: '서울글로우의원', area: '신사', mode: 'clinic', languages: ['ja', 'en'] },
  cln_mint: { code: CODES.clinics.cln_mint, slug: 'mint', ko: '민트피부과의원', area: '강남', mode: 'proxy', languages: ['ja', 'en'] },
  cln_hanbit: { code: CODES.clinics.cln_hanbit, slug: 'hanbit', ko: '한빛의원', area: '명동', mode: 'proxy', languages: ['zh-CN', 'ja'] },
  cln_ara: { code: CODES.clinics.cln_ara, slug: 'ara', ko: '아라의원', area: '압구정', mode: 'proxy', languages: ['ja'] },
  cln_dahye: { code: CODES.clinics.cln_dahye, slug: 'dahye', ko: '다혜피부과의원', area: '홍대', mode: 'clinic', languages: ['en'] },
};

const P = (id) => PROCEDURES[id].code;
const C = (id) => CLINICS[id].code;

/**
 * Offers whose conditions depend on the patient's history. The clause shape is what goes on the wire as
 * `event.zkClauses` (03-a2a-protocol.md, ZK extension) except that ids are already mapped to circuit codes.
 * Date-window clauses are deliberately not used in the demo: the chain clock (1 day = 60 s) and the app's
 * fixed demo clock are independent, so count-only conditions keep the story simple.
 */
export const OFFERS = [
  {
    id: 'ofr_mint_rejuran_first_visit',
    clinicId: 'cln_mint',
    procedureId: 'rejuran_healer',
    title: '첫 방문 1cc 이벤트',
    benefit: '리쥬란 1cc 99,000원 (정상가 150,000원)',
    scene: 1,
    // the quote in the spec demo (qt_88a1): "first visit only" = no record at Mint
    clauses: [{ clinic: C('cln_mint'), maxCount: 0 }],
  },
  {
    id: 'ofr_hanbit_first_visit',
    clinicId: 'cln_hanbit',
    procedureId: 'rejuran_healer',
    title: '한빛 첫 방문 10%',
    benefit: '첫 방문 10% 할인',
    scene: 1,
    clauses: [{ clinic: C('cln_hanbit'), maxCount: 0 }],
  },
  {
    id: 'ofr_seoul_glow_rejuran_second',
    clinicId: 'cln_seoul_glow',
    procedureId: 'rejuran_healer',
    title: '리쥬란 2회차 패키지 10%',
    benefit: '2회차·3회차 묶음 10% 할인',
    scene: 2,
    // exactly one Rejuran session anywhere: the customer is due for the 2nd of the initial 3
    clauses: [{ type: P('rejuran_healer'), minCount: 1, maxCount: 1 }],
  },
  {
    id: 'ofr_hanbit_rejuran_continue',
    clinicId: 'cln_hanbit',
    procedureId: 'rejuran_healer',
    title: '리쥬란 이어서 2회차 10%',
    benefit: '같은 병원 연속 시술 10% 할인',
    scene: 2,
    clauses: [{ type: P('rejuran_healer'), clinic: C('cln_hanbit'), minCount: 1, maxCount: 1 }],
  },
  {
    id: 'ofr_dahye_first_visit',
    clinicId: 'cln_dahye',
    procedureId: 'botox_forehead',
    title: '다혜 첫 방문 보톡스 10%',
    benefit: '첫 방문 10% 할인',
    scene: 1,
    clauses: [{ clinic: C('cln_dahye'), maxCount: 0 }],
  },
];

/** Personas = customer ids of docs/spec. `cus_yuki_done` (Yuki's finished profile) shares Yuki's wallet. */
export const PERSONAS = {
  cus_yuki: { id: 'cus_yuki', name: 'Yuki', flag: '🇯🇵', age: 29, home: '도쿄', note: '피부과 처음 · 리쥬란이 궁금 · 11/13~15 방한 (첫 K-시술)' },
  cus_lin: { id: 'cus_lin', name: 'Lin', flag: '🇨🇳', age: 33, home: '상하이', note: '리쥬란 3회 코스를 방한마다 나눠 받음 · 1회차 완료 (10/31 한빛의원)' },
  cus_emily: { id: 'cus_emily', name: 'Emily', flag: '🇺🇸', age: 26, home: 'LA', note: '모공·여드름 자국 · 처음 받는 K-시술 · 11/20~30 방한' },
  cus_jisoo: { id: 'cus_jisoo', name: '지수', flag: '🇰🇷', age: 34, home: '서울', note: '리쥬란·보톡스 정기 시술 · 기록은 직접 입력 (매칭 대상 아님)' },
};
export const PERSONA_ALIASES = { cus_yuki_done: 'cus_yuki' };
export const resolvePersona = (id) => PERSONA_ALIASES[id] ?? id;

/** Clinic-confirmed records a persona starts from (re-anchored on reset under a fresh pseudonym). */
export const BASELINE_RECORDS = {
  cus_yuki: [],
  cus_lin: [['cln_hanbit', 'rejuran_healer']], // rec_lin_01, source "booking"
  cus_emily: [],
  cus_jisoo: [],
};

/** Records a customer typed in herself (source "manual"). Shown in the wallet, never anchored, never provable. */
export const SELF_REPORTED = {
  cus_jisoo: [
    ['2026-09-14', 'rejuran_healer', '2cc', '서울글로우의원 (35만)'],
    ['2026-10-14', 'rejuran_healer', '2cc', '서울글로우의원 (35만)'],
    ['2026-08-05', 'botox_forehead', '50유닛', '다혜피부과의원 (9만)'],
  ].map(([date, procedureId, amount, where]) => ({ date, procedureId, amount, where, yearInferred: false })),
};

/** Seed for verified-visit groups ("피북 사용자 N명 받음") and reviews that carry real Semaphore proofs. */
export const VERIFIED_VISITS = {
  cln_seoul_glow: { rejuran_healer: 1240, botox_forehead: 310 },
  cln_mint: { rejuran_healer: 980, shrink_universe: 220 },
  cln_hanbit: { rejuran_healer: 410, thermage_flx: 95 },
  cln_ara: { rejuran_healer: 640 },
  cln_dahye: { botox_forehead: 300, ulthera: 160, shrink_universe: 140 },
};
export const SEED_REVIEWS = [
  ['cln_seoul_glow', 'rejuran_healer', 5, '日本語のコーディネーターが最初から最後まで一緒でした。2ccで見積もり通り。'],
  ['cln_seoul_glow', 'rejuran_healer', 4, '붓기 하루. 2회차도 여기서 할 예정.'],
  ['cln_mint', 'rejuran_healer', 3, '1cc는 역시 적었어요. 다음엔 2cc로.'],
  ['cln_hanbit', 'rejuran_healer', 4, '中文沟通没问题，第二次也打算来。'],
  ['cln_ara', 'rejuran_healer', 3, '見積もりより支払いが多かった。説明は丁寧。'],
  ['cln_dahye', 'botox_forehead', 5, 'The doctor explained everything in English. Natural result.'],
  ['cln_dahye', 'ulthera', 4, 'Back to sightseeing the next day.'],
];

export const procedureById = (id) => PROCEDURES[id];
export const clinicById = (id) => CLINICS[id];
export const offerById = (id) => OFFERS.find((o) => o.id === id);
const byCode = (table) => Object.fromEntries(Object.entries(table).map(([id, v]) => [v.code, id]));
export const procedureIdByCode = byCode(PROCEDURES);
export const clinicIdByCode = byCode(CLINICS);

/** Human-readable clause, e.g. "리쥬란 힐러 정확히 1회" / "민트피부과의원 기록 0건". */
export function describeClause({ type = 0, clinic = 0, maxDays, minCount = 0, maxCount }) {
  const what = [type ? PROCEDURES[procedureIdByCode[type]].ko : '시술 무관', clinic ? `@ ${CLINICS[clinicIdByCode[clinic]].ko}` : ''].filter(Boolean).join(' ');
  const window = maxDays !== undefined ? ` (최근 ${maxDays}일)` : '';
  if (maxCount === 0) return `${what}${window} 기록 0건`;
  if (minCount === maxCount) return `${what}${window} 정확히 ${minCount}회`;
  return `${what}${window} ${minCount}회 이상`;
}
