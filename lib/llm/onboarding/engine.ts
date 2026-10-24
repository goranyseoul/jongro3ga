import { z } from "zod";
import { LocaleSchema } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { ConsentEntry, CustomerProfile } from "../../domain/customer";
import type { IsoDate, IsoDateTime, Locale } from "../../domain/common";
import { getStore, type Store } from "../../store";
import { resolveFixture } from "../fixtures";
import { ONBOARDING_LINES } from "../fixtures/onboarding-lines";
import { question } from "../fixtures/onboarding";
import { findMedicalViolations, mentionsSensitiveTopic, sanitizeText } from "../guard";
import { runClaude, type RunOptions, type ToolCallResult } from "../index";
import { llmMode } from "../models";
import { buildOnboardingSystemPrompt, type OnboardingTurnInput, type OnboardingTurnState } from "../prompts/onboarding-customer";
import { parseToolInput } from "../tools";
import {
  CONSENT_TYPES,
  FX_RATES,
  applyPatch,
  canMatch,
  checkPatchRules,
  emptyDraft,
  hasSensitiveConsent,
  isSlotId,
  missingRequired,
  nextSlot,
  patchPaths,
  progressPercent,
  slotDef,
  widgetFor,
  type ConsentType,
  type OnboardingDraft,
  type ProfilePatch,
  type SlotId,
  type WidgetSpec,
} from "./slots";
import { ONBOARDING_TOOLS, finishOnboardingTool, requestConsentTool, showWidgetTool, updateProfileTool } from "./tools";

// Customer onboarding engine (04-onboarding-chat.md). One call = one turn: apply the customer's widget value,
// let Claude (or the fixture agent) talk and call tools, validate every tool call on the server, and return the
// events the SSE route streams. The server, not the model, owns the rules: health questions only after the
// sensitiveHealth consent, residency only for foreigners, finish only with every required slot.

export const ONBOARDING_COLLECTION = "onboarding_sessions";
export const CONSENT_TEXT_VERSION = "2026-10-24.v1";

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  at: IsoDateTime;
}

export interface OnboardingSession {
  id: string;
  kind: "customer";
  /** Page the conversation started on; the conversation language until the customer picks one. */
  pageLocale: Locale;
  draft: OnboardingDraft;
  filledSlots: string[];
  transcript: TranscriptEntry[];
  skipped: SlotId[];
  editing?: SlotId;
  summaryShown: boolean;
  summaryConfirmed: boolean;
  status: "active" | "completed";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const WidgetValueSchema = z.strictObject({
  slot: z.string().min(1),
  value: z.unknown().optional(),
  skip: z.boolean().optional(),
});
export type WidgetValue = z.infer<typeof WidgetValueSchema>;

export const OnboardingRequestSchema = z.strictObject({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "sessionId: 8 to 64 letters, digits, _ or -"),
  message: z.string().max(2000).default(""),
  widgetValue: WidgetValueSchema.optional(),
  locale: LocaleSchema.optional(),
});
export type OnboardingRequest = z.input<typeof OnboardingRequestSchema>;

/** Profile body for PUT /api/me/profile. `safety` is left out when the sensitiveHealth consent was declined. */
export type CustomerProfileBody = Omit<CustomerProfile, "safety"> & { safety?: CustomerProfile["safety"] };

export type OnboardingEvent =
  | { type: "text"; id: string; text: string }
  | { type: "profile_patch"; patch: ProfilePatch; draft: OnboardingDraft; progress: number }
  | { type: "widget"; widget: WidgetSpec }
  | { type: "error"; message: string }
  | {
      type: "done";
      sessionId: string;
      status: "active" | "completed";
      nextSlot: SlotId | "summary" | null;
      missing: SlotId[];
      progress: number;
      draft: OnboardingDraft;
      /** Server (demo clock) date, the earliest arrival the date widget offers. */
      today: IsoDate;
      profile?: CustomerProfileBody;
      consents?: Omit<ConsentEntry, "customerId">[];
    };

export interface TurnDeps {
  store?: Store;
  today?: IsoDate;
  now?: IsoDateTime;
  /** Account ids from the session (AUTH track); placeholders are derived from the session id when signed out. */
  identity?: { id: string; agentId: string };
}

// ---- widget values ----

type WidgetAction =
  | { kind: "patch"; slot: SlotId; patch: ProfilePatch }
  | { kind: "consents"; consents: Partial<Record<ConsentType, boolean>> }
  | { kind: "skip"; slot: SlotId }
  | { kind: "summary_confirm" }
  | { kind: "summary_edit"; slot: SlotId }
  | { kind: "invalid"; slot: string; error: string };

