import type { ConsentEntry } from "../../domain/customer";

// Client safe helper over the consents returned by GET /api/customer/me (latest entry per type).
export function granted(consents: readonly ConsentEntry[], type: ConsentEntry["type"]): boolean {
  return consents.some((c) => c.type === type && c.granted);
}
