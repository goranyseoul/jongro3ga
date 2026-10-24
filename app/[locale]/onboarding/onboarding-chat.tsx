"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AgentCardView,
  Button,
  Card,
  CardHeader,
  ChatBubble,
  ChatInput,
  Chip,
  ChipGroup,
  ConsentCard,
  Money,
  Sheet,
  WidgetCurrency,
  buttonStyles,
  WidgetDateRange,
  WidgetSlider,
  type CurrencyAmount,
  type DateRange,
} from "@/components/ui";
import { useAgent } from "@/components/customer/agent-context";
import { AgentWindow } from "@/components/customer/agent-window";
import { AgentOrb } from "@/components/customer/agent-orb";
import { AuthDialog, type AuthCopy } from "@/components/customer/auth-dialog";
import { hasSession } from "@/components/auth/client";
import { ClinicCarousel } from "@/components/customer/clinic-carousel";
import { LocaleSwitcher } from "@/components/customer/locale-switcher";
import { SpotlightTour } from "@/components/customer/spotlight-tour";
import { TaskSteps, type TaskStep } from "@/components/customer/task-steps";
import { updateDemoState } from "@/components/customer/demo-state";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/domain/common";
import type { ReferenceCurrency } from "@/lib/money";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DEMO_TODAY } from "@/lib/ui-data/customer";
import {
  CATEGORY_NAME,
  CATEGORY_ORDER,
  DIRECTORY,
  clinicsForTopic,
  findProcedure,
  procedureLabel,
  type DirectoryTopic,
} from "@/lib/ui-data/directory";
import type { LandingCopy } from "../landing-copy";
import { LandingHome } from "../landing-home";
import { LOCALES, LOCALE_NAME } from "../locales";
import { GatewayFlow } from "../hero/gateway-flow";
import { Splash } from "../hero/splash";
import { COPY, type OnboardingCopy } from "./copy";
import {
  AGE_BANDS,
  AREAS,
  BLOCKING_CONSENTS,
  CHANNELS,
  CONCERNS,
  CONSENTS,
  CURRENCIES,
  DOWNTIME_DAYS,
  EDITABLE_STEPS,
  EMPTY_DRAFT,
  FX_RATES,
  NATIONALITIES,
  REPLY_DELAY_MS,
  REQUIRED_CONSENTS,
  RESIDENCIES,
  STEP_ORDER,
  STEP_SLOT,
  buildAgentCard,
  defaultCurrency,
  isStepApplicable,
  matchOption,
  nextStep,
  progressPercent,
  type Concern,
  type Draft,
  type StepId,
} from "./mock";

type Message = { id: string; from: "agent" | "user"; text: string; clinics?: { ids: string[]; focus: string[] } };
type AgentLine = string | { text: string; clinics: { ids: string[]; focus: string[] } };

const shortDate = (iso: string) => iso.slice(5).replace("-", "/");
const tripRange = (d: Draft) =>
  d.trip.arrival && d.trip.departure ? `${shortDate(d.trip.arrival)} ~ ${shortDate(d.trip.departure)}` : "";

// After an edit from the summary, a changed answer can open required steps that were skipped before
// (for example nationality KR to JP opens residency and the trip).
function firstMissingStep(d: Draft): StepId | undefined {
  const missing: [StepId, boolean][] = [
    ["residency", d.residency === undefined],
    ["trip", !d.trip.arrival || !d.trip.departure],
    ["concerns", d.concerns.length === 0],
    ["pregnant", d.pregnant === undefined],
  ];
  return missing.find(([step, isMissing]) => isMissing && isStepApplicable(step, d))?.[0];
}

function question(step: StepId, d: Draft, c: OnboardingCopy): string {
  const name = d.nickname ?? "";
  switch (step) {
    case "locale":
      return c.say.locale;
    case "consent":
      return c.say.consent;
    case "nickname":
      return c.say.nickname;
    case "nationality":
      return c.say.nationality(name);
    case "residency":
      return c.say.residency;
    case "ageBand":
      return c.say.ageBand;
    case "trip":
      return c.say.trip;
    case "stayArea":
      return c.say.stayArea(tripRange(d));
    case "concerns":
      return c.say.concerns;
    case "history":
      return c.say.history;
    case "pregnant":
      return c.say.pregnant;
    case "budget":
      return c.say.budget;
    case "downtime":
      return c.say.downtime;
    case "languages":
      return c.say.languages;
    case "channel":
      return c.say.channel;
    case "handle":
      return c.say.handle(d.channel ? c.channel[d.channel] : "");
    case "summary":
      return c.say.summary;
    case "done":
      return c.say.done(name);
  }
}

