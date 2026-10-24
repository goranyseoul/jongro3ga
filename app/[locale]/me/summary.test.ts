import { describe, expect, it } from "vitest";
import { applyProfileEdits, type DemoState } from "../../../components/customer/demo-state";
import { CUSTOMERS, recordsFor, type TreatmentRecord } from "../../../lib/ui-data/customer";
import { activePlans, journeyStatus, journeySteps, nextDue, recentRecords, totalSpentKrw } from "./summary";

const EMPTY: DemoState = { requestStarted: false, addedRecords: [], recordStatus: {}, consents: {}, deleted: false };
const jisoo = recordsFor("cus_jisoo");

describe("me summary", () => {
  it("leaves money and next session empty when there are no records", () => {
    expect(totalSpentKrw([])).toBeUndefined();
    expect(nextDue([])).toBeUndefined();
  });

  it("sums only known prices", () => {
    const records = [
      { ...jisoo[0], priceKrw: 100 },
      { ...jisoo[1], priceKrw: undefined },
    ] as TreatmentRecord[];
    expect(totalSpentKrw(records)).toBe(100);
  });

  it("picks the soonest due session and counts days from the demo clock", () => {
    const due = nextDue(jisoo, "2026-11-12");
    expect(due).toBeDefined();
    expect(due?.days).toBe(due ? Math.round((Date.parse(due.date) - Date.parse("2026-11-12")) / 86_400_000) : 0);
  });

  it("orders recent records newest first", () => {
    const recent = recentRecords(jisoo, 3);
    expect(recent).toHaveLength(3);
    expect(recent[0].date >= recent[1].date && recent[1].date >= recent[2].date).toBe(true);
    expect(activePlans(jisoo)).toBeGreaterThan(0);
  });

  it("walks the request and booking steps", () => {
    expect(journeyStatus(EMPTY)).toBe("none");
    expect(journeySteps({ ...EMPTY, requestStarted: true }).map((s) => s.status)).toEqual(["done", "active", "pending", "pending"]);
    const pending = { ...EMPTY, requestStarted: true, booking: { quoteId: "q", slot: "2026-11-14T11:00:00+09:00", status: "pending_clinic" as const } };
    expect(journeySteps(pending).map((s) => s.status)).toEqual(["done", "done", "active", "pending"]);
    const confirmed = { ...pending, booking: { ...pending.booking, status: "confirmed" as const } };
    expect(journeySteps(confirmed).map((s) => s.status)).toEqual(["done", "done", "done", "active"]);
  });

  it("applies profile edits but never nationality or residency", () => {
    const emily = CUSTOMERS.find((c) => c.id === "cus_emily")!;
    const edited = applyProfileEdits(emily, {
      nickname: "Em",
      trip: { arrival: "2026-11-21", departure: "2026-11-28" },
      languagesNeeded: ["en", "ko"],
      contact: { channel: "email", handle: "em@example.com" },
    });
    expect(edited.nickname).toBe("Em");
    expect(edited.trip).toMatchObject({ arrival: "2026-11-21", departure: "2026-11-28", stayArea: "gangnam" });
    expect(edited.prefs.languagesNeeded).toEqual(["en", "ko"]);
    expect(edited.nationality).toBe(emily.nationality);
    expect(edited.residency).toBe(emily.residency);
    expect(applyProfileEdits(emily, undefined)).toBe(emily);
  });
});
