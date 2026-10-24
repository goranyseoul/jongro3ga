import { activateRule, rejectRule, retireRule, RuleTransitionError } from "../../../../../../lib/agents/platform/rules";

// POST /api/ops/rules/{ruleId}/activate | reject | retire: the operator's decision (07 4절).
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ ruleId: string; action: string }> }) {
  const { ruleId, action } = await ctx.params;
  try {
    if (action === "activate") return Response.json({ rule: await activateRule(ruleId, { approvedBy: "ops_demo" }) });
    if (action === "reject") return Response.json({ rule: await rejectRule(ruleId, { rejectedBy: "ops_demo" }) });
    if (action === "retire") return Response.json({ rule: await retireRule(ruleId) });
    return Response.json({ error: `unknown action ${action}` }, { status: 404 });
  } catch (error) {
    const status = error instanceof RuleTransitionError ? 409 : 500;
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
