// POST /api/demo/inject-outcomes: the 20 Ara outcomes for the rule proposal demo (scenario row 7). DEMO_MODE only.
import { clock } from "../../../../lib/clock";
import { getStore } from "../../../../lib/store";
import { injectAraBurst } from "../../../../lib/agents/platform/signals-demo";
import { demoOnly, json } from "../../ops/_lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const result = await injectAraBurst(getStore(), clock.now());
  return json({ ...result, now: clock.nowIso() });
}
