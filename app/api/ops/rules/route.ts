// GET /api/ops/rules?status=proposed|active|rejected|retired: routing rules with expiry review flags.
import { clock } from "../../../../lib/clock";
import { getStore } from "../../../../lib/store";
import { EXCLUDE_TTL_DAYS, REVIEW_BEFORE_DAYS, expireRules, listRuleHistory, listRules } from "../../../../lib/agents/platform/proposer-rules";
import type { RoutingRule } from "../../../../lib/domain/platform";
import { errorJson, json, requireOperator } from "../_lib/http";
import { clinicNames } from "../_lib/labels";
import { present } from "../_lib/rules";

export const dynamic = "force-dynamic";

const STATUSES = new Set<RoutingRule["status"]>(["proposed", "active", "rejected", "retired"]);

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const status = new URL(request.url).searchParams.get("status");
  if (status && !STATUSES.has(status as RoutingRule["status"])) return errorJson(400, "bad_status", `unknown status ${status}`);
  const store = getStore();
  const now = clock.now();
  const expired = await expireRules(store, now);
  const all = await listRules(store);
  const rules = status ? all.filter((rule) => rule.status === status) : all;
  const history = await listRuleHistory(store);
  const counts = { proposed: 0, active: 0, rejected: 0, retired: 0 };
  for (const rule of all) counts[rule.status] += 1;
  return json({
    now: clock.nowIso(),
    excludeTtlDays: EXCLUDE_TTL_DAYS,
    reviewBeforeDays: REVIEW_BEFORE_DAYS,
    expiredRuleIds: expired,
    counts,
    rules: rules.map((rule) => ({ ...present(rule, now), history: history.filter((h) => h.ruleId === rule.id).map(({ version, event, by, at }) => ({ version, event, by, at })) })),
    clinics: await clinicNames(store),
  });
}
