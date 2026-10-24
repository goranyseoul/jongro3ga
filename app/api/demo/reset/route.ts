import { clock } from "../../../../lib/clock";
import { demoEnabled, demoForbidden, resetDemo } from "../../../../lib/bff/demo";

// POST /api/demo/reset: store back to the seed, clock to DEMO_NOW, task stores cleared, offer cache refilled.
export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoEnabled()) return demoForbidden();
  const offerCache = await resetDemo();
  return Response.json({ ok: true, now: clock.nowIso(), offerCache });
}
