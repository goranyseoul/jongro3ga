// POST /api/ops/rules/propose: the [규칙 제안 실행] button (07 section 4, P0 runs it on demand).
import { clock } from "../../../../../lib/clock";
import { getStore } from "../../../../../lib/store";
import { runProposer } from "../../../../../lib/agents/platform/proposer";
import { errorJson, json, requireOperator } from "../../_lib/http";
import { clinicNames } from "../../_lib/labels";
import { present } from "../../_lib/rules";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const store = getStore();
  try {
    const run = await runProposer(store);
    const now = clock.now();
    return json({
      ranAt: run.ranAt,
      windowDays: run.windowDays,
      mode: run.mode,
      ...(run.claudeError ? { claudeError: run.claudeError } : {}),
      candidates: run.candidates.map(({ key, trigger, urgent, stats }) => ({ key, trigger, urgent, stats })),
      proposed: run.proposed.map((rule) => present(rule, now)),
      skipped: run.skipped,
      dropped: run.dropped,
      suspendedClinicIds: run.suspendedClinicIds,
      expiredRuleIds: run.expiredRuleIds,
      clinics: await clinicNames(store),
      requestedBy: auth.operatorId,
    });
  } catch (error) {
    return errorJson(500, "proposer_failed", error instanceof Error ? error.message : String(error));
  }
}
