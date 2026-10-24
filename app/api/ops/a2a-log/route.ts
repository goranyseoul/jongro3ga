// GET /api/ops/a2a-log: every A2A call, oldest first (05-screens.md /ops/a2a-log).
// Filters: agent (agent id or "role:<role>"), skill, state, contextId (substring), after (entry id: only
// newer calls, for polling), limit. Request and response JSON are masked again before leaving the server.
import { listA2ALog } from "../../../../lib/a2a/log";
import { maskSensitive } from "../../../../lib/a2a/mask";
import { clock } from "../../../../lib/clock";
import type { A2ALogEntry } from "../../../../lib/domain/shared";
import { getStore } from "../../../../lib/store";
import { json, requireOperator } from "../_lib/http";
import { clinicNames } from "../_lib/labels";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 1000;

function matches(entry: A2ALogEntry, params: URLSearchParams): boolean {
  const agent = params.get("agent");
  if (agent) {
    const parties = [entry.from, entry.to];
    const hit = agent.startsWith("role:") ? parties.some((p) => p.role === agent.slice(5)) : parties.some((p) => p.agentId === agent);
    if (!hit) return false;
  }
  const skill = params.get("skill");
  if (skill && entry.skillId !== skill) return false;
  const state = params.get("state");
  if (state && entry.state !== state) return false;
  const contextId = params.get("contextId")?.trim().toLowerCase();
  if (contextId && !(entry.contextId ?? "").toLowerCase().includes(contextId)) return false;
  return true;
}

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const store = getStore();
  const all = await listA2ALog(store);
  let rows = all.filter((entry) => matches(entry, params));
  const after = params.get("after");
  if (after) {
    const index = rows.findIndex((entry) => entry.id === after);
    if (index >= 0) rows = rows.slice(index + 1);
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || MAX_LIMIT));
  rows = rows.slice(-limit);

  const agents = new Map<string, A2ALogEntry["from"]>();
  for (const entry of all) for (const party of [entry.from, entry.to]) agents.set(party.agentId, { agentId: party.agentId, role: party.role });
  const unique = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

  return json({
    now: clock.nowIso(),
    total: all.length,
    entries: rows.map((entry) => ({
      ...entry,
      request: maskSensitive(entry.request),
      ...(entry.response === undefined ? {} : { response: maskSensitive(entry.response) }),
    })),
    facets: {
      agents: [...agents.values()],
      skills: unique(all.map((entry) => entry.skillId)).sort(),
      states: unique(all.map((entry) => entry.state)),
      contextIds: unique(all.map((entry) => entry.contextId)),
    },
    clinics: await clinicNames(store),
  });
}