/** Landing hero shown before the first message; the conversation then takes over the same page. */
export type OnboardingIntro = {
  wordmark: string;
  title: string;
  body: string;
  suggestions: string[];
  startPlain: string;
  suggestionsLabel: string;
  /** Accessible name of the language switch in the header. */
  languageLabel: string;
  signup: AuthCopy & { toggle: string; personas: string[] };
  agentWindow: LandingCopy["agentWindow"];
  tour: LandingCopy["tour"];
};

// Each tour step points at the element carrying this data-tour value; the order matches the copy.
const TOUR_TARGETS = ["input", "topics", "signup"] as const;
const TOUR_SEEN_KEY = "pibook.tour.v1";
// A language switch reloads the page in the new locale; the draft travels through sessionStorage for a moment.
const HANDOFF_KEY = "pibook.onboarding.handoff";
const HANDOFF_MAX_AGE_MS = 120_000;
// the entry splash plays 1.5s and fades; the tour and the first greeting wait for it
const SPLASH_MS = 2600;

export function OnboardingChat({ locale, intro, footer }: { locale: Locale; intro: OnboardingIntro; footer: ReactNode }) {
  const c = COPY[locale];
  const router = useRouter();

  const [signedIn, setSignedIn] = useState(false);
  const [started, setStarted] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<StepId>("locale");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [pickingEdit, setPickingEdit] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The conversation lives in a window over the landing; "full" is the old whole-screen view of it.
  const [surface, setSurface] = useState<"window" | "full">("window");
  const [windowOpen, setWindowOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [splashOver, setSplashOver] = useState(false);
  const full = started && surface === "full";
  const resumed = useRef(false);

  // widget values that are only committed when the customer presses next
  const [range, setRange] = useState<DateRange>({ start: "", end: "" });
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [budget, setBudget] = useState<CurrencyAmount>({ currency: "KRW", amount: null });
  const [downtime, setDowntime] = useState(DOWNTIME_DAYS[1]);
  const [languages, setLanguages] = useState<Locale[]>([locale]);

  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  // the wordmark leads home once there is a session
  useEffect(() => {
    void hasSession().then(setSignedIn);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSplashOver(true), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing, step, pickingEdit]);

  const message = (from: Message["from"], text: string): Message => ({ id: `m${nextId.current++}`, from, text });
  const agentMessage = (line: AgentLine): Message =>
    typeof line === "string" ? message("agent", line) : { ...message("agent", line.text), clinics: line.clinics };

  const agentSays = (lines: AgentLine[], then?: () => void) => {
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((prev) => [...prev, ...lines.map(agentMessage)]);
        setTyping(false);
        then?.();
      }, REPLY_DELAY_MS),
    );
  };

  const advance = (next: Draft, userText?: string, notes: string[] = []) => {
    if (userText) setMessages((prev) => [...prev, message("user", userText)]);
    setDraft(next);
    setPickingEdit(false);

    let target: StepId = nextStep(step, next);
    if (returnToSummary) {
      target = firstMissingStep(next) ?? "summary";
      if (target === "summary") setReturnToSummary(false);
    }
    if (target === "trip") setRange({ start: next.trip.arrival ?? "", end: next.trip.departure ?? "" });
    if (target === "budget") setBudget(next.budget ?? { currency: defaultCurrency(next.nationality), amount: null });

    const lines = [...notes, question(target, next, c)];
    if (target === "done" && next.firstIntent) lines.push(c.say.intentReady(next.firstIntent));
    agentSays(lines, () => setStep(target));
  };

  // Reads a typed sentence as a directory topic: a procedure name first, then a treatment group, then an area.
  const topicFromText = (text: string): DirectoryTopic | undefined => {
    const procedure = findProcedure(text);
    if (procedure) return { kind: "procedure", id: procedure.id };
    const lower = text.toLowerCase();
    const category = CATEGORY_ORDER.find((area) =>
      Object.values(CATEGORY_NAME[area]).some((name) => name && lower.includes(name.toLowerCase())),
    );
    if (category) return { kind: "category", id: category };
    const area = AREAS.find((a) => a !== "other" && lower.includes(c.area[a].toLowerCase()));
    return area ? { kind: "area", id: area } : undefined;
  };

  // What the agent shows from the directory for a topic, before onboarding continues.
  const directoryAnswer = (topic: DirectoryTopic): AgentLine => {
    const clinics = clinicsForTopic(topic);
    if (clinics.length === 0) return c.resultsNone;
    const focus = topic.kind === "procedure" ? [topic.id] : topic.kind === "procedures" ? topic.ids : [];
    const subject =
      topic.kind === "procedure"
        ? procedureLabel(topic.id, locale)
        : topic.kind === "procedures"
          ? topic.ids.map((id) => procedureLabel(id, locale)).join(" · ")
          : topic.kind === "category"
            ? (CATEGORY_NAME[topic.id][locale] ?? CATEGORY_NAME[topic.id].en ?? topic.id)
            : topic.kind === "area"
              ? c.area[topic.id]
              : "";
    const text = topic.kind === "all" ? c.resultsAll(clinics.length) : c.results(subject, clinics.length);
    return { text, clinics: { ids: clinics.map((clinic) => clinic.id), focus } };
  };

  // First message from the landing: keep it as firstIntent, answer from the directory when the message names
  // a procedure, group or area, then start onboarding at the locale step.
  const start = (intent?: string, topic?: DirectoryTopic) => {
    setWindowOpen(true);
    if (started && !intent) return; // already talking: just bring the window back
    setStarted(true);
    if (!intent) {
      agentSays([c.say.locale]);
      return;
    }
    setMessages([message("user", intent)]);
    setDraft({ ...EMPTY_DRAFT, firstIntent: intent });
    const resolved = topic ?? topicFromText(intent);
    agentSays(resolved ? [directoryAnswer(resolved), c.say.locale] : [c.say.intentAck(intent), c.say.locale]);
  };

  // A tap or a typed line on the landing: the first one starts the conversation, later ones join it.
  const ask = (text: string, topic?: DirectoryTopic) => {
    if (!started) return start(text, topic);
    setWindowOpen(true);
    setMessages((prev) => [...prev, message("user", text)]);
    const resolved = topic ?? topicFromText(text);
    agentSays([resolved ? directoryAnswer(resolved) : c.say.intentAck(text)]);
  };

  // Requests handed over from other screens (clinic list, clinic detail) through the agent context:
  // they arrive here after AgentDock brings the customer back to the landing.
  const { pending, clearPending } = useAgent();
  useEffect(() => {
    if (!pending) return;
    ask(pending.text, pending.topic);
    clearPending(pending.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const nudge = (userText: string, line: string) => {
    setMessages((prev) => [...prev, message("user", userText)]);
    agentSays([line]);
  };

  const chooseLocale = (value: Locale) => {
    if (value !== locale) {
      // the page reloads in the new language: hand the answers over so the conversation goes on there
      try {
        sessionStorage.setItem(
          HANDOFF_KEY,
          JSON.stringify({ draft: { ...draft, locale: value, languages: [value] }, at: Date.now() }),
        );
      } catch {
        /* storage blocked: the conversation restarts in the new language */
      }
      router.push(`/${value}`);
      return;
    }
    advance({ ...draft, locale: value, languages: [value] }, LOCALE_NAME[value]);
  };

  const editStep = (target: StepId) => {
    setMessages((prev) => [...prev, message("user", c.slots[STEP_SLOT[target] ?? "nickname"])]);
    setPickingEdit(false);
    setReturnToSummary(true);
    if (target === "trip") setRange({ start: draft.trip.arrival ?? "", end: draft.trip.departure ?? "" });
    if (target === "concerns") setConcerns(draft.concerns);
    if (target === "languages") setLanguages(draft.languages);
    if (target === "downtime" && draft.downtime !== undefined) setDowntime(draft.downtime);
    if (target === "budget") setBudget(draft.budget ?? { currency: defaultCurrency(draft.nationality), amount: null });
    agentSays([question(target, draft, c)], () => setStep(target));
  };

  const handleText = (text: string) => {
    switch (step) {
      case "locale": {
        const value = matchOption(text, LOCALE_NAME);
        return value ? chooseLocale(value) : nudge(text, c.nudge);
      }
      case "nickname":
        return advance({ ...draft, nickname: text }, text);
      case "nationality": {
        const value = matchOption(text, c.nationality);
        return value ? advance({ ...draft, nationality: value }, text) : nudge(text, c.nudge);
      }
      case "residency": {
        const value = matchOption(text, c.residency);
        if (!value) return nudge(text, c.nudge);
        return advance({ ...draft, residency: value }, text, value === "resident" ? [c.say.residentNote] : []);
      }
      case "ageBand": {
        const value = matchOption(text, c.ageBand);
        return value ? advance({ ...draft, ageBand: value }, text) : nudge(text, c.nudge);
      }
      case "stayArea": {
        const value = matchOption(text, c.area);
        return value ? advance({ ...draft, trip: { ...draft.trip, stayArea: value } }, text) : nudge(text, c.nudge);
      }
      case "history":
        return advance({ ...draft, history: text }, text);
      case "pregnant": {
        const value = matchOption(text, { yes: c.yes, no: c.no });
        return value ? advance({ ...draft, pregnant: value === "yes" }, text) : nudge(text, c.nudge);
      }
      case "channel": {
        const value = matchOption(text, c.channel);
        return value ? advance({ ...draft, channel: value }, text) : nudge(text, c.nudge);
      }
      case "handle":
        return advance({ ...draft, handle: text }, text);
      default:
        return nudge(text, c.widgetNudge);
    }
  };

  const submitConsents = () => {
    if (BLOCKING_CONSENTS.some((type) => draft.consents[type] !== true)) {
      agentSays([c.say.consentBlocked]);
      return;
    }
    const agreed = CONSENTS.filter((type) => draft.consents[type]).map((type) => c.consents[type].title);
    advance(draft, agreed.join(" · "), draft.consents.sensitiveHealth ? [] : [c.say.sensitiveDeclined]);
  };

  // Picks the conversation up after a language switch, in the new locale and with the window open.
  useEffect(() => {
    let handoff: { draft: Draft; at: number } | null = null;
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      handoff = raw ? JSON.parse(raw) : null;
    } catch {
      handoff = null;
    }
    if (!handoff || Date.now() - handoff.at > HANDOFF_MAX_AGE_MS || handoff.draft.locale !== locale) return;
    resumed.current = true;
    const next = handoff.draft;
    const target = nextStep("locale", next);
    setStarted(true);
    setWindowOpen(true);
    // replaces instead of appending, so a repeated effect run (React strict mode) never doubles the line
    setMessages([message("user", LOCALE_NAME[locale])]);
    setDraft(next);
    agentSays([question(target, next, c)], () => {
      setStep(target);
      try {
        sessionStorage.removeItem(HANDOFF_KEY);
      } catch {
        /* nothing to clean up */
      }
    });
    // runs once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First visit: a spotlight tour over the landing. The agent window opens only when the customer asks
  // something, so the landing never shows two places to type at once.
  // ?tour replays it. When storage is blocked there is no tour, so nobody gets it on every load.
  // ?start comes from the sign-up page and opens the conversation right away instead.
  useEffect(() => {
    if (resumed.current) return;
    if (new URLSearchParams(window.location.search).has("start")) {
      window.history.replaceState(null, "", window.location.pathname);
      start();
      return;
    }
    let skip = true;
    try {
      skip = localStorage.getItem(TOUR_SEEN_KEY) !== null && !new URLSearchParams(window.location.search).has("tour");
    } catch {
      skip = true;
    }
    if (skip) return;
    const timer = window.setTimeout(() => setTourOpen(true), SPLASH_MS);
    return () => window.clearTimeout(timer);
    // runs once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishTour = () => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      /* the tour may show again */
    }
    setTourOpen(false);
  };

  const percent = progressPercent(draft);
  const done = step === "done";
  const card = buildAgentCard(done);
  const today = DEMO_TODAY;

  const widget = () => {
    switch (step) {
      case "locale":
        return (
          <ChipGroup
            label={c.slots.locale}
            options={LOCALES.map((value) => ({ value, label: LOCALE_NAME[value] }))}
            value={draft.locale ?? null}
            onChange={chooseLocale}
          />
        );
      case "consent":
        return (
          <div className="flex flex-col gap-sp-3">
            {CONSENTS.map((type) => (
              <ConsentCard
                key={type}
                title={c.consents[type].title}
                description={c.consents[type].description}
                requiredLabel={REQUIRED_CONSENTS.includes(type) ? c.required : c.optional}
                agreeLabel={c.agree}
                declineLabel={c.decline}
                value={draft.consents[type] ?? null}
                onChange={(granted) => setDraft({ ...draft, consents: { ...draft.consents, [type]: granted } })}
              />
            ))}
            <Button
              fullWidth
              disabled={REQUIRED_CONSENTS.some((type) => draft.consents[type] === undefined)}
              onClick={submitConsents}
            >
              {c.next}
            </Button>
          </div>
        );
      case "nationality":
        return (
          <ChipGroup
            label={c.slots.nationality}
            options={NATIONALITIES.map((value) => ({ value, label: c.nationality[value] }))}
            value={draft.nationality ?? null}
            onChange={(value) => advance({ ...draft, nationality: value }, c.nationality[value])}
          />
        );
      case "residency":
        return (
          <ChipGroup
            label={c.slots.residency}
            options={RESIDENCIES.map((value) => ({ value, label: c.residency[value] }))}
            value={draft.residency ?? null}
            onChange={(value) =>
              advance({ ...draft, residency: value }, c.residency[value], value === "resident" ? [c.say.residentNote] : [])
            }
          />
        );
      case "ageBand":
        return (
          <ChipGroup
            label={c.slots.ageBand}
            options={AGE_BANDS.map((value) => ({ value, label: c.ageBand[value] }))}
            value={draft.ageBand ?? null}
            onChange={(value) => advance({ ...draft, ageBand: value }, c.ageBand[value])}
          />
        );
      case "trip":
        return (
          <Card className="flex flex-col gap-sp-3">
            <WidgetDateRange value={range} onChange={setRange} startLabel={c.dates.start} endLabel={c.dates.end} min={today} />
            <Button
              fullWidth
              disabled={!range.start || !range.end}
              onClick={() =>
                advance(
                  { ...draft, trip: { ...draft.trip, arrival: range.start, departure: range.end } },
                  `${range.start} ~ ${range.end}`,
                )
              }
            >
              {c.next}
            </Button>
          </Card>
        );
      case "stayArea":
        return (
          <div className="flex flex-col gap-sp-2">
            <ChipGroup
              label={c.slots.stayArea}
              options={AREAS.map((value) => ({ value, label: c.area[value] }))}
              value={draft.trip.stayArea ?? null}
              onChange={(value) => advance({ ...draft, trip: { ...draft.trip, stayArea: value } }, c.area[value])}
            />
            <Button variant="ghost" className="self-start" onClick={() => advance(draft, c.skip)}>
              {c.skip}
            </Button>
          </div>
        );
      case "concerns":
        return (
          <div className="flex flex-col gap-sp-3">
            <ChipGroup
              multiple
              label={c.slots.concerns}
              options={CONCERNS.map((value) => ({ value, label: c.concern[value] }))}
              value={concerns}
              onChange={setConcerns}
            />
            <Button
              fullWidth
              disabled={concerns.length === 0}
              onClick={() => advance({ ...draft, concerns }, concerns.map((value) => c.concern[value]).join(" · "))}
            >
              {c.next}
            </Button>
          </div>
        );
      case "history":
        return (
          <ChipGroup
            label={c.slots.history}
            options={[
              { value: "yes", label: c.historyYes },
              { value: "none", label: c.historyNone },
            ]}
            value={null}
            // "yes" asks for the details; the typed answer then fills the history slot
            onChange={(value) =>
              value === "yes" ? nudge(c.historyYes, c.say.historyDetail) : advance({ ...draft, history: c.historyNone }, c.historyNone)
            }
          />
        );
      case "pregnant":
        return (
          <ChipGroup
            label={c.slots.pregnant}
            options={[
              { value: "yes", label: c.yes },
              { value: "no", label: c.no },
            ]}
            value={draft.pregnant === undefined ? null : draft.pregnant ? "yes" : "no"}
            onChange={(value) => advance({ ...draft, pregnant: value === "yes" }, value === "yes" ? c.yes : c.no)}
          />
        );
      case "budget":
        return (
          <Card className="flex flex-col gap-sp-3">
            <WidgetCurrency
              value={budget}
              onChange={setBudget}
              currencies={CURRENCIES}
              rates={FX_RATES}
              currencyLabel={c.currency.currency}
              amountLabel={c.currency.amount}
              rateNote={c.currency.rateNote}
            />
            <div className="flex flex-col gap-sp-2 sm:flex-row">
              <Button
                fullWidth
                disabled={budget.amount === null}
                onClick={() => {
                  if (budget.amount === null) return;
                  advance(
                    { ...draft, budget: { currency: budget.currency, amount: budget.amount } },
                    `${budget.currency} ${budget.amount.toLocaleString("en-US")}`,
                  );
                }}
              >
                {c.next}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => advance(draft, c.skip)}>
                {c.skip}
              </Button>
            </div>
          </Card>
        );
      case "downtime":
        return (
          <Card className="flex flex-col gap-sp-3">
            <WidgetSlider
              label={c.downtimeLabel}
              steps={DOWNTIME_DAYS.map((value) => ({ value, label: c.days(value) }))}
              value={downtime}
              onChange={setDowntime}
            />
            <div className="flex flex-col gap-sp-2 sm:flex-row">
              <Button fullWidth onClick={() => advance({ ...draft, downtime }, c.days(downtime))}>
                {c.next}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => advance(draft, c.skip)}>
                {c.skip}
              </Button>
            </div>
          </Card>
        );
      case "languages":
        return (
          <div className="flex flex-col gap-sp-3">
            <ChipGroup
              multiple
              label={c.slots.languages}
              options={LOCALES.map((value) => ({ value, label: LOCALE_NAME[value] }))}
              value={languages}
              onChange={setLanguages}
            />
            <Button
              fullWidth
              disabled={languages.length === 0}
              onClick={() => advance({ ...draft, languages }, languages.map((value) => LOCALE_NAME[value]).join(" · "))}
            >
              {c.next}
            </Button>
          </div>
        );
      case "channel":
        return (
          <ChipGroup
            label={c.slots.channel}
            options={CHANNELS.map((value) => ({ value, label: c.channel[value] }))}
            value={draft.channel ?? null}
            onChange={(value) => advance({ ...draft, channel: value }, c.channel[value])}
          />
        );
      case "summary":
        return (
          <Card className="flex flex-col gap-sp-4">
            <CardHeader title={c.summary.title} />
            <SlotList draft={draft} copy={c} locale={locale} />
            {pickingEdit ? (
              <ChipGroup
                label={c.say.editPick}
                options={EDITABLE_STEPS.filter((s) => isStepApplicable(s, draft)).map((s) => ({
                  value: s,
                  label: c.slots[STEP_SLOT[s] ?? "nickname"],
                }))}
                value={null}
                onChange={editStep}
              />
            ) : (
              <div className="flex flex-col gap-sp-2 sm:flex-row">
                <Button fullWidth onClick={() => advance(draft, c.summary.create)}>
                  {c.summary.create}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setMessages((prev) => [...prev, message("user", c.summary.edit)]);
                    agentSays([c.say.editPick], () => setPickingEdit(true));
                  }}
                >
                  {c.summary.edit}
                </Button>
              </div>
            )}
          </Card>
        );
      case "done":
        return (
          <Button
            fullWidth
            onClick={() => {
              updateDemoState((state) => ({ ...state, nickname: draft.nickname }));
              router.push(`/${locale}/home`);
            }}
          >
            {c.goHome}
          </Button>
        );
      default:
        return null;
    }
  };

  // Checklist of the onboarding slots: answered or passed steps are done, the open one is active, and a
  // declined required consent shows as an error.
  const currentIndex = STEP_ORDER.indexOf(step);
  const declinedRequired = BLOCKING_CONSENTS.some((type) => draft.consents[type] === false);
  const taskSteps: TaskStep[] = [
    ...(draft.firstIntent
      ? [{ id: "firstIntent", label: c.slots.firstIntent, value: draft.firstIntent, status: "done" as const }]
      : []),
    ...STEP_ORDER.filter((s) => STEP_SLOT[s] && isStepApplicable(s, draft)).map((s): TaskStep => {
      const answer = slotValue(s, draft, c, locale);
      const agreed = CONSENTS.filter((type) => draft.consents[type]).length;
      const passed = STEP_ORDER.indexOf(s) < currentIndex;
      // the language answer is pre-filled from the page language, so it only counts once the step was reached
      const answered = answer !== undefined && (s !== "languages" || passed);
      let status: TaskStep["status"] = s === step ? "active" : answered || passed ? "done" : "pending";
      if (s === "consent" && declinedRequired) status = "error";
      return {
        id: s,
        label: c.slots[STEP_SLOT[s] ?? "nickname"],
        value: s === "consent" ? (agreed > 0 ? `${agreed}/${CONSENTS.length}` : undefined) : s === "languages" && !passed && s !== step ? undefined : answer,
        status,
      };
    }),
  ];

  const checklist = (
    <Card className="flex flex-col gap-sp-3">
      <CardHeader title={done ? c.doneTitle : c.previewTitle} description={c.progress(percent)} />
      <TaskSteps steps={taskSteps} label={c.previewTitle} statusLabels={c.taskStatus} />
    </Card>
  );

  const preview = (
    <div className="flex flex-col gap-sp-4">
      {checklist}
      <AgentCardView card={card} labels={c.agentCard} />
    </div>
  );

  // One screen for both phases: the sunrise backdrop and the gateway flow stay mounted, the hero copy turns into
  // the conversation in place, and the input stays where it was.
  const heroMain = (
    <main className="relative flex flex-1 flex-col items-center justify-center px-sp-4 pb-sp-12 pt-sp-12">
      <div className="mb-sp-6 flex w-full max-w-2xl flex-col items-center gap-sp-2 text-center">
        <h1 className="type-hero text-balance">{intro.title}</h1>
        <p className="text-balance text-body text-muted">{intro.body}</p>
      </div>
      <div
        className="flex w-full max-w-2xl flex-col gap-sp-6"
        onFocus={() => setEngaged(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEngaged(false);
        }}
      >
        <div data-tour="input">
          <ChatInput
            collapsible
            onSend={(text) => ask(text)}
            label={c.inputLabel}
            sendLabel={c.send}
            placeholder={c.placeholder}
            hint={<span className="hidden sm:inline">{c.inputHint}</span>}
          />
        </div>
        <div role="group" aria-label={intro.suggestionsLabel} className="flex flex-wrap justify-center gap-sp-2">
          {intro.suggestions.map((suggestion) => (
            <Chip key={suggestion} onClick={() => ask(suggestion)}>
              {suggestion}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-sp-2">
          <Button variant="ghost" onClick={() => start()}>
            {intro.startPlain}
          </Button>
          <Link href="/signup" data-tour="signup" className={buttonStyles({ variant: "secondary" })}>
            {intro.signup.toggle}
          </Link>
        </div>
      </div>
    </main>
  );

  // The conversation itself, shown in the agent window over the landing or, expanded, on the whole screen.
  const conversationLog = (
    <div role="log" aria-live="polite" className="flex flex-col gap-sp-3">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-sp-2">
          <ChatBubble from={m.from} avatar={m.from === "agent" ? <AgentOrb /> : null}>
            {m.text}
          </ChatBubble>
          {m.clinics ? (
            <ClinicCarousel
              clinics={m.clinics.ids.flatMap((id) => DIRECTORY.filter((clinic) => clinic.id === id))}
              focus={m.clinics.focus}
              locale={locale}
              areaName={(area) => c.area[area]}
              labels={c.clinicCard}
            />
          ) : null}
        </div>
      ))}
      {typing ? <ChatBubble from="agent" avatar={<AgentOrb />}>{`${c.typing}...`}</ChatBubble> : null}
      {!typing ? widget() : null}
      <div ref={endRef} />
    </div>
  );

  const composer = (
    <ChatInput
      onSend={handleText}
      label={c.inputLabel}
      sendLabel={c.send}
      placeholder={c.placeholder}
      disabled={typing || done}
      hint={<span className="hidden sm:inline">{c.inputHint}</span>}
    />
  );

  // Expanding morphs the window into the whole screen (both carry the agent-surface view transition name),
  // then the full layout settles in. Without the View Transitions API, or with reduced motion, it just switches.
  const expand = () => {
    const apply = () => {
      setSurface("full");
      setWindowOpen(false);
    };
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    doc.startViewTransition(() => flushSync(apply));
  };

  const chatMain = (
    <main className="agent-surface relative flex min-h-0 flex-1 px-sp-4 lg:gap-sp-8 lg:px-sp-6">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center">
        <h1 className="sr-only">{c.title}</h1>
        <div className="min-h-0 w-full max-w-2xl flex-1 overflow-y-auto py-sp-4">{conversationLog}</div>
        <div className="w-full max-w-2xl pb-sp-6 pt-sp-2">{composer}</div>
      </div>
      <aside className="hidden w-full max-w-xs shrink-0 overflow-y-auto py-sp-4 lg:block">{checklist}</aside>
    </main>
  );

  return (
    <div lang={locale} className={cn("flex flex-col", full ? "h-dvh" : "min-h-dvh")}>
      {full || splashOver ? null : <Splash wordmark={intro.wordmark} />}
      <div className={cn("theme-sunrise relative flex flex-col", full && "min-h-0 flex-1 overflow-hidden")}>
        <section className={cn("relative flex flex-col overflow-hidden", full && "min-h-0 flex-1")}>
          <GatewayFlow className="absolute inset-0" quiet={engaged || started} />
          <header className="relative z-10 flex items-center justify-between gap-sp-3 px-sp-4 py-sp-2 md:px-sp-6">
            {/* signed in: the customer's home. Otherwise back to a fresh landing; a full load drops the conversation */}
            {signedIn ? (
              <Link href="/home" className={cn("type-hero rounded-md", focusRing)}>
                {intro.wordmark}
              </Link>
            ) : (
              <a href={`/${locale}`} className={cn("type-hero rounded-md", focusRing)}>
                {intro.wordmark}
              </a>
            )}
            <div className="flex items-center gap-sp-2">
              {/* hidden once the customer has answered: this switch reloads the page and would drop the answers.
                  Inside the conversation the language chips carry them over. */}
              {messages.some((m) => m.from === "user") ? null : <LocaleSwitcher label={intro.languageLabel} />}
              {full ? (
                <Button variant="secondary" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
                  <span className="tabular-nums">{c.progress(percent)}</span>
                </Button>
              ) : null}
            </div>
          </header>
          {full ? chatMain : heroMain}
        </section>
        {full ? null : <LandingHome locale={locale} onAsk={ask} />}
      </div>
      {full ? null : footer}
      {/* log-in only: proxy.ts sends signed-out visitors of app routes here with ?auth=login&next=, which
          opens it by itself. Signing up is its own page (/signup). Sits outside the sunrise section. */}
      <AuthDialog
        open={false}
        onClose={() => undefined}
        brand={intro.wordmark}
        copy={intro.signup}
        personas={intro.signup.personas}
        onDone={() => start()}
      />
      {full ? null : (
        <AgentWindow
          open={windowOpen}
          onOpenChange={(open) => (open ? start() : setWindowOpen(false))}
          labels={intro.agentWindow}
          onExpand={expand}
          focusOnOpen={!tourOpen}
          inputReady={!typing && !done}
          // no launcher before the first question: the hero input is the one place to start
          hideLauncher={tourOpen || !started}
          headerExtra={
            started ? (
              <Button variant="ghost" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
                <span className="tabular-nums">{c.progress(percent)}</span>
              </Button>
            ) : null
          }
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-sp-4 py-sp-3">{conversationLog}</div>
          <div className="px-sp-3 pb-sp-3 pt-sp-2">{composer}</div>
        </AgentWindow>
      )}
      {tourOpen ? (
        <SpotlightTour
          steps={intro.tour.steps.map((step, i) => ({ ...step, target: TOUR_TARGETS[i] }))}
          labels={intro.tour}
          onFinish={finishTour}
        />
      ) : null}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={c.previewTitle} closeLabel={c.close}>
        {preview}
      </Sheet>
    </div>
  );
}

