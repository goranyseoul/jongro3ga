import { decodeJwt } from "jose";
import type { BookingV1, OutcomeV1, SignalReportV1 } from "../../a2a/schemas";
import { verifyReferralToken } from "../../a2a/auth";
import { clock } from "../../clock";
import type { Area, JudgedQuote, Outcome, PriceRecord } from "../../domain";
import { materializeAraBurst } from "../../store";
import { completed, rejected, type SkillCaller, type TextResult } from "./skill-result";
import { normalizedTotalKrw, round } from "./stats";
import { platformStore, type PlatformSignal, type StoredAttribution } from "./store";

// Outcome collection and the other reports the platform receives (07 3절): platform.submit_outcome,
// platform.report_booking (attribution ledger) and platform.report_signal. Pure helpers first, then the skills.

export const QUOTE_GAP_SIGNAL = 0.1;
export const LOW_SATISFACTION = 2;

/** (paid - quoted) / quoted, both VAT included, to 6 decimals. */
export const quoteGapRatio = (paidKrw: number, quotedKrw: number): number => round((paidKrw - quotedKrw) / quotedKrw, 6);

const signalId = (outcome: Pick<Outcome, "bookingId" | "checkpoint">, kind: string) => `sig_${outcome.bookingId}_${outcome.checkpoint}_${kind}`;
const SIGNAL_KINDS = ["quote_gap", "low_satisfaction", "side_effect_report"] as const;

/** 07 3절 신호: quote_gap (> 0.10), low_satisfaction (<= 2), side_effect_report (any side effect). Pure. */
export function outcomeSignals(outcome: Outcome): PlatformSignal[] {
  const context = { nationality: outcome.visitorProfile.nationality, procedureId: outcome.procedureId, outcomeId: outcome.id };
  const base = { clinicId: outcome.clinicId, context, at: outcome.receivedAt };
  const out: PlatformSignal[] = [];
  if (outcome.quoteGapRatio !== undefined && outcome.quoteGapRatio > QUOTE_GAP_SIGNAL) {
    out.push({ ...base, id: signalId(outcome, "quote_gap"), kind: "quote_gap", value: outcome.quoteGapRatio });
  }
  if (outcome.satisfaction <= LOW_SATISFACTION) {
    out.push({ ...base, id: signalId(outcome, "low_satisfaction"), kind: "low_satisfaction", value: outcome.satisfaction });
  }
  if (outcome.sideEffects.length > 0) {
    out.push({ ...base, id: signalId(outcome, "side_effect_report"), kind: "side_effect_report", value: outcome.sideEffects.length });
  }
  return out;
}

/** The paid price as a verified PriceRecord (booking linked, so verified). Pure. */
export function priceRecordFromOutcome(outcome: Outcome, area: Area): PriceRecord {
  return {
    id: `pr_${outcome.bookingId}_${outcome.checkpoint}`,
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
    date: outcome.submittedAt.slice(0, 10),
  };
}

