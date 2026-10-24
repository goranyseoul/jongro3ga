import type { ProcedureRequestV1, QuoteV1 } from "../../a2a/schemas";
import type { IsoDate, Locale, MenuItem, Offer, Slot } from "../../domain";
import { openSlots } from "./availability";
import { closestByAmount, eventActiveOn, eventProduct, isProofOnly, wireEvent } from "./offers";

// clinic.quote item selection, docs/spec/07-platform-intelligence.md "병원 에이전트의 견적 항목 선택", with the
// ZK rule of BUILD-LOG 22: an event with zkClauses is chosen only when its offer proof was verified. Pure: the
// executor verifies the proof (lib/zk/client) and passes the result in.
//
// Order:
//   0. a verified proof for an active proof-only event of the procedure: that event, plus offerApplied
//   1. an active event without zkClauses: that event at its own amount (07 rule 1)
//   2. the menu item closest to the asked amount, ties to the larger (07 rule 2)
//   2b. no menu item but an active proof-only event (Mint): that item at its regularPriceKrw, no event
//   3. nothing: rejected (07 rule 3)

const DAY_MS = 24 * 60 * 60 * 1000;
export const QUOTE_VALID_DAYS = 7;

export interface QuoteInput {
  clinicId: string;
  operationMode: "proxy" | "clinic";
  /** Languages the clinic supports. */
  languages: readonly Locale[];
  request: ProcedureRequestV1;
  menu: readonly MenuItem[];
  offers: readonly Offer[];
  slots: readonly Slot[];
  /** clock.today() */
  today: IsoDate;
  quoteId: string;
  /** Offer id whose pibu/offer-proof@1 the clinic verified for this request. */
  verifiedOfferId?: string;
}

export type QuoteBasis = "proof_event" | "event" | "menu" | "regular_price";

export type QuoteDecision =
  | { ok: true; quote: QuoteV1; basis: QuoteBasis }
  | { ok: false; reason: "procedure_not_offered" };

export const addDays = (day: IsoDate, days: number): IsoDate =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function decideQuote(input: QuoteInput): QuoteDecision {
  const { request, today } = input;
  const procedureId = request.procedureId;
  const menu = input.menu.filter((item) => item.procedureId === procedureId);
  const events = input.offers.filter((offer) => offer.procedureId === procedureId && eventActiveOn(offer, today));
  const proofEvents = events.filter(isProofOnly);
  const plainEvents = events.filter((offer) => !isProofOnly(offer));

  const base = {
    schema: "pibu/quote@1" as const,
    quoteId: input.quoteId,
    requestId: request.requestId,
    clinicId: input.clinicId,
    procedureId,
    excludes: [] as string[],
    slots: openSlots(input.slots, procedureId, request.dateWindow.from, request.dateWindow.to),
    languages: quoteLanguages(input.languages, request.languages),
    indicative: input.operationMode === "proxy",
    validUntil: addDays(today, QUOTE_VALID_DAYS),
    operationMode: input.operationMode,
  };
  const fromEvent = (offer: Offer, priceKrw: number) => ({
    ...base,
    product: eventProduct(procedureId, input.menu),
    amount: offer.amount,
    priceKrw,
    vatIncluded: true,
    includes: [] as string[],
  });

  const proven = input.verifiedOfferId ? proofEvents.find((offer) => offer.id === input.verifiedOfferId) : undefined;
  if (proven) {
    return {
      ok: true,
      basis: "proof_event",
      quote: { ...fromEvent(proven, proven.priceKrw), event: wireEvent(proven), offerApplied: { offerId: proven.id, verified: true } },
    };
  }

  const event = closestByAmount(plainEvents, request.amount);
  if (event) return { ok: true, basis: "event", quote: { ...fromEvent(event, event.priceKrw), event: wireEvent(event) } };

  const item = closestByAmount(menu, request.amount);
  if (item) {
    return {
      ok: true,
      basis: "menu",
      quote: {
        ...base,
        product: item.product,
        amount: item.amount,
        priceKrw: item.priceKrw,
        vatIncluded: item.vatIncluded,
        includes: [...item.includes],
      },
    };
  }

  // The regular price of a proof-only event is the clinic's regular price for that item (BUILD-LOG 22).
  const regular = closestByAmount(proofEvents, request.amount);
  if (regular) return { ok: true, basis: "regular_price", quote: fromEvent(regular, regular.regularPriceKrw) };

  return { ok: false, reason: "procedure_not_offered" };
}

/** The clinic's languages the customer asked for, or all of the clinic's when none match. */
function quoteLanguages(clinic: readonly Locale[], asked: readonly Locale[]): Locale[] {
  const shared = clinic.filter((locale) => asked.includes(locale));
  return shared.length > 0 ? shared : [...clinic];
}
