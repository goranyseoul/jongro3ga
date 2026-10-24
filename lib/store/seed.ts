import { z } from "zod";
import clinicsJson from "../../data/seed/clinics.json";
import customersJson from "../../data/seed/customers.json";
import fxJson from "../../data/seed/fx.json";
import krPatternsJson from "../../data/seed/kr-patterns.json";
import araBurstJson from "../../data/seed/outcomes-ara-burst.json";
import outcomesJson from "../../data/seed/outcomes.json";
import priceRecordsJson from "../../data/seed/price-records.json";
import rulesJson from "../../data/seed/rules.json";
import slotsJson from "../../data/seed/slots.json";
import verifiedVisitsJson from "../../data/seed/verified-visits.json";
import { clock } from "../clock";
import type { AgentIdentity, IsoDateTime, Outcome } from "../domain";
import { getProcedure } from "../domain/procedure-master";
import { COLLECTIONS, PLATFORM_AGENT_ID, clinicAgentId } from "./collections";
import type { MemoryStore } from "./memory";
import {
  AraBurstTemplateSchema,
  ClinicsSeedSchema,
  CustomersSeedSchema,
  FxRateSchema,
  KrPatternSchema,
  OutcomeSchema,
  PriceRecordSchema,
  RoutingRuleSchema,
  SlotSchema,
  VerifiedVisitsSeedSchema,
} from "./seed-schemas";
import { NAMESPACES, type Namespace, type StoreSnapshot } from "./types";

// Demo seed loader (06-data-model.md "시드 파일", 10-build-plan.md T03). Every file is validated with zod and
// cross-checked (ids that point at clinics, procedures and customers must exist) before anything is stored, so a
// broken seed fails at boot and not in the middle of the demo.

/** Origin the seed files were written with. agentCardUrl values start with it and get rewritten to `baseUrl`. */
export const SEED_BASE_URL = "http://localhost:3000";

export interface SeedOptions {
  /** PUBLIC_BASE_URL of this deployment, e.g. "http://localhost:3000". */
  baseUrl: string;
  /** tokenIssuedAt of the agent identities. Defaults to clock.nowIso(). */
  now?: IsoDateTime;
}

export function defaultBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.PUBLIC_BASE_URL || SEED_BASE_URL;
}

/** Raw seed file contents, keyed by file name. Tests use it to feed broken copies to validateSeed. */
export const SEED_FILES = {
  "clinics.json": clinicsJson,
  "slots.json": slotsJson,
  "price-records.json": priceRecordsJson,
  "outcomes.json": outcomesJson,
  "outcomes-ara-burst.json": araBurstJson,
  "customers.json": customersJson,
  "rules.json": rulesJson,
  "kr-patterns.json": krPatternsJson,
  "fx.json": fxJson,
  "verified-visits.json": verifiedVisitsJson,
} as const;
export type SeedFiles = { -readonly [K in keyof typeof SEED_FILES]: unknown };

const uniqueIds = (label: string) =>
  <T extends { id: string }>(list: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `${label}: duplicate id ${item.id}` });
      seen.add(item.id);
    }
  };

const FILE_SCHEMAS = {
  "clinics.json": ClinicsSeedSchema,
  "slots.json": z.array(SlotSchema).superRefine(uniqueIds("slots")),
  "price-records.json": z.array(PriceRecordSchema).superRefine(uniqueIds("price records")),
  "outcomes.json": z.array(OutcomeSchema).superRefine(uniqueIds("outcomes")),
  "outcomes-ara-burst.json": z.array(AraBurstTemplateSchema).superRefine(uniqueIds("burst")),
  "customers.json": CustomersSeedSchema,
  "rules.json": z.array(RoutingRuleSchema).superRefine(uniqueIds("rules")),
  "kr-patterns.json": z.array(KrPatternSchema).superRefine(uniqueIds("kr patterns")),
  "fx.json": z.array(FxRateSchema).superRefine(uniqueIds("fx")),
  "verified-visits.json": VerifiedVisitsSeedSchema,
} as const;

export type ParsedSeed = { [K in keyof typeof FILE_SCHEMAS]: z.infer<(typeof FILE_SCHEMAS)[K]> };

/**
 * Validates every seed file and the references between them. Throws one error listing every problem.
 * Pure: `files` defaults to the committed seed, tests pass modified copies.
 */
export function validateSeed(files: SeedFiles = SEED_FILES): ParsedSeed {
  const problems: string[] = [];
  const parsed = {} as Record<string, unknown>;
  for (const [name, schema] of Object.entries(FILE_SCHEMAS)) {
    const result = schema.safeParse(files[name as keyof SeedFiles]);
    if (result.success) parsed[name] = result.data;
    else for (const issue of result.error.issues) problems.push(`${name} ${issue.path.join(".")}: ${issue.message}`);
  }
  if (problems.length === 0) problems.push(...referenceProblems(parsed as ParsedSeed));
  if (problems.length > 0) throw new Error(`invalid seed:\n  ${problems.join("\n  ")}`);
  return parsed as ParsedSeed;
}

