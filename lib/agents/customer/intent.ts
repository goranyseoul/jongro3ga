import { agentUrls } from "../../a2a/cards";
import { sendMessage } from "../../a2a/client";
import { RecipeV1Schema, type RecipeV1 } from "../../a2a/schemas";
import { taskArtifactData } from "../../a2a/wire";
import { clock } from "../../clock";
import type { TreatmentRecord } from "../../domain";
import {
  UNKNOWN_PROCEDURE,
  buildProcedureRequest,
  draftProcedureRequest,
  importNotepad,
  type DraftProcedureRequest,
  type LlmMode,
  type NotepadImport,
} from "../../llm";
import { CONSENT_EXT, requestConsentRef } from "./consent";
import { addRecord } from "./records";
import { customerStore, newId, type StoredRequest } from "./store";

// 요청 정리 (02 1절) and the memo import. The LLM layer (lib/llm) drafts, this file applies the profile, the
// recipe and the ledger, stores the CustomerRequest, and returns what is still missing so the chat screen (WP7)
// can ask back ("빠진 필수 슬롯만 되묻는다").

export interface DraftOptions {
  /** A recipe the screen already has; when given no platform.recipe call is made. */
  recipe?: RecipeV1;
  /** Ask platform.recipe for typical amounts first (demo row 2 shows it in the log). Default true. */
  fetchRecipe?: boolean;
  /** Slots the customer answered or changed on the condition card, applied over the draft. */
  overrides?: Partial<Omit<DraftProcedureRequest, "followUpQuestion">>;
  fetchImpl?: typeof fetch;
}

export type DraftResult =
  | { ok: true; mode: LlmMode; request: StoredRequest; recipe?: RecipeV1 }
  | {
      ok: false;
      mode: LlmMode;
      requestId: string;
      /** Required slots still open: "procedureId", "amount", or a schema path. */
      missing: string[];
      /** The question to ask, in the customer's language. */
      followUpQuestion?: string;
      draft: DraftProcedureRequest;
      recipe?: RecipeV1;
      error?: string;
    };

