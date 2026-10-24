// Outcome collection for platform.submit_outcome (07 3절). Pure; ./skills.ts does the store work.
// Outcomes come only from the customer agent that booked; clinics never submit them.
import type { OutcomeV1 } from "../../a2a/schemas";
import type { AgentRef } from "../../a2a/contract";
import type { AttributionEntry, Outcome, PriceRecord, Signal } from "../../domain";
import { kstDate, roundTo } from "./stats";

export type CallerCheck = { ok: true } | { ok: false; reason: string };

/** 07: token role = customer and sub = the booking's customerAgentId. Clinic tokens are refused. */
export function checkOutcomeCaller(caller: AgentRef, attribution: AttributionEntry | undefined, outcome: Pick<OutcomeV1, "bookingId" | "clinicId">): CallerCheck {
  if (caller.role !== "customer") return { ok: false, reason: "outcomes are accepted only from the customer's agent" };
  if (!attribution) return { ok: false, reason: `booking ${outcome.bookingId} is not known to the platform` };
  if (attribution.customerAgentId !== caller.agentId) return { ok: false, reason: "this booking belongs to another customer" };
  if (attribution.clinicId !== outcome.clinicId) return { ok: false, reason: "clinicId does not match the booking" };
  return { ok: true };
}

/** (paid - quoted) / quoted, both VAT included. 4 decimals. */
export function quoteGapRatio(paidKrw: number, quotedKrw: number): number {
  return roundTo((paidKrw - quotedKrw) / quotedKrw, 4);
}

export type SignalDraft = Omit<Signal, "id">;

/** quote_gap (> 0.10), low_satisfaction (<= 2), side_effect_report (any side effect). */
export function signalsForOutcome(outcome: Outcome, at: string): SignalDraft[] {
  const context = { nationality: outcome.visitorProfile.nationality, procedureId: outcome.procedureId, outcomeId: outcome.outcomeId };
  const out: SignalDraft[] = [];
  if (typeof outcome.quoteGapRatio === "number" && outcome.quoteGapRatio > 0.1) {
    out.push({ clinicId: outcome.clinicId, kind: "quote_gap", value: outcome.quoteGapRatio, context, at });
  }
  if (outcome.satisfaction <= 2) out.push({ clinicId: outcome.clinicId, kind: "low_satisfaction", value: outcome.satisfaction, context, at });
  if (outcome.sideEffects.length > 0) {
    out.push({ clinicId: outcome.clinicId, kind: "side_effect_report", value: outcome.sideEffects.length, context, at });
  }
  return out;
}

/** A booking-linked outcome becomes a verified PriceRecord (source = outcome). One per booking. */
export function priceRecordFromOutcome(outcome: OutcomeV1, area: PriceRecord["area"]): PriceRecord {
  return {
    id: `pr_${outcome.bookingId}`,
    procedureId: outcome.procedureId,
    area,
    amount: outcome.receivedAmount,
    paidKrw: outcome.paidKrw,
    normalizedUnitKrw: Math.round(outcome.paidKrw / outcome.receivedAmount.value),
    source: "outcome",
    verified: true,
    ageBand: outcome.visitorProfile.ageBand,
    nationalityGroup: outcome.visitorProfile.nationality === "KR" ? "KR" : "foreign",
    clinicId: outcome.clinicId,
    date: kstDate(outcome.submittedAt),
  };
}
