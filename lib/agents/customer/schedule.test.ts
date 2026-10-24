import { describe, expect, it } from "vitest";
import {
  addInterval,
  addMonths,
  downtimeWarning,
  nextDueFor,
  numberSeries,
  scheduleFacts,
  sessionNumberFor,
} from "./schedule";

// 06 "다음 회차 계산" with BUILD-LOG 13 (calendar months) and 14 (downtime before departure is a warning).

describe("calendar month intervals (BUILD-LOG 13)", () => {
  it("adds multiples of 30 days as calendar months and other intervals as days", () => {
    expect(addInterval("2026-11-14", 30)).toBe("2026-12-14");
    expect(addInterval("2026-11-14", 90)).toBe("2027-02-14");
    expect(addInterval("2026-11-14", 300)).toBe("2027-09-14");
    expect(addInterval("2026-11-14", 14)).toBe("2026-11-28");
    expect(addInterval("2026-11-14", 45)).toBe("2026-12-29");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-08-31", 3)).toBe("2026-11-30");
    expect(addInterval("2027-01-31", 30)).toBe("2027-02-28");
  });
});

describe("next session (06)", () => {
  it("Rejuran session 1 on 2026-11-14 is due again on 2026-12-14", () => {
    expect(nextDueFor("rejuran_healer", "2026-11-14", 1)).toBe("2026-12-14");
  });

  it("Rejuran keeps the 30 day series until session 3, then 90 days (3 calendar months)", () => {
    expect(nextDueFor("rejuran_healer", "2026-12-14", 2)).toBe("2027-01-14");
    expect(nextDueFor("rejuran_healer", "2027-01-14", 3)).toBe("2027-04-14");
    expect(nextDueFor("rejuran_healer", "2027-04-14", 4)).toBe("2027-07-14");
  });

  it("Thermage and Ulthera are once a year (300 days = 10 calendar months)", () => {
    expect(nextDueFor("thermage_flx", "2026-11-14", 1)).toBe("2027-09-14");
    expect(nextDueFor("ulthera", "2026-11-14", 4)).toBe("2027-09-14");
  });

  it("month end: Rejuran session 1 on 01-31 is due on 02-28", () => {
    expect(nextDueFor("rejuran_healer", "2027-01-31", 1)).toBe("2027-02-28");
  });

  it("has no due date for a procedure without a cycle in the master or the defaults", () => {
    expect(nextDueFor("no_such_procedure", "2026-11-14", 1)).toBeUndefined();
  });

  it("falls back to the 06 defaults only where the master is null", () => {
    expect(scheduleFacts("rejuran_healer")).toMatchObject({ initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } });
  });
});

describe("session numbers", () => {
  it("continues the series within maintenanceIntervalDays.max and restarts at 1 after a longer gap", () => {
    expect(sessionNumberFor("rejuran_healer", "2026-11-14", undefined)).toBe(1);
    expect(sessionNumberFor("rejuran_healer", "2026-12-14", { date: "2026-11-14", sessionNumber: 1 })).toBe(2);
    // 120 days is still the series, 121 is not.
    expect(sessionNumberFor("rejuran_healer", "2027-03-14", { date: "2026-11-14", sessionNumber: 2 })).toBe(3);
    expect(sessionNumberFor("rejuran_healer", "2027-03-15", { date: "2026-11-14", sessionNumber: 2 })).toBe(1);
  });

  it("numbers a whole series in date order and restarts after the gap", () => {
    const out = numberSeries("rejuran_healer", [
      { id: "c", date: "2027-01-14" },
      { id: "a", date: "2026-11-14" },
      { id: "b", date: "2026-12-14" },
      { id: "d", date: "2027-09-01" },
    ]);
    expect(out).toEqual([
      { id: "a", sessionNumber: 1, nextDue: "2026-12-14" },
      { id: "b", sessionNumber: 2, nextDue: "2027-01-14" },
      { id: "c", sessionNumber: 3, nextDue: "2027-04-14" },
      { id: "d", sessionNumber: 1, nextDue: "2027-10-01" },
    ]);
  });
});

describe("downtime before the flight home (06, BUILD-LOG 14)", () => {
  it("warns when the longest downtime ends after the departure date, without blocking", () => {
    // Rejuran downtime is 1~3 days in the master: 11/14 + 3 = 11/17, two days past an 11/15 departure.
    expect(downtimeWarning("rejuran_healer", "2026-11-14T11:00:00+09:00", "2026-11-15")).toEqual({
      procedureId: "rejuran_healer",
      downtimeEndsOn: "2026-11-17",
      departure: "2026-11-15",
      daysOver: 2,
    });
  });

  it("does not warn when the downtime ends on or before the departure date", () => {
    expect(downtimeWarning("rejuran_healer", "2026-11-12T11:00:00+09:00", "2026-11-15")).toBeUndefined();
    expect(downtimeWarning("thermage_flx", "2026-11-15T11:00:00+09:00", "2026-11-15")).toBeUndefined();
  });

  it("reads the slot as a Seoul date", () => {
    // 23:30 UTC on the 13th is already the 14th in Seoul.
    expect(downtimeWarning("rejuran_healer", "2026-11-13T23:30:00Z", "2026-11-16")?.downtimeEndsOn).toBe("2026-11-17");
  });
});
