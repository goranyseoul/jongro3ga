import { OfferProofV1Schema } from "../../a2a/schemas";
import type { IsoDate, Offer } from "../../domain";
import { clauseHolds, N, type ZkChart } from "../../zk/clauses";
import { verifyOffer } from "../../zk/client";
import type { ProofBundle } from "../../zk/types";
import { eventActiveOn, isProofOnly } from "./offers";

// Offer proof check for clinic.quote (02 "오퍼 증명 검증", docs/INTEGRATION.md sections 3 to 5). Code decides,
// before anything else looks at the request, and every failure means "no proof": the clinic then quotes the
// regular price and never rejects because of a proof (03 "에러 처리").

const EMPTY_CHART: ZkChart = {
  types: Array<number>(N).fill(0),
  dates: Array<number>(N).fill(0),
  clinics: Array<number>(N).fill(0),
  salt: "0",
};

export type ProofCheck =
  | { verified: true; offerId: string; unanchored: boolean }
  | { verified: false; reason: "no_proof" | "malformed" | "other_clinic" | "no_such_offer" | "verifier_unreachable" | "rejected" | "needs_records" };

/**
 * Verifies `metadata.offerProof` against the clinic's active proof-only events for the procedure.
 * - The proof must be a valid pibu/offer-proof@1 for this clinic and name one of those events.
 * - lib/zk/client.verifyOffer must answer ok. A throw (verifier down) counts as a failed check.
 * - An unanchored pseudonym (no on-chain chart) only passes clauses an empty chart satisfies, e.g. first visit.
 */
export async function checkOfferProof(input: {
  clinicId: string;
  procedureId: string;
  offers: readonly Offer[];
  today: IsoDate;
  raw: unknown;
}): Promise<ProofCheck> {
  if (input.raw === undefined || input.raw === null) return { verified: false, reason: "no_proof" };
  if (typeof input.raw !== "object" || Array.isArray(input.raw)) return { verified: false, reason: "malformed" };

  // `unanchored` travels with the glowpass bundle (lib/zk/types ProofBundle) but is not a wire field.
  const { unanchored: claimedUnanchored, ...wire } = input.raw as Record<string, unknown>;
  const parsed = OfferProofV1Schema.safeParse(wire);
  if (!parsed.success) return { verified: false, reason: "malformed" };
  const proof = parsed.data;
  if (proof.clinicId !== input.clinicId) return { verified: false, reason: "other_clinic" };

  const offer = input.offers.find(
    (o) => o.id === proof.offerId && o.procedureId === input.procedureId && isProofOnly(o) && eventActiveOn(o, input.today),
  );
  if (!offer) return { verified: false, reason: "no_such_offer" };

  const bundle: ProofBundle = {
    subjectId: proof.subjectId,
    offerId: proof.offerId,
    today: proof.today,
    proofs: proof.proofs,
    ...(claimedUnanchored === true ? { unanchored: true } : {}),
  };
  let result;
  try {
    result = await verifyOffer(input.clinicId, bundle);
  } catch {
    return { verified: false, reason: "verifier_unreachable" };
  }
  if (!result?.ok) return { verified: false, reason: "rejected" };

  const unanchored = result.unanchored === true;
  if (unanchored && !(offer.zkClauses ?? []).every((clause) => clauseHolds(EMPTY_CHART, proof.today, clause))) {
    return { verified: false, reason: "needs_records" };
  }
  return { verified: true, offerId: offer.id, unanchored };
}
