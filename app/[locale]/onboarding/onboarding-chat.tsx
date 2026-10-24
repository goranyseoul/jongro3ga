"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  WidgetDateRange,
  WidgetSlider,
  type CurrencyAmount,
  type DateRange,
} from "@/components/ui";
import { AgentWindow } from "@/components/customer/agent-window";
import { AuthDialog, type AuthCopy } from "@/components/customer/auth-dialog";
import { ClinicCarousel } from "@/components/customer/clinic-carousel";
import { LocaleSwitcher } from "@/components/customer/locale-switcher";
import { SpotlightTour } from "@/components/customer/spotlight-tour";
import { TaskSteps, type TaskStep } from "@/components/customer/task-steps";
import { updateDemoState } from "@/components/customer/demo-state";
import type { Concern, Locale } from "@/lib/domain/common";
import type { ReferenceCurrency } from "@/lib/money";
import { cn } from "@/lib/cn";
import { readSse } from "@/lib/llm/sse";
import {
  AGE_BANDS,
  AREAS,
  BLOCKING_CONSENTS,
  CHANNELS,
  CONCERNS,
  CONSENT_TYPES,
  CURRENCIES,
  DOWNTIME_DAYS,
  FX_RATES,
  NATIONALITY_OPTIONS,
  REQUIRED_CONSENTS,
  RESIDENCIES,
  SLOTS,
  UNKNOWN_NATIONALITY,
  defaultCurrency,
  emptyDraft,
  progressPercent,
  slotDef,
  type ConsentType,
  type NationalityOption,
  type OnboardingDraft,
  type SlotId,
  type WidgetSpec,
} from "@/lib/llm/onboarding/slots";
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
import { ParticleField } from "../hero/particle-field";
import { Splash } from "../hero/splash";
import { COPY, type OnboardingCopy } from "./copy";
import { buildAgentCard, type SlotKey } from "./mock";

// The landing and onboarding chat. The onboarding conversation comes from POST /api/onboarding/customer
// (04-onboarding-chat.md): the server streams the agent's text, profile patches and the next widget, and this
// screen renders them and sends back what the customer typed or tapped. Directory answers (the clinic
// carousel for a procedure, group or area) are local, so they show at once without waiting for the agent.

type Clinics = { ids: string[]; focus: string[] };
type Message = { id: string; from: "agent" | "user"; text: string; clinics?: Clinics };
type AgentLine = string | { text: string; clinics: Clinics };

type DoneData = {
  sessionId: string;
  status: "active" | "completed";
  nextSlot: SlotId | "summary" | null;
  draft: OnboardingDraft;
  today: string;
  profile?: { agentId: string; nickname: string };
  saved?: "account" | "demo_fallback" | "error";
};

type TurnBody = { message: string; widgetValue?: { slot: string; value?: unknown; skip?: boolean } };

const SLOT_LABEL: Record<SlotId, SlotKey> = {
  locale: "locale",
  consents: "consents",
  nickname: "nickname",
  nationality: "nationality",
  residency: "residency",
  ageBand: "ageBand",
  trip: "trip",
  "trip.stayArea": "stayArea",
  "skin.concerns": "concerns",
  history: "history",
  "safety.pregnantOrBreastfeeding": "pregnant",
  "prefs.budgetKrw": "budget",
  "prefs.downtimeToleranceDays": "downtime",
  "prefs.languagesNeeded": "languages",
  "contact.channel": "channel",
  "contact.handle": "handle",
};

/** Slots the summary card can reopen. Locale and consents are changed elsewhere. */
const EDITABLE: SlotId[] = SLOTS.map((slot) => slot.id).filter((id) => id !== "locale" && id !== "consents");