const CurrencyInput = z.strictObject({ currency: z.enum(["KRW", "JPY", "CNY", "USD"]), amount: z.number().positive() });

/** Turns a widget answer into a patch. Values are checked here; business rules run afterwards like for Claude. */
export function widgetAction(value: WidgetValue): WidgetAction {
  const { slot } = value;
  if (slot === "summary") {
    if (value.value === "confirm") return { kind: "summary_confirm" };
    const edit = (value.value as { edit?: unknown } | undefined)?.edit;
    if (isSlotId(edit) && edit !== "consents" && edit !== "locale") return { kind: "summary_edit", slot: edit };
    return { kind: "invalid", slot, error: "summary expects \"confirm\" or { edit: slot }" };
  }
  if (!isSlotId(slot)) return { kind: "invalid", slot, error: `unknown slot ${slot}` };
  if (value.skip) {
    return slotDef(slot)?.required ? { kind: "invalid", slot, error: `${slot} is required and cannot be skipped` } : { kind: "skip", slot };
  }
  if (slot === "consents") {
    const parsed = z.partialRecord(z.enum(CONSENT_TYPES), z.boolean()).safeParse(value.value);
    return parsed.success ? { kind: "consents", consents: parsed.data } : { kind: "invalid", slot, error: "consents expects { type: boolean }" };
  }
  const raw = value.value;
  let patch: ProfilePatch | undefined;
  switch (slot) {
    case "locale":
      patch = { locale: raw as Locale };
      break;
    case "nickname":
      patch = { nickname: raw as string };
      break;
    case "nationality":
      patch = { nationality: raw === "other" ? "ZZ" : (raw as string) };
      break;
    case "residency":
      patch = { residency: raw as ProfilePatch["residency"] };
      break;
    case "ageBand":
      patch = { ageBand: raw as ProfilePatch["ageBand"] };
      break;
    case "trip": {
      const range = raw as { arrival?: string; departure?: string } | undefined;
      patch = { trip: { arrival: range?.arrival, departure: range?.departure } };
      break;
    }
    case "trip.stayArea":
      patch = { trip: { stayArea: raw as never } };
      break;
    case "skin.concerns":
      patch = { skin: { concerns: raw as never } };
      break;
    case "history":
      patch = raw === "none" ? { history: { none: true, items: [] } } : { history: { none: false, items: [{ text: String(raw ?? "") }] } };
      break;
    case "safety.pregnantOrBreastfeeding":
      patch = { safety: { pregnantOrBreastfeeding: raw === true || raw === "yes" } };
      if (raw !== true && raw !== false && raw !== "yes" && raw !== "no") patch = undefined;
      break;
    case "prefs.budgetKrw": {
      const input = CurrencyInput.safeParse(raw);
      if (input.success) {
        const max = Math.round(input.data.amount * FX_RATES[input.data.currency]);
        patch = { prefs: { budgetKrw: { max }, budgetInput: input.data } };
      }
      break;
    }
    case "prefs.downtimeToleranceDays":
      patch = { prefs: { downtimeToleranceDays: raw as never } };
      break;
    case "prefs.languagesNeeded":
      patch = { prefs: { languagesNeeded: raw as never } };
      break;
    case "contact.channel":
      patch = { contact: { channel: raw as never } };
      break;
    case "contact.handle":
      patch = { contact: { handle: raw as string } };
      break;
  }
  if (!patch) return { kind: "invalid", slot, error: `invalid value for ${slot}` };
  const parsed = parseToolInput(updateProfileTool, { patch });
  return parsed.ok ? { kind: "patch", slot, patch: parsed.value.patch } : { kind: "invalid", slot, error: parsed.error };
}

// ---- session store ----

