import { demoEnabled, demoForbidden } from "../../../../lib/bff/demo";
import { runYukiScenario } from "../../../../lib/bff/demo-scenario";

// POST /api/demo/run-scenario: Yuki's request over real A2A calls (10 데모 2~5행), for the /demo console.
export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoEnabled()) return demoForbidden();
  try {
    return Response.json(await runYukiScenario());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
