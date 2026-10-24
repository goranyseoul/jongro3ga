import type { Locale } from "../../domain/common";
import type { RunOptions, ToolCallResult } from "../index";
import { readOnboardingState, type OnboardingTurnState } from "../prompts/onboarding-customer";
import {
  BLOCKING_CONSENTS,
  applyPatch,
  canMatch,
  nextSlot,
  patchPaths,
  widgetFor,
  type OnboardingDraft,
  type ProfilePatch,
  type SlotId,
} from "../onboarding/slots";
import { ONBOARDING_LINES, type OnboardingLines } from "./onboarding-lines";
import {
  parseAgeBand,
  parseArea,
  parseChannel,
  parseConcerns,
  parseDateRange,
  parseLocale,
  parseNationality,
  parseNickname,
  parseNone,
  parseResidency,
  parseYesNo,
} from "./parse";

// Fixture agent for the customer onboarding chat. It reads the same <onboarding_state> block the live model
// gets and answers like the model would: update_profile for what it understood, one question, one widget.

type ToolCall = ToolCallResult["toolCalls"][number];

export function question(slot: SlotId | "summary" | null, draft: OnboardingDraft, L: OnboardingLines): string {
  switch (slot) {
    case "locale":
      return L.greeting;
    case "consents":
      return L.consent;
    case "nickname":
      return L.nickname;
    case "nationality":
      return L.nationality(draft.nickname ?? "");
    case "residency":
      return L.residency;
    case "ageBand":
      return L.ageBand;
    case "trip":
      return L.trip;
    case "trip.stayArea":
      return L.stayArea;
    case "skin.concerns":
      return L.concerns;
    case "history":
      return L.history;
    case "safety.pregnantOrBreastfeeding":
      return L.pregnant;
    case "prefs.budgetKrw":
      return L.budget;
    case "prefs.downtimeToleranceDays":
      return L.downtime;
    case "prefs.languagesNeeded":
      return L.languages;
    case "contact.channel":
      return L.channel;
    case "contact.handle":
      return L.handle(draft.contact.channel ? L.channelName[draft.contact.channel] : "");
    case "summary":
      return L.summary;
    case null:
      return L.done(draft.nickname ?? "");
  }
}

export function widgetCall(slot: SlotId | "summary" | null): ToolCall[] {
  if (slot === null) return [];
  if (slot === "consents") return [{ name: "request_consent", input: {} }];
  const widget = widgetFor(slot);
  if (widget.type === "free_text") return [];
  return [{ name: "show_widget", input: { type: widget.type, slot: widget.slot, ...(widget.options ? { options: widget.options } : {}) } }];
}

const joinSentences = (locale: Locale, parts: string[]) => parts.filter(Boolean).join(locale === "ja" || locale === "zh-CN" ? "" : " ");

function parseBudget(text: string): ProfilePatch["prefs"] | undefined {
  const t = text.normalize("NFKC").replace(/,/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(万|만)?\s*(円|yen|jpy|원|won|krw|元|cny|rmb|usd|dollars?|\$)?/i);
  if (!m) return undefined;
  const amount = Number(m[1]) * (m[2] ? 10_000 : 1);
  const unit = (m[3] ?? "").toLowerCase();
  const currency = /円|yen|jpy/.test(unit) ? "JPY" : /元|cny|rmb/.test(unit) ? "CNY" : /usd|dollar|\$/.test(unit) ? "USD" : "KRW";
  const rate = { KRW: 1, JPY: 9.2, CNY: 190, USD: 1380 }[currency];
  if (!(amount > 0)) return undefined;
  return { budgetKrw: { max: Math.round(amount * rate) }, budgetInput: { currency, amount } };
}

function parseDowntime(text: string): 0 | 1 | 3 | 7 | undefined {
  const m = text.normalize("NFKC").match(/(\d+)/);
  if (!m) return /(当日|당일|same day|当天)/i.test(text) ? 0 : undefined;
  const days = Number(m[1]);
  return days >= 7 ? 7 : days >= 3 ? 3 : days >= 1 ? 1 : 0;
}

