import { injectAraBurst } from "../../../../lib/agents/platform/outcomes";
import { demoEnabled, demoForbidden, ensurePlatformReady } from "../../../../lib/bff/demo";

// POST /api/demo/inject-outcomes: the 20 Ara outcomes for the rule proposal demo (10 데모 7행).
export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoEnabled()) return demoForbidden();
  await ensurePlatformReady();
  const burst = await injectAraBurst();
  const gaps = burst.map((o) => o.quoteGapRatio ?? 0);
  const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  return Response.json({ injected: burst.length, meanGapPct: Math.round(mean * 100) });
}
