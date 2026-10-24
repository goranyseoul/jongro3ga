import { refreshOfferCache } from "../../agents/platform/offer-cache";

// Test only: the platform's offer cache refresh (WP4, BUILD-LOG 23 (1)). platform.match_clinics answers FAILED
// `offer_cache_empty` until the cache is filled, and the customer module's tests may not import the platform module
// (scripts/check-boundaries.mjs), so they fill it through this file over the real clinic.offers route.

export { refreshOfferCache };