function referenceProblems(seed: ParsedSeed): string[] {
  const out: string[] = [];
  const clinics = seed["clinics.json"];
  const customers = seed["customers.json"];
  const clinicIds = new Set(clinics.registry.map((c) => c.id));
  const customerIds = new Set(customers.accounts.map((a) => a.id));
  const checkClinic = (where: string, id: string | undefined) => {
    if (id !== undefined && !clinicIds.has(id)) out.push(`${where}: unknown clinic ${id}`);
  };
  const checkProcedure = (where: string, id: string | undefined) => {
    if (id !== undefined && !getProcedure(id)) out.push(`${where}: unknown procedure ${id}`);
  };

  // every registry clinic has exactly one profile and one slot policy, with the same slug, area and languages
  for (const entry of clinics.registry) {
    const profiles = clinics.profiles.filter((p) => p.id === entry.id);
    const policies = clinics.slotPolicies.filter((p) => p.clinicId === entry.id);
    if (profiles.length !== 1) out.push(`clinics.json: ${entry.id} needs exactly one profile`);
    if (policies.length !== 1) out.push(`clinics.json: ${entry.id} needs exactly one slot policy`);
    const profile = profiles[0];
    if (profile && (profile.slug !== entry.slug || profile.area !== entry.area || profile.operationMode !== entry.operationMode))
      out.push(`clinics.json: ${entry.id} profile disagrees with the registry`);
    if (profile && JSON.stringify(profile.languages) !== JSON.stringify(entry.languages))
      out.push(`clinics.json: ${entry.id} profile languages disagree with the registry`);
    if (!entry.agentCardUrl.startsWith(`${SEED_BASE_URL}/a2a/clinics/${entry.slug}/`))
      out.push(`clinics.json: ${entry.id} agentCardUrl must be ${SEED_BASE_URL}/a2a/clinics/${entry.slug}/agent-card.json`);
  }
  for (const p of clinics.profiles) checkClinic(`clinics.json profile`, p.id);
  for (const m of clinics.menus) {
    checkClinic(`clinics.json menu ${m.id}`, m.clinicId);
    checkProcedure(`clinics.json menu ${m.id}`, m.procedureId);
  }
  for (const o of clinics.offers) {
    checkClinic(`clinics.json offer ${o.id}`, o.clinicId);
    checkProcedure(`clinics.json offer ${o.id}`, o.procedureId);
    for (const c of o.zkClauses ?? []) {
      checkClinic(`clinics.json offer ${o.id} zkClause`, c.clinicId);
      checkProcedure(`clinics.json offer ${o.id} zkClause`, c.type);
    }
  }
  for (const p of clinics.slotPolicies) {
    checkClinic(`clinics.json slot policy`, p.clinicId);
    for (const proc of Object.keys(p.durationMinByProcedure)) checkProcedure(`clinics.json slot policy ${p.clinicId}`, proc);
  }
  for (const s of seed["slots.json"]) {
    checkClinic(`slots.json ${s.id}`, s.clinicId);
    for (const proc of s.procedureIds) checkProcedure(`slots.json ${s.id}`, proc);
  }
  for (const r of seed["price-records.json"]) {
    checkClinic(`price-records.json ${r.id}`, r.clinicId);
    checkProcedure(`price-records.json ${r.id}`, r.procedureId);
  }
  for (const o of [...seed["outcomes.json"], ...seed["outcomes-ara-burst.json"]]) {
    checkClinic(`outcome ${o.id}`, o.clinicId);
    checkProcedure(`outcome ${o.id}`, o.procedureId);
    if (o.id !== o.outcomeId) out.push(`outcome ${o.id}: id must equal outcomeId`);
  }
  for (const p of customers.profiles) {
    const account = customers.accounts.find((a) => a.id === p.id);
    if (!account) out.push(`customers.json profile ${p.id}: no account`);
    else if (account.agentId !== p.agentId) out.push(`customers.json profile ${p.id}: agentId differs from the account`);
  }
  for (const c of customers.consents) if (!customerIds.has(c.customerId)) out.push(`customers.json consent ${c.id}: unknown customer`);
  for (const r of customers.records) {
    if (!customerIds.has(r.customerId)) out.push(`customers.json record ${r.id}: unknown customer`);
    checkClinic(`customers.json record ${r.id}`, r.clinicId);
    checkProcedure(`customers.json record ${r.id}`, r.procedureId);
  }
  for (const rule of seed["rules.json"]) {
    if ("clinicIds" in rule.then) for (const c of rule.then.clinicIds) checkClinic(`rules.json ${rule.id}`, c);
    for (const proc of rule.when.procedureIds ?? []) checkProcedure(`rules.json ${rule.id}`, proc);
  }
  for (const k of seed["kr-patterns.json"]) for (const proc of k.procedureIds) checkProcedure(`kr-patterns.json ${k.id}`, proc);
  const visits = seed["verified-visits.json"];
  for (const v of [...visits.verifiedVisits, ...visits.reviewStats]) {
    checkClinic(`verified-visits.json ${v.id}`, v.clinicId);
    checkProcedure(`verified-visits.json ${v.id}`, v.procedureId);
  }
  return out;
}

