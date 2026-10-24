import type { ConsentEntry, CustomerAccount, CustomerProfile } from "../../domain/customer";
import type { Store } from "../../store/types";
import type { StoredRecord } from "./records";
import { C, NS, getOf } from "./store";

// Demo customers of the customer namespace (06 "customers.json": cus_yuki_done and friends). All fictional.
// They are put lazily when a demo account is first resolved, so a store reset or a seed loader that does
// not know this namespace still leaves the customer screens working. Existing items are never replaced.

const CONSENT_VERSION = "2026-10-24.v1";
const noSafetyIssues = { pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false };

export const DEMO_CUSTOMER_ID = "cus_yuki_done";

export const DEMO_PROFILES: CustomerProfile[] = [
  {
    id: "cus_yuki_done",
    agentId: "cag_7f3k2",
    locale: "ja",
    nickname: "ゆき",
    nationality: "JP",
    residency: "short_term_visitor",
    ageBand: "25-29",
    trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa", flightTimeHome: "19:00" },
    skin: { type: "combination", concerns: ["elasticity", "fine_lines"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 450000 }, downtimeToleranceDays: 1, painTolerance: "mid", languagesNeeded: ["ja"], doctorGender: "any" },
    contact: { channel: "line", handle: "yuki_demo" },
    completedAt: "2026-10-24T09:58:00+09:00",
  },
  {
    id: "cus_lin",
    agentId: "cag_4n8vd",
    locale: "zh-CN",
    nickname: "Lin",
    nationality: "CN",
    residency: "short_term_visitor",
    ageBand: "35-39",
    trip: { arrival: "2026-12-05", departure: "2026-12-09", stayArea: "myeongdong", flightTimeHome: "17:30" },
    skin: { type: "dry", concerns: ["elasticity", "dryness"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 500000 }, downtimeToleranceDays: 3, painTolerance: "mid", languagesNeeded: ["zh-CN"], doctorGender: "any" },
    contact: { channel: "wechat", handle: "lin_demo" },
    completedAt: "2026-10-20T20:10:00+09:00",
  },
  {
    id: "cus_emily",
    agentId: "cag_2q9wk",
    locale: "en",
    nickname: "Emily",
    nationality: "US",
    residency: "short_term_visitor",
    ageBand: "25-29",
    trip: { arrival: "2026-11-20", departure: "2026-11-30", stayArea: "gangnam", flightTimeHome: "11:00" },
    skin: { type: "oily", concerns: ["pores", "acne_scars"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 600000 }, downtimeToleranceDays: 3, painTolerance: "high", languagesNeeded: ["en"], doctorGender: "any" },
    contact: { channel: "whatsapp", handle: "emily_demo" },
    completedAt: "2026-10-22T14:30:00+09:00",
  },
  {
    id: "cus_jisoo",
    agentId: "cag_8h3tb",
    locale: "ko",
    nickname: "지수",
    nationality: "KR",
    ageBand: "30-34",
    skin: { type: "combination", concerns: ["elasticity", "fine_lines"] },
    safety: noSafetyIssues,
    prefs: { languagesNeeded: ["ko"] },
    contact: { channel: "email", handle: "jisoo_demo@example.com" },
    completedAt: "2026-09-02T21:00:00+09:00",
  },
];

/** Persona names used by the ZK layer (docs/INTEGRATION.md section 2). */
const ZK_PERSONA: Record<string, string> = {
  cus_yuki_done: "cus_yuki",
  cus_lin: "cus_lin",
  cus_jisoo: "cus_jisoo",
};

export function demoAccount(profile: CustomerProfile): CustomerAccount {
  return {
    id: profile.id,
    agentId: profile.agentId,
    demoPersona: ZK_PERSONA[profile.id],
    createdAt: profile.completedAt ?? "2026-10-24T09:00:00+09:00",
  };
}

export function canMatchProfile(profile: Pick<CustomerProfile, "nationality" | "residency">): boolean {
  return profile.nationality !== "KR" && profile.residency !== "resident";
}

export function demoConsents(profile: CustomerProfile, index: number): ConsentEntry[] {
  const base = profile.id === DEMO_CUSTOMER_ID ? 91 : 100 + index * 10;
  const at = profile.completedAt ?? "2026-10-24T09:00:00+09:00";
  const entry = (n: number, type: ConsentEntry["type"], granted: boolean, scope: string[], recipientRole?: "platform" | "clinic"): ConsentEntry => ({
    id: `cns_${String(base + n).padStart(4, "0")}`,
    customerId: profile.id,
    type,
    granted,
    scope,
    ...(recipientRole ? { recipientRole } : {}),
    textVersion: CONSENT_VERSION,
    at,
  });
  const entries = [
    entry(0, "terms", true, ["account.*"], "platform"),
    entry(1, "privacy", true, ["profile.*", "contact.*"], "platform"),
    entry(2, "sensitiveHealth", true, ["skin.*", "safety.*", "history.*"], "platform"),
    entry(3, "crossBorder", true, ["profile.*", "skin.*", "safety.*"], "platform"),
    entry(4, "shareAnonymizedRecords", profile.id !== "cus_emily", ["records.*"], "platform"),
  ];
  // Only customers who can book have a clinic sharing consent (08-compliance.md section 2).
  if (canMatchProfile(profile)) entries.push(entry(5, "shareWithClinic", true, ["safetyInfo.*", "contact.handle"], "clinic"));
  return entries;
}

