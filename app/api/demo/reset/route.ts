// POST /api/demo/reset: back to data/seed (05-screens.md demo control [시드 리셋]). DEMO_MODE only.
import { loadSeed } from "../../../../data/seed/load";
import { clock, resetClock } from "../../../../lib/clock";
import { getStore, resetStore } from "../../../../lib/store";
import { demoOnly, errorJson, json } from "../../ops/_lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const blocked = demoOnly();
  if (blocked) return blocked;
  resetStore();
  resetClock();
  try {
    const { loaded } = await loadSeed(getStore());
    return json({ ok: true, now: clock.nowIso(), loaded });
  } catch (error) {
    // The store is empty and the clock is back at the start either way; say plainly that the seed did not load.
    return errorJson(500, "seed_load_failed", error instanceof Error ? error.message : String(error), { now: clock.nowIso() });
  }
}
