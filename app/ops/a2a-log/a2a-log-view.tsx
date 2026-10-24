"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { A2ALogRow, FilterSelect, type FilterOption } from "@/components/ops";
import {
  A2A_LOG,
  AGENT_ROLE_LABEL,
  TASK_STATE_LABEL,
  agentLabel,
  type A2AAgent,
  type A2ALogEntry,
} from "@/lib/ui-data/ops";

const ALL = "all";
const CONTEXT_LIST_ID = "a2a-context-ids";
const ROLE_ORDER: A2AAgent["role"][] = ["platform", "customer", "clinic"];

type Filters = { agent: string; skill: string; state: string; contextId: string };
const NO_FILTERS: Filters = { agent: ALL, skill: ALL, state: ALL, contextId: "" };

const unique = <T,>(items: T[]) => [...new Set(items)];

const agentById = new Map<string, A2AAgent>();
for (const entry of A2A_LOG) for (const agent of [entry.from, entry.to]) agentById.set(agent.agentId, agent);
const agents = [...agentById.values()].sort(
  (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.agentId.localeCompare(b.agentId),
);

const AGENT_OPTIONS: FilterOption[] = [
  { value: ALL, label: "전체" },
  ...ROLE_ORDER.map((role) => ({ value: `role:${role}`, label: `${AGENT_ROLE_LABEL[role]} 전체` })),
  ...agents.map((agent) => ({ value: agent.agentId, label: agentLabel(agent) })),
];

const SKILL_OPTIONS: FilterOption[] = [
  { value: ALL, label: "전체" },
  ...unique(A2A_LOG.map((entry) => entry.skillId))
    .sort()
    .map((skillId) => ({ value: skillId, label: skillId })),
];

const STATE_OPTIONS: FilterOption[] = [
  { value: ALL, label: "전체" },
  ...unique(A2A_LOG.map((entry) => entry.state)).map((state) => ({ value: state, label: TASK_STATE_LABEL[state] })),
];

const CONTEXT_IDS = unique(A2A_LOG.map((entry) => entry.contextId));

function matches(entry: A2ALogEntry, filters: Filters): boolean {
  const { agent, skill, state, contextId } = filters;
  if (agent !== ALL) {
    const involved = [entry.from, entry.to];
    const hit = agent.startsWith("role:")
      ? involved.some((party) => party.role === agent.slice("role:".length))
      : involved.some((party) => party.agentId === agent);
    if (!hit) return false;
  }
  if (skill !== ALL && entry.skillId !== skill) return false;
  if (state !== ALL && entry.state !== state) return false;
  const needle = contextId.trim().toLowerCase();
  return needle === "" || entry.contextId.toLowerCase().includes(needle);
}

export function A2ALogView() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const rows = A2A_LOG.filter((entry) => matches(entry, filters));
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
        <FilterSelect label="에이전트" value={filters.agent} onChange={(agent) => set({ agent })} options={AGENT_OPTIONS} />
        <FilterSelect label="스킬" value={filters.skill} onChange={(skill) => set({ skill })} options={SKILL_OPTIONS} />
        <FilterSelect label="상태" value={filters.state} onChange={(state) => set({ state })} options={STATE_OPTIONS} />
        <Input
          label="contextId"
          value={filters.contextId}
          onChange={(event) => set({ contextId: event.target.value })}
          placeholder="req_01J9Z8"
          list={CONTEXT_LIST_ID}
          autoComplete="off"
        />
        <datalist id={CONTEXT_LIST_ID}>
          {CONTEXT_IDS.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-sp-3">
        <p role="status" aria-live="polite" className="text-label text-muted tabular-nums">
          {rows.length}건 (전체 {A2A_LOG.length}건)
        </p>
        {filtered ? (
          <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
            필터 초기화
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-body text-muted">조건에 맞는 호출이 없어요. 필터를 줄여 보세요.</p>
      ) : (
        <ul aria-label="A2A 호출" className="rounded-card border border-border-soft bg-elev">
          {rows.map((entry) => (
            <A2ALogRow
              key={entry.id}
              entry={entry}
              expanded={open.has(entry.id)}
              onToggle={() => toggle(entry.id)}
              onFilterContext={(contextId) => set({ contextId })}
            />
          ))}
        </ul>
      )}
    </>
  );
}
