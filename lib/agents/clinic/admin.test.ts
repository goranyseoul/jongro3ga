import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetClock, setClock } from "../../clock";
import { resetStore } from "../../store";
import { listInbox, setSlotPolicy, updateMenu, updateProfile, upsertOffer } from "./admin";
import { getProfile, getSlotPolicy, listMenu, listOffers, putBooking, type ClinicBookingRecord } from "./store";

// Clinic data entry adapters (lib/agents/clinic/admin.ts), on the seeded clinic namespace.

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  setClock("2026-11-12T10:00:00+09:00");
  resetStore({ seed: true });
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

const rejuran = { procedureId: "rejuran_healer", product: "Rejuran Healer", amount: { value: 2, unit: "cc" }, priceKrw: 320000, vatIncluded: true };

describe("updateMenu", () => {
  it("replaces the clinic's whole menu, keeping ids that are passed back", async () => {
    const result = await updateMenu("cln_mint", [{ id: "mnu_mint_toning_1", procedureId: "laser_toning", product: "Laser toning", amount: { value: 1, unit: "session" }, priceKrw: 55000, vatIncluded: true }, rejuran]);
    expect(result.ok).toBe(true);
    const menu = await listMenu("cln_mint");
    expect(menu).toHaveLength(2);
    expect(menu.find((m) => m.id === "mnu_mint_toning_1")).toMatchObject({ priceKrw: 55000, includes: [], foreignerSamePrice: true });
    expect(menu.find((m) => m.procedureId === "rejuran_healer")?.id).toMatch(/^mnu_/);
    expect(await listMenu("cln_seoul_glow")).toHaveLength(4);
  });

  it("refuses unknown procedures and bad prices without touching the menu", async () => {
    const result = await updateMenu("cln_mint", [{ ...rejuran, procedureId: "nope" }, { ...rejuran, priceKrw: -1 }]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.issues.join("\n")).toMatch(/0\.procedureId: unknown procedure[\s\S]*1\.priceKrw/);
    expect(await listMenu("cln_mint")).toHaveLength(3);
  });
});

describe("upsertOffer", () => {
  const offer = {
    procedureId: "rejuran_healer",
    title: "12월 이벤트",
    amount: { value: 2, unit: "cc" },
    priceKrw: 290000,
    regularPriceKrw: 340000,
    validFrom: "2026-12-01",
    validUntil: "2026-12-31",
    conditions: "외국인 첫 방문",
  };

  it("adds an event with all five promotion fields and replaces it by id", async () => {
    const created = await upsertOffer("cln_seoul_glow", offer);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toMatch(/^ofr_/);
    await upsertOffer("cln_seoul_glow", { ...offer, id: created.value.id, priceKrw: 280000 });
    const events = (await listOffers("cln_seoul_glow")).filter((o) => o.id === created.value.id);
    expect(events).toEqual([expect.objectContaining({ clinicId: "cln_seoul_glow", priceKrw: 280000 })]);
  });

  it("refuses an event without conditions, with a reversed period or above the regular price", async () => {
    const { conditions: _omit, ...noConditions } = offer;
    void _omit;
    for (const bad of [noConditions, { ...offer, validUntil: "2026-11-30" }, { ...offer, priceKrw: 400000 }]) {
      expect((await upsertOffer("cln_seoul_glow", bad)).ok).toBe(false);
    }
    expect(await listOffers("cln_seoul_glow")).toHaveLength(1);
  });
});

describe("setSlotPolicy and updateProfile", () => {
  it("stores a valid policy and refuses an hour range that closes before it opens", async () => {
    const policy = (await getSlotPolicy("cln_mint"))!;
    const { clinicId: _c, ...input } = policy;
    void _c;
    expect((await setSlotPolicy("cln_mint", { ...input, autoConfirm: true })).ok).toBe(true);
    expect((await getSlotPolicy("cln_mint"))?.autoConfirm).toBe(true);
    const bad = await setSlotPolicy("cln_mint", { ...input, hours: { ...input.hours, mon: { open: "19:00", close: "10:00" } } });
    expect(bad.ok).toBe(false);
  });

  it("edits the contact person but not the slug", async () => {
    expect((await updateProfile("cln_mint", { contactPerson: { name: "가상 실장 M", role: "상담 실장" } })).ok).toBe(true);
    expect((await getProfile("cln_mint"))?.contactPerson?.name).toBe("가상 실장 M");
    expect((await updateProfile("cln_mint", { slug: "other" })).ok).toBe(false);
    expect((await updateProfile("cln_nope", {})).ok).toBe(false);
  });
});

describe("listInbox", () => {
  it("lists the clinic's bookings newest first, optionally by status", async () => {
    const base = (id: string, createdAt: string, status: ClinicBookingRecord["status"]): ClinicBookingRecord => ({
      id,
      clinicId: "cln_seoul_glow",
      a2aTaskId: `tsk_${id}`,
      request: {
        schema: "pibu/booking-request@1",
        requestId: "req_1",
        quoteId: "qt_1",
        clinicId: "cln_seoul_glow",
        slot: "2026-11-14T11:00:00+09:00",
        guest: { displayName: "Y", contactChannel: "line", contactHandle: "y", language: "ja" },
        consentRef: "cns_1",
      },
      status,
      referralJti: "jti",
      customerAgentId: "cag_7f3k2",
      referralToken: "token",
      priceKrw: 340000,
      procedureId: "rejuran_healer",
      createdAt,
      updatedAt: createdAt,
    });
    await putBooking(base("bkg_a", "2026-11-12T09:00:00+09:00", "confirmed"));
    await putBooking(base("bkg_b", "2026-11-12T09:30:00+09:00", "pending_clinic"));
    await putBooking({ ...base("bkg_c", "2026-11-12T09:45:00+09:00", "pending_clinic"), clinicId: "cln_mint" });
    expect((await listInbox("cln_seoul_glow")).map((b) => b.id)).toEqual(["bkg_b", "bkg_a"]);
    expect((await listInbox("cln_seoul_glow", { status: "pending_clinic" })).map((b) => b.id)).toEqual(["bkg_b"]);
  });
});
