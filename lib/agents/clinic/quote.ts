// clinic.quote item selection (07-platform-intelligence.md "병원 에이전트의 견적 항목 선택").
// Pure functions: the skill handler loads the clinic data and the clock, these decide.
import type { Amount, IsoDate, Krw } from "../../domain/common";
import type { MenuItem, Slot } from "../../domain/clinic";
import type { StoredOffer } from "./store";

/** Inclusion codes used on the wire (03 quote example: numbing_cream, soothing_mask). */
export const INCLUSION_CODES = ["numbing_cream", "soothing_mask", "recovery_cream"] as const;

export interface QuoteEvent {
  title: string;
  regularPriceKrw: Krw;
  validFrom: IsoDate;
  validUntil: IsoDate;
  conditions: string;
}

export interface QuoteSelection {
  source: "event" | "menu" | "event_regular_price";
  product: string;
  amount: Amount;
  priceKrw: Krw;
  vatIncluded: boolean;
  includes: string[];
  excludes: string[];
  event?: QuoteEvent;
  offerId?: string;
  menuItemId?: string;
}

export interface SelectInput {
  procedureId: string;
  amount: Amount;
  today: IsoDate;
  menu: MenuItem[];
  offers: StoredOffer[];
  /** false when an offer needed a ZK proof that did not verify: quote the regular price instead. */
  allowEvents?: boolean;
  /** Offer the customer proved eligibility for (ZK bundle offerId), preferred over the closest one. */
  preferOfferId?: string;
}

/** Offers that run today and are switched on, for one procedure. */
export function currentOffers(offers: StoredOffer[], procedureId: string, today: IsoDate): StoredOffer[] {
  return offers.filter(
    (offer) =>
      offer.procedureId === procedureId && offer.active !== false && offer.validFrom <= today && today <= offer.validUntil,
  );
}

/** Closest amount to the request; ties go to the larger amount. Different units rank last. */
export function closest<T extends { amount: Amount }>(items: T[], wanted: Amount): T | undefined {
  const distance = (item: T) => (item.amount.unit === wanted.unit ? Math.abs(item.amount.value - wanted.value) : Number.POSITIVE_INFINITY);
  return [...items].sort((a, b) => distance(a) - distance(b) || b.amount.value - a.amount.value)[0];
}

function excludesOf(includes: string[]): string[] {
  return INCLUSION_CODES.filter((code) => !includes.includes(code));
}

function sameAmount(a: Amount, b: Amount): boolean {
  return a.unit === b.unit && a.value === b.value;
}

/** Menu facts (product name, VAT, inclusions) for an offer: same procedure and amount first, then any. */
function menuFor(offer: StoredOffer, menu: MenuItem[]): MenuItem | undefined {
  const forProcedure = menu.filter((item) => item.procedureId === offer.procedureId);
  return forProcedure.find((item) => sameAmount(item.amount, offer.amount)) ?? forProcedure[0];
}

/**
 * 1. A running event for the procedure wins, at the event's own amount (Mint answers a 2cc request with its 1cc event).
 * 2. Otherwise the menu item closest to the requested amount (ties: larger amount).
 * 3. Nothing for the procedure: null, the handler answers TASK_STATE_REJECTED.
 */
export function selectQuoteItem(input: SelectInput): QuoteSelection | null {
  const allowEvents = input.allowEvents ?? true;
  const running = currentOffers(input.offers, input.procedureId, input.today);
  const menu = input.menu.filter((item) => item.procedureId === input.procedureId);

  if (allowEvents && running.length > 0) {
    const offer = running.find((candidate) => candidate.id === input.preferOfferId) ?? closest(running, input.amount)!;
    const facts = menuFor(offer, input.menu);
    const includes = facts?.includes ?? [];
    return {
      source: "event",
      product: facts?.product ?? offer.title,
      amount: offer.amount,
      priceKrw: offer.priceKrw,
      vatIncluded: facts?.vatIncluded ?? true,
      includes,
      excludes: excludesOf(includes),
      event: {
        title: offer.title,
        regularPriceKrw: offer.regularPriceKrw,
        validFrom: offer.validFrom,
        validUntil: offer.validUntil,
        conditions: offer.conditions,
      },
      offerId: offer.id,
      menuItemId: facts?.id,
    };
  }

  const item = closest(menu, input.amount);
  if (item) {
    return {
      source: "menu",
      product: item.product,
      amount: item.amount,
      priceKrw: item.priceKrw,
      vatIncluded: item.vatIncluded,
      includes: item.includes,
      excludes: excludesOf(item.includes),
      menuItemId: item.id,
    };
  }

  // Event-only procedure whose discount was withheld: the regular price of that event's amount.
  const offer = closest(running, input.amount);
  if (offer) {
    return {
      source: "event_regular_price",
      product: offer.title,
      amount: offer.amount,
      priceKrw: offer.regularPriceKrw,
      vatIncluded: true,
      includes: [],
      excludes: excludesOf([]),
      offerId: offer.id,
    };
  }
  return null;
}

/** Calendar date in Seoul for an ISO date-time with any offset. */
export function kstDate(iso: string): IsoDate {
  return new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** Free slots inside the date window (KST calendar dates) that accept the procedure. */
export function freeSlots(slots: Slot[], procedureId: string, from: IsoDate, to: IsoDate): string[] {
  return slots
    .filter((slot) => !slot.held)
    .filter((slot) => slot.procedureIds.length === 0 || slot.procedureIds.includes(procedureId))
    .filter((slot) => {
      const date = kstDate(slot.start);
      return from <= date && date <= to;
    })
    .map((slot) => slot.start)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
}

/** Quote validity: one week, never past the event's last day. */
export function quoteValidUntil(today: IsoDate, event?: QuoteEvent): IsoDate {
  const week = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  return event && event.validUntil < week ? event.validUntil : week;
}
