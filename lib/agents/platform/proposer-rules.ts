// Routing rule lifecycle for /ops/rules (07-platform-intelligence.md section 4): proposed -> active
// (approve) or rejected (reject), active -> retired (retire or expiry). Every change bumps `version` and
// stores a full copy in the history collection; nothing is ever deleted (guardrail 5).
import { clock } from "../../clock";
import type { ClinicRegistryEntry, RoutingRule } from "../../domain/platform";
import type { Store } from "../../store/types";
import { DAY_MS, PLATFORM_COLLECTIONS, toKstIso } from "./signals";

/** exclude_clinic rules expire after this many days unless renewed (guardrail 3). */
export const EXCLUDE_TTL_DAYS = 90;
/** Active rules this close to expiry are flagged for review on /ops/rules. */
export const REVIEW_BEFORE_DAYS = 7;

export type RuleEvent = "proposed" | "approved" | "rejected" | "retired" | "expired";

/** A stored rule. The extra fields are ops bookkeeping; matching only needs the RoutingRule part. */
export interface OpsRule extends RoutingRule {
  /** Side effect trigger: proposed with the clinic already suspended, waiting for the operator. */
  urgent?: boolean;
  /** Which deterministic trigger produced it, or "claude_extra". */
  trigger?: string;
  candidateKey?: string;
  /** Registry statuses the emergency suspension replaced, restored if the operator rejects or retires. */
  suspension?: { clinicIds: string[]; previous: Record<string, ClinicRegistryEntry["verificationStatus"]>; at: string };
  closedAt?: string;
  closedBy?: string;
}

export interface RuleHistoryEntry {
  /** `${ruleId}@v${version}` */
  id: string;
  ruleId: string;
  version: number;
  event: RuleEvent;
  by: string;
  at: string;
  rule: OpsRule;
}

export class RuleTransitionError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_transition",
    message: string,
  ) {
    super(message);
    this.name = "RuleTransitionError";
  }
}

const RULES = PLATFORM_COLLECTIONS.rules;
const HISTORY = PLATFORM_COLLECTIONS.ruleHistory;

export async function listRules(store: Store, status?: RoutingRule["status"]): Promise<OpsRule[]> {
  const rules = await store.list<OpsRule>("platform", RULES);
  return status ? rules.filter((rule) => rule.status === status) : rules;
}

export async function getRule(store: Store, id: string): Promise<OpsRule | undefined> {
  return store.get<OpsRule>("platform", RULES, id);
}

export async function listRuleHistory(store: Store, ruleId?: string): Promise<RuleHistoryEntry[]> {
  const entries = await store.list<RuleHistoryEntry>("platform", HISTORY);
  return (ruleId ? entries.filter((entry) => entry.ruleId === ruleId) : entries).sort(
    (a, b) => a.ruleId.localeCompare(b.ruleId) || a.version - b.version,
  );
}

/** "rule_003" after rule_001 and rule_002. Seeds and proposals share one sequence. */
export async function nextRuleId(store: Store): Promise<string> {
  const rules = await store.list<OpsRule>("platform", RULES);
  const max = rules.reduce((highest, rule) => {
    const n = Number(/^rule_(\d+)$/.exec(rule.id)?.[1] ?? 0);
    return Math.max(highest, n);
  }, 0);
  return `rule_${String(max + 1).padStart(3, "0")}`;
}

async function write(store: Store, rule: OpsRule, event: RuleEvent, by: string, at: string): Promise<OpsRule> {
  await store.put("platform", RULES, rule);
  const entry: RuleHistoryEntry = { id: `${rule.id}@v${rule.version}`, ruleId: rule.id, version: rule.version, event, by, at, rule };
  await store.put("platform", HISTORY, entry);
  return rule;
}

/** Stores a new proposal as version 1. */
export async function saveProposedRule(store: Store, rule: OpsRule, by: string): Promise<OpsRule> {
  if (await getRule(store, rule.id)) throw new RuleTransitionError("invalid_transition", `rule ${rule.id} already exists`);
  return write(store, { ...rule, status: "proposed", version: 1 }, "proposed", by, rule.createdAt);
}

async function transition(
  store: Store,
  id: string,
  from: RoutingRule["status"],
  to: RoutingRule["status"],
  event: RuleEvent,
  by: string,
  now: Date,
  patch: (rule: OpsRule, at: string) => Partial<OpsRule>,
): Promise<OpsRule> {
  const rule = await getRule(store, id);
  if (!rule) throw new RuleTransitionError("not_found", `rule ${id} not found`);
  if (rule.status !== from) throw new RuleTransitionError("invalid_transition", `rule ${id} is ${rule.status}, expected ${from}`);
  const at = toKstIso(now);
  const next: OpsRule = { ...rule, ...patch(rule, at), status: to, version: rule.version + 1 };
  return write(store, next, event, by, at);
}

/** Puts the registry statuses back that an emergency suspension replaced, unless someone changed them since. */
async function liftSuspension(store: Store, rule: OpsRule): Promise<void> {
  if (!rule.suspension) return;
  for (const clinicId of rule.suspension.clinicIds) {
    const entry = await store.get<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry, clinicId);
    if (!entry || entry.verificationStatus !== "suspended") continue;
    await store.put("platform", PLATFORM_COLLECTIONS.registry, { ...entry, verificationStatus: rule.suspension.previous[clinicId] ?? "verified" });
  }
}

export async function approveRule(store: Store, id: string, by: string, now: Date = clock.now()): Promise<OpsRule> {
  return transition(store, id, "proposed", "active", "approved", by, now, (rule, at) => ({
    approvedBy: by,
    activatedAt: at,
    expiresAt: rule.then.kind === "exclude_clinic" ? toKstIso(new Date(now.getTime() + EXCLUDE_TTL_DAYS * DAY_MS)) : rule.expiresAt,
  }));
}

export async function rejectRule(store: Store, id: string, by: string, now: Date = clock.now()): Promise<OpsRule> {
  const rule = await transition(store, id, "proposed", "rejected", "rejected", by, now, (_, at) => ({ closedAt: at, closedBy: by }));
  await liftSuspension(store, rule);
  return rule;
}

export async function retireRule(store: Store, id: string, by: string, now: Date = clock.now()): Promise<OpsRule> {
  const rule = await transition(store, id, "active", "retired", "retired", by, now, (_, at) => ({ closedAt: at, closedBy: by }));
  await liftSuspension(store, rule);
  return rule;
}

/** Retires active rules whose expiresAt has passed. Returns the ids it retired. */
export async function expireRules(store: Store, now: Date = clock.now()): Promise<string[]> {
  const expired = (await listRules(store, "active")).filter((rule) => rule.expiresAt && Date.parse(rule.expiresAt) <= now.getTime());
  for (const rule of expired) {
    await transition(store, rule.id, "active", "retired", "expired", "system", now, (_, at) => ({ closedAt: at, closedBy: "system" }));
  }
  return expired.map((rule) => rule.id);
}

/** Whole days until an active rule expires, or null when it has no expiry. */
export function daysToExpiry(rule: OpsRule, now: Date = clock.now()): number | null {
  if (!rule.expiresAt) return null;
  return Math.ceil((Date.parse(rule.expiresAt) - now.getTime()) / DAY_MS);
}

export function reviewDue(rule: OpsRule, now: Date = clock.now()): boolean {
  const days = daysToExpiry(rule, now);
  return rule.status === "active" && days !== null && days <= REVIEW_BEFORE_DAYS;
}
