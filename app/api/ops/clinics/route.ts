// GET /api/ops/clinics: clinic registry with data freshness (05-screens.md /ops/clinics).
import { clock } from "../../../../lib/clock";
import type { ClinicRegistryEntry } from "../../../../lib/domain/platform";
import { getStore } from "../../../../lib/store";
import { PLATFORM_COLLECTIONS, STALE_AFTER_DAYS, clinicDisplayName, withFreshness } from "../../../../lib/agents/platform/signals";
import { json, requireOperator } from "../_lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const today = clock.today();
  const registry = await getStore().list<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry);
  const clinics = registry
    .map((entry) => ({ ...withFreshness(entry, today), displayName: clinicDisplayName(entry, entry.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return json({ now: clock.nowIso(), today, staleAfterDays: STALE_AFTER_DAYS, clinics });
}
