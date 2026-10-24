import type { OffersV1 } from "../../a2a/schemas";
import type { Amount, IsoDate, MenuItem, Offer } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";

// clinic.offers (pibu/offers@1): the whole regular menu plus the events valid in the asked month. Also the
// shared helpers quote.ts uses to read events. Pure.

type WireEvent = NonNullable<OffersV1["items"][number]["event"]>;

/** True when the event runs on `day` (07 견적 규칙 1, validFrom and validUntil included). */
export const eventActiveOn = (offer: Pick<Offer, "validFrom" | "validUntil">, day: IsoDate): boolean =>
  offer.validFrom <= day && day <= offer.validUntil;

/** True when the event runs on at least one day of `month` (YYYY-MM). */
export const eventActiveInMonth = (offer: Pick<Offer, "validFrom" | "validUntil">, month: string): boolean =>
  offer.validFrom <= `${month}-31` && offer.validUntil >= `${month}-01`;

/** An event applies only with a verified offer proof when it carries zkClauses (03 "ZK 확장 필드"). */
export const isProofOnly = (offer: Offer): boolean => (offer.zkClauses?.length ?? 0) > 0;

/** The five promotion fields (Medical Act enforcement decree art. 23), plus zkClauses for a proof-only event. */
export function wireEvent(offer: Offer): WireEvent {
  return {
    title: offer.title,
    regularPriceKrw: offer.regularPriceKrw,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    conditions: offer.conditions,
    ...(isProofOnly(offer) ? { zkClauses: offer.zkClauses } : {}),
  };
}

/**
 * Product name for an event, which has none of its own (06 `Offer`, BUILD-LOG 20 (3)). The clinic's own menu
 * item for the procedure first, then the procedure master: `products[0]` once the master carries it (06), its
 * English name until then.
 */
export function eventProduct(procedureId: string, menu: readonly MenuItem[]): string {
  const fromMenu = menu.find((item) => item.procedureId === procedureId)?.product;
  if (fromMenu) return fromMenu;
  const procedure = getProcedure(procedureId) as ({ products?: string[] } & ReturnType<typeof getProcedure>) | undefined;
  return procedure?.products?.[0] ?? procedure?.name.en ?? procedureId;
}

/** The item whose amount is closest to `wanted`: same unit first, ties go to the larger amount (07 견적 규칙 2). */
export function closestByAmount<T extends { amount: Amount }>(items: readonly T[], wanted: Amount): T | undefined {
  const sameUnit = items.filter((item) => item.amount.unit === wanted.unit);
  const pool = sameUnit.length > 0 ? sameUnit : items;
  let best: T | undefined;
  for (const item of pool) {
    if (!best) {
      best = item;
      continue;
    }
    const d = Math.abs(item.amount.value - wanted.value);
    const bestD = Math.abs(best.amount.value - wanted.value);
    if (d < bestD || (d === bestD && item.amount.value > best.amount.value)) best = item;
  }
  return best;
}

export function buildOffers(input: {
  clinicId: string;
  menu: readonly MenuItem[];
  offers: readonly Offer[];
  /** YYYY-MM */
  month: string;
}): OffersV1 {
  const menuItems = input.menu.map((item) => ({
    procedureId: item.procedureId,
    product: item.product,
    amount: item.amount,
    priceKrw: item.priceKrw,
    vatIncluded: item.vatIncluded,
  }));
  const eventItems = input.offers
    .filter((offer) => eventActiveInMonth(offer, input.month))
    .map((offer) => ({
      procedureId: offer.procedureId,
      product: eventProduct(offer.procedureId, input.menu),
      amount: offer.amount,
      priceKrw: offer.priceKrw,
      // Event prices are VAT included (06 "99,000 VAT 포함", BUILD-LOG 20 (3)).
      vatIncluded: true,
      event: wireEvent(offer),
    }));
  return { schema: "pibu/offers@1", clinicId: input.clinicId, month: input.month, items: [...menuItems, ...eventItems] };
}
