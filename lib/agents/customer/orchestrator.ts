import { EXT, agentUrls } from "../../a2a/cards";
import { A2AClientError, fetchAgentCard, sendMessage, type AgentRef } from "../../a2a/client";
import {
  ClinicShortlistV1Schema,
  FairnessVerdictListV1Schema,
  QuoteV1Schema,
  type ClinicShortlistV1,
  type OffersV1,
} from "../../a2a/schemas";
import { taskArtifactData, type WireTask } from "../../a2a/wire";
import { clock } from "../../clock";
import type { ConsentEntry } from "../../domain";
import type { PublicOffer } from "../../zk/browser/offers";
import { CONSENT_EXT, forClinic, forPlatform, requestConsentRef } from "./consent";
import { stepText, type StepCopyKey } from "./copy";
import { summarizeRequest } from "./summary";
import { customerStore, type RequestStep, type StoredQuote, type StoredRequest } from "./store";
import {
  buildChart,
  chainToday,
  loadOfferCatalog,
  parseOffers,
  personaOf,
  planOffers,
  proveItem,
  type OfferProofMetadata,
} from "./zk-match";

// 대화 대행 (02 1절, 03 "전체 시퀀스", 09 런타임 구성, 10 T08 and the customer side of T18).
//
//   matching   platform.match_clinics with the platform copy of the request (consent ledger, consent.ts)
//   quoting    clinic.offers per candidate -> device side offer matching -> proofs for eligible offers only
//              -> clinic.quote to every candidate in parallel with the clinic copy, the referral token and,
//              where an offer holds, metadata.offerProof. Timeouts and rejections go to platform.report_signal
//   judging    platform.judge_quote with every quote received
//   comparing  quotes and verdicts stored; the comparison summary in the customer's language
//   failed     not eligible, no consent, platform refused or down, or no clinic answered
//
// The caller does not need to await: the status of the CustomerRequest moves step by step and the screen polls it
// (09). Every call of one request carries contextId = requestId, so the A2A log is the timeline; steps that are
// not A2A calls (device side matching, proofs) are written to `steps`.

export interface RunOptions {
  /** fetch for every A2A call. Tests pass lib/a2a/__fixtures__/route-fetch.ts. */
  fetchImpl?: typeof fetch;
  /** Deadline of each clinic call (offers and quote). Default 20000 (03 "에러 처리": 20 seconds). */
  timeoutMs?: number;
  /** The wallet server's public offer catalog (offer ids). Default: GET {ZK_SERVER_URL}/api/offers. */
  offerCatalog?: () => Promise<PublicOffer[]>;
  /** Write the comparison summary (summary.ts) at the end. Default true. */
  summarize?: boolean;
}

const CLINIC_TIMEOUT_MS = 20_000;
const NOT_ELIGIBLE = "not_eligible_foreign_patient";

