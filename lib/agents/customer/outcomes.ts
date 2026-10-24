import { agentUrls } from "../../a2a/cards";
import { sendMessage, type AgentRef } from "../../a2a/client";
import { OutcomeV1Schema, type OutcomeV1 } from "../../a2a/schemas";
import { taskArtifactText, type WireTask } from "../../a2a/wire";
import { clock } from "../../clock";
import type { OutcomeDraft, TreatmentRecord } from "../../domain";
import { walletView } from "../../zk/client";
import { stepText } from "./copy";
import { renumberSeries } from "./records";
import { customerStore, findBooking, newId, outcomeDraftId, type StoredBooking } from "./store";
import { chainToday, personaOf } from "./zk-match";

// 결과 기록 (02 1절, 03 outcome@1 and record-anchor@1, 10 demo row 6).
//
//   submitOutcome  OutcomeDraft.outcome stored -> platform.submit_outcome -> sentAt
//                  D0: platform.anchor_record right after (INTEGRATION 4 step 4) -> TreatmentRecord.anchor
//                  then the record takes the paid price and received amount and its next due date is recomputed
//
// P0 is the server wallet transition (BUILD-LOG 23 (9)): the platform relays and glowpass makes the append proof,
// so record-anchor@1 carries the wallet's subjectId and placeholders for the proof fields.

/** What the customer enters on the outcome screen (/[locale]/outcomes/[bookingId]). */
export interface OutcomeInput {
  checkpoint: OutcomeDraft["checkpoint"];
  paidKrw: number;
  receivedAmount: OutcomeV1["receivedAmount"];
  productVerified: string;
  receiptAttached: boolean;
  satisfaction: number;
  painScore: number;
  downtimeDaysActual?: number | null;
  wouldReturn: boolean;
  sideEffects?: string[];
  comment?: string;
}

export type AnchorResult =
  | { anchored: true; tx: string; version: number; subjectId: string }
  | { anchored: false; reason: string };

export interface SubmitResult {
  draft: OutcomeDraft;
  /** platform.submit_outcome answered COMPLETED. */
  sent: boolean;
  /** The platform's text (confirmation or rejection reason). */
  platformText?: string;
  /** D0 only. */
  anchor?: AnchorResult;
  record?: TreatmentRecord;
}

const fetchOpt = (opts: { fetchImpl?: typeof fetch }) => (opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {});

