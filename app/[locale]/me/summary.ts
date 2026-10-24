import type { IsoDate } from "@/lib/domain/common";
import type { TaskStepStatus } from "@/components/customer/task-steps";
import type { DemoState } from "@/components/customer/demo-state";
// relative so vitest, which has no "@/" alias, can load it
import {
  DEMO_TODAY,
  daysBetween,
  upcomingDue,
  upcomingSessionNumber,
  type BookingStatus,
  type TreatmentRecord,
} from "../../../lib/ui-data/customer";

// Pure numbers behind the /me dashboard, kept apart from the view so they can be tested without React.

export type NextDue = { record: TreatmentRecord; date: IsoDate; days: number; session: number };

/** Soonest due session of an active procedure; overdue ones come first because they are the most urgent. */
export function nextDue(records: TreatmentRecord[], today: IsoDate = DEMO_TODAY): NextDue | undefined {
  const record = upcomingDue(records)[0];
  if (!record?.nextDue) return undefined;
  return { record, date: record.nextDue, days: daysBetween(today, record.nextDue), session: upcomingSessionNumber(record) };
}

/** Sum of known prices, or undefined when no record has a price (a missing price is not a zero). */
export function totalSpentKrw(records: TreatmentRecord[]): number | undefined {
  const priced = records.filter((r) => typeof r.priceKrw === "number");
  if (priced.length === 0) return undefined;
  return priced.reduce((sum, r) => sum + (r.priceKrw as number), 0);
}

/** Newest first, ties broken by the higher session number. */
export function recentRecords(records: TreatmentRecord[], limit = 5): TreatmentRecord[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber).slice(0, limit);
}

/** The latest record of each procedure that is still active: what the customer is keeping up with. */
export function activePlans(records: TreatmentRecord[]): number {
  const latest = new Map<string, TreatmentRecord>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) latest.set(r.procedureId, r);
  return [...latest.values()].filter((r) => r.status === "active").length;
}

export type JourneyStatus = "none" | "comparing" | BookingStatus;

/** One word for where the request and booking stand. */
export function journeyStatus(demo: DemoState): JourneyStatus {
  if (demo.outcome) return "completed";
  if (demo.booking) return demo.booking.status;
  if (demo.requestStarted) return "comparing";
  return "none";
}

export type JourneyStepId = "request" | "quotes" | "booking" | "visit";
export type JourneyStep = { id: JourneyStepId; status: TaskStepStatus };

/** Request, quotes, booking, visit: the four stages a matched customer goes through. */
export function journeySteps(demo: DemoState): JourneyStep[] {
  const status = journeyStatus(demo);
  const booked = status === "confirmed" || status === "completed" || status === "no_show";
  const failed = status === "canceled";
  const step = (id: JourneyStepId, s: TaskStepStatus): JourneyStep => ({ id, status: s });

  if (status === "none") {
    return [step("request", "pending"), step("quotes", "pending"), step("booking", "pending"), step("visit", "pending")];
  }
  if (status === "comparing") {
    return [step("request", "done"), step("quotes", "active"), step("booking", "pending"), step("visit", "pending")];
  }
  return [
    step("request", "done"),
    step("quotes", "done"),
    step("booking", failed ? "error" : booked ? "done" : "active"),
    step("visit", status === "completed" ? "done" : status === "no_show" ? "error" : booked ? "active" : "pending"),
  ];
}