/** What the fixture "understands" from free text, for the open slot plus the basic info a visitor tends to bundle. */
export function extractPatch(text: string, state: OnboardingTurnState): ProfilePatch | undefined {
  const slot = state.editing ?? state.nextSlot;
  const draft = state.draft;
  const patch: ProfilePatch = {};
  const basicStage = slot === "nickname" || slot === "nationality" || slot === "residency" || slot === "ageBand" || slot === "trip";

  if (basicStage) {
    if (slot === "nickname" || (!draft.nickname && slot !== "residency")) {
      const nickname = parseNickname(text, slot === "nickname");
      if (nickname) patch.nickname = nickname;
    }
    const nationality = parseNationality(text);
    if (nationality && (slot === "nationality" || !draft.nationality)) patch.nationality = nationality;
    const ageBand = parseAgeBand(text);
    if (ageBand) patch.ageBand = ageBand;
    if (slot === "residency" || (slot !== "nickname" && /(居住|살고|live in|生活)/i.test(text))) {
      const residency = parseResidency(text);
      if (residency) patch.residency = residency;
    }
    const dates = parseDateRange(text, state.today);
    if (dates && canMatch(applyPatch(draft, patch))) patch.trip = { arrival: dates.arrival, departure: dates.departure };
  }

  switch (slot) {
    case "locale": {
      const locale = parseLocale(text);
      if (locale) patch.locale = locale;
      break;
    }
    case "trip.stayArea": {
      const area = parseArea(text);
      if (area) patch.trip = { stayArea: area };
      break;
    }
    case "skin.concerns": {
      const concerns = parseConcerns(text);
      if (concerns.length > 0) patch.skin = { concerns };
      break;
    }
    case "history":
      patch.history = parseNone(text) ? { none: true, items: [] } : { none: false, items: [{ text: text.trim() }] };
      break;
    case "safety.pregnantOrBreastfeeding": {
      const yes = parseYesNo(text);
      if (yes !== undefined) patch.safety = { pregnantOrBreastfeeding: yes };
      break;
    }
    case "prefs.budgetKrw": {
      const prefs = parseBudget(text);
      if (prefs) patch.prefs = prefs;
      break;
    }
    case "prefs.downtimeToleranceDays": {
      const days = parseDowntime(text);
      if (days !== undefined) patch.prefs = { downtimeToleranceDays: days };
      break;
    }
    case "prefs.languagesNeeded": {
      const locales = text
        .split(/[\s,，、·]+/)
        .map(parseLocale)
        .filter((l): l is Locale => l !== undefined);
      if (locales.length > 0) patch.prefs = { languagesNeeded: [...new Set(locales)] };
      break;
    }
    case "contact.channel": {
      const channel = parseChannel(text);
      if (channel) patch.contact = { channel };
      break;
    }
    case "contact.handle": {
      const handle = text.trim().split(/\s+/).pop();
      if (handle) patch.contact = { handle };
      break;
    }
    default:
      break;
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

function touches(patch: ProfilePatch, slot: SlotId): boolean {
  const paths = patchPaths(patch);
  return paths.some((path) => path === slot || path.startsWith(`${slot}.`) || slot.startsWith(`${path}.`) || (slot === "trip" && path.startsWith("trip.")));
}

export function onboardingAgent(options: RunOptions): ToolCallResult {
  const state = readOnboardingState(options.system);
  if (!state) return { text: ONBOARDING_LINES.en.reask, toolCalls: [] };
  const L = ONBOARDING_LINES[state.locale];
  const name = state.draft.nickname ?? "";

  if (state.finished) {
    const intent = state.draft.firstIntent;
    return { text: [L.done(name), intent ? L.intentReady(intent) : ""].filter(Boolean).join("\n\n"), toolCalls: [] };
  }
  if (state.toolErrors?.length) {
    return { text: joinSentences(state.locale, [L.reask, question(state.nextSlot, state.draft, L)]), toolCalls: widgetCall(state.nextSlot) };
  }

  const notes: string[] = [];
  const lead: string[] = [];
  const calls: ToolCall[] = [];
  let draft = state.draft;
  let editing = state.editing;
  const input = state.input;

  if (input.kind === "start") {
    if (draft.firstIntent) notes.push(L.intentAck(draft.firstIntent));
  } else if (input.kind === "text") {
    if (state.nextSlot === "summary" && parseYesNo(input.text ?? "") === true) {
      return { text: "", toolCalls: [{ name: "finish_onboarding", input: {} }] };
    }
    const patch = extractPatch(input.text ?? "", state);
    if (!patch) {
      return { text: joinSentences(state.locale, [L.nudge]), toolCalls: widgetCall(state.editing ?? state.nextSlot) };
    }
    calls.push({ name: "update_profile", input: { patch } });
    draft = applyPatch(draft, patch);
    if (editing && touches(patch, editing)) editing = undefined;
    if (patch.residency === "resident") notes.push(L.residentNote);
    if (patch.trip?.arrival && patch.trip.departure) lead.push(L.tripAck(L.range(patch.trip.arrival, patch.trip.departure)));
  } else {
    if (input.consentsSubmitted) {
      if (BLOCKING_CONSENTS.some((type) => draft.consents[type] !== true)) notes.push(L.consentBlocked);
      else if (draft.consents.sensitiveHealth === false) notes.push(L.sensitiveDeclined);
    }
    if (input.applied?.residency === "resident") notes.push(L.residentNote);
    if (input.applied?.trip?.arrival && input.applied.trip.departure) {
      lead.push(L.tripAck(L.range(input.applied.trip.arrival, input.applied.trip.departure)));
    }
  }

  const next =
    input.kind === "text"
      ? nextSlot({ draft, skipped: state.skipped, editing, summaryConfirmed: state.summaryConfirmed })
      : state.nextSlot;
  const ask = joinSentences(state.locale, [...lead, question(next, draft, L)]);
  return { text: [...notes, ask].join("\n\n"), toolCalls: [...calls, ...widgetCall(next)] };
}

export const onboardingFixtures = { "onboarding.customer": onboardingAgent };
