import { listBookings } from "../agents/clinic/store";
import { sendMessage, A2AClientError } from "../a2a/client";
import { taskArtifactData, type WireTask } from "../a2a/wire";
import { clock } from "../clock";
import { proveOffer, toOfferProof } from "../zk/client";
import { ensurePlatformReady } from "./demo";
import { inProcessFetch } from "./in-process-fetch";

// Demo driver for 10 데모 2~6행: runs Yuki's request over real A2A calls (the agents answer, the log fills),
// for the /demo console while the customer screens still show their scripted data. It plays the customer
// agent's part with fixed inputs (cus_yuki_done); the customer agent module itself is WP6.

const YUKI = { agentId: "cag_7f3k2d", role: "customer" as const };
const PERSONA = "cus_yuki";
const base = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const ZK_EXT = "https://pibu.app/ext/zk-offer-proof/v1";
const REFERRAL_EXT = "https://pibu.app/ext/referral/v1";

interface Candidate {
  clinicId: string;
  agentCardUrl: string;
  referralToken: string;
}
interface Quote {
  quoteId: string;
  clinicId: string;
  procedureId: string;
  amount: { value: number; unit: string };
  priceKrw: number;
  vatIncluded: boolean;
  includes: string[];
  slots: string[];
  offerApplied?: unknown;
}

export interface ScenarioResult {
  requestId: string;
  steps: { step: string; state: string; detail?: string }[];
  quotes: Quote[];
  verdicts: unknown[];
  booking?: { taskId: string; clinicId: string; state: string };
}

const call = (skillId: Parameters<typeof sendMessage>[0]["skillId"], toCardUrl: string, contextId: string, data: Record<string, unknown>, extra: Partial<Parameters<typeof sendMessage>[0]> = {}) =>
  sendMessage({ from: YUKI, toCardUrl, skillId, contextId, data, fetchImpl: inProcessFetch, ...extra });

const stateOf = (task: WireTask) => task.status.state;