// What the customer answered for a step, or undefined while it is open.
function slotValue(step: StepId, draft: Draft, c: OnboardingCopy, locale: Locale): ReactNode {
  switch (step) {
    case "locale":
      return draft.locale ? LOCALE_NAME[draft.locale] : undefined;
    case "consent": {
      const agreed = CONSENTS.filter((type) => draft.consents[type]).map((type) => c.consents[type].title);
      return agreed.length > 0 ? agreed.join(" · ") : undefined;
    }
    case "nickname":
      return draft.nickname;
    case "nationality":
      return draft.nationality ? c.nationality[draft.nationality] : undefined;
    case "residency":
      return draft.residency ? c.residency[draft.residency] : undefined;
    case "ageBand":
      return draft.ageBand ? c.ageBand[draft.ageBand] : undefined;
    case "trip":
      return draft.trip.arrival && draft.trip.departure ? `${draft.trip.arrival} ~ ${draft.trip.departure}` : undefined;
    case "stayArea":
      return draft.trip.stayArea ? c.area[draft.trip.stayArea] : undefined;
    case "concerns":
      return draft.concerns.length > 0 ? draft.concerns.map((v) => c.concern[v]).join(" · ") : undefined;
    case "history":
      return draft.history;
    case "pregnant":
      return draft.pregnant === undefined ? undefined : draft.pregnant ? c.yes : c.no;
    case "budget": {
      if (!draft.budget) return undefined;
      const { currency, amount } = draft.budget;
      const krw = Math.round(amount * FX_RATES[currency]);
      const reference = currency === "KRW" ? undefined : { currency: currency as ReferenceCurrency, amount };
      return <Money krw={krw} reference={reference} locale={locale} />;
    }
    case "downtime":
      return draft.downtime === undefined ? undefined : c.days(draft.downtime);
    case "languages":
      return draft.languages.length > 0 ? draft.languages.map((v) => LOCALE_NAME[v]).join(" · ") : undefined;
    case "channel":
      return draft.channel ? c.channel[draft.channel] : undefined;
    case "handle":
      return draft.handle;
    default:
      return undefined;
  }
}

// Live slot rows for the agent preview and the summary card. Empty values show a middle dot.
function SlotList({ draft, copy: c, locale }: { draft: Draft; copy: OnboardingCopy; locale: Locale }) {
  const value = (step: StepId) => slotValue(step, draft, c, locale);

  const rows = STEP_ORDER.filter((step) => STEP_SLOT[step] && isStepApplicable(step, draft));

  return (
    <dl className="flex flex-col gap-sp-2">
      {rows.map((step) => (
        <div key={step} className="flex items-baseline justify-between gap-sp-3">
          <dt className="shrink-0 text-label text-muted">{c.slots[STEP_SLOT[step] ?? "nickname"]}</dt>
          <dd className="min-w-0 break-words text-end text-body">{value(step) ?? <span className="text-subtle">·</span>}</dd>
        </div>
      ))}
      {draft.firstIntent ? (
        <div className="flex items-baseline justify-between gap-sp-3">
          <dt className="shrink-0 text-label text-muted">{c.slots.firstIntent}</dt>
          <dd className="min-w-0 break-words text-end text-body">{draft.firstIntent}</dd>
        </div>
      ) : null}
    </dl>
  );
}
