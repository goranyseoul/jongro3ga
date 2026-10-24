import type { RecordAnchorV1, ReviewV1 } from "../../a2a/schemas";
import { getAgentIdentity } from "../../a2a/auth";
import { clock } from "../../clock";
import type { AnchorLog, Locale, VerifiedVisitStat } from "../../domain";
import { anchorVisit, submitReview } from "../../zk/client";
import { completed, failed, rejected, type SkillCaller, type TextResult } from "./skill-result";
import { mean, round } from "./stats";
import { platformStore, statKey, type StoredReviewStat } from "./store";

// ZK record layer skills of the platform (INTEGRATION.md 3절·4절, 03 record-anchor@1 and review@1):
// platform.anchor_record and platform.submit_review. P0 is the server wallet transition: glowpass holds the
// customer charts, makes the append proof and the Semaphore proof, and verifies them; the platform checks the
// booking, relays through lib/zk/client and keeps the aggregates.

/** glowpass knows personas by customer id. cus_yuki_done is the same wallet as cus_yuki (INTEGRATION.md 2절). */
const PERSONA_ALIAS: Record<string, string> = { cus_yuki_done: "cus_yuki" };

async function personaOf(agentId: string): Promise<string | undefined> {
  const identity = await getAgentIdentity(agentId);
  if (!identity || identity.role !== "customer") return undefined;
  return PERSONA_ALIAS[identity.ownerId] ?? identity.ownerId;
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * platform.anchor_record: the booking must be the caller's and done (status completed or a D0 outcome in).
 * The record hash is not recomputed in P0 (no Poseidon in lib/zk; glowpass builds the append proof itself).
 */
export async function anchorRecord(input: RecordAnchorV1, caller: SkillCaller): Promise<TextResult> {
  if (caller.role !== "customer") return rejected("records are anchored for customer agents only");
  const attribution = await platformStore.attributionByBooking(input.bookingId);
  if (!attribution || attribution.customerAgentId !== caller.agentId) {
    return rejected(`booking_not_owned: ${input.bookingId} is not a booking of this customer agent`);
  }
  if (attribution.clinicId !== input.clinicId) return rejected(`clinic_mismatch: ${input.bookingId} is at ${attribution.clinicId}`);
  const d0 = (await platformStore.outcomes()).find((o) => o.bookingId === input.bookingId && o.checkpoint === "D0");
  if (attribution.status !== "completed" && !d0) return rejected(`booking_not_completed: ${input.bookingId} is ${attribution.status}`);
  if (d0 && d0.procedureId !== input.procedureId) return rejected(`procedure_mismatch: ${input.bookingId} was ${d0.procedureId}`);
  if ((await platformStore.anchorLogs()).some((log) => log.bookingId === input.bookingId)) {
    return rejected(`already_anchored: ${input.bookingId} has a record on chain`);
  }
  const persona = await personaOf(caller.agentId);
  if (!persona) return rejected("unknown_customer_agent");

  let anchored: { tx: string; day: number };
  try {
    anchored = await anchorVisit(persona, input.clinicId, input.procedureId);
  } catch (error) {
    return failed(`anchor_failed: ${reason(error)}`);
  }

  const log: AnchorLog = {
    id: `anc_${input.bookingId}`,
    bookingId: input.bookingId,
    subjectId: input.subjectId,
    tx: anchored.tx,
    day: anchored.day,
    at: clock.nowIso(),
  };
  await platformStore.putAnchorLog(log);
  const stat = (await platformStore.verifiedVisits()).find((v) => v.clinicId === input.clinicId && v.procedureId === input.procedureId);
  const next: VerifiedVisitStat = stat
    ? { ...stat, count: stat.count + 1 }
    : { id: `vv_${statKey(input.clinicId, input.procedureId)}`, clinicId: input.clinicId, procedureId: input.procedureId, count: 1 };
  await platformStore.putVerifiedVisits(next);
  return completed(`anchored ${anchored.tx}`);
}

/** Locale of a review text from its script, for the published review list. */
export function detectLocale(text: string): Locale {
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[가-힯]/.test(text)) return "ko";
  if (/[一-鿿]/.test(text)) return "zh-CN";
  return "en";
}

/**
 * platform.submit_review: one review per visit. A spent nullifier is refused here; the Semaphore proof itself is
 * verified by glowpass in P0. Accepted reviews join the (clinic, procedure) aggregate with their text.
 */
export async function submitVerifiedReview(input: ReviewV1, caller: SkillCaller): Promise<TextResult> {
  if (caller.role !== "customer") return rejected("reviews come from customer agents only");
  const stat = (await platformStore.reviewStats()).find((r) => r.clinicId === input.clinicId && r.procedureId === input.procedureId);
  if (stat?.nullifiers.includes(input.visitProof.nullifier)) {
    return rejected("nullifier_already_used: this visit has already been reviewed");
  }
  const persona = await personaOf(caller.agentId);
  if (!persona) return rejected("unknown_customer_agent");

  try {
    const result = await submitReview(persona, input.clinicId, input.procedureId, {
      rating: input.rating,
      ...(input.text === undefined ? {} : { text: input.text }),
    });
    if (!result.ok) return rejected(`review_rejected: ${result.reason ?? "proof not accepted"}`);
  } catch (error) {
    return failed(`review_failed: ${reason(error)}`);
  }

  const text = input.text ?? "";
  const reviews = [...(stat?.reviews ?? []), { rating: input.rating, text, locale: detectLocale(text) }];
  const next: StoredReviewStat = {
    id: stat?.id ?? `rs_${statKey(input.clinicId, input.procedureId)}`,
    clinicId: input.clinicId,
    procedureId: input.procedureId,
    n: reviews.length,
    avgRating: round(mean(reviews.map((r) => r.rating)), 1),
    nullifiers: [...(stat?.nullifiers ?? []), input.visitProof.nullifier],
    reviews,
  };
  await platformStore.putReviewStats(next);
  return completed(`review accepted: n=${next.n}, average ${next.avgRating.toFixed(1)}`);
}