function newSession(id: string, pageLocale: Locale, now: IsoDateTime): OnboardingSession {
  return {
    id,
    kind: "customer",
    pageLocale,
    draft: emptyDraft(),
    filledSlots: [],
    transcript: [],
    skipped: [],
    summaryShown: false,
    summaryConfirmed: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadOnboardingSession(id: string, store: Store = getStore()): Promise<OnboardingSession | undefined> {
  return store.get<OnboardingSession>("customer", ONBOARDING_COLLECTION, id);
}

// ---- profile on finish ----

const CONSENT_SCOPE: Record<ConsentType, string[]> = {
  terms: [],
  privacy: ["nickname", "nationality", "residency", "ageBand", "trip.*", "prefs.*", "contact.*"],
  sensitiveHealth: ["skin.*", "history.*", "safety.*"],
  crossBorder: ["*"],
  shareAnonymizedRecords: ["records.anonymized"],
};

export function buildConsentEntries(draft: OnboardingDraft, at: IsoDateTime, sessionId: string): Omit<ConsentEntry, "customerId">[] {
  return CONSENT_TYPES.filter((type) => draft.consents[type] !== undefined).map((type) => ({
    id: `cns_${sessionId.replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}_${type}`,
    type,
    granted: draft.consents[type] === true,
    scope: CONSENT_SCOPE[type],
    ...(type === "sensitiveHealth" ? { recipientRole: "clinic" as const } : {}),
    textVersion: CONSENT_TEXT_VERSION,
    at,
  }));
}

/** CustomerProfile (06) from a finished draft. Only call when missingRequired(draft) is empty. */
export function buildCustomerProfile(draft: OnboardingDraft, identity: { id: string; agentId: string }, completedAt: IsoDateTime): CustomerProfileBody {
  const visitor = canMatch(draft);
  return {
    id: identity.id,
    agentId: identity.agentId,
    locale: draft.locale!,
    nickname: draft.nickname!,
    nationality: draft.nationality!,
    ...(draft.nationality !== "KR" && draft.residency ? { residency: draft.residency } : {}),
    ageBand: draft.ageBand!,
    ...(visitor && draft.trip.arrival && draft.trip.departure
      ? {
          trip: {
            arrival: draft.trip.arrival,
            departure: draft.trip.departure,
            ...(draft.trip.stayArea ? { stayArea: draft.trip.stayArea } : {}),
            ...(draft.trip.flightTimeHome ? { flightTimeHome: draft.trip.flightTimeHome } : {}),
          },
        }
      : {}),
    skin: { ...(draft.skin.type ? { type: draft.skin.type } : {}), concerns: hasSensitiveConsent(draft) ? draft.skin.concerns : [] },
    ...(hasSensitiveConsent(draft)
      ? {
          safety: {
            pregnantOrBreastfeeding: draft.safety.pregnantOrBreastfeeding === true,
            allergies: draft.safety.allergies ?? [],
            ...(draft.safety.anticoagulants !== undefined ? { anticoagulants: draft.safety.anticoagulants } : {}),
            ...(draft.safety.recentIsotretinoin !== undefined ? { recentIsotretinoin: draft.safety.recentIsotretinoin } : {}),
            ...(draft.safety.keloidHistory !== undefined ? { keloidHistory: draft.safety.keloidHistory } : {}),
          },
        }
      : {}),
    prefs: {
      ...(draft.prefs.budgetKrw ? { budgetKrw: draft.prefs.budgetKrw } : {}),
      ...(draft.prefs.downtimeToleranceDays !== undefined ? { downtimeToleranceDays: draft.prefs.downtimeToleranceDays } : {}),
      ...(draft.prefs.painTolerance ? { painTolerance: draft.prefs.painTolerance } : {}),
      languagesNeeded: draft.prefs.languagesNeeded,
      ...(draft.prefs.doctorGender ? { doctorGender: draft.prefs.doctorGender } : {}),
    },
    contact: { channel: draft.contact.channel!, handle: draft.contact.handle! },
    completedAt,
  };
}

/** Signed out placeholder ids, stable per session so a retry does not mint a second agent. */
export function placeholderIdentity(sessionId: string): { id: string; agentId: string } {
  const compact = sessionId.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return { id: `cus_${compact.slice(0, 16)}`, agentId: `cag_${compact.slice(0, 8)}` };
}

// ---- turn ----

interface ToolOutcome {
  draft: OnboardingDraft;
  editing?: SlotId;
  applied: ProfilePatch[];
  widget?: WidgetSpec;
  finishRequested: boolean;
  errors: string[];
}

function applyTool(
  result: ToolCallResult,
  base: { draft: OnboardingDraft; editing?: SlotId; summaryShown: boolean; summaryConfirmed: boolean },
  today: IsoDate,
): ToolOutcome {
  const out: ToolOutcome = { draft: base.draft, editing: base.editing, applied: [], finishRequested: false, errors: [] };
  for (const call of result.toolCalls) {
    if (call.name === updateProfileTool.spec.name) {
      const parsed = parseToolInput(updateProfileTool, call.input);
      if (!parsed.ok) {
        out.errors.push(`update_profile: ${parsed.error}`);
        continue;
      }
      const ruleErrors = checkPatchRules(out.draft, parsed.value.patch, today);
      if (ruleErrors.length > 0) {
        out.errors.push(...ruleErrors.map((e) => `update_profile: ${e}`));
        continue;
      }
      out.draft = withDefaults(applyPatch(out.draft, parsed.value.patch));
      out.applied.push(parsed.value.patch);
      if (out.editing && patchPaths(parsed.value.patch).some((p) => p === out.editing || p.startsWith(`${out.editing}.`) || out.editing!.startsWith(`${p}.`) || (out.editing === "trip" && p.startsWith("trip.")))) {
        out.editing = undefined;
      }
    } else if (call.name === showWidgetTool.spec.name) {
      const parsed = parseToolInput(showWidgetTool, call.input);
      if (!parsed.ok) continue;
      const { type, slot } = parsed.value;
      if (type === "summary" || slot === "summary") {
        out.widget = widgetFor("summary");
        continue;
      }
      if (!isSlotId(slot)) continue;
      // never put a health question on screen before the sensitiveHealth consent
      if (slotDef(slot)?.sensitive && !hasSensitiveConsent(out.draft)) continue;
      out.widget = widgetFor(slot);
    } else if (call.name === requestConsentTool.spec.name) {
      const parsed = parseToolInput(requestConsentTool, call.input);
      out.widget = { ...widgetFor("consents"), ...(parsed.ok && parsed.value.consentTypes ? { consentTypes: parsed.value.consentTypes } : {}) };
    } else if (call.name === finishOnboardingTool.spec.name) {
      const missing = missingRequired(out.draft);
      if (missing.length > 0) out.errors.push(`finish_onboarding: required slots missing: ${missing.join(", ")}`);
      else if (!base.summaryShown && !base.summaryConfirmed) out.errors.push("finish_onboarding: show the summary card and let the customer confirm first");
      else out.finishRequested = true;
    }
  }
  return out;
}

/**
 * Hook for answers that imply others. Languages needed is deliberately not filled from the locale: the widget
 * preselects it, but the customer is still asked (they may need English at the clinic too).
 */
function withDefaults(draft: OnboardingDraft): OnboardingDraft {
  return draft;
}

function mergePatches(patches: ProfilePatch[]): ProfilePatch {
  return patches.reduce<ProfilePatch>(
    (acc, p) => ({
      ...acc,
      ...p,
      ...(p.trip || acc.trip ? { trip: { ...acc.trip, ...p.trip } } : {}),
      ...(p.skin || acc.skin ? { skin: { ...acc.skin, ...p.skin } } : {}),
      ...(p.safety || acc.safety ? { safety: { ...acc.safety, ...p.safety } } : {}),
      ...(p.prefs || acc.prefs ? { prefs: { ...acc.prefs, ...p.prefs } } : {}),
      ...(p.contact || acc.contact ? { contact: { ...acc.contact, ...p.contact } } : {}),
    }),
    {},
  );
}

function describeWidget(value: WidgetValue): string {
  return value.skip ? `[skipped ${value.slot}]` : `[widget ${value.slot} = ${JSON.stringify(value.value)}]`;
}

function toMessages(transcript: TranscriptEntry[]): RunOptions["messages"] {
  const messages = transcript.map((entry) => ({ role: entry.role, content: entry.text }));
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: "[conversation started]" });
  return messages;
}

