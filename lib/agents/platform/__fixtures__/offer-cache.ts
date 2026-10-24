import { vi } from "vitest";
import type { OffersV1 } from "../../../a2a/schemas";
import { clearAgentCardCache } from "../../../a2a/client";
import { resetTaskStores } from "../../../a2a/server";
import { resetClock, setClock } from "../../../clock";
import { clock } from "../../../clock";
import type { ClinicOfferCache, MenuItem, Offer } from "../../../domain";
import { COLLECTIONS, getStore, resetStore } from "../../../store";
import { SEED_FILES } from "../../../store/seed";
import { procedureFacts } from "../procedure-facts";

// Test only: the offer cache the platform would hold after refreshOfferCache, built from data/seed/clinics.json.
// The clinic agent (WP3) is not answering clinic.offers yet, so platform tests put the cache in directly.

type ClinicsSeed = { registry: { id: string }[]; menus: MenuItem[]; offers: Offer[] };

/** pibu/offers@1 per clinic: every menu item, plus every offer of the month as an event item. */
export function seedOffers(month = "2026-11"): OffersV1[] {
  const seed = SEED_FILES["clinics.json"] as unknown as ClinicsSeed;
  return seed.registry.map(({ id: clinicId }) => ({
    schema: "pibu/offers@1",
    clinicId,
    month,
    items: [
      ...seed.menus
        .filter((m) => m.clinicId === clinicId)
        .map((m) => ({ procedureId: m.procedureId, product: m.product, amount: m.amount, priceKrw: m.priceKrw, vatIncluded: m.vatIncluded })),
      ...seed.offers
        .filter((o) => o.clinicId === clinicId && o.validFrom.slice(0, 7) <= month && o.validUntil.slice(0, 7) >= month)
        .map((o) => ({
          procedureId: o.procedureId,
          product: procedureFacts(o.procedureId)?.products[0] ?? o.procedureId,
          amount: o.amount,
          priceKrw: o.priceKrw,
          // BUILD-LOG 20 (3): event prices are VAT included
          vatIncluded: true,
          event: {
            title: o.title,
            regularPriceKrw: o.regularPriceKrw,
            validFrom: o.validFrom,
            validUntil: o.validUntil,
            conditions: o.conditions,
            ...(o.zkClauses ? { zkClauses: o.zkClauses } : {}),
          },
        })),
    ],
  }));
}

/** Puts `seedOffers()` into platform.offer_cache. */
export async function putSeedOfferCache(): Promise<void> {
  const store = getStore();
  for (const offers of seedOffers()) {
    const cache: ClinicOfferCache = { id: offers.clinicId, clinicId: offers.clinicId, offers, fetchedAt: clock.nowIso() };
    await store.put("platform", COLLECTIONS.platform.offerCache, cache);
  }
}

export const TEST_BASE = "https://pibu.example";
export const TEST_NOW = "2026-11-12T10:00:00+09:00";

/** The common platform test setup: demo clock, seeded store, offer cache, empty task stores and card cache. */
export async function setupPlatformTest(): Promise<void> {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", TEST_BASE);
  setClock(TEST_NOW);
  resetStore({ seed: true });
  await putSeedOfferCache();
  resetTaskStores();
  clearAgentCardCache();
}

export function teardownPlatformTest(): void {
  resetClock();
  vi.unstubAllEnvs();
}
