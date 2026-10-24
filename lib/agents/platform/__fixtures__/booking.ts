import type { BookingV1, ClinicShortlistV1, OutcomeV1 } from "../../../a2a/schemas";
import { judgeQuotes } from "../fairness";
import { matchClinics } from "../matching";
import { reportBooking } from "../outcomes";
import { YUKI_AGENT, yukiRequest } from "./requests";

// Test only: Yuki matched, quoted, judged and booked, so outcome, anchor and review tests start from an
// attributed booking the way the demo reaches it (10 demo rows 3 to 5).

export const YUKI_BOOKING = "bkg_5521";

export async function yukiShortlist(): Promise<ClinicShortlistV1> {
  const result = await matchClinics(yukiRequest(), YUKI_AGENT);
  if (result.state !== "completed") throw new Error(`match rejected: ${result.reason}`);
  return result.shortlist;
}

export function bookingFor(shortlist: ClinicShortlistV1, clinicId: string, extra: Partial<BookingV1> = {}): BookingV1 {
  const candidate = shortlist.candidates.find((c) => c.clinicId === clinicId);
  if (!candidate) throw new Error(`${clinicId} is not on the shortlist`);
  return {
    schema: "pibu/booking@1",
    bookingId: YUKI_BOOKING,
    requestId: shortlist.requestId,
    quoteId: `qt_${clinicId.replace(/^cln_/, "")}`,
    clinicId,
    customerAgentId: YUKI_AGENT,
    slot: "2026-11-14T11:00:00+09:00",
    status: "confirmed",
    confirmedBy: "clinic_staff",
    priceKrw: 340_000,
    referralToken: candidate.referralToken,
    ...extra,
  };
}

/** Match, judge the clinic's 2cc quote, and have the clinic report the booking. */
export async function attributedBooking(
  clinicId = "cln_seoul_glow",
  quote: { priceKrw: number; vatIncluded: boolean } = { priceKrw: 340_000, vatIncluded: true },
): Promise<{ shortlist: ClinicShortlistV1; booking: BookingV1 }> {
  const shortlist = await yukiShortlist();
  const booking = bookingFor(shortlist, clinicId, { priceKrw: quote.priceKrw });
  await judgeQuotes({
    schema: "pibu/judge-request@1",
    requestId: shortlist.requestId,
    matchId: shortlist.matchId,
    quotes: [
      { quoteId: booking.quoteId, clinicId, procedureId: "rejuran_healer", amount: { value: 2, unit: "cc" }, ...quote, includes: [] },
    ],
  });
  const reported = await reportBooking(booking, { agentId: clinicId, role: "clinic" });
  if (reported.state !== "completed") throw new Error(reported.text);
  return { shortlist, booking };
}

/** 03 pibu/outcome@1 example (D0 at Seoul Glow, 340,000, 2cc, satisfaction 5). */
export const yukiOutcome = (extra: Partial<OutcomeV1> = {}): OutcomeV1 => ({
  schema: "pibu/outcome@1",
  outcomeId: "out_3310",
  bookingId: YUKI_BOOKING,
  clinicId: "cln_seoul_glow",
  procedureId: "rejuran_healer",
  checkpoint: "D0",
  paidKrw: 340_000,
  receivedAmount: { value: 2, unit: "cc" },
  productVerified: "vial_shown",
  receiptAttached: true,
  satisfaction: 5,
  painScore: 3,
  downtimeDaysActual: null,
  wouldReturn: true,
  sideEffects: [],
  comment: "Explained everything in Japanese.",
  visitorProfile: { nationality: "JP", ageBand: "25-29" },
  submittedAt: "2026-11-14T13:10:00+09:00",
  ...extra,
});
