import { proposeRules } from "../../../../../lib/agents/platform/proposer";
import { ensurePlatformReady } from "../../../../../lib/bff/demo";

// POST /api/ops/rules/propose: [규칙 제안 실행]. Deterministic triggers with template reasons (07 4절 1단계).
export const dynamic = "force-dynamic";

export async function POST() {
  await ensurePlatformReady();
  const result = await proposeRules({ proposedBy: "ops_demo" });
  return Response.json(result);
}
