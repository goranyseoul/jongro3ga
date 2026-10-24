"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { A2ALogRow, FilterSelect, LoadState, useApi, type FilterOption } from "@/components/ops";
import {
  AGENT_ROLE_LABEL,
  TASK_STATE_LABEL,
  agentLabel,
  fetchA2ALog,
  type A2AAgent,
} from "@/lib/ui-data/ops";

const ALL = "all";
const CONTEXT_LIST_ID = "a2a-context-ids";
const ROLE_ORDER: A2AAgent["role"][] = ["platform", "customer", "clinic"];
// New calls show up without reloading the page.
const POLL_MS = 3000;

type Filters = { agent: string; skill: string; state: string; contextId: string };
const NO_FILTERS: Filters = { agent: ALL, skill: ALL, state: ALL, contextId: "" };

const opt = (value: string) => (value === ALL ? undefined : value);

export function A2ALogView() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Filtering happens on the server (GET /api/ops/a2a-log); the facets list every value in the whole log.
  const query = { agent: opt(filters.agent), skill: opt(filters.skill), state: opt(filters.state), contextId: filters.contextId.trim() || undefined };
  const { data, error, loading, reload } = useApi(() => fetchA2ALog(query), POLL_MS, JSON.stringify(query));

  const clinics = data?.clinics ?? {};
  const agents = [...(data?.facets.agents ?? [])].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.agentId.localeCompare(b.agentId),
  );
  const agentOptions: FilterOption[] = [
    { value: ALL, label: "전체" },
    ...ROLE_ORDER.map((role) => ({ value: `role:${role}`, label: `${AGENT_ROLE_LABEL[role]} 전체` })),
    ...agents.map((agent) => ({ value: agent.agentId, label: agentLabel(agent, clinics) })),
  ];
  const skillOptions: FilterOption[] = [{ value: ALL, label: "전체" }, ...(data?.facets.skills ?? []).map((skill) => ({ value: skill, label: skill }))];
  const stateOptions: FilterOption[] = [
    { value: ALL, label: "전체" },
    ...(data?.facets.states ?? []).map((state) => ({ value: state, label: TASK_STATE_LABEL[state] ?? state })),
  ];

  const rows = data?.entries ?? [];
  const filtered = Object.entries(filters).some(([key, value]) => value !== NO_FILTERS[key as keyof Filters]);
  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <section aria-label="필터" className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="에이전트" value={filters.agent} onChange={(agent) => set({ agent })} options={agentOptions} />
        <FilterSelect label="스킬" value={filters.skill} onChange={(skill) => set({ skill })} options={skillOptions} />
        <FilterSelect label="상태" value={filters.state} onChange={(state) => set({ state })} options={stateOptions} />
        <Input
          label="contextId"
          value={filters.contextId}
          onChange={(event) => set({ contextId: event.target.value })}
          placeholder="req_01J9Z8"
          list={CONTEXT_LIST_ID}
          autoComplete="off"
        />
        <datalist id={CONTEXT_LIST_ID}>
          {(data?.facets.contextIds ?? []).map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-sp-3">
        <p role="status" aria-live="polite" className="text-label text-muted tabular-nums">
          {rows.length}건 (전체 {data?.total ?? 0}건)
        </p>
        {filtered ? (
          <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
            필터 초기화
          </Button>
        ) : null}
      </div>

      <LoadState what="A2A 로그" loading={loading && !data} error={error} onRetry={reload} />

      {data && rows.length === 0 ? (
        <p className="text-body text-muted">{data.total === 0 ? "아직 A2A 호출이 없어요." : "조건에 맞는 호출이 없어요. 필터를 줄여 보세요."}</p>
      ) : rows.length > 0 ? (
        <ul aria-label="A2A 호출" className="rounded-card border border-border-soft bg-elev">
          {rows.map((entry) => (
            <A2ALogRow
              key={entry.id}
              entry={entry}
              clinics={clinics}
              expanded={open.has(entry.id)}
              onToggle={() => toggle(entry.id)}
              onFilterContext={(contextId) => set({ contextId })}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
}
