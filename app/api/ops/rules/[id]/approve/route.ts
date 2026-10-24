// POST /api/ops/rules/:id/approve (07 section 4: every change bumps the version and keeps history).
import { clock } from "../../../../../../lib/clock";
import { getStore } from "../../../../../../lib/store";
import { approveRule } from "../../../../../../lib/agents/platform/proposer-rules";
import { json, requireOperator } from "../../../_lib/http";
import { present, transitionError } from "../../../_lib/rules";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const now = clock.now();
    const rule = await approveRule(getStore(), id, auth.operatorId, now);
    return json({ rule: present(rule, now) });
  } catch (error) {
    return transitionError(error);
  }
}