function newSessionId(): string {
  return `onb_${crypto.randomUUID().replace(/-/g, "")}`;
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
const TOUR_TARGETS = ["input", "topics", "signup", "agent"] as const;
const TOUR_SEEN_KEY = "pibook.tour.v1";
// A language chip reloads the page in the new locale; the onboarding session id travels through
// sessionStorage for a moment so the server-side conversation goes on there.
const HANDOFF_KEY = "pibook.onboarding.handoff";
const HANDOFF_MAX_AGE_MS = 120_000;
// the entry splash plays 1.5s and fades; the tour and the first greeting wait for it
const SPLASH_MS = 2600;
const WINDOW_WIDTH_QUERY = "(min-width: 768px)";

export function OnboardingChat({ locale, intro, footer }: { locale: Locale; intro: OnboardingIntro; footer: ReactNode }) {
  const c = COPY[locale];
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [widget, setWidget] = useState<WidgetSpec | null>(null);
  const [nextSlot, setNextSlot] = useState<SlotId | "summary" | null>("locale");
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [today, setToday] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [pickingEdit, setPickingEdit] = useState(false);
  // "yes" on past procedures: the next typed line is the detail that fills the history slot
  const [awaitingHistory, setAwaitingHistory] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The conversation lives in a window over the landing; "full" is the whole-screen view of it.
  const [surface, setSurface] = useState<"window" | "full">("window");
  const [windowOpen, setWindowOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [splashOver, setSplashOver] = useState(false);
  const full = started && surface === "full";
  const resumed = useRef(false);
  // read by callbacks scheduled before a re-render (the tour timer), so a second call never posts a second greeting
  const startedRef = useRef(false);

  // widget values that are only sent when the customer presses next
  const [consents, setConsents] = useState<Partial<Record<ConsentType, boolean>>>({});
  const [range, setRange] = useState<DateRange>({ start: "", end: "" });
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [budget, setBudget] = useState<CurrencyAmount>({ currency: "KRW", amount: null });
  const [downtime, setDowntime] = useState<number>(DOWNTIME_DAYS[1]);
  const [languages, setLanguages] = useState<Locale[]>([locale]);

  const sessionId = useRef("");
  // bumped when the conversation restarts, so a reply still streaming for the old session is dropped
  const generation = useRef(0);
  const spoke = useRef(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashOver(true), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, widget, pickingEdit]);

  const message = (from: Message["from"], text: string): Message => ({ id: `m${nextId.current++}`, from, text });
  const agentMessage = (line: AgentLine): Message =>
    typeof line === "string" ? message("agent", line) : { ...message("agent", line.text), clinics: line.clinics };
  const addMessages = (...next: Message[]) => setMessages((prev) => [...prev, ...next]);

  // Prefill the widget the server asked for from what is already known.
  const prepareWidget = (next: WidgetSpec, known: OnboardingDraft) => {
    if (next.slot === "consents") setConsents(known.consents);
    if (next.slot === "trip") setRange({ start: known.trip.arrival ?? "", end: known.trip.departure ?? "" });
    if (next.slot === "skin.concerns") setConcerns(known.skin.concerns);
    if (next.slot === "prefs.budgetKrw") {
      setBudget(known.prefs.budgetInput ?? { currency: defaultCurrency(known.nationality), amount: null });
    }
    if (next.slot === "prefs.downtimeToleranceDays" && known.prefs.downtimeToleranceDays !== undefined) {
      setDowntime(known.prefs.downtimeToleranceDays);
    }
    if (next.slot === "prefs.languagesNeeded") {
      setLanguages(known.prefs.languagesNeeded.length > 0 ? known.prefs.languagesNeeded : [known.locale ?? locale]);
    }
  };

  // One onboarding turn: post it, stream the agent's text into the log, then show the widget the server asked for.
  const send = async (body: TurnBody, userText?: string) => {
    if (userText) {
      spoke.current = true;
      addMessages(message("user", userText));
    }
    const gen = generation.current;
    const current = () => gen === generation.current;
    setBusy(true);
    setStreaming(false);
    setWidget(null);
    setPickingEdit(false);
    setAwaitingHistory(false);
    if (!sessionId.current) sessionId.current = newSessionId();

    let latest = draft;
    let pendingWidget: WidgetSpec | null = null;
    try {
      const response = await fetch("/api/onboarding/customer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, locale, ...body }),
      });
      if (!response.ok || !response.body) throw new Error(`onboarding ${response.status}`);
      await readSse(response.body, ({ event, data }) => {
        if (!current()) return;
        if (event === "text") {
          const { id: serverId, delta } = data as { id: string; delta: string };
          const id = `s${gen}-${serverId}`;
          setStreaming(true);
          setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === id);
            if (index < 0) return [...prev, { id, from: "agent", text: delta }];
            const next = prev.slice();
            next[index] = { ...next[index]!, text: next[index]!.text + delta };
            return next;
          });
        } else if (event === "profile_patch") {
          latest = (data as { draft: OnboardingDraft }).draft;
          setDraft(latest);
        } else if (event === "widget") {
          pendingWidget = (data as { widget: WidgetSpec }).widget;
        } else if (event === "done") {
          const done = data as DoneData;
          latest = done.draft;
          setDraft(done.draft);
          setNextSlot(done.nextSlot);
          setStatus(done.status);
          setToday(done.today);
          if (done.status === "completed" && done.profile) {
            setAgentId(done.profile.agentId);
            // signed out or the account save failed: keep the nickname in the browser demo state
            if (done.saved !== "account") updateDemoState((state) => ({ ...state, nickname: done.profile!.nickname }));
          }
        }
      });
      if (!current()) return;
      if (pendingWidget) {
        prepareWidget(pendingWidget, latest);
        setWidget(pendingWidget);
      }
    } catch {
      if (!current()) return;
      addMessages(message("agent", c.connectionError));
      setWidget(pendingWidget);
    } finally {
      if (current()) {
        setBusy(false);
        setStreaming(false);
      }
    }
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

  // What the agent shows from the directory for a topic, alongside the onboarding conversation.
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

  // Opens the window and, the first time, starts the onboarding conversation with the agent's greeting.
  const start = () => {
    setWindowOpen(true);
    if (startedRef.current) return; // already talking: just bring the window back
    startedRef.current = true;
    setStarted(true);
    void send({ message: "" });
  };

  // The customer's first line: answered from the directory right away when it names a procedure, group or
  // area, and sent to the agent, which keeps it as firstIntent. A greeting already on screen (the tour opens
  // the window first) is replaced by a fresh conversation that starts from this line.
  const startWithIntent = (intent: string, topic?: DirectoryTopic) => {
    generation.current += 1;
    sessionId.current = "";
    spoke.current = true;
    startedRef.current = true;
    setWindowOpen(true);
    setStarted(true);
    setWidget(null);
    setDraft(emptyDraft());
    setNextSlot("locale");
    const resolved = topic ?? topicFromText(intent);
    setMessages([message("user", intent), ...(resolved ? [agentMessage(directoryAnswer(resolved))] : [])]);
    void send({ message: intent });
  };

  // A tap or a typed line on the landing: the first one starts the conversation, later ones join it with a
  // directory answer while the onboarding question stays where it is.
  const ask = (text: string, topic?: DirectoryTopic) => {
    if (!spoke.current) return startWithIntent(text, topic);
    setWindowOpen(true);
    const resolved = topic ?? topicFromText(text);
    addMessages(message("user", text), agentMessage(resolved ? directoryAnswer(resolved) : c.say.intentAck(text)));
  };

  const answer = (slot: SlotId | "summary", value: unknown, label: string) => void send({ message: label, widgetValue: { slot, value } }, label);
  const skip = (slot: SlotId) => void send({ message: c.skip, widgetValue: { slot, skip: true } }, c.skip);

  const chooseLocale = (value: Locale) => {
    if (value !== locale) {
      // the page reloads in the new language: hand the session over so the conversation goes on there
      try {
        if (!sessionId.current) sessionId.current = newSessionId();
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ sessionId: sessionId.current, locale: value, at: Date.now() }));
      } catch {
        /* storage blocked: the conversation restarts in the new language */
      }
      router.push(`/${value}`);
      return;
    }
    answer("locale", value, LOCALE_NAME[value]);
  };

  const done = status === "completed";
  const handleText = (text: string) => {
    if (busy || done) return;
    if (awaitingHistory) {
      // the detail answer fills the history slot on the server; the text also reaches the agent as typed
      void send({ message: text, widgetValue: { slot: "history", value: text } }, text);
      return;
    }
    void send({ message: text }, text);
  };

  const submitConsents = () => {
    const agreed = CONSENT_TYPES.filter((type) => consents[type]).map((type) => c.consents[type].title);
    answer("consents", consents, agreed.length > 0 ? agreed.join(" · ") : c.decline);
  };

  // Picks the conversation up after a language switch, in the new locale and with the window open.
  useEffect(() => {
    if (resumed.current) return;
    let handoff: { sessionId: string; locale: Locale; at: number } | null = null;
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      handoff = raw ? JSON.parse(raw) : null;
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      handoff = null;
    }
    if (!handoff || Date.now() - handoff.at > HANDOFF_MAX_AGE_MS || handoff.locale !== locale || !handoff.sessionId) return;
    resumed.current = true;
    sessionId.current = handoff.sessionId;
    startedRef.current = true;
    setStarted(true);
    setWindowOpen(true);
    void send({ message: LOCALE_NAME[locale], widgetValue: { slot: "locale", value: locale } }, LOCALE_NAME[locale]);
    // runs once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First visit: a spotlight tour, and on a wide screen the agent window opens beside it and greets right away.
  // ?tour replays it. When storage is blocked there is no tour, so nobody gets it on every load.
  useEffect(() => {
    if (resumed.current) return;
    let skipTour = true;
    try {
      skipTour = localStorage.getItem(TOUR_SEEN_KEY) !== null && !new URLSearchParams(window.location.search).has("tour");
    } catch {
      skipTour = true;
    }
    if (skipTour) return;
    const timer = window.setTimeout(() => {
      setTourOpen(true);
      if (window.matchMedia(WINDOW_WIDTH_QUERY).matches) start();
    }, SPLASH_MS);
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
    start();
  };

  const percent = progressPercent(draft);
  const card = buildAgentCard(done, agentId);
  const firstIntent = draft.firstIntent;

  const renderWidget = () => {
    if (done) {
      return (
        <Button
          fullWidth
          onClick={() =>
            router.push(firstIntent ? `/${locale}/chat?intent=${encodeURIComponent(firstIntent)}` : `/${locale}/home`)
          }
        >
          {firstIntent ? c.goChat : c.goHome}
        </Button>
      );
    }
    if (!widget) return null;
    const optionalSkip = widget.skippable ? (
      <Button variant="ghost" fullWidth onClick={() => skip(widget.slot as SlotId)}>
        {c.skip}
      </Button>
    ) : null;

    switch (widget.slot) {
      case "locale":
        return (
          <ChipGroup
            label={c.slots.locale}
            options={LOCALES.map((value) => ({ value, label: LOCALE_NAME[value] }))}
            value={draft.locale ?? null}
            onChange={chooseLocale}
          />
        );
      case "consents": {
        const types = widget.consentTypes ?? [...CONSENT_TYPES];
        return (
          <div className="flex flex-col gap-sp-3">
            {types.map((type) => (
              <ConsentCard
                key={type}
                title={c.consents[type].title}
                description={c.consents[type].description}
                requiredLabel={REQUIRED_CONSENTS.includes(type) ? c.required : c.optional}
                agreeLabel={c.agree}
                declineLabel={c.decline}
                value={consents[type] ?? null}
                onChange={(granted) => setConsents((prev) => ({ ...prev, [type]: granted }))}
              />
            ))}
            <Button
              fullWidth
              disabled={REQUIRED_CONSENTS.filter((type) => types.includes(type)).some((type) => consents[type] === undefined)}
              onClick={submitConsents}
            >
              {c.next}
            </Button>
          </div>
        );
      }
      case "nationality":
        return (
          <ChipGroup
            label={c.slots.nationality}
            options={NATIONALITY_OPTIONS.map((value) => ({ value, label: c.nationality[value] }))}
            value={nationalityOption(draft.nationality)}
            onChange={(value) => answer("nationality", value, c.nationality[value])}
          />
        );
      case "residency":
        return (
          <ChipGroup
            label={c.slots.residency}
            options={RESIDENCIES.map((value) => ({ value, label: c.residency[value] }))}
            value={draft.residency ?? null}
            onChange={(value) => answer("residency", value, c.residency[value])}
          />
        );
      case "ageBand":
        return (
          <ChipGroup
            label={c.slots.ageBand}
            options={AGE_BANDS.map((value) => ({ value, label: c.ageBand[value] }))}
            value={draft.ageBand ?? null}
            onChange={(value) => answer("ageBand", value, c.ageBand[value])}
          />
        );
      case "trip":
        return (
          <Card className="flex flex-col gap-sp-3">
            <WidgetDateRange
              value={range}
              onChange={setRange}
              startLabel={c.dates.start}
              endLabel={c.dates.end}
              min={today || undefined}
            />
            <Button
              fullWidth
              disabled={!range.start || !range.end}
              onClick={() => answer("trip", { arrival: range.start, departure: range.end }, `${range.start} ~ ${range.end}`)}
            >
              {c.next}
            </Button>
          </Card>
        );
      case "trip.stayArea":
        return (
          <div className="flex flex-col gap-sp-2">
            <ChipGroup
              label={c.slots.stayArea}
              options={AREAS.map((value) => ({ value, label: c.area[value] }))}
              value={draft.trip.stayArea ?? null}
              onChange={(value) => answer("trip.stayArea", value, c.area[value])}
            />
            <Button variant="ghost" className="self-start" onClick={() => skip("trip.stayArea")}>
              {c.skip}
            </Button>
          </div>
        );
      case "skin.concerns":
        return (
          <div className="flex flex-col gap-sp-3">
            <ChipGroup
              multiple
              label={c.slots.concerns}
              options={CONCERNS.map((value) => ({ value, label: c.concern[value] }))}
              value={concerns}
              onChange={(value) => setConcerns(value as Concern[])}
            />
            <Button
              fullWidth
              disabled={concerns.length === 0}
              onClick={() => answer("skin.concerns", concerns, concerns.map((value) => c.concern[value]).join(" · "))}
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
            // "yes" asks for the details; the typed answer then goes to the agent and fills the history slot
            onChange={(value) => {
              if (value === "none") {
                answer("history", "none", c.historyNone);
                return;
              }
              addMessages(message("user", c.historyYes), message("agent", c.say.historyDetail));
              setAwaitingHistory(true);
            }}
          />
        );
      case "safety.pregnantOrBreastfeeding":
        return (
          <ChipGroup
            label={c.slots.pregnant}
            options={[
              { value: "yes", label: c.yes },
              { value: "no", label: c.no },
            ]}
            value={draft.safety.pregnantOrBreastfeeding === undefined ? null : draft.safety.pregnantOrBreastfeeding ? "yes" : "no"}
            onChange={(value) => answer("safety.pregnantOrBreastfeeding", value === "yes", value === "yes" ? c.yes : c.no)}
          />
        );
      case "prefs.budgetKrw":
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
                  answer(
                    "prefs.budgetKrw",
                    { currency: budget.currency, amount: budget.amount },
                    `${budget.currency} ${budget.amount.toLocaleString("en-US")}`,
                  );
                }}
              >
                {c.next}
              </Button>
              {optionalSkip}
            </div>
          </Card>
        );
      case "prefs.downtimeToleranceDays":
        return (
          <Card className="flex flex-col gap-sp-3">
            <WidgetSlider
              label={c.downtimeLabel}
              steps={DOWNTIME_DAYS.map((value) => ({ value, label: c.days(value) }))}
              value={downtime}
              onChange={setDowntime}
            />
            <div className="flex flex-col gap-sp-2 sm:flex-row">
              <Button fullWidth onClick={() => answer("prefs.downtimeToleranceDays", downtime, c.days(downtime))}>
                {c.next}
              </Button>
              {optionalSkip}
            </div>
          </Card>
        );
      case "prefs.languagesNeeded":
        return (
          <div className="flex flex-col gap-sp-3">
            <ChipGroup
              multiple
              label={c.slots.languages}
              options={LOCALES.map((value) => ({ value, label: LOCALE_NAME[value] }))}
              value={languages}
              onChange={(value) => setLanguages(value as Locale[])}
            />
            <Button
              fullWidth
              disabled={languages.length === 0}
              onClick={() => answer("prefs.languagesNeeded", languages, languages.map((value) => LOCALE_NAME[value]).join(" · "))}
            >
              {c.next}
            </Button>
          </div>
        );
      case "contact.channel":
        return (
          <ChipGroup
            label={c.slots.channel}
            options={CHANNELS.map((value) => ({ value, label: c.channel[value] }))}
            value={draft.contact.channel ?? null}
            onChange={(value) => answer("contact.channel", value, c.channel[value])}
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
                options={EDITABLE.filter((id) => slotDef(id)?.applies(draft)).map((id) => ({ value: id, label: c.slots[SLOT_LABEL[id]] }))}
                value={null}
                onChange={(id) => answer("summary", { edit: id }, c.slots[SLOT_LABEL[id]])}
              />
            ) : (
              <div className="flex flex-col gap-sp-2 sm:flex-row">
                <Button fullWidth onClick={() => answer("summary", "confirm", c.summary.create)}>
                  {c.summary.create}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    addMessages(message("user", c.summary.edit), message("agent", c.say.editPick));
                    setPickingEdit(true);
                  }}
                >
                  {c.summary.edit}
                </Button>
              </div>
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  // Checklist of the onboarding slots: answered or passed slots are done, the open one is active, and a
  // declined blocking consent shows as an error.
  const order = SLOTS.map((slot) => slot.id);
  const currentIndex = nextSlot === null ? order.length : nextSlot === "summary" ? order.length - 0.5 : order.indexOf(nextSlot);
  const declinedRequired = BLOCKING_CONSENTS.some((type) => draft.consents[type] === false);
  const taskSteps: TaskStep[] = [
    ...(firstIntent ? [{ id: "firstIntent", label: c.slots.firstIntent, value: firstIntent, status: "done" as const }] : []),
    ...SLOTS.filter((slot) => slot.applies(draft)).map((slot): TaskStep => {
      const passed = order.indexOf(slot.id) < currentIndex;
      const value = slotValue(slot.id, draft, c, locale);
      let stepStatus: TaskStep["status"] = slot.id === nextSlot ? "active" : slot.filled(draft) || passed ? "done" : "pending";
      if (slot.id === "consents" && declinedRequired) stepStatus = "error";
      const agreed = CONSENT_TYPES.filter((type) => draft.consents[type]).length;
      return {
        id: slot.id,
        label: c.slots[SLOT_LABEL[slot.id]],
        value: slot.id === "consents" ? (agreed > 0 ? `${agreed}/${CONSENT_TYPES.length}` : undefined) : value,
        status: stepStatus,
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

  // One screen for both phases: the sunrise backdrop and the particle field stay mounted, the hero copy turns into
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
        <Button variant="ghost" className="self-center" onClick={() => start()}>
          {intro.startPlain}
        </Button>
      </div>
    </main>
  );

  // The conversation itself, shown in the agent window over the landing or, expanded, on the whole screen.
  const conversationLog = (
    <div role="log" aria-live="polite" className="flex flex-col gap-sp-3">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-sp-2">
          <ChatBubble from={m.from}>{m.text}</ChatBubble>
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
      {busy && !streaming ? <ChatBubble from="agent">{`${c.typing}...`}</ChatBubble> : null}
      {!busy ? renderWidget() : null}
      <div ref={endRef} />
    </div>
  );

  const composer = (
    <ChatInput
      onSend={handleText}
      label={c.inputLabel}
      sendLabel={c.send}
      placeholder={c.placeholder}
      disabled={busy || done}
      hint={<span className="hidden sm:inline">{c.inputHint}</span>}
    />
  );

  const chatMain = (
    <main className="relative flex min-h-0 flex-1 px-sp-4 lg:gap-sp-8 lg:px-sp-6">
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
          <ParticleField className="absolute inset-0" shrink={engaged || started} />
          <header className="relative flex flex-wrap items-center justify-between gap-x-sp-3 px-sp-4 py-sp-2 md:px-sp-6">
            <span className="type-hero">{intro.wordmark}</span>
            {/* hidden once the customer has answered: this switch reloads the page and would drop the answers.
                Inside the conversation the language chips carry them over. */}
            {messages.some((m) => m.from === "user") ? null : (
              <div className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1 sm:justify-end">
                <LocaleSwitcher label={intro.languageLabel} />
              </div>
            )}
            {full ? (
              <Button variant="secondary" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
                <span className="tabular-nums">{c.progress(percent)}</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                data-tour="signup"
                aria-expanded={signupOpen}
                aria-haspopup="dialog"
                onClick={() => setSignupOpen((open) => !open)}
              >
                {intro.signup.toggle}
              </Button>
            )}
          </header>
          {full ? chatMain : heroMain}
        </section>
        {full ? null : <LandingHome locale={locale} onAsk={ask} />}
      </div>
      {full ? null : footer}
      {/* dialogs sit outside the sunrise section so they keep the default dark tokens */}
      <AuthDialog
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        brand={intro.wordmark}
        copy={intro.signup}
        personas={intro.signup.personas}
        // signing up or in starts the conversation; on finish the server saves the profile to that account
        onDone={() => {
          setSignupOpen(false);
          start();
        }}
      />
      {full ? null : (
        <AgentWindow
          open={windowOpen}
          onOpenChange={(open) => (open ? start() : setWindowOpen(false))}
          labels={intro.agentWindow}
          onExpand={() => {
            setSurface("full");
            setWindowOpen(false);
          }}
          focusOnOpen={!tourOpen}
          inputReady={!busy && !done}
          hideLauncher={tourOpen}
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
          onStep={(target) => target === "agent" && start()}
          onFinish={finishTour}
        />
      ) : null}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={c.previewTitle} closeLabel={c.close}>
        {preview}
      </Sheet>
    </div>
  );
}

function nationalityOption(nationality: string | undefined): NationalityOption | null {
  if (nationality === undefined) return null;
  if (nationality === UNKNOWN_NATIONALITY) return "other";
  return (NATIONALITY_OPTIONS as readonly string[]).includes(nationality) ? (nationality as NationalityOption) : "other";
}

// What the customer answered for a slot, or undefined while it is open.
function slotValue(slot: SlotId, draft: OnboardingDraft, c: OnboardingCopy, locale: Locale): ReactNode {
  switch (slot) {
    case "locale":
      return draft.locale ? LOCALE_NAME[draft.locale] : undefined;
    case "consents": {
      const agreed = CONSENT_TYPES.filter((type) => draft.consents[type]).map((type) => c.consents[type].title);
      return agreed.length > 0 ? agreed.join(" · ") : undefined;
    }
    case "nickname":
      return draft.nickname;
    case "nationality": {
      const option = nationalityOption(draft.nationality);
      return option ? (option === "other" && draft.nationality !== UNKNOWN_NATIONALITY ? draft.nationality : c.nationality[option]) : undefined;
    }
    case "residency":
      return draft.residency ? c.residency[draft.residency] : undefined;
    case "ageBand":
      return draft.ageBand ? c.ageBand[draft.ageBand] : undefined;
    case "trip":
      return draft.trip.arrival && draft.trip.departure ? `${draft.trip.arrival} ~ ${draft.trip.departure}` : undefined;
    case "trip.stayArea":
      return draft.trip.stayArea ? c.area[draft.trip.stayArea] : undefined;
    case "skin.concerns":
      return draft.skin.concerns.length > 0 ? draft.skin.concerns.map((v) => c.concern[v]).join(" · ") : undefined;
    case "history":
      if (!draft.history) return undefined;
      return draft.history.none ? c.historyNone : draft.history.items.map((item) => item.text).join(" · ");
    case "safety.pregnantOrBreastfeeding":
      return draft.safety.pregnantOrBreastfeeding === undefined ? undefined : draft.safety.pregnantOrBreastfeeding ? c.yes : c.no;
    case "prefs.budgetKrw": {
      if (!draft.prefs.budgetKrw) return undefined;
      const input = draft.prefs.budgetInput;
      const reference = input && input.currency !== "KRW" ? { currency: input.currency as ReferenceCurrency, amount: input.amount } : undefined;
      return <Money krw={draft.prefs.budgetKrw.max} reference={reference} locale={locale} />;
    }
    case "prefs.downtimeToleranceDays":
      return draft.prefs.downtimeToleranceDays === undefined ? undefined : c.days(draft.prefs.downtimeToleranceDays);
    case "prefs.languagesNeeded":
      return draft.prefs.languagesNeeded.length > 0 ? draft.prefs.languagesNeeded.map((v) => LOCALE_NAME[v]).join(" · ") : undefined;
    case "contact.channel":
      return draft.contact.channel ? c.channel[draft.contact.channel] : undefined;
    case "contact.handle":
      return draft.contact.handle;
  }
}

// Live slot rows for the summary card. Empty values show a middle dot.
function SlotList({ draft, copy: c, locale }: { draft: OnboardingDraft; copy: OnboardingCopy; locale: Locale }) {
  const rows = SLOTS.filter((slot) => slot.id !== "consents" && slot.applies(draft));
  return (
    <dl className="flex flex-col gap-sp-2">
      {rows.map((slot) => (
        <div key={slot.id} className="flex items-baseline justify-between gap-sp-3">
          <dt className="shrink-0 text-label text-muted">{c.slots[SLOT_LABEL[slot.id]]}</dt>
          <dd className="min-w-0 break-words text-end text-body">
            {slotValue(slot.id, draft, c, locale) ?? <span className="text-subtle">·</span>}
          </dd>
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