const withId = <T extends { id: string }>(items: readonly T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]));

const rebase = (url: string, baseUrl: string) =>
  url.startsWith(SEED_BASE_URL) ? `${baseUrl.replace(/\/+$/, "")}${url.slice(SEED_BASE_URL.length)}` : url;

/** The whole seed as a store snapshot, collection names from COLLECTIONS. Pure apart from the default `now`. */
export function buildSeedSnapshot(options: SeedOptions, files: SeedFiles = SEED_FILES): StoreSnapshot {
  const seed = validateSeed(files);
  const base = options.baseUrl.replace(/\/+$/, "");
  const now = options.now ?? clock.nowIso();
  const clinics = seed["clinics.json"];
  const customers = seed["customers.json"];
  const visits = seed["verified-visits.json"];

  const identities: (AgentIdentity & { id: string })[] = [
    { id: PLATFORM_AGENT_ID, agentId: PLATFORM_AGENT_ID, role: "platform", cardUrl: `${base}/a2a/platform/agent-card.json`, ownerId: "pibu", tokenIssuedAt: now },
    ...clinics.registry.map((entry) => ({
      id: clinicAgentId(entry.id),
      agentId: clinicAgentId(entry.id),
      role: "clinic" as const,
      cardUrl: `${base}/a2a/clinics/${entry.slug}/agent-card.json`,
      ownerId: entry.id,
      tokenIssuedAt: now,
    })),
    ...customers.accounts.map((account) => ({
      id: account.agentId,
      agentId: account.agentId,
      role: "customer" as const,
      cardUrl: `${base}/a2a/customers/${account.agentId}/agent-card.json`,
      ownerId: account.id,
      tokenIssuedAt: now,
    })),
  ];

  const snapshot = Object.fromEntries(NAMESPACES.map((ns) => [ns, {}])) as StoreSnapshot;
  const set = (ns: Namespace, collection: string, items: readonly { id: string }[]) => {
    snapshot[ns][collection] = withId(items);
  };
  const { customer: C, platform: P, clinic: K, shared: S } = COLLECTIONS;

  set("customer", C.accounts, customers.accounts);
  set("customer", C.profiles, customers.profiles);
  set("customer", C.consents, customers.consents);
  set("customer", C.records, customers.records);

  set("platform", P.clinicRegistry, clinics.registry.map((entry) => ({ ...entry, agentCardUrl: rebase(entry.agentCardUrl, base) })));
  set("platform", P.priceRecords, seed["price-records.json"]);
  set("platform", P.outcomes, seed["outcomes.json"]);
  set("platform", P.rules, seed["rules.json"]);
  set("platform", P.krPatterns, seed["kr-patterns.json"]);
  set("platform", P.fx, seed["fx.json"]);
  set("platform", P.verifiedVisits, visits.verifiedVisits);
  set("platform", P.reviewStats, visits.reviewStats);

  set("clinic", K.profiles, clinics.profiles);
  set("clinic", K.menuItems, clinics.menus);
  set("clinic", K.offers, clinics.offers);
  set("clinic", K.slotPolicies, clinics.slotPolicies.map((policy) => ({ id: policy.clinicId, ...policy })));
  set("clinic", K.slots, seed["slots.json"]);

  set("shared", S.agentIdentities, identities);
  return snapshot;
}

/**
 * Replaces everything in `store` with the seed. Synchronous (MemoryStore.restore), so getStore() can seed on
 * first use without becoming async.
 */
export function loadSeed(store: Pick<MemoryStore, "restore">, options: SeedOptions): void {
  store.restore(buildSeedSnapshot(options));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const toKstIso = (ms: number): IsoDateTime => `${new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 19)}+09:00`;

/**
 * The demo control's "결과 20건 주입" (10 demo row 7): the 20 Ara burst outcomes dated `daysAgo` days before
 * `now`, same time of day. Callers put them into platform.outcomes themselves (they do not create PriceRecords, 07).
 */
export function materializeAraBurst(now: Date = clock.now()): Outcome[] {
  const templates = z.array(AraBurstTemplateSchema).parse(araBurstJson);
  return templates.map(({ daysAgo, ...template }) => {
    const at = toKstIso(now.getTime() - daysAgo * DAY_MS);
    return OutcomeSchema.parse({ ...template, submittedAt: at, receivedAt: at });
  });
}