/** platform.recipe for the customer's concerns and age band. Undefined on any failure (the fixture default applies). */
async function askRecipe(input: {
  agentId: string;
  requestId: string;
  concerns: string[];
  ageBand: string;
  consentRef: string;
  fetchImpl?: typeof fetch;
}): Promise<RecipeV1 | undefined> {
  try {
    const task = await sendMessage({
      from: { agentId: input.agentId, role: "customer" },
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.recipe",
      data: { schema: "pibu/recipe-query@1", concerns: input.concerns, ageBand: input.ageBand },
      contextId: input.requestId,
      metadata: { consentRef: input.consentRef },
      extensions: [CONSENT_EXT],
      ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    });
    if (task.status.state !== "TASK_STATE_COMPLETED") return undefined;
    const parsed = RecipeV1Schema.safeParse(taskArtifactData(task));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One sentence ("リジュラン受けたい") to a stored CustomerRequest in status `draft`. Defaults (02): amount from the
 * recipe's typical minimum, areas = the stay area's group, budget from prefs, dates = the trip, languages from
 * prefs. When a required slot is still open nothing is stored and `missing` says what to ask.
 */
export async function draftRequest(customerId: string, utterance: string, opts: DraftOptions = {}): Promise<DraftResult> {
  const [account, profile, consents, records] = await Promise.all([
    customerStore.account(customerId),
    customerStore.profile(customerId),
    customerStore.consents(customerId),
    customerStore.records(customerId),
  ]);
  if (!account || !profile) throw new Error(`no customer ${customerId}`);
  const requestId = newId("req");
  const consentRef = requestConsentRef(consents);

  let recipe = opts.recipe;
  if (!recipe && opts.fetchRecipe !== false && consentRef && profile.skin.concerns.length > 0) {
    recipe = await askRecipe({
      agentId: account.agentId,
      requestId,
      concerns: profile.skin.concerns,
      ageBand: profile.ageBand,
      consentRef,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    });
  }

  const { mode, draft } = await draftProcedureRequest({
    utterance,
    locale: profile.locale,
    profile: { locale: profile.locale, nationality: profile.nationality, residency: profile.residency, ageBand: profile.ageBand, trip: profile.trip, prefs: profile.prefs },
    ...(recipe ? { recipe } : {}),
    firstKProcedure: records.length === 0,
    today: clock.today(),
  });
  const merged: DraftProcedureRequest = { ...draft, ...opts.overrides };
  if (opts.overrides && merged.procedureId !== UNKNOWN_PROCEDURE && merged.amount !== undefined) delete merged.followUpQuestion;

  const built = buildProcedureRequest(merged, { requestId, customerAgentId: account.agentId });
  if (!built.ok) {
    return {
      ok: false,
      mode,
      requestId,
      missing: built.missing,
      ...(merged.followUpQuestion ? { followUpQuestion: merged.followUpQuestion } : {}),
      draft: merged,
      ...(recipe ? { recipe } : {}),
      ...(built.missing.length === 0 ? { error: built.error } : {}),
    };
  }

  const now = clock.nowIso();
  const request: StoredRequest = {
    id: requestId,
    customerId,
    rawUtterance: utterance,
    request: built.request,
    status: "draft",
    createdAt: now,
    steps: [],
    updatedAt: now,
  };
  await customerStore.putRequest(request);
  return { ok: true, mode, request, ...(recipe ? { recipe } : {}) };
}

// ---- memo import (DEMO.md scenario 2 ①) ----

export interface ImportResult {
  mode: LlmMode;
  /** Stored records, source "manual". */
  records: TreatmentRecord[];
  /** Lines whose procedure is not in the master; not stored, the screen asks about them. */
  unknown: NotepadImport["records"];
  /** Records whose year was guessed: the screen confirms them with the year question. */
  yearInferred: TreatmentRecord[];
  questions: NotepadImport["questions"];
  passes: NotepadImport["passes"];
  appointments: NotepadImport["appointments"];
  observations: NotepadImport["observations"];
}

/**
 * A pasted phone memo to manual TreatmentRecords (lib/llm importNotepad). Manual records never count for offer
 * proofs (INTEGRATION 6). `save: false` returns the parse without storing (preview before the customer confirms).
 */
export async function importRecords(customerId: string, text: string, opts: { save?: boolean } = {}): Promise<ImportResult> {
  const profile = await customerStore.profile(customerId);
  if (!profile) throw new Error(`no customer ${customerId}`);
  const { mode, data } = await importNotepad({ text, locale: profile.locale, today: clock.today() });
  const known = data.records.filter((r) => r.procedureId !== UNKNOWN_PROCEDURE);
  const unknown = data.records.filter((r) => r.procedureId === UNKNOWN_PROCEDURE);

  const records: TreatmentRecord[] = [];
  const inferredIds = new Set<string>();
  for (const line of [...known].sort((a, b) => a.date.localeCompare(b.date))) {
    const id = newId("rec");
    const note = [line.procedureText, line.note].filter(Boolean).join(" · ");
    const input = {
      procedureId: line.procedureId,
      date: line.date,
      ...(line.amount ? { amount: line.amount } : {}),
      ...(line.priceKrw !== undefined ? { priceKrw: line.priceKrw } : {}),
      ...(line.clinicName ? { clinicName: line.clinicName } : {}),
      ...(note ? { note } : {}),
      source: "manual" as const,
    };
    if (opts.save === false) {
      records.push({ id, customerId, ...input, sessionNumber: 1, status: "active", sharedToPlatform: false });
    } else {
      records.push(await addRecord(customerId, input, id));
    }
    if (line.yearInferred) inferredIds.add(id);
  }
  // Later lines of a series renumber earlier ones: read the final numbers back.
  const final = opts.save === false ? records : await Promise.all(records.map(async (r) => (await customerStore.record(r.id)) ?? r));
  return {
    mode,
    records: final,
    unknown,
    yearInferred: final.filter((r) => inferredIds.has(r.id)),
    questions: data.questions,
    passes: data.passes,
    appointments: data.appointments,
    observations: data.observations,
  };
}
