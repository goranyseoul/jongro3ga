// Demo clinic catalog. Each clinic publishes an A2A-style Agent Card: services, prices and
// SALES OFFER RULES. Offer rules are public so the patient's agent can match them on-device;
// the clinic only ever receives a ZK proof that the patient satisfies the rule it picked.
import { PROCEDURES } from '../chain/records.mjs';

const { REJURAN, FILLER, BOTOX, THERMAGE, ULTHERA, EXOSOME, LASER_TONING } = PROCEDURES;

export const PROCEDURE_NAMES = {
  [REJURAN]: 'Rejuran Healer (skin booster)',
  [FILLER]: 'Hyaluronic filler',
  [BOTOX]: 'Botox',
  [THERMAGE]: 'Thermage FLX',
  [ULTHERA]: 'Ulthera lifting',
  [EXOSOME]: 'Exosome booster',
  [LASER_TONING]: 'Laser toning',
};

export const CLINICS = [
  {
    id: 'glow',
    name: 'Gangnam Glow Dermatology',
    nameKo: '강남 글로우 피부과',
    area: 'Gangnam',
    languages: ['en', 'ja', 'zh'],
    foreignPatientRegistered: true,
    doctors: [{ name: 'Dr. Kim Seo-yeon', specialty: 'Board-certified dermatologist', years: 14 }],
    services: [
      { procedure: 'REJURAN', priceKRW: 350000, downtimeDays: 2, note: 'Bumps fade in ~2 days' },
      { procedure: 'LASER_TONING', priceKRW: 120000, downtimeDays: 0 },
      { procedure: 'BOTOX', priceKRW: 150000, downtimeDays: 0 },
    ],
    offers: [
      {
        id: 'glow-laser-first',
        title: 'Laser toning first-timer 30% off',
        description: 'For patients who have never had laser toning.',
        procedure: 'LASER_TONING',
        discountPct: 30,
        clauses: [{ type: LASER_TONING, maxCount: 0 }],
      },
    ],
    salesNotes: 'Push Rejuran 3-session course (10% off when booked together).',
  },
  {
    id: 'lumiere',
    name: 'Seoul Lumière Clinic',
    nameKo: '서울 뤼미에르 클리닉',
    area: 'Sinsa',
    languages: ['en', 'ja'],
    foreignPatientRegistered: true,
    doctors: [{ name: 'Dr. Park Ji-hoon', specialty: 'Dermatology, skin boosters', years: 11 }],
    services: [
      { procedure: 'EXOSOME', priceKRW: 280000, downtimeDays: 0 },
      { procedure: 'REJURAN', priceKRW: 330000, downtimeDays: 2 },
      { procedure: 'LASER_TONING', priceKRW: 110000, downtimeDays: 0 },
    ],
    offers: [
      {
        id: 'lumiere-booster-upgrade',
        title: 'Rejuran + Exosome combo 20% off',
        description: 'For experienced Rejuran patients (2+ sessions) whose last session was 60+ days ago — ready for the next step.',
        procedure: 'EXOSOME',
        discountPct: 20,
        clauses: [
          { type: REJURAN, minCount: 2 }, // Rejuran at least twice, ever
          { type: REJURAN, maxDays: 59, maxCount: 0 }, // none in the last 59 days
        ],
      },
    ],
    salesNotes: 'Upsell Exosome as the add-on after Rejuran. Mention zero downtime for short trips.',
  },
  {
    id: 'apgujeong',
    name: 'Apgujeong Lift Clinic',
    nameKo: '압구정 리프트 의원',
    area: 'Apgujeong',
    languages: ['en', 'zh'],
    foreignPatientRegistered: true,
    doctors: [{ name: 'Dr. Lee Min-jae', specialty: 'Lifting & energy devices', years: 17 }],
    services: [
      { procedure: 'ULTHERA', priceKRW: 1200000, downtimeDays: 1 },
      { procedure: 'THERMAGE', priceKRW: 1500000, downtimeDays: 0 },
      { procedure: 'BOTOX', priceKRW: 170000, downtimeDays: 0 },
    ],
    offers: [
      {
        id: 'apgujeong-switch-ulthera',
        title: 'Thermage users: first Ulthera 30% off',
        description: 'Tried Thermage before? Experience Ulthera lifting for the first time at 30% off.',
        procedure: 'ULTHERA',
        discountPct: 30,
        clauses: [
          { type: THERMAGE, minCount: 1 }, // had Thermage somewhere
          { type: ULTHERA, maxCount: 0 }, // never had Ulthera (first-time offer)
        ],
      },
    ],
    salesNotes: 'Compete for Thermage customers of other clinics. Ulthera pairs well with Botox.',
  },
];

export const clinicById = (id) => CLINICS.find((c) => c.id === id);
export const offerById = (id) => CLINICS.flatMap((c) => c.offers.map((o) => ({ ...o, clinicId: c.id }))).find((o) => o.id === id);

const codeName = Object.fromEntries(Object.entries(PROCEDURES).map(([k, v]) => [v, k]));
/** Human-readable clause, e.g. "REJURAN at least 2 times". */
export function describeClause({ type, minDays = 0, maxDays, minCount = 0, maxCount }) {
  const name = codeName[type];
  const window = maxDays !== undefined ? ` within the last ${maxDays} days` : minDays ? ` more than ${minDays} days ago` : '';
  if (maxCount === 0) return `no ${name}${window}`;
  return `${name} at least ${minCount} time(s)${window}`;
}

/** A2A Agent Card (public). */
export function agentCard(c, baseUrl) {
  return {
    name: c.name,
    description: `${c.nameKo} · ${c.area}. Registered for foreign patients: ${c.foreignPatientRegistered}.`,
    url: `${baseUrl}/clinics/${c.id}/a2a`,
    version: '1.0.0',
    defaultInputModes: ['text', 'data'],
    defaultOutputModes: ['text', 'data'],
    skills: [
      { id: 'consult', name: 'Consultation & quote', description: 'Recommend procedures and quote prices for a visiting patient.' },
      { id: 'verify-offer', name: 'Verify offer eligibility', description: 'Accepts ZK proofs (Noir/UltraHonk) against the Base Sepolia record registry.' },
    ],
    clinic: {
      languages: c.languages,
      doctors: c.doctors,
      services: c.services.map((s) => ({ ...s, name: PROCEDURE_NAMES[PROCEDURES[s.procedure]] })),
      offers: c.offers.map(({ clauses, ...o }) => ({ ...o, conditions: clauses.map(describeClause), clauses })),
    },
  };
}
