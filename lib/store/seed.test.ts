import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clock, resetClock, setClock } from "../clock";
import type {
  AgentIdentity,
  ClinicRegistryEntry,
  CustomerAccount,
  CustomerProfile,
  MenuItem,
  Offer,
  Outcome,
  PriceRecord,
  RoutingRule,
  Slot,
  TreatmentRecord,
  VerifiedVisitStat,
} from "../domain";
import { pibuGlobals } from "../pibu-globals";
import { COLLECTIONS } from "./collections";
import { getStore, resetStore } from "./index";
import { createMemoryStore } from "./memory";
import { SEED_FILES, buildSeedSnapshot, loadSeed, materializeAraBurst, validateSeed, type SeedFiles } from "./seed";
import type { KrPattern, SeedReviewStat } from "./seed-schemas";

// 10-build-plan.md T03 acceptance: the seed loads, matches the counts and statistics the other specs rely on
// (07 verdict sample, 07 clinic flag and trigger windows, 10 demo rows), validates, and holds no real person data.

const NOW = "2026-11-12T10:00:00+09:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const ENV = { ...process.env };
const { customer: C, platform: P, clinic: K, shared: S } = COLLECTIONS;

beforeAll(() => {
  process.env.DEMO_MODE = "true";
  delete process.env.PUBLIC_BASE_URL;
  setClock(NOW);
});