/** Yuki: recipe, match, offer proof for Mint when the ZK server answers, three quotes, judge, book Seoul Glow 11/14 11:00. */
export async function runYukiScenario(): Promise<ScenarioResult> {
  await ensurePlatformReady();
  const requestId = `req_demo_${clock.now().getTime().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const platformCard = `${base()}/a2a/platform/agent-card.json`;
  const result: ScenarioResult = { requestId, steps: [], quotes: [], verdicts: [] };

  const recipe = await call("platform.recipe", platformCard, requestId, {
    schema: "pibu/recipe-query@1",
    concerns: ["elasticity"],
    ageBand: "25-29",
    procedureIds: ["rejuran_healer"],
  });
  result.steps.push({ step: "platform.recipe", state: stateOf(recipe) });

  const request = {
    schema: "pibu/procedure-request@1",
    requestId,
    customerAgentId: YUKI.agentId,
    procedureId: "rejuran_healer",
    productPreference: "any",
    amount: { value: 2, unit: "cc" },
    budgetKrw: { max: 450000 },
    areas: ["sinsa", "gangnam", "apgujeong"],
    languages: ["ja"],
    dateWindow: { from: "2026-11-13", to: "2026-11-15" },
    visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
    notes: "Prefer short downtime, flying home on 11-15 evening",
  };
  const match = await call("platform.match_clinics", platformCard, requestId, request);
  result.steps.push({ step: "platform.match_clinics", state: stateOf(match) });
  if (stateOf(match) !== "TASK_STATE_COMPLETED") return result;
  const shortlist = taskArtifactData(match) as { matchId: string; candidates: Candidate[] };

  // The copy a clinic may see (03 필드 규칙): no notes, budget, residency or age band.
  const forClinic = {
    schema: request.schema,
    requestId,
    customerAgentId: request.customerAgentId,
    procedureId: request.procedureId,
    productPreference: request.productPreference,
    amount: request.amount,
    areas: request.areas,
    languages: request.languages,
    dateWindow: request.dateWindow,
    visitorProfile: { nationality: "JP", firstKProcedure: true },
  };

  // On device offer matching (INTEGRATION 4절): Yuki has no clinic confirmed record, so only Mint's first visit
  // offer applies. The proof comes from the ZK server when it runs; without it Mint quotes the regular price.
  let mintProof: unknown;
  try {
    const bundle = await Promise.race([
      proveOffer(PERSONA, "ofr_mint_rejuran_first_visit"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("zk server timeout")), 8000)),
    ]);
    mintProof = toOfferProof(bundle, "cln_mint");
    result.steps.push({ step: "zk.prove_offer", state: "ok", detail: "ofr_mint_rejuran_first_visit" });
  } catch (error) {
    result.steps.push({ step: "zk.prove_offer", state: "skipped", detail: error instanceof Error ? error.message : String(error) });
  }

  const settled = await Promise.allSettled(
    shortlist.candidates.map((candidate) => {
      const proof = candidate.clinicId === "cln_mint" ? mintProof : undefined;
      return call("clinic.quote", candidate.agentCardUrl, requestId, forClinic, {
        metadata: { referralToken: candidate.referralToken, ...(proof ? { offerProof: proof } : {}) },
        extensions: proof ? [REFERRAL_EXT, ZK_EXT] : [REFERRAL_EXT],
      });
    }),
  );
  settled.forEach((outcome, i) => {
    const clinicId = shortlist.candidates[i].clinicId;
    if (outcome.status === "rejected") {
      const reason = outcome.reason instanceof A2AClientError ? outcome.reason.kind : String(outcome.reason);
      result.steps.push({ step: `clinic.quote ${clinicId}`, state: "error", detail: reason });
      return;
    }
    result.steps.push({ step: `clinic.quote ${clinicId}`, state: stateOf(outcome.value) });
    const quote = taskArtifactData(outcome.value) as Quote | undefined;
    if (quote) result.quotes.push(quote);
  });
  if (result.quotes.length === 0) return result;

  const judged = await call("platform.judge_quote", platformCard, requestId, {
    schema: "pibu/judge-request@1",
    requestId,
    matchId: shortlist.matchId,
    quotes: result.quotes.map((q) => ({
      quoteId: q.quoteId,
      clinicId: q.clinicId,
      procedureId: q.procedureId,
      amount: q.amount,
      priceKrw: q.priceKrw,
      vatIncluded: q.vatIncluded,
      includes: q.includes,
    })),
  });
  result.steps.push({ step: "platform.judge_quote", state: stateOf(judged) });
  result.verdicts = ((taskArtifactData(judged) as { verdicts?: unknown[] } | undefined)?.verdicts ?? []) as unknown[];

  const glow = shortlist.candidates.find((c) => c.clinicId === "cln_seoul_glow");
  const glowQuote = result.quotes.find((q) => q.clinicId === "cln_seoul_glow");
  if (glow && glowQuote) {
    const slot = glowQuote.slots.find((s) => s.startsWith("2026-11-14T11:00")) ?? glowQuote.slots[0];
    const book = await call(
      "clinic.book",
      glow.agentCardUrl,
      requestId,
      {
        schema: "pibu/booking-request@1",
        requestId,
        quoteId: glowQuote.quoteId,
        clinicId: "cln_seoul_glow",
        slot,
        guest: { displayName: "Yuki T.", contactChannel: "line", contactHandle: "yuki_demo", language: "ja" },
        safetyInfo: { pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false },
        consentRef: "cns_0091",
      },
      { metadata: { referralToken: glow.referralToken, consentRef: "cns_0091" }, extensions: [REFERRAL_EXT, "https://pibu.app/ext/consent/v1"] },
    );
    result.steps.push({ step: "clinic.book", state: stateOf(book) });
    result.booking = { taskId: book.id, clinicId: "cln_seoul_glow", state: stateOf(book) };
  }
  return result;
}

// ---- 10 데모 6행: D0 outcome after the clock moved to the treatment day ----


/** Yuki's latest confirmed booking: D0 outcome to the platform, then the record anchor (ZK server, skipped if down). */
export async function submitYukiD0(): Promise<{ bookingId?: string; steps: { step: string; state: string; detail?: string }[] }> {
  const steps: { step: string; state: string; detail?: string }[] = [];
  const confirmed = (await listBookings({ status: "confirmed" }))
    .filter((b) => b.customerAgentId === YUKI.agentId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const booking = confirmed[0];
  if (!booking) return { steps: [{ step: "find_booking", state: "none", detail: "no confirmed Yuki booking" }] };
  const platformCard = `${base()}/a2a/platform/agent-card.json`;
  const contextId = booking.request.requestId;

  const outcome = await call("platform.submit_outcome", platformCard, contextId, {
    schema: "pibu/outcome@1",
    outcomeId: `out_${booking.id.replace(/^bkg_/, "")}_d0`,
    bookingId: booking.id,
    clinicId: booking.clinicId,
    procedureId: booking.procedureId,
    checkpoint: "D0",
    paidKrw: booking.priceKrw,
    receivedAmount: { value: 2, unit: "cc" },
    productVerified: "vial_shown",
    receiptAttached: true,
    satisfaction: 5,
    painScore: 3,
    downtimeDaysActual: null,
    wouldReturn: true,
    sideEffects: [],
    comment: "Explained everything in Japanese.",
    visitorProfile: { nationality: "JP", ageBand: "25-29" },
    submittedAt: clock.nowIso(),
  });
  steps.push({ step: "platform.submit_outcome", state: stateOf(outcome) });

  const anchor = await call("platform.anchor_record", platformCard, contextId, {
    schema: "pibu/record-anchor@1",
    bookingId: booking.id,
    clinicId: booking.clinicId,
    procedureId: booking.procedureId,
    subjectId: `0x${"0".repeat(64)}`,
    record: { day: Math.floor(clock.now().getTime() / 60000), recordNonce: "1", ticketCommitment: "1" },
    oldCommitment: "0x0",
    newCommitment: "0x0",
    recordHash: "0x0",
    proof: "0x0",
  }).catch((error: unknown) => error);
  if (anchor instanceof Error) steps.push({ step: "platform.anchor_record", state: "error", detail: anchor.message });
  else steps.push({ step: "platform.anchor_record", state: stateOf(anchor as WireTask) });
  return { bookingId: booking.id, steps };
}
