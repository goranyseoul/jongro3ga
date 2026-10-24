// GET /api/ops/prices?procedureId=: unit price p25/p50/p75/p90 per procedure and area group (05 /ops/prices).
import { clock } from "../../../../lib/clock";
import type { PriceRecord } from "../../../../lib/domain/platform";
import { getStore } from "../../../../lib/store";
import { PLATFORM_COLLECTIONS, PRICE_WINDOW_DAYS, priceDistribution } from "../../../../lib/agents/platform/signals";
import { json, requireOperator } from "../_lib/http";
import { procedureName } from "../_lib/labels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const procedureId = new URL(request.url).searchParams.get("procedureId");
  const records = await getStore().list<PriceRecord>("platform", PLATFORM_COLLECTIONS.priceRecords);
  const bands = priceDistribution(records, clock.now())
    .filter((band) => !procedureId || band.procedureId === procedureId)
    .map((band) => ({ ...band, procedureName: procedureName(band.procedureId) }));
  return json({ now: clock.nowIso(), windowDays: PRICE_WINDOW_DAYS, bands });
}