/** The quote the booking was made from: the attributed quoteId, else the latest judged quote of that match and clinic. */
function quoteOf(attribution: StoredAttribution, judged: readonly JudgedQuote[]): JudgedQuote | undefined {
  const byId = attribution.quoteId ? judged.find((j) => j.quoteId === attribution.quoteId) : undefined;
  if (byId) return byId;
  return judged
    .filter((j) => j.matchId === attribution.matchId && j.clinicId === attribution.clinicId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

/** platform.submit_outcome. Only the customer agent the booking was referred to may report on it. */
export async function submitOutcome(input: OutcomeV1, caller: SkillCaller): Promise<TextResult> {
  if (caller.role !== "customer") return rejected("outcomes come from customer agents only");
  const attribution = await platformStore.attributionByBooking(input.bookingId);
  if (!attribution) return rejected(`unknown_booking: ${input.bookingId} was never reported by its clinic`);
  if (attribution.customerAgentId !== caller.agentId) return rejected("customer_agent_mismatch: the booking belongs to another customer agent");
  if (attribution.clinicId !== input.clinicId) return rejected(`clinic_mismatch: ${input.bookingId} is at ${attribution.clinicId}`);

  const [judged, outcomes, clinic] = await Promise.all([
    platformStore.judgedQuotes(),
    platformStore.outcomes(),
    platformStore.clinic(input.clinicId),
  ]);
  const quote = quoteOf(attribution, judged);
  // Without a judged quote the booked price is the quote (bookings are VAT included, 03 booking example).
  const quotedKrw = quote ? normalizedTotalKrw(quote.quote.priceKrw, quote.quote.vatIncluded) : attribution.priceKrw;
  const previous = outcomes.find((o) => o.bookingId === input.bookingId && o.checkpoint === input.checkpoint);
  const outcome: Outcome = {
    ...input,
    id: previous?.id ?? input.outcomeId,
    receivedAt: clock.nowIso(),
    quotedKrw,
    quoteGapRatio: quoteGapRatio(input.paidKrw, quotedKrw),
  };

  if (previous) await platformStore.putOutcomeHistory({ id: `${previous.id}@${previous.receivedAt}`, replacedAt: outcome.receivedAt, value: previous });
  await platformStore.putOutcome(outcome);
  // The paid price is known at D0; later check-ins would count the same payment again.
  if (outcome.checkpoint === "D0") await platformStore.putPriceRecord(priceRecordFromOutcome(outcome, clinic?.area ?? "other"));
  for (const kind of SIGNAL_KINDS) await platformStore.removeSignal(signalId(outcome, kind));
  const signals = outcomeSignals(outcome);
  for (const signal of signals) await platformStore.putSignal(signal);

  const gapPct = round(outcome.quoteGapRatio! * 100, 1);
  return completed(
    `${previous ? "replaced" : "accepted"} outcome ${outcome.id} for ${input.bookingId} ${input.checkpoint}: ` +
      `quote gap ${gapPct >= 0 ? "+" : ""}${gapPct}%, signals ${signals.map((s) => s.kind).join(", ") || "none"}`,
  );
}

/** The jti of a referral token whose signature checked out but which has expired since (status updates after 72h). */
function jtiOf(token: string): string | undefined {
  try {
    const jti = decodeJwt(token).jti;
    return typeof jti === "string" ? jti : undefined;
  } catch {
    return undefined;
  }
}

/**
 * platform.report_booking from a clinic agent: the referral token must be one the platform issued to that clinic
 * (`aud`) for that customer agent (`sub`) and request (`rid`). The result is the attribution ledger entry.
 */
export async function reportBooking(booking: BookingV1, caller: SkillCaller): Promise<TextResult> {
  if (caller.role !== "clinic") return rejected("bookings are reported by clinic agents only");
  if (caller.agentId !== booking.clinicId) return rejected(`clinic_mismatch: ${caller.agentId} cannot report a booking at ${booking.clinicId}`);
  const existing = await platformStore.attributionByBooking(booking.bookingId);

  const claims = await verifyReferralToken(booking.referralToken, { clinicId: booking.clinicId });
  let matchId: string;
  let jti: string;
  if ("error" in claims) {
    // A booking attributed while its token was valid may still change status (completed, canceled) later.
    const sameToken = claims.error === "expired" && existing && jtiOf(booking.referralToken) === existing.referralTokenJti;
    if (!sameToken) return rejected(`invalid_referral_token: ${claims.error}`);
    matchId = existing.matchId;
    jti = existing.referralTokenJti;
  } else {
    if (claims.sub !== booking.customerAgentId) return rejected("customer_agent_mismatch: the referral token was issued to another customer agent");
    if (claims.rid !== booking.requestId) return rejected("request_mismatch: the referral token was issued for another request");
    matchId = claims.mid;
    jti = claims.jti;
  }

  const match = await platformStore.matchLog(matchId);
  const nationality = match?.request.visitorProfile.nationality;
  const entry: StoredAttribution = {
    id: existing?.id ?? `att_${booking.bookingId}`,
    bookingId: booking.bookingId,
    clinicId: booking.clinicId,
    customerAgentId: booking.customerAgentId,
    matchId,
    referralTokenJti: jti,
    status: booking.status,
    priceKrw: booking.priceKrw,
    ...(nationality ? { nationality } : {}),
    reportedAt: clock.nowIso(),
    quoteId: booking.quoteId,
  };
  await platformStore.putAttribution(entry);
  return completed(`booking ${booking.bookingId} attributed to ${matchId} (${booking.status})`);
}

/** platform.report_signal: a timeout or rejection a customer agent saw while asking a clinic. */
export async function reportSignal(report: SignalReportV1, caller: SkillCaller): Promise<TextResult> {
  const match = (await platformStore.matchLogs())
    .filter((log) => log.requestId === report.requestId && log.customerAgentId === caller.agentId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const signal: PlatformSignal = {
    id: `sig_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    clinicId: report.clinicId,
    kind: report.kind,
    value: 1,
    context: {
      ...(report.taskId ? { taskId: report.taskId } : {}),
      ...(match ? { nationality: match.request.visitorProfile.nationality, procedureId: match.request.procedureId } : {}),
    },
    at: report.at,
  };
  await platformStore.putSignal(signal);
  return completed(`signal ${report.kind} recorded for ${report.clinicId}`);
}

/**
 * The demo control's [결과 20건 주입] (10 demo row 7): the 20 Ara outcomes dated 1 to 29 days before now.
 * They feed the proposer's 30 day triggers and do not create PriceRecords (07 3절).
 */
export async function injectAraBurst(): Promise<Outcome[]> {
  const burst = materializeAraBurst(clock.now());
  for (const outcome of burst) await platformStore.putOutcome(outcome);
  return burst;
}
