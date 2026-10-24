import { describe, expect, it } from "vitest";
import { addMonths, checkinDueAt, computeNextDue, downtimeOverlapsDeparture, nextSessionNumber, renumberSeries } from "./schedule";

describe("next session rules (06, BUILD-LOG 13 calendar months)", () => {
  it("Rejuran session 1 on 11-14 makes session 2 due on 12-14", () => {
    expect(nextSessionNumber(undefined, "rejuran_healer", "2026-11-14")).toBe(1);
    expect(computeNextDue("rejuran_healer", "2026-11-14", 1)).toBe("2026-12-14");
    // product level ids on the wire resolve to the same procedure
    expect(computeNextDue("rejuran_healer", "2026-11-14", 1)).toBe("2026-12-14");
  });

  it("continues the initial series monthly, then uses the maintenance minimum (90 days = 3 months)", () => {
    expect(computeNextDue("rejuran_healer", "2026-12-14", 2)).toBe("2027-01-14");
    expect(computeNextDue("rejuran_healer", "2027-01-14", 3)).toBe("2027-04-14");
    expect(computeNextDue("rejuran_healer", "2027-04-14", 4)).toBe("2027-07-14");
  });

  it("counts the next session number and resets after maintenance max x 1.5 (Rejuran 120 x 1.5 = 180 days)", () => {
    const previous = { procedureId: "rejuran_healer", date: "2026-11-14", sessionNumber: 2 };
    expect(nextSessionNumber(previous, "rejuran_healer", "2027-05-13")).toBe(3); // 180 days later: not over the limit
    expect(nextSessionNumber(previous, "rejuran_healer", "2027-05-14")).toBe(1); // 181 days later: starts over
  });

  it("Thermage and Ulthera come back once a year (maintenance 300~400 days)", () => {
    expect(computeNextDue("thermage_flx", "2026-11-14", 1)).toBe("2027-09-14");
    expect(computeNextDue("ulthera", "2026-03-21", 1)).toBe("2027-01-21");
    expect(computeNextDue("thermage_flx", "2026-11-14", 1)).toBe("2027-09-14");
  });

  it("keeps non month intervals in days and clamps month ends", () => {
    expect(computeNextDue("sculptra", "2026-11-14", 1)).toBe("2026-12-12"); // 28 days
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(computeNextDue("laser_toning", "2026-11-14", 10)).toBeUndefined(); // series done, no upkeep
    expect(computeNextDue("unknown_procedure", "2026-11-14", 1)).toBeUndefined();
  });

  it("renumbers a series when a record is added out of order", () => {
    const series = renumberSeries([
      { procedureId: "rejuran_healer", date: "2026-12-14", sessionNumber: 1 },
      { procedureId: "rejuran_healer", date: "2026-11-14", sessionNumber: 1 },
    ]);
    expect(series.map((r) => [r.date, r.sessionNumber, r.nextDue])).toEqual([
      ["2026-11-14", 1, "2026-12-14"],
      ["2026-12-14", 2, "2027-01-14"],
    ]);
  });
});

describe("departure downtime warning (06)", () => {
  // Rejuran downtime is 1~3 days in the master: a slot on 11-13 ends by 11-16 at worst
  it("warns when procedure day + downtime max passes the departure date", () => {
    expect(downtimeOverlapsDeparture("rejuran_healer", "2026-11-13T10:00:00+09:00", "2026-11-15")).toBe(true);
    expect(downtimeOverlapsDeparture("rejuran_healer", "2026-11-13T10:00:00+09:00", "2026-11-16")).toBe(false);
    expect(downtimeOverlapsDeparture("thermage_flx", "2026-11-15T10:00:00+09:00", "2026-11-15")).toBe(false);
    expect(downtimeOverlapsDeparture("rejuran_healer", "2026-11-13T10:00:00+09:00", undefined)).toBe(false);
  });

  it("schedules D7 and D30 check-ins after the procedure day", () => {
    expect(checkinDueAt("2026-11-14", "D7")).toBe("2026-11-21T10:00:00+09:00");
    expect(checkinDueAt("2026-11-14", "D30")).toBe("2026-12-14T10:00:00+09:00");
  });
});
