import { createReviewBoard, newVisitIdentity, writeReview } from './reviews.mjs';

const board = createReviewBoard();
const yuki = newVisitIdentity(), lin = newVisitIdentity(), emily = newVisitIdentity(), outsider = newVisitIdentity();
let failures = 0;
const check = (label, got, want) => { const pass = got === want; if (!pass) failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label} -> ${got}`); };

board.issueTicket('clinic-b', 'EXOSOME', yuki.commitment);
board.issueTicket('clinic-b', 'EXOSOME', lin.commitment);

let t = Date.now();
const r1 = await writeReview(yuki, board.groupOf('clinic-b', 'EXOSOME'), 'clinic-b', 'EXOSOME', { rating: 5, text: 'Great glow, no downtime' });
console.log(`  (proof ${Date.now() - t}ms)`);
check('Yuki reviews', (await board.submitReview(r1)).ok, true);
check('only 2 visits -> review held back', board.stats()[0].procedures.EXOSOME.reviews.length, 0);

board.issueTicket('clinic-b', 'EXOSOME', emily.commitment);
check('3rd visit -> review published', board.stats()[0].procedures.EXOSOME.reviews.length, 1);

const r2 = await writeReview(yuki, board.groupOf('clinic-b', 'EXOSOME'), 'clinic-b', 'EXOSOME', { rating: 5, text: 'Again!' });
check('Yuki reviews twice', (await board.submitReview(r2)).reason, 'already reviewed (nullifier used)');

const tampered = { ...(await writeReview(lin, board.groupOf('clinic-b', 'EXOSOME'), 'clinic-b', 'EXOSOME', { rating: 2, text: 'meh' })), rating: 5, text: 'Amazing!' };
check('platform/attacker edits Lin\'s review', (await board.submitReview(tampered)).reason, 'review text does not match proof');

const fakeGroup = board.groupOf('clinic-x', 'EXOSOME');
board.issueTicket('clinic-x', 'EXOSOME', outsider.commitment);
const r3 = await writeReview(outsider, fakeGroup, 'clinic-x', 'EXOSOME', { rating: 5, text: 'paid review' });
check('non-patient posts to clinic B', (await board.submitReview({ ...r3, clinicId: 'clinic-b' })).reason, 'wrong scope');

console.log(JSON.stringify(board.stats(), null, 1));
console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