/** Splits agent text into chat bubbles on blank lines. */
export function bubbles(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function runOnboardingTurn(request: OnboardingRequest, deps: TurnDeps = {}): Promise<{ events: OnboardingEvent[]; session: OnboardingSession }> {
  const req = OnboardingRequestSchema.parse(request);
  const store = deps.store ?? getStore();
  const today = deps.today ?? clock.today();
  const now = deps.now ?? clock.nowIso();

  const session = (await loadOnboardingSession(req.sessionId, store)) ?? newSession(req.sessionId, req.locale ?? "en", now);
  const events: OnboardingEvent[] = [];
  const appliedPatches: ProfilePatch[] = [];
  const conversationLocale = () => session.draft.locale ?? session.pageLocale;

  const doneEvent = (extra: Partial<Extract<OnboardingEvent, { type: "done" }>> = {}): OnboardingEvent => ({
    type: "done",
    sessionId: session.id,
    status: session.status,
    nextSlot: session.status === "completed" ? null : nextSlot(session),
    missing: missingRequired(session.draft),
    progress: progressPercent(session.draft),
    draft: session.draft,
    today,
    ...extra,
  });

  if (session.status === "completed") {
    const identity = deps.identity ?? placeholderIdentity(session.id);
    return {
      events: [doneEvent({ profile: buildCustomerProfile(session.draft, identity, session.updatedAt), consents: buildConsentEntries(session.draft, session.updatedAt, session.id) })],
      session,
    };
  }

  // 1. the customer's side of the turn
  let input: OnboardingTurnInput;
  if (req.widgetValue) {
    const action = widgetAction(req.widgetValue);
    const userText = req.message.trim() || describeWidget(req.widgetValue);
    if (action.kind === "invalid") {
      return rejectWidget(session, action.slot, action.error, events, store, now, today, conversationLocale());
    }
    if (action.kind === "patch") {
      const ruleErrors = checkPatchRules(session.draft, action.patch, today);
      if (ruleErrors.length > 0) return rejectWidget(session, action.slot, ruleErrors.join(" "), events, store, now, today, conversationLocale());
      session.draft = withDefaults(applyPatch(session.draft, action.patch));
      appliedPatches.push(action.patch);
      if (session.editing === action.slot) {
        session.editing = undefined;
        session.summaryShown = false;
      }
      input = { kind: "widget", slot: action.slot, applied: action.patch };
    } else if (action.kind === "consents") {
      session.draft = { ...session.draft, consents: { ...session.draft.consents, ...action.consents } };
      input = { kind: "widget", slot: "consents", consentsSubmitted: true };
    } else if (action.kind === "skip") {
      if (!session.skipped.includes(action.slot)) session.skipped.push(action.slot);
      if (session.editing === action.slot) session.editing = undefined;
      input = { kind: "widget", slot: action.slot, skipped: true };
    } else if (action.kind === "summary_confirm") {
      if (missingRequired(session.draft).length === 0) session.summaryConfirmed = true;
      else session.summaryShown = false;
      input = { kind: "widget", slot: "summary", summary: "confirm" };
    } else {
      session.editing = action.slot;
      session.summaryShown = false;
      session.summaryConfirmed = false;
      input = { kind: "widget", slot: "summary", summary: "edit" };
    }
    session.transcript.push({ role: "user", text: userText, at: now });
  } else if (session.transcript.length === 0) {
    const intent = req.message.trim();
    if (intent) {
      const patch: ProfilePatch = { firstIntent: intent.slice(0, 200) };
      session.draft = applyPatch(session.draft, patch);
      appliedPatches.push(patch);
    }
    session.transcript.push({ role: "user", text: intent || `[started on the ${session.pageLocale} page]`, at: now });
    input = { kind: "start" };
  } else if (req.message.trim()) {
    session.transcript.push({ role: "user", text: req.message.trim(), at: now });
    input = { kind: "text", text: req.message.trim() };
  } else {
    input = { kind: "start" };
  }

  // 2. the agent's side: Claude or the fixture agent, with one retry when a tool call is rejected
  let finished = session.summaryConfirmed && missingRequired(session.draft).length === 0;
  const stateFor = (draft: OnboardingDraft, editing: SlotId | undefined, toolErrors?: string[]): OnboardingTurnState => ({
    locale: draft.locale ?? session.pageLocale,
    today,
    draft,
    skipped: session.skipped,
    ...(editing ? { editing } : {}),
    summaryShown: session.summaryShown,
    summaryConfirmed: session.summaryConfirmed,
    finished,
    nextSlot: finished ? null : nextSlot({ draft, skipped: session.skipped, editing, summaryConfirmed: session.summaryConfirmed }),
    missing: missingRequired(draft),
    input,
    ...(toolErrors ? { toolErrors } : {}),
  });
  const optionsFor = (state: OnboardingTurnState): RunOptions => ({
    tier: "chat",
    system: buildOnboardingSystemPrompt(state),
    messages: toMessages(session.transcript),
    tools: ONBOARDING_TOOLS.map((tool) => tool.spec),
    fixtureKey: "onboarding.customer",
    maxTokens: 1024,
  });

  let state = stateFor(session.draft, session.editing);
  let options = optionsFor(state);
  let result = await runClaude(options);
  let outcome = finished ? emptyOutcome(session) : applyTool(result, session, today);
  if (!finished && outcome.errors.length > 0) {
    // keep what was valid, tell the model what was not, and let it ask again (04: "실패 시 도구 에러로 반환")
    session.draft = outcome.draft;
    session.editing = outcome.editing;
    appliedPatches.push(...outcome.applied);
    state = stateFor(session.draft, session.editing, outcome.errors);
    options = optionsFor(state);
    options.messages = [
      ...options.messages,
      { role: "assistant", content: result.text || "(tool calls)" },
      { role: "user", content: `[tool_error] ${outcome.errors.join(" | ")}` },
    ];
    result = await runClaude(options);
    outcome = applyTool(result, session, today);
  }
  if (!finished) {
    session.draft = outcome.draft;
    session.editing = outcome.editing;
    appliedPatches.push(...outcome.applied);
    if (outcome.finishRequested) {
      session.summaryConfirmed = true;
      finished = true;
    }
  }

  // 3. server side decisions: the next widget and a safe text
  const next = finished ? null : nextSlot(session);
  let widget: WidgetSpec | undefined;
  if (!finished) {
    const proposed = outcome.widget;
    const proposedOk =
      proposed !== undefined &&
      (proposed.slot === next ||
        (proposed.slot !== "summary" && slotDef(proposed.slot)?.applies(session.draft) && !slotDef(proposed.slot)?.filled(session.draft)));
    if (proposedOk) widget = proposed;
    else if (next !== null) {
      const auto = widgetFor(next);
      if (auto.type !== "free_text") widget = auto;
    }
    if (widget?.slot === "summary") session.summaryShown = true;
  }

  const finalState: OnboardingTurnState = { ...stateFor(session.draft, session.editing), finished, nextSlot: next };
  let text = sanitizeText(result.text);
  // Live output that diagnoses, recommends, or asks about health before the consent is replaced (08 section 6).
  const unsafe =
    llmMode() === "live" &&
    (findMedicalViolations(text).length > 0 || (!hasSensitiveConsent(session.draft) && mentionsSensitiveTopic(text)));
  if (!text || unsafe) {
    text = finished ? sanitizeText(resolveFixture(optionsFor(finalState)).text) : safeQuestion(finalState);
  }

  // 4. persist and emit
  session.status = finished ? "completed" : "active";
  session.transcript.push({ role: "assistant", text, at: now });
  for (const patch of appliedPatches) for (const path of patchPaths(patch)) if (!session.filledSlots.includes(path)) session.filledSlots.push(path);
  session.updatedAt = now;
  await store.put("customer", ONBOARDING_COLLECTION, session);

  if (appliedPatches.length > 0) {
    events.push({ type: "profile_patch", patch: mergePatches(appliedPatches), draft: session.draft, progress: progressPercent(session.draft) });
  }
  bubbles(text).forEach((bubble, index) => events.push({ type: "text", id: `${session.transcript.length}-${index}`, text: bubble }));
  if (widget) events.push({ type: "widget", widget });
  if (finished) {
    const identity = deps.identity ?? placeholderIdentity(session.id);
    events.push(doneEvent({ profile: buildCustomerProfile(session.draft, identity, now), consents: buildConsentEntries(session.draft, now, session.id) }));
  } else {
    events.push(doneEvent());
  }
  return { events, session };
}

function emptyOutcome(session: OnboardingSession): ToolOutcome {
  return { draft: session.draft, editing: session.editing, applied: [], finishRequested: false, errors: [] };
}

/** The fixed question for the next slot, used when live text is empty or crosses the boundary. */
function safeQuestion(state: OnboardingTurnState): string {
  const L = ONBOARDING_LINES[state.locale];
  return question(state.nextSlot, state.draft, L);
}

async function rejectWidget(
  session: OnboardingSession,
  slot: string,
  error: string,
  events: OnboardingEvent[],
  store: Store,
  now: IsoDateTime,
  today: IsoDate,
  locale: Locale,
): Promise<{ events: OnboardingEvent[]; session: OnboardingSession }> {
  const L = ONBOARDING_LINES[locale];
  const text = L.reask;
  session.transcript.push({ role: "assistant", text, at: now });
  session.updatedAt = now;
  await store.put("customer", ONBOARDING_COLLECTION, session);
  events.push({ type: "error", message: error });
  events.push({ type: "text", id: `${session.transcript.length}-0`, text });
  const target = isSlotId(slot) ? slot : nextSlot(session);
  if (target) events.push({ type: "widget", widget: widgetFor(target) });
  events.push({
    type: "done",
    sessionId: session.id,
    status: session.status,
    nextSlot: nextSlot(session),
    missing: missingRequired(session.draft),
    progress: progressPercent(session.draft),
    draft: session.draft,
    today,
  });
  return { events, session };
}