const statusText = (task: WireTask): string =>
  (task.status.message?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string")
    .join(" ");

/** pibu/outcome@1 from the screen input, the booking and the profile. Throws on invalid input. */
export async function buildOutcome(booking: StoredBooking, input: OutcomeInput, outcomeId: string = newId("out")): Promise<OutcomeV1> {
  const wire = booking.booking;
  if (!wire) throw new Error(`booking ${booking.id} is not confirmed yet`);
  const profile = await customerStore.profile(booking.customerId);
  if (!profile) throw new Error(`no profile ${booking.customerId}`);
  return OutcomeV1Schema.parse({
    schema: "pibu/outcome@1",
    outcomeId,
    bookingId: wire.bookingId,
    clinicId: wire.clinicId,
    procedureId: booking.procedureId,
    checkpoint: input.checkpoint,
    paidKrw: input.paidKrw,
    receivedAmount: input.receivedAmount,
    productVerified: input.productVerified,
    receiptAttached: input.receiptAttached,
    satisfaction: input.satisfaction,
    painScore: input.painScore,
    downtimeDaysActual: input.downtimeDaysActual ?? null,
    wouldReturn: input.wouldReturn,
    sideEffects: input.sideEffects ?? [],
    ...(input.comment ? { comment: input.comment } : {}),
    visitorProfile: { nationality: profile.nationality, ageBand: profile.ageBand },
    submittedAt: clock.nowIso(),
  });
}

/** Stores the outcome draft and sends it to the platform; for D0 anchors the visit and updates the record. */
export async function submitOutcome(bookingId: string, input: OutcomeInput, opts: { fetchImpl?: typeof fetch } = {}): Promise<SubmitResult> {
  const booking = await findBooking(bookingId);
  if (!booking?.booking) throw new Error(`booking ${bookingId} is not confirmed`);
  const account = await customerStore.account(booking.customerId);
  if (!account) throw new Error(`no customer ${booking.customerId}`);
  const from: AgentRef = { agentId: account.agentId, role: "customer" };

  const draftId = outcomeDraftId(booking.booking.bookingId, input.checkpoint);
  const previous = await customerStore.outcomeDraft(draftId);
  const outcome = await buildOutcome(booking, input, previous?.outcome?.outcomeId);
  let draft: OutcomeDraft = {
    id: draftId,
    bookingId: booking.booking.bookingId,
    checkpoint: input.checkpoint,
    dueAt: previous?.dueAt ?? booking.slot,
    outcome,
  };
  await customerStore.putOutcomeDraft(draft);

  let sent = false;
  let platformText: string | undefined;
  try {
    const task = await sendMessage({
      from,
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.submit_outcome",
      data: outcome,
      text: `Outcome ${input.checkpoint} for ${outcome.bookingId}`,
      contextId: booking.requestId,
      ...fetchOpt(opts),
    });
    sent = task.status.state === "TASK_STATE_COMPLETED";
    platformText = sent ? taskArtifactText(task) : statusText(task) || task.status.state;
  } catch (error) {
    platformText = error instanceof Error ? error.message : String(error);
  }
  if (sent) {
    draft = { ...draft, sentAt: clock.nowIso() };
    await customerStore.putOutcomeDraft(draft);
  }

  const result: SubmitResult = { draft, sent, ...(platformText ? { platformText } : {}) };
  if (input.checkpoint !== "D0") return result;

  if (sent) result.anchor = await anchor(booking, from, opts);
  const record = await updateRecordFromOutcome(booking, outcome, result.anchor);
  if (record) result.record = record;
  return result;
}

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const HEX = /^0x[0-9a-fA-F]+$/;

/** platform.anchor_record for a D0 visit. A wallet that cannot be read skips the anchor (a step says why). */
async function anchor(booking: StoredBooking, from: AgentRef, opts: { fetchImpl?: typeof fetch }): Promise<AnchorResult> {
  const wire = booking.booking!;
  const persona = personaOf(booking.customerId);
  let view;
  try {
    view = await walletView(persona);
  } catch (error) {
    const reason = `wallet_unreachable: ${error instanceof Error ? error.message : String(error)}`;
    await addStep(booking.requestId, "anchor_skipped", wire.clinicId);
    return { anchored: false, reason };
  }
  if (!HEX32.test(view.onchain.subjectId)) {
    await addStep(booking.requestId, "anchor_skipped", wire.clinicId);
    return { anchored: false, reason: "wallet_without_subject" };
  }
  try {
    const task = await sendMessage({
      from,
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.anchor_record",
      data: {
        schema: "pibu/record-anchor@1",
        bookingId: wire.bookingId,
        clinicId: wire.clinicId,
        procedureId: booking.procedureId,
        subjectId: view.onchain.subjectId,
        // P0 server wallet: glowpass builds the append proof itself, these are placeholders (BUILD-LOG 23 (9)).
        record: { day: chainToday(clock.now()), recordNonce: "0", ticketCommitment: "0" },
        oldCommitment: HEX.test(view.onchain.commitment) ? view.onchain.commitment : "0x0",
        newCommitment: "0x0",
        recordHash: "0x0",
        proof: "0x0",
      },
      text: `Anchor the visit of ${wire.bookingId}`,
      contextId: booking.requestId,
      ...fetchOpt(opts),
    });
    const text = task.status.state === "TASK_STATE_COMPLETED" ? (taskArtifactText(task) ?? "") : statusText(task);
    const tx = /^anchored\s+(\S+)/.exec(text)?.[1];
    if (task.status.state !== "TASK_STATE_COMPLETED" || !tx) return { anchored: false, reason: text || task.status.state };
    await addStep(booking.requestId, "record_anchored", wire.clinicId);
    return { anchored: true, tx, version: view.onchain.version + 1, subjectId: view.onchain.subjectId };
  } catch (error) {
    return { anchored: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function addStep(requestId: string, copy: "record_anchored" | "anchor_skipped", clinicId: string): Promise<void> {
  const request = await customerStore.request(requestId);
  if (!request) return;
  request.steps.push({ at: clock.nowIso(), kind: "anchor", clinicId, text: stepText(copy, { clinicId }) });
  await customerStore.putRequest({ ...request, updatedAt: clock.nowIso() });
}

/** D0: the booking's record takes what was actually paid and received, the anchor if any, and is renumbered. */
async function updateRecordFromOutcome(booking: StoredBooking, outcome: OutcomeV1, anchored: AnchorResult | undefined): Promise<TreatmentRecord | undefined> {
  const recordId = booking.recordId ?? `rec_${outcome.bookingId}`;
  const record = await customerStore.record(recordId);
  if (!record) return undefined;
  const rating = Math.min(5, Math.max(1, Math.round(outcome.satisfaction))) as TreatmentRecord["rating"];
  const next: TreatmentRecord = {
    ...record,
    priceKrw: outcome.paidKrw,
    amount: outcome.receivedAmount,
    rating,
    sharedToPlatform: true,
    // recordHash: the P0 placeholder sent in record-anchor@1 (glowpass computes the real one).
    ...(anchored?.anchored ? { anchor: { subjectId: anchored.subjectId, version: anchored.version, tx: anchored.tx, recordHash: "0x0" } } : {}),
  };
  await customerStore.putRecord(next);
  const series = await renumberSeries(record.customerId, record.procedureId);
  return series.find((r) => r.id === recordId);
}

/** Outcome drafts of a booking (D0, D7, D30) for the outcome screen. */
export async function listOutcomeDrafts(bookingId: string): Promise<OutcomeDraft[]> {
  const booking = await findBooking(bookingId);
  const wireId = booking?.booking?.bookingId ?? bookingId;
  const order = { D0: 0, D7: 1, D30: 2 } as const;
  return (await customerStore.outcomeDrafts(wireId)).sort((a, b) => order[a.checkpoint] - order[b.checkpoint]);
}