const isA2AError = (error: unknown): error is A2AClientError => error instanceof A2AClientError;
const statusText = (task: WireTask): string =>
  (task.status.message?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string")
    .join(" ");

interface Run {
  request: StoredRequest;
  from: AgentRef;
  consents: ConsentEntry[];
  opts: RunOptions;
}

async function save(run: Run, patch: Partial<StoredRequest> = {}): Promise<void> {
  Object.assign(run.request, patch, { updatedAt: clock.nowIso() });
  await customerStore.putRequest(run.request);
}

function step(run: Run, kind: RequestStep["kind"], copy: StepCopyKey, clinicId?: string): void {
  run.request.steps.push({ at: clock.nowIso(), kind, ...(clinicId ? { clinicId } : {}), text: stepText(copy, clinicId ? { clinicId } : {}) });
}

async function fail(run: Run, reason: string): Promise<StoredRequest> {
  await save(run, { status: "failed", failure: { reason, at: clock.nowIso() } });
  return run.request;
}

const fetchOpt = (opts: RunOptions) => (opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {});

/** Runs the request from matching to comparing. Resolves with the final request; never rejects for a remote failure. */
export async function runRequest(requestId: string, opts: RunOptions = {}): Promise<StoredRequest> {
  const request = await customerStore.request(requestId);
  if (!request) throw new Error(`no request ${requestId}`);
  const account = await customerStore.account(request.customerId);
  if (!account) throw new Error(`no customer ${request.customerId}`);

  // A rerun (demo row 8) starts clean: old quotes, steps and failure go.
  for (const old of await customerStore.quotes(requestId)) await customerStore.removeQuote(old.id);
  const fresh: StoredRequest = { ...request, steps: [], status: "matching" };
  delete fresh.failure;
  delete fresh.shortlist;
  delete fresh.summary;
  delete fresh.matchId;
  const run: Run = {
    request: fresh,
    from: { agentId: account.agentId, role: "customer" },
    consents: await customerStore.consents(request.customerId),
    opts,
  };

  // Korean nationals are never matched (08 2절). Their request cannot even form a platform copy (no residency).
  if (run.request.request.visitorProfile.nationality === "KR") {
    step(run, "eligibility", "not_eligible");
    return fail(run, NOT_ELIGIBLE);
  }
  const consentRef = requestConsentRef(run.consents);
  if (!consentRef) {
    step(run, "consent", "consent_missing");
    return fail(run, "consent_missing");
  }
  await save(run);

  const shortlist = await match(run, consentRef);
  if (!shortlist) return run.request;
  await save(run, { status: "quoting", shortlist, matchId: shortlist.matchId });

  const proofs = await prepareProofs(run, shortlist);
  await save(run);
  const quotes = await collectQuotes(run, shortlist, consentRef, proofs);
  await save(run);
  if (quotes.length === 0) return fail(run, "no_quotes");

  await save(run, { status: "judging" });
  await judge(run, shortlist, quotes);
  await save(run, { status: "comparing" });

  if (opts.summarize !== false) {
    try {
      await summarizeRequest(requestId);
      const latest = await customerStore.request(requestId);
      if (latest?.summary) run.request.summary = latest.summary;
    } catch {
      // The comparison works without the sentence; the screen shows the table.
    }
  }
  return run.request;
}

// ---- matching ----

async function match(run: Run, consentRef: string): Promise<ClinicShortlistV1 | undefined> {
  const request = run.request.request;
  let task: WireTask;
  try {
    task = await sendMessage({
      from: run.from,
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.match_clinics",
      data: forPlatform(request),
      text: `Match clinics for ${request.procedureId} ${request.amount.value}${request.amount.unit}`,
      contextId: run.request.id,
      metadata: { consentRef },
      extensions: [CONSENT_EXT],
      ...fetchOpt(run.opts),
    });
  } catch (error) {
    await fail(run, `platform_unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  if (task.status.state === "TASK_STATE_REJECTED") {
    if (statusText(task) === NOT_ELIGIBLE) step(run, "eligibility", "not_eligible");
    await fail(run, statusText(task) || "match_rejected");
    return undefined;
  }
  if (task.status.state !== "TASK_STATE_COMPLETED") {
    await fail(run, `platform_${task.status.state.replace("TASK_STATE_", "").toLowerCase()}: ${statusText(task)}`.trim());
    return undefined;
  }
  const parsed = ClinicShortlistV1Schema.safeParse(taskArtifactData(task));
  if (!parsed.success) {
    await fail(run, "platform_invalid_shortlist");
    return undefined;
  }
  if (parsed.data.candidates.length === 0) {
    await fail(run, "no_candidates");
    return undefined;
  }
  return parsed.data;
}

// ---- device side offer matching and proofs (T18) ----

/** Extension URIs an agent's card declares; empty when the card cannot be read. */
async function cardExtensions(url: string, run: Run): Promise<string[]> {
  try {
    const card = await fetchAgentCard(url, { from: run.from, timeoutMs: run.opts.timeoutMs ?? CLINIC_TIMEOUT_MS, ...fetchOpt(run.opts) });
    return (card.capabilities.extensions ?? []).map((e) => e.uri);
  } catch {
    return [];
  }
}

async function fetchOffers(run: Run, cardUrl: string): Promise<OffersV1 | undefined> {
  try {
    const task = await sendMessage({
      from: run.from,
      toCardUrl: cardUrl,
      skillId: "clinic.offers",
      data: { schema: "pibu/offers-query@1", month: clock.today().slice(0, 7) },
      contextId: run.request.id,
      timeoutMs: run.opts.timeoutMs ?? CLINIC_TIMEOUT_MS,
      ...fetchOpt(run.opts),
    });
    return task.status.state === "TASK_STATE_COMPLETED" ? parseOffers(taskArtifactData(task)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Offer proofs per clinic. A clinic gets a proof only when its card declares the zk-offer-proof extension, its
 * offer clauses hold on the local chart and the wallet server could prove it. Nothing is asked for the others.
 */
async function prepareProofs(run: Run, shortlist: ClinicShortlistV1): Promise<Map<string, OfferProofMetadata>> {
  const proofs = new Map<string, OfferProofMetadata>();
  const withZk: Array<{ clinicId: string; cardUrl: string }> = [];
  await Promise.all(
    shortlist.candidates.map(async (c) => {
      const extensions = await cardExtensions(c.agentCardUrl, run);
      if (extensions.includes(EXT.zkOfferProof)) withZk.push({ clinicId: c.clinicId, cardUrl: c.agentCardUrl });
    }),
  );
  if (withZk.length === 0) return proofs;

  const offersByClinic = new Map<string, OffersV1>();
  await Promise.all(
    withZk.map(async ({ clinicId, cardUrl }) => {
      const offers = await fetchOffers(run, cardUrl);
      if (offers && offers.clinicId === clinicId) offersByClinic.set(clinicId, offers);
    }),
  );
  // Keep the shortlist order for the steps.
  const ordered = new Map(shortlist.candidates.flatMap((c) => (offersByClinic.has(c.clinicId) ? [[c.clinicId, offersByClinic.get(c.clinicId)!] as const] : [])));

  const today = chainToday(clock.now());
  const chart = buildChart(await customerStore.records(run.request.customerId), today, clock.today());
  const plans = planOffers({ chart, today, todayDate: clock.today(), procedureId: run.request.request.procedureId, offersByClinic: ordered });
  if (plans.length === 0) return proofs;

  const eligible = plans.filter((p) => p.eligible.length > 0);
  for (const plan of plans) step(run, "offer_match", plan.eligible.length > 0 ? "offer_eligible" : "offer_not_eligible", plan.clinicId);
  if (eligible.length === 0) return proofs;

  const catalog = await (run.opts.offerCatalog ?? (() => loadOfferCatalog()))().catch(() => [] as PublicOffer[]);
  const persona = personaOf(run.request.customerId);
  const results = await Promise.all(eligible.map(async (plan) => ({ plan, result: await proveItem(persona, plan.eligible[0]!, catalog) })));
  for (const { plan, result } of results) {
    if (result.ok) {
      proofs.set(plan.clinicId, result.proof);
      step(run, "proof_attached", "proof_attached", plan.clinicId);
    } else {
      step(run, "proof_skipped", "proof_skipped", plan.clinicId);
    }
  }
  return proofs;
}

// ---- quotes ----

async function reportSignal(run: Run, clinicId: string, kind: "response_timeout" | "rejection", taskId?: string): Promise<void> {
  try {
    await sendMessage({
      from: run.from,
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.report_signal",
      data: {
        schema: "pibu/signal-report@1",
        clinicId,
        kind,
        ...(taskId ? { taskId } : {}),
        requestId: run.request.id,
        at: clock.nowIso(),
      },
      contextId: run.request.id,
      ...fetchOpt(run.opts),
    });
  } catch {
    // A lost signal only costs the platform one data point.
  }
}

async function collectQuotes(
  run: Run,
  shortlist: ClinicShortlistV1,
  consentRef: string,
  proofs: ReadonlyMap<string, OfferProofMetadata>,
): Promise<StoredQuote[]> {
  const request = run.request.request;
  const data = forClinic(request);
  const settled = await Promise.allSettled(
    shortlist.candidates.map((c) => {
      const proof = proofs.get(c.clinicId);
      return sendMessage({
        from: run.from,
        toCardUrl: c.agentCardUrl,
        skillId: "clinic.quote",
        data,
        text: `Quote request for ${request.procedureId} ${request.amount.value}${request.amount.unit}, ${request.dateWindow.from}~${request.dateWindow.to}`,
        contextId: run.request.id,
        metadata: { referralToken: c.referralToken, consentRef, ...(proof ? { offerProof: proof } : {}) },
        extensions: [EXT.referral, CONSENT_EXT, ...(proof ? [EXT.zkOfferProof] : [])],
        timeoutMs: run.opts.timeoutMs ?? CLINIC_TIMEOUT_MS,
        ...fetchOpt(run.opts),
      });
    }),
  );

  const quotes: StoredQuote[] = [];
  const signals: Promise<void>[] = [];
  settled.forEach((result, rank) => {
    const candidate = shortlist.candidates[rank]!;
    if (result.status === "rejected") {
      const error = result.reason;
      if (isA2AError(error) && (error.kind === "timeout" || error.kind === "network")) {
        step(run, "quote_missing", "quote_timeout", candidate.clinicId);
        signals.push(reportSignal(run, candidate.clinicId, "response_timeout"));
      }
      return;
    }
    const task = result.value;
    if (task.status.state === "TASK_STATE_REJECTED") {
      step(run, "quote_missing", "quote_rejected", candidate.clinicId);
      signals.push(reportSignal(run, candidate.clinicId, "rejection", task.id));
      return;
    }
    if (task.status.state !== "TASK_STATE_COMPLETED") return;
    const parsed = QuoteV1Schema.safeParse(taskArtifactData(task));
    if (!parsed.success || parsed.data.clinicId !== candidate.clinicId || parsed.data.requestId !== request.requestId) return;
    quotes.push({ id: parsed.data.quoteId, requestId: run.request.id, quote: parsed.data, taskId: task.id, receivedAt: clock.nowIso(), rank });
  });
  await Promise.all(signals);
  for (const quote of quotes) await customerStore.putQuote(quote);
  return quotes;
}

// ---- verdicts ----

async function judge(run: Run, shortlist: ClinicShortlistV1, quotes: StoredQuote[]): Promise<void> {
  let task: WireTask;
  try {
    task = await sendMessage({
      from: run.from,
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.judge_quote",
      data: {
        schema: "pibu/judge-request@1",
        requestId: run.request.id,
        matchId: shortlist.matchId,
        quotes: quotes.map(({ quote: q }) => ({
          quoteId: q.quoteId,
          clinicId: q.clinicId,
          procedureId: q.procedureId,
          amount: q.amount,
          priceKrw: q.priceKrw,
          vatIncluded: q.vatIncluded,
          includes: q.includes,
        })),
      },
      contextId: run.request.id,
      ...fetchOpt(run.opts),
    });
  } catch {
    return; // The comparison shows the quotes without labels; the agent never judges prices itself (02).
  }
  if (task.status.state !== "TASK_STATE_COMPLETED") return;
  const parsed = FairnessVerdictListV1Schema.safeParse(taskArtifactData(task));
  if (!parsed.success) return;
  for (const quote of quotes) {
    const verdict = parsed.data.verdicts.find((v) => v.quoteId === quote.id);
    if (verdict) await customerStore.putQuote({ ...quote, verdict });
  }
}

// ---- reads for the screens (WP7) ----

/** The request with its quotes in shortlist order, for GET /api/customer/requests/[id]. */
export async function getRequestView(requestId: string): Promise<{ request: StoredRequest; quotes: StoredQuote[] } | undefined> {
  const request = await customerStore.request(requestId);
  if (!request) return undefined;
  return { request, quotes: await customerStore.quotes(requestId) };
}

/** The customer's requests, newest first. */
export async function listRequests(customerId: string): Promise<StoredRequest[]> {
  return (await customerStore.requests(customerId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