afterAll(() => {
  for (const key of ["DEMO_MODE", "PUBLIC_BASE_URL"] as const) {
    if (ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ENV[key];
  }
  resetClock();
});

beforeEach(() => {
  resetStore({ seed: true });
});

const store = () => getStore();
const daysBefore = (days: number) => clock.now().getTime() - days * DAY_MS;
const isoDateDaysBefore = (days: number) => new Date(daysBefore(days) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ---- the 07 verdict statistics, written out independently of the generator ----

const REGION_GROUP: Record<string, string> = {
  gangnam: "gangnam_sinsa",
  sinsa: "gangnam_sinsa",
  apgujeong: "gangnam_sinsa",
  myeongdong: "myeongdong",
  hongdae: "hongdae",
  other: "other",
};

/** 07 "분위수 (선형 보간)": h = (n - 1) p over the sorted sample. */
function quantileLinear(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

/** Nearest rank, no interpolation: the seed must give the same numbers under either definition. */
function quantileNearestRank(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
}

const roundHalf = (x: number) => Math.round(x * 2) / 2;

/** 07 "기준 표본 R": procedure, verified, not a public offer, within 120 days (boundary included), region group. */
async function verdictSample(procedureId: string, group: string): Promise<PriceRecord[]> {
  const cutoff = isoDateDaysBefore(120);
  const all = await store().list<PriceRecord>("platform", P.priceRecords, { procedureId });
  return all.filter((r) => r.verified && r.source !== "public_offer" && r.date >= cutoff && REGION_GROUP[r.area] === group);
}

describe("loading", () => {
  it("stores every entity under its COLLECTIONS name with the expected counts", async () => {
    const count = async (ns: "customer" | "platform" | "clinic" | "shared", collection: string) =>
      (await store().list(ns, collection)).length;
    expect({
      registry: await count("platform", P.clinicRegistry),
      clinicProfiles: await count("clinic", K.profiles),
      menus: await count("clinic", K.menuItems),
      offers: await count("clinic", K.offers),
      slotPolicies: await count("clinic", K.slotPolicies),
      slots: await count("clinic", K.slots),
      priceRecords: await count("platform", P.priceRecords),
      outcomes: await count("platform", P.outcomes),
      accounts: await count("customer", C.accounts),
      customerProfiles: await count("customer", C.profiles),
      consents: await count("customer", C.consents),
      records: await count("customer", C.records),
      rules: await count("platform", P.rules),
      krPatterns: await count("platform", P.krPatterns),
      fx: await count("platform", P.fx),
      verifiedVisits: await count("platform", P.verifiedVisits),
      reviewStats: await count("platform", P.reviewStats),
      agentIdentities: await count("shared", S.agentIdentities),
    }).toEqual({
      registry: 5,
      clinicProfiles: 5,
      menus: 19,
      offers: 3,
      slotPolicies: 5,
      slots: 5 * 21 * 4,
      priceRecords: 226,
      outcomes: 30,
      accounts: 6,
      customerProfiles: 6,
      consents: 23,
      records: 5,
      rules: 2,
      krPatterns: 23,
      fx: 3,
      verifiedVisits: 10,
      reviewStats: 5,
      agentIdentities: 1 + 5 + 6,
    });
    // the burst is injected by the demo control, never loaded
    expect(await store().get("platform", P.outcomes, "out_ara_burst_01")).toBeUndefined();
  });

  it("registers one agent identity per agent, card URLs on the base URL, issued at clock time", async () => {
    const ids = await store().list<AgentIdentity & { id: string }>("shared", S.agentIdentities);
    expect(ids.find((i) => i.id === "agt_platform")).toEqual({
      id: "agt_platform",
      agentId: "agt_platform",
      role: "platform",
      cardUrl: "http://localhost:3000/a2a/platform/agent-card.json",
      ownerId: "pibu",
      tokenIssuedAt: NOW,
    });
    expect(await store().get("shared", S.agentIdentities, "cln_seoul_glow")).toMatchObject({
      agentId: "cln_seoul_glow",
      role: "clinic",
      cardUrl: "http://localhost:3000/a2a/clinics/seoul-glow/agent-card.json",
    });
    expect(await store().get("shared", S.agentIdentities, "cag_7f3k2d")).toMatchObject({
      role: "customer",
      ownerId: "cus_yuki_done",
      cardUrl: "http://localhost:3000/a2a/customers/cag_7f3k2d/agent-card.json",
    });
    expect(ids.every((i) => i.id === i.agentId && i.tokenIssuedAt === NOW)).toBe(true);
  });

  it("rewrites agent card URLs to the deployment's base URL", async () => {
    const other = createMemoryStore();
    loadSeed(other, { baseUrl: "https://pibook.example/", now: "2026-11-13T09:00:00+09:00" });
    const mint = await other.get<ClinicRegistryEntry>("platform", P.clinicRegistry, "cln_mint");
    expect(mint!.agentCardUrl).toBe("https://pibook.example/a2a/clinics/mint/agent-card.json");
    const ids = await other.list<AgentIdentity>("shared", S.agentIdentities);
    expect(ids.every((i) => i.cardUrl.startsWith("https://pibook.example/a2a/") && i.tokenIssuedAt === "2026-11-13T09:00:00+09:00")).toBe(true);
  });

  it("stores slot policies keyed by clinic id", async () => {
    expect(await store().get("clinic", K.slotPolicies, "cln_seoul_glow")).toMatchObject({ id: "cln_seoul_glow", clinicId: "cln_seoul_glow", autoConfirm: false });
  });

  it("getStore seeds on first use and resetStore({ seed: true }) reloads in place", async () => {
    delete pibuGlobals().store;
    const fresh = getStore();
    expect(await fresh.list("platform", P.clinicRegistry)).toHaveLength(5);

    await fresh.remove("platform", P.clinicRegistry, "cln_mint");
    resetStore();
    expect(await fresh.list("platform", P.clinicRegistry)).toEqual([]);
    resetStore({ seed: true });
    expect(getStore()).toBe(fresh);
    expect(await fresh.list("platform", P.clinicRegistry)).toHaveLength(5);
  });
});

describe("clinics (06 seed table, 01 personas)", () => {
  it("has the five clinics with their areas, modes and language support", async () => {
    const registry = await store().list<ClinicRegistryEntry>("platform", P.clinicRegistry);
    const summary = Object.fromEntries(
      registry.map((c) => [c.id, [c.slug, c.area, c.operationMode, c.languages.map((l) => `${l.locale}:${l.mode}`).join(",")]]),
    );
    expect(summary).toEqual({
      cln_seoul_glow: ["seoul-glow", "sinsa", "clinic", "ja:staff,ko:staff"],
      cln_mint: ["mint", "gangnam", "proxy", "ja:interpreter,ko:staff"],
      cln_ara: ["ara", "apgujeong", "proxy", "ja:interpreter,ko:staff"],
      cln_hanbit: ["hanbit", "myeongdong", "proxy", "zh-CN:staff,ko:staff"],
      cln_dahye: ["dahye", "hongdae", "clinic", "en:staff,ko:staff"],
    });
    expect(registry.every((c) => c.verificationStatus === "verified" && c.foreignPatientFacilityRegistered)).toBe(true);
    expect(registry.every((c) => ["ko", "en", "ja", "zh-CN"].every((l) => c.name[l as "ko"]))).toBe(true);
    // stale on purpose (ops freshness view, 30 days): Hanbit and Ara
    const verifiedAt = Object.fromEntries(registry.map((c) => [c.id, c.lastVerifiedAt]));
    expect(verifiedAt).toMatchObject({ cln_hanbit: "2026-09-28", cln_ara: "2026-10-09" });
  });

  it("prices Rejuran as the spec says, and Mint sells Rejuran only through its 1cc first visit event", async () => {
    const menus = await store().list<MenuItem>("clinic", K.menuItems, { procedureId: "rejuran_healer" });
    const byClinic = Object.fromEntries(menus.map((m) => [m.clinicId, [m.amount.value, m.amount.unit, m.priceKrw, m.vatIncluded]]));
    expect(byClinic).toEqual({
      cln_seoul_glow: [2, "cc", 340000, true],
      cln_ara: [2, "cc", 300000, false],
      cln_hanbit: [2, "cc", 420000, true],
      cln_dahye: [2, "cc", 360000, true],
    });
    expect(await store().list<MenuItem>("clinic", K.menuItems, { clinicId: "cln_mint", procedureId: "rejuran_healer" })).toEqual([]);

    const mintOffers = await store().list<Offer>("clinic", K.offers, { clinicId: "cln_mint" });
    expect(mintOffers).toEqual([
      {
        id: "ofr_mint_rejuran_first_visit",
        clinicId: "cln_mint",
        procedureId: "rejuran_healer",
        title: "첫 방문 1cc 이벤트",
        amount: { value: 1, unit: "cc" },
        priceKrw: 99000,
        regularPriceKrw: 150000,
        validFrom: "2026-11-01",
        validUntil: "2026-11-30",
        conditions: "첫 방문 한정",
        zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }],
      },
    ]);
  });

  it("has the two second session offers of Lin's scenario (INTEGRATION.md section 0)", async () => {
    const offers = await store().list<Offer>("clinic", K.offers);
    const clauses = Object.fromEntries(offers.map((o) => [o.id, o.zkClauses]));
    expect(clauses).toEqual({
      ofr_mint_rejuran_first_visit: [{ clinicId: "cln_mint", maxCount: 0 }],
      ofr_seoul_glow_rejuran_second: [{ type: "rejuran_healer", minCount: 1, maxCount: 1 }],
      ofr_hanbit_rejuran_continue: [{ type: "rejuran_healer", clinicId: "cln_hanbit", minCount: 1, maxCount: 1 }],
    });
    for (const o of offers) {
      for (const field of ["title", "regularPriceKrw", "validFrom", "validUntil", "conditions"] as const) expect(o[field], `${o.id}.${field}`).toBeTruthy();
    }
  });

  it("gives every clinic 2 to 4 menu items besides Rejuran", async () => {
    const menus = await store().list<MenuItem>("clinic", K.menuItems);
    for (const id of ["cln_seoul_glow", "cln_mint", "cln_ara", "cln_hanbit", "cln_dahye"]) {
      const others = menus.filter((m) => m.clinicId === id && m.procedureId !== "rejuran_healer");
      expect(others.length, id).toBeGreaterThanOrEqual(2);
      expect(others.length, id).toBeLessThanOrEqual(4);
    }
  });

  it("opens 4 free slots a day per clinic, 2026-11-10 .. 11-30, for everything the clinic sells", async () => {
    const slots = await store().list<Slot>("clinic", K.slots);
    const menus = await store().list<MenuItem>("clinic", K.menuItems);
    const offers = await store().list<Offer>("clinic", K.offers);
    expect(slots.every((s) => !s.held)).toBe(true);
    expect(new Set(slots.map((s) => s.start.slice(11))).size).toBe(4);
    expect([...new Set(slots.map((s) => s.start.slice(11)))].sort()).toEqual(["10:00:00+09:00", "11:00:00+09:00", "14:00:00+09:00", "15:00:00+09:00"]);
    const days = [...new Set(slots.map((s) => s.start.slice(0, 10)))].sort();
    expect([days[0], days.at(-1), days.length]).toEqual(["2026-11-10", "2026-11-30", 21]);
    for (const s of slots) {
      const sells = new Set([...menus, ...offers].filter((m) => m.clinicId === s.clinicId).map((m) => m.procedureId));
      expect(new Set(s.procedureIds), s.id).toEqual(sells);
    }
    // Yuki's demo booking: Seoul Glow 11/14 11:00 (10 demo row 5)
    expect(slots.find((s) => s.clinicId === "cln_seoul_glow" && s.start === "2026-11-14T11:00:00+09:00")?.procedureIds).toContain("rejuran_healer");
  });
});

describe("price records (07 기준 표본)", () => {
  it("has exactly 42 verified Rejuran records in gangnam_sinsa, all dated 2026-07-16 .. 2026-11-10", async () => {
    const all = await store().list<PriceRecord>("platform", P.priceRecords, { procedureId: "rejuran_healer" });
    const verified = all.filter((r) => r.verified && r.source !== "public_offer" && REGION_GROUP[r.area] === "gangnam_sinsa");
    expect(verified).toHaveLength(42);
    expect(verified.every((r) => r.date >= "2026-07-16" && r.date <= "2026-11-10")).toBe(true);
    expect(new Set(verified.map((r) => r.source))).toEqual(new Set(["outcome", "shared_record"]));
    // records that look alike but stay out of the sample
    expect(all.some((r) => REGION_GROUP[r.area] === "gangnam_sinsa" && r.source === "public_offer")).toBe(true);
    expect(all.some((r) => REGION_GROUP[r.area] === "gangnam_sinsa" && !r.verified && r.source !== "public_offer")).toBe(true);
  });

  it("gives the 120 day sample n = 42 with p25 140,000, p50 160,000, p75 185,000, p90 210,000 and amounts 2 .. 3 cc", async () => {
    const sample = await verdictSample("rejuran_healer", "gangnam_sinsa");
    expect(sample).toHaveLength(42);
    const units = sample.map((r) => r.normalizedUnitKrw);
    const expected = { p25: 140000, p50: 160000, p75: 185000, p90: 210000 };
    const ps = { p25: 0.25, p50: 0.5, p75: 0.75, p90: 0.9 };
    for (const quantile of [quantileLinear, quantileNearestRank]) {
      expect(Object.fromEntries(Object.entries(ps).map(([k, p]) => [k, quantile(units, p)])), quantile.name).toEqual(expected);
    }
    const amounts = sample.map((r) => r.amount.value);
    expect([roundHalf(quantileLinear(amounts, 0.25)), roundHalf(quantileLinear(amounts, 0.75))]).toEqual([2, 3]);
    expect([roundHalf(quantileNearestRank(amounts, 0.25)), roundHalf(quantileNearestRank(amounts, 0.75))]).toEqual([2, 3]);

    // 07 outlier fence p25 - 3 IQR .. p75 + 3 IQR removes nothing, so n stays 42
    const iqr = expected.p75 - expected.p25;
    expect(units.every((u) => u >= expected.p25 - 3 * iqr && u <= expected.p75 + 3 * iqr)).toBe(true);
    // a quote naming the product keeps all 42 (07: product filter when >= 5 records share it)
    expect(sample.every((r) => r.product === "Rejuran Healer")).toBe(true);
    // the paid amount really is VAT included unit x amount
    expect(sample.every((r) => r.paidKrw === r.normalizedUnitKrw * r.amount.value)).toBe(true);
  });

  it("puts the 07 reference quotes in the expected price bands", () => {
    const band = (x: number) => (x < 140000 ? "low" : x <= 185000 ? "mid" : x <= 210000 ? "high" : "very_high");
    const unit = (price: number, vatIncluded: boolean, cc: number) => Math.round((vatIncluded ? price : Math.round(price * 1.1)) / cc);
    expect([band(unit(99000, true, 1)), band(unit(340000, true, 2)), band(unit(300000, false, 2)), band(unit(420000, true, 2))]).toEqual([
      "low",
      "mid",
      "mid",
      "high",
    ]);
  });

  it("has 10 to 20 records for every other procedure and region group", async () => {
    const all = await store().list<PriceRecord>("platform", P.priceRecords);
    const groups = new Map<string, number>();
    for (const r of all) {
      const key = `${r.procedureId}@${REGION_GROUP[r.area]}`;
      if (key === "rejuran_healer@gangnam_sinsa") continue;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    expect(groups.size).toBeGreaterThanOrEqual(10);
    for (const [key, n] of groups) {
      expect(n, key).toBeGreaterThanOrEqual(10);
      expect(n, key).toBeLessThanOrEqual(20);
    }
    expect(["rejuran_healer@myeongdong", "rejuran_healer@hongdae"].every((k) => groups.has(k))).toBe(true);
  });
});

describe("outcomes (07 clinic flag 90 days, trigger 30 days)", () => {
  const within = (o: Outcome, days: number) => Date.parse(o.submittedAt) >= daysBefore(days);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it("has Ara's 4 Japanese outcomes inside the 90 day window, outside the 30 day one, mean gap +0.15", async () => {
    const ara = await store().list<Outcome>("platform", P.outcomes, { clinicId: "cln_ara" });
    expect(ara).toHaveLength(4);
    expect(ara.every((o) => o.visitorProfile.nationality === "JP")).toBe(true);
    expect(ara.every((o) => within(o, 90) && !within(o, 30))).toBe(true);
    // also when the window compares calendar dates
    expect(ara.every((o) => o.submittedAt.slice(0, 10) >= isoDateDaysBefore(90) && o.submittedAt.slice(0, 10) < isoDateDaysBefore(30))).toBe(true);
    expect(mean(ara.map((o) => o.quoteGapRatio!))).toBeCloseTo(0.15, 12);
    expect(ara.every((o) => o.paidKrw === Math.round(o.quotedKrw! * (1 + o.quoteGapRatio!)))).toBe(true);
  });

  it("flags only Ara for paid more than quoted (90 days, mean > 0.10, n >= 3)", async () => {
    const outcomes = await store().list<Outcome>("platform", P.outcomes);
    const flagged = [...new Set(outcomes.map((o) => o.clinicId))].filter((clinicId) => {
      const recent = outcomes.filter((o) => o.clinicId === clinicId && within(o, 90));
      return recent.length >= 3 && mean(recent.map((o) => o.quoteGapRatio ?? 0)) > 0.1;
    });
    expect(flagged).toEqual(["cln_ara"]);
    expect(outcomes.filter((o) => o.clinicId !== "cln_ara").every((o) => o.visitorProfile.nationality !== undefined)).toBe(true);
    expect(new Set(outcomes.filter((o) => o.clinicId !== "cln_ara").map((o) => o.clinicId)).size).toBe(4);
  });

  it("injects the burst 1 .. 29 days before now with gaps 0.25 .. 0.37 in equal steps, mean exactly 0.31", async () => {
    const burst = materializeAraBurst(clock.now());
    expect(burst).toHaveLength(20);
    expect(burst.every((o) => o.clinicId === "cln_ara" && o.visitorProfile.nationality === "JP" && o.procedureId === "rejuran_healer")).toBe(true);
    const gaps = burst.map((o) => o.quoteGapRatio!).sort((a, b) => a - b);
    expect([gaps[0], gaps.at(-1)]).toEqual([0.25, 0.37]);
    gaps.slice(1).forEach((g, i) => expect(g - gaps[i]!).toBeCloseTo(0.12 / 19, 5));
    expect(mean(gaps)).toBeCloseTo(0.31, 12);
    const ages = burst.map((o) => (clock.now().getTime() - Date.parse(o.submittedAt)) / DAY_MS);
    expect(Math.min(...ages)).toBe(1);
    expect(Math.max(...ages)).toBe(29);
    expect(burst.every((o) => o.receivedAt === o.submittedAt && o.submittedAt.endsWith("+09:00"))).toBe(true);

    // what the 30 day trigger sees after injection: Ara x JP, n = 20, +31% (10 demo row 7)
    const base = await store().list<Outcome>("platform", P.outcomes);
    const segment = [...base, ...burst].filter((o) => o.clinicId === "cln_ara" && o.visitorProfile.nationality === "JP" && within(o, 30));
    expect(segment).toHaveLength(20);
    expect(Math.round(mean(segment.map((o) => o.quoteGapRatio!)) * 100)).toBe(31);
    // the burst alone does not also trip the low satisfaction trigger (ratio > 0.4)
    expect(segment.filter((o) => o.satisfaction <= 2).length / segment.length).toBeLessThanOrEqual(0.4);
  });

  it("dates the burst from the clock it is given", () => {
    const later = new Date("2026-11-14T13:00:00+09:00");
    const burst = materializeAraBurst(later);
    expect(burst.every((o) => Date.parse(o.submittedAt) < later.getTime() && Date.parse(o.submittedAt) >= later.getTime() - 29 * DAY_MS)).toBe(true);
  });
});

describe("customers (01 personas, 06 seed table)", () => {
  it("has the six personas, Yuki unfinished and Yuki's finished twin", async () => {
    const accounts = await store().list<CustomerAccount>("customer", C.accounts);
    expect(accounts.map((a) => a.id).sort()).toEqual(["cus_emily", "cus_jisoo", "cus_lin", "cus_sua", "cus_yuki", "cus_yuki_done"]);
    const profile = (id: string) => store().get<CustomerProfile>("customer", C.profiles, id);

    const yuki = (await profile("cus_yuki"))!;
    expect(yuki.completedAt).toBeUndefined();
    expect(yuki.agentId).toBe("cag_7f3k2");

    const done = (await profile("cus_yuki_done"))!;
    expect(done).toMatchObject({
      agentId: "cag_7f3k2d",
      nationality: "JP",
      ageBand: "25-29",
      residency: "short_term_visitor",
      trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa", flightTimeHome: "19:00" },
      prefs: { budgetKrw: { max: 450000 }, languagesNeeded: ["ja"] },
    });
    expect(done.completedAt).toBeDefined();

    expect(await profile("cus_lin")).toMatchObject({ nationality: "CN", locale: "zh-CN", residency: "short_term_visitor" });
    expect(await profile("cus_emily")).toMatchObject({ nationality: "US", locale: "en" });
    // Jisoo is a Korean resident: never matched or booked (08 section 2), so no residency and no trip
    const jisoo = (await profile("cus_jisoo"))!;
    expect([jisoo.nationality, jisoo.residency, jisoo.trip]).toEqual(["KR", undefined, undefined]);
    const others = ["cus_yuki_done", "cus_lin", "cus_emily", "cus_jisoo", "cus_sua"];
    for (const id of others) expect((await profile(id))!.completedAt, id).toBeDefined();
  });

  it("gives Lin one booked Rejuran session at Hanbit in 2026-09", async () => {
    const records = await store().list<TreatmentRecord>("customer", C.records, { customerId: "cus_lin" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ procedureId: "rejuran_healer", clinicId: "cln_hanbit", source: "booking", sessionNumber: 1 });
    expect(records[0]!.date.slice(0, 7)).toBe("2026-09");
  });
});

describe("rules, recipes, fx, verified visits", () => {
  it("has the two active operator rules and no proposals", async () => {
    const rules = await store().list<RoutingRule>("platform", P.rules);
    expect(rules.map((r) => [r.id, r.status, r.source, r.when, r.then])).toEqual([
      ["rule_001", "active", "operator", { nationalities: ["CN"] }, { kind: "require_language", languages: ["zh-CN"] }],
      ["rule_002", "active", "operator", { procedureIds: ["ulthera"] }, { kind: "demote_clinic", clinicIds: ["cln_dahye"], delta: 0.1 }],
    ]);
  });

  it("puts Rejuran alone at the top of the 25-29 elasticity recipe", async () => {
    const rows = await store().list<KrPattern>("platform", P.krPatterns, { ageBand: "25-29" });
    const elasticity = rows.filter((r) => r.concerns.includes("elasticity")).sort((a, b) => b.share - a.share);
    expect(elasticity[0]!.procedureIds).toEqual(["rejuran_healer"]);
    const all = await store().list<KrPattern>("platform", P.krPatterns);
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(all.length).toBeLessThanOrEqual(25);
    // shares of one (ageBand, concerns) group never add up past 1
    const groups = new Map<string, number>();
    for (const r of all) groups.set(`${r.ageBand}|${r.concerns.join()}`, (groups.get(`${r.ageBand}|${r.concerns.join()}`) ?? 0) + r.share);
    for (const [key, total] of groups) expect(total, key).toBeLessThanOrEqual(1);
  });

  it("has fixed reference rates for JPY, CNY and USD", async () => {
    const fx = await store().list<{ id: string; asOf: string }>("platform", P.fx);
    expect(fx.map((r) => r.id).sort()).toEqual(["CNY", "JPY", "USD"]);
    expect(fx.every((r) => r.asOf === "2026-11-01")).toBe(true);
  });

  it("shows Seoul Glow's Rejuran with 1,240 visitors and 18 reviews at 4.6 (10 demo row 4)", async () => {
    expect(await store().get<VerifiedVisitStat>("platform", P.verifiedVisits, "vv_seoul_glow_rejuran_healer")).toMatchObject({ count: 1240 });
    const stat = (await store().list<SeedReviewStat>("platform", P.reviewStats, { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer" }))[0]!;
    expect([stat.n, stat.avgRating, stat.reviews.length]).toEqual([18, 4.6, 18]);
  });

  it("publishes reviews only for anonymity sets of 3 or more, with no clinic to clinic comparison", async () => {
    const stats = await store().list<SeedReviewStat>("platform", P.reviewStats);
    expect(stats.every((s) => s.n >= 3 && s.reviews.length === s.n)).toBe(true);
    const COMPARATIVE = /より良い|より安い|一番|better than|cheaper than|the best|보다 낫|보다 좋|보다 싸|最好|比.{1,8}好/i;
    for (const s of stats) for (const r of s.reviews) expect(r.text, s.id).not.toMatch(COMPARATIVE);
  });
});

describe("validation", () => {
  const copy = (): SeedFiles => structuredClone(SEED_FILES) as SeedFiles;
  type Mutable = Record<string, any>;

  it("accepts every committed seed file", () => {
    expect(() => validateSeed()).not.toThrow();
  });

  it("rejects broken copies: missing event field, unknown procedure, unknown clinic, extra field, bad gap template", () => {
    const breakers: [string, (f: Mutable) => void, RegExp][] = [
      ["offer without conditions", (f) => delete f["clinics.json"].offers[0].conditions, /clinics\.json offers\.0\.conditions/],
      ["menu on an unknown procedure", (f) => (f["clinics.json"].menus[0].procedureId = "rejuran_typo"), /unknown procedure rejuran_typo/],
      ["slot at an unknown clinic", (f) => (f["slots.json"][0].clinicId = "cln_nowhere"), /unknown clinic cln_nowhere/],
      ["misspelled field", (f) => (f["price-records.json"][0].verfied = true), /price-records\.json 0/],
      ["unit price not paid / amount", (f) => (f["price-records.json"][0].paidKrw += 1), /normalizedUnitKrw/],
      ["burst template 30 days back", (f) => (f["outcomes-ara-burst.json"][0].daysAgo = 30), /outcomes-ara-burst\.json 0\.daysAgo/],
      ["review stat under the anonymity set", (f) => (f["verified-visits.json"].reviewStats[4].n = 2), /verified-visits\.json/],
      ["avgRating not the mean", (f) => (f["verified-visits.json"].reviewStats[0].avgRating = 4.9), /avgRating/],
      ["duplicate id", (f) => (f["rules.json"][1].id = "rule_001"), /duplicate id rule_001/],
      ["profile agentId differs", (f) => (f["customers.json"].profiles[0].agentId = "cag_other"), /agentId differs/],
      ["registry and profile disagree", (f) => (f["clinics.json"].profiles[0].area = "hongdae"), /disagrees with the registry/],
      ["KR with residency", (f) => (f["customers.json"].profiles[4].residency = "resident"), /residency/],
    ];
    for (const [label, mutate, message] of breakers) {
      const files = copy();
      mutate(files as Mutable);
      expect(() => validateSeed(files), label).toThrow(message);
    }
  });

  it("loads nothing from a broken seed", () => {
    const files = copy();
    delete (files as Mutable)["clinics.json"].offers[0].title;
    expect(() => buildSeedSnapshot({ baseUrl: "http://localhost:3000" }, files)).toThrow(/invalid seed/);
  });
});

describe("no real person data (README: every seed person is fictional)", () => {
  const KR_PHONE = /(?<!\d)(?:01[016789]|0[2-6]\d?|070)[-. ]?\d{3,4}[-. ]?\d{4}(?!\d)/;
  const FULL_NAME = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
  const HANDLE = /^[a-z]+(?:_[a-z]+)*_demo$/;

  /** Every string anywhere in the seed. */
  function strings(value: unknown, out: string[] = []): string[] {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const v of value) strings(v, out);
    else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, out);
    return out;
  }

  /** Fields that name or reach a person. */
  function personFields(files: SeedFiles): { where: string; value: string }[] {
    const f = files as Record<string, any>;
    const out: { where: string; value: string }[] = [];
    for (const p of f["customers.json"].profiles) {
      out.push({ where: `${p.id}.nickname`, value: p.nickname }, { where: `${p.id}.contact.handle`, value: p.contact.handle });
    }
    for (const a of f["customers.json"].accounts) if (a.email) out.push({ where: `${a.id}.email`, value: a.email });
    for (const p of f["clinics.json"].profiles) {
      for (const d of p.doctors) out.push({ where: `${p.id}.doctor`, value: d.name });
      if (p.contactPerson) out.push({ where: `${p.id}.contactPerson`, value: p.contactPerson.name });
    }
    return out;
  }

  function violations(files: SeedFiles): string[] {
    const out: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      for (const s of strings(content)) if (KR_PHONE.test(s)) out.push(`${name}: phone number in "${s}"`);
    }
    for (const { where, value } of personFields(files)) {
      if (FULL_NAME.test(value)) out.push(`${where}: looks like a full name "${value}"`);
      if (where.endsWith("contact.handle") && !HANDLE.test(value)) out.push(`${where}: not a demo handle "${value}"`);
      if (where.endsWith(".email") && !/^[a-z_]+_demo@example\.com$/.test(value)) out.push(`${where}: not a demo address "${value}"`);
      if ((where.endsWith(".doctor") || where.endsWith(".contactPerson")) && !value.startsWith("가상 ")) out.push(`${where}: not marked fictional "${value}"`);
    }
    return out;
  }

  it("has no phone numbers, full names or real contact handles", () => {
    expect(violations(SEED_FILES as SeedFiles)).toEqual([]);
  });

  it("catches them when they are planted (positive control)", () => {
    const planted: [string, (f: Record<string, any>) => void][] = [
      ["mobile in a handle", (f) => (f["customers.json"].profiles[2].contact.handle = "010-1234-5678")],
      ["mobile without separators in an address", (f) => (f["clinics.json"].profiles[0].address = "문의 01012345678")],
      ["Seoul landline in a review", (f) => (f["verified-visits.json"].reviewStats[0].reviews[0].text = "電話 02-123-4567 まで")],
      ["full name as nickname", (f) => (f["customers.json"].profiles[1].nickname = "Tanaka Yuki")],
      ["real looking handle", (f) => (f["customers.json"].profiles[3].contact.handle = "emily.real")],
      ["real looking doctor", (f) => (f["clinics.json"].profiles[1].doctors[0].name = "Minji Kim")],
      ["real looking email", (f) => (f["customers.json"].accounts[0].email = "someone@gmail.com")],
    ];
    for (const [label, plant] of planted) {
      const files = structuredClone(SEED_FILES) as Record<string, any>;
      plant(files);
      expect(violations(files as SeedFiles).length, label).toBeGreaterThan(0);
    }
  });
});