// Jisoo's history (records tab presets, monthly groups, pages) and Lin's anchored visit (records provenance).
export const DEMO_RECORDS: StoredRecord[] = [
  // Jisoo (34, Seoul): regular Rejuran and Botox, plus older sessions entered from memory
  {
    id: "rec_jisoo_h1",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2024-12-09",
    amount: { value: 2, unit: "cc" },
    priceKrw: 330000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "onboarding_history",
    sessionNumber: 1,
    nextDue: "2025-01-08",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_h2",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2025-01-01",
    datePrecision: "month",
    amount: { value: 2, unit: "cc" },
    priceKrw: 330000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "onboarding_history",
    sessionNumber: 2,
    nextDue: "2025-01-31",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_h3",
    customerId: "cus_jisoo",
    procedureId: "thermage_flx",
    date: "2025-11-08",
    amount: { value: 600, unit: "shot" },
    priceKrw: 1900000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    rating: 4,
    sessionNumber: 1,
    nextDue: "2026-09-04",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_h4",
    customerId: "cus_jisoo",
    procedureId: "shrink_universe",
    date: "2026-06-20",
    amount: { value: 300, unit: "shot" },
    priceKrw: 150000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    rating: 3,
    sessionNumber: 1,
    nextDue: "2026-07-20",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_b1",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2025-04-12",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 1,
    nextDue: "2025-07-11",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_b2",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2025-08-09",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 2,
    nextDue: "2025-11-07",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_b3",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2025-12-06",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 3,
    nextDue: "2026-03-06",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_b4",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2026-04-04",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 4,
    nextDue: "2026-07-03",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_j1",
    customerId: "cus_jisoo",
    procedureId: "skin_booster_juvelook",
    date: "2026-02-14",
    amount: { value: 2, unit: "cc" },
    priceKrw: 400000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "manual",
    rating: 3,
    sessionNumber: 1,
    nextDue: "2026-03-16",
    status: "stopped",
    stopReason: "expensive",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_01",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2026-09-14",
    amount: { value: 2, unit: "cc" },
    priceKrw: 350000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "manual",
    rating: 5,
    sessionNumber: 1,
    nextDue: "2026-10-14",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_02",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2026-10-14",
    amount: { value: 2, unit: "cc" },
    priceKrw: 350000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "manual",
    rating: 4,
    sessionNumber: 2,
    nextDue: "2026-11-13",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_03",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2026-08-05",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 5,
    nextDue: "2026-11-03",
    status: "active",
    sharedToPlatform: true,
  },
  // Lin (33, Shanghai): first Rejuran session of the course, clinic confirmed and anchored on Base Sepolia
  {
    id: "rec_lin_01",
    customerId: "cus_lin",
    procedureId: "rejuran_healer",
    date: "2026-10-31",
    amount: { value: 2, unit: "cc" },
    priceKrw: 420000,
    clinicName: "Hanbit Clinic",
    clinicId: "cln_hanbit",
    source: "booking",
    rating: 4,
    sessionNumber: 1,
    nextDue: "2026-11-30",
    status: "active",
    sharedToPlatform: false,
    // RecordAppended of the registry (tx input: append(subjectId, newCommitment, recordHash, day, proof))
    anchor: {
      subjectId: "0xfdb6e679db657053cd5086ccd1efeee43dcc26eeaf3c8e53c39381d5774cb878",
      version: 1,
      tx: "0x170839896bcee7d8e491cf34b840056b1ec6f972ca7c9b5b46a11d8fc98d02b1",
      recordHash: "0x0cfeb9a92de8e9adc6977d60a4d48db60a27ac4317f26a41972e51b3e6969357",
    },
  },
];

/** Puts the demo customer `id` (profile, account, consents, records) unless the profile already exists. */
export async function ensureDemoCustomer(store: Store, id: string): Promise<CustomerProfile | undefined> {
  const existing = await getOf<CustomerProfile>(store, C.profiles, id);
  if (existing) return existing;
  const index = DEMO_PROFILES.findIndex((p) => p.id === id);
  const profile = DEMO_PROFILES[index];
  if (!profile) return undefined;
  await store.put(NS, C.profiles, profile);
  await store.put(NS, C.accounts, demoAccount(profile));
  for (const consent of demoConsents(profile, index)) await store.put(NS, C.consents, consent);
  for (const record of DEMO_RECORDS.filter((r) => r.customerId === id)) await store.put(NS, C.records, record);
  return profile;
}

export function isDemoCustomerId(id: string): boolean {
  return DEMO_PROFILES.some((p) => p.id === id);
}

export function demoProfileByAgentId(agentId: string): CustomerProfile | undefined {
  return DEMO_PROFILES.find((p) => p.agentId === agentId);
}
