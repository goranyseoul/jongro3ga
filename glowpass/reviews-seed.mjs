// Demo review board: verified-visit groups per (clinic, procedure) sized like DEMO.md
// ("피북 사용자 1,2xx명 받음"), plus a handful of reviews that carry real Semaphore proofs.
// Past patients are random commitments; reviewers are real identities so their proofs verify.
import { keccak256 } from 'viem';
import { createReviewBoard, newVisitIdentity, writeReview } from '../chain/reviews.mjs';
import { VERIFIED_VISITS, SEED_REVIEWS } from './catalog.mjs';

const randomCommitment = () => BigInt(keccak256(crypto.getRandomValues(new Uint8Array(32)))) >> 8n;

export function seedReviewBoard() {
  const board = createReviewBoard();
  const reviewers = [];
  for (const [clinicId, procs] of Object.entries(VERIFIED_VISITS)) {
    for (const [proc, n] of Object.entries(procs)) {
      const ids = SEED_REVIEWS.filter(([c, p]) => c === clinicId && p === proc).map((r) => ({ r, id: newVisitIdentity() }));
      reviewers.push(...ids);
      board.seedTickets(clinicId, proc, [...ids.map((x) => x.id.commitment), ...Array.from({ length: n - ids.length }, randomCommitment)]);
    }
  }
  // proofs take ~2s each: generate in the background so the server starts immediately
  const ready = (async () => {
    for (const { r: [clinicId, proc, rating, text], id } of reviewers) {
      await board.submitReview(await writeReview(id, board.groupOf(clinicId, proc), clinicId, proc, { rating, text }));
    }
  })();
  return { board, ready };
}
