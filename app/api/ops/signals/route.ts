// GET /api/ops/signals: last 30 days per clinic and per clinic x nationality (05-screens.md /ops/signals).
import { clock } from "../../../../lib/clock";
import { getStore } from "../../../../lib/store";
import { SEGMENT_WINDOW_DAYS, aggregateSegments, loadWindow, summarizeClinics } from "../../../../lib/agents/platform/signals";
import { json, requireOperator } from "../_lib/http";
import { clinicNames } from "../_lib/labels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const store = getStore();
  const input = await loadWindow(store, clock.now());
  const segments = aggregateSegments(input);
  return json({
    now: clock.nowIso(),
    windowDays: SEGMENT_WINDOW_DAYS,
    clinics: summarizeClinics(input, segments),
    segments,
    names: await clinicNames(store),
  });
}
