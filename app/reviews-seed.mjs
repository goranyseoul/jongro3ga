// Demo review board: verified-visit groups per (clinic, procedure) with a few real Semaphore reviews.
// Members are fresh identities (stand-ins for past patients); reviews carry real proofs.
import { createReviewBoard, newVisitIdentity, writeReview } from '../chain/reviews.mjs';

const VISITS = {
  glow: { REJURAN: 41, LASER_TONING: 23, BOTOX: 9 },
  lumiere: { EXOSOME: 57, REJURAN: 30, LASER_TONING: 12 },
  apgujeong: { ULTHERA: 19, THERMAGE: 12, BOTOX: 6 },
};
const REVIEWS = [
  ['glow', 'REJURAN', 5, 'Bumps were gone in 2 days. English-speaking coordinator was great.'],
  ['glow', 'LASER_TONING', 4, 'Quick and painless, tone is more even.'],
  ['lumiere', 'EXOSOME', 5, 'Zero downtime, skin glowing for my flight home.'],
  ['lumiere', 'EXOSOME', 5, 'Perfect add-on after my Rejuran course.'],
  ['lumiere', 'REJURAN', 4, 'Good result, slightly pricey.'],
  ['apgujeong', 'ULTHERA', 5, 'Visible jawline lift after a month. Worth it.'],
  ['apgujeong', 'THERMAGE', 3, 'Nice but I expected more lifting.'],
];

export async function seedReviewBoard() {
  const board = createReviewBoard();
  const reviewers = new Map();
  for (const [clinicId, procs] of Object.entries(VISITS)) {
    for (const [proc, n] of Object.entries(procs)) {
      for (let i = 0; i < n; i++) {
        const id = newVisitIdentity();
        board.issueTicket(clinicId, proc, id.commitment);
        reviewers.set(`${clinicId}:${proc}:${i}`, id);
      }
    }
  }
  const used = new Map();
  for (const [clinicId, proc, rating, text] of REVIEWS) {
    const k = `${clinicId}:${proc}`;
    const i = used.get(k) ?? 0;
    used.set(k, i + 1);
    const r = await writeReview(reviewers.get(`${k}:${i}`), board.groupOf(clinicId, proc), clinicId, proc, { rating, text });
    await board.submitReview(r);
  }
  return board;
}
