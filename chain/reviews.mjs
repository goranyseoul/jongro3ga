// Verified anonymous reviews with Semaphore v4.
// - A clinic visit grants a review ticket: the patient's fresh per-visit Semaphore identity
//   is added to the (clinic, procedure) group. The identity is unlinkable to the record subjectId.
// - A review is a Semaphore proof: "I am in this group" + nullifier (one review per ticket per scope).
// - Reviews are only published once the group reaches MIN_ANON_SET members, so a review cannot be
//   tied to the only patient who visited that week.
import { Identity, Group, generateProof, verifyProof } from '@semaphore-protocol/core';
import { keccak256, toBytes } from 'viem';

export const MIN_ANON_SET = 3;
const toField = (str) => BigInt(keccak256(toBytes(str))) >> 8n;
export const scopeOf = (clinicId, procedure) => toField(`review:${clinicId}:${procedure}`);
export const messageOf = ({ rating, text }) => toField(JSON.stringify({ rating, text }));

export function createReviewBoard() {
  const groups = new Map(); // key -> { group, rootHistory:Set }
  const nullifiers = new Set();
  const reviews = []; // { clinicId, procedure, rating, text, nullifier, at }
  const key = (c, p) => `${c}:${p}`;
  const entry = (c, p) => {
    if (!groups.has(key(c, p))) groups.set(key(c, p), { group: new Group(), roots: new Set() });
    return groups.get(key(c, p));
  };

  return {
    /** Clinic side (via platform): called when a visit is recorded. */
    issueTicket(clinicId, procedure, identityCommitment) {
      const e = entry(clinicId, procedure);
      e.group.addMember(identityCommitment);
      e.roots.add(e.group.root.toString());
    },
    /** Patient side needs the current group (members are public commitments). */
    groupOf: (clinicId, procedure) => entry(clinicId, procedure).group,

    /** Platform side: accept a review only with a valid, unused, in-scope proof. */
    async submitReview({ clinicId, procedure, rating, text, proof }) {
      const e = entry(clinicId, procedure);
      if (BigInt(proof.scope) !== scopeOf(clinicId, procedure)) return { ok: false, reason: 'wrong scope' };
      if (BigInt(proof.message) !== messageOf({ rating, text })) return { ok: false, reason: 'review text does not match proof' };
      if (!e.roots.has(BigInt(proof.merkleTreeRoot).toString())) return { ok: false, reason: 'not a member of this clinic/procedure group' };
      if (nullifiers.has(BigInt(proof.nullifier).toString())) return { ok: false, reason: 'already reviewed (nullifier used)' };
      if (!(await verifyProof(proof))) return { ok: false, reason: 'invalid proof' };
      nullifiers.add(BigInt(proof.nullifier).toString());
      reviews.push({ clinicId, procedure, rating, text, nullifier: BigInt(proof.nullifier).toString(), at: Date.now() });
      return { ok: true };
    },

    /** Public view: verified visits per clinic (= ranking signal) and reviews that are safe to show. */
    stats() {
      const byClinic = {};
      for (const [k, { group }] of groups) {
        const [clinicId, procedure] = k.split(':');
        const c = (byClinic[clinicId] ??= { clinicId, verifiedVisits: 0, procedures: {} });
        c.verifiedVisits += group.size;
        const rs = reviews.filter((r) => r.clinicId === clinicId && r.procedure === procedure);
        const published = group.size >= MIN_ANON_SET ? rs : [];
        c.procedures[procedure] = {
          verifiedVisits: group.size,
          pendingReviews: rs.length - published.length,
          reviews: published.map(({ rating, text }) => ({ rating, text })),
          avgRating: published.length ? published.reduce((a, r) => a + r.rating, 0) / published.length : null,
        };
      }
      return Object.values(byClinic).sort((a, b) => b.verifiedVisits - a.verifiedVisits);
    },
  };
}

/** Patient wallet side: a fresh identity per visit; the private key stays on the device. */
export const newVisitIdentity = () => new Identity();
export async function writeReview(identity, group, clinicId, procedure, { rating, text }) {
  const proof = await generateProof(identity, group, messageOf({ rating, text }), scopeOf(clinicId, procedure));
  return { clinicId, procedure, rating, text, proof };
}
