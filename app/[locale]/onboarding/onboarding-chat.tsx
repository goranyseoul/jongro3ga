"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AgentCardView,
  Button,
  Card,
  CardHeader,
  ChatBubble,
  ChatInput,
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
import type { Locale } from "@/lib/domain/common";
import type { ReferenceCurrency } from "@/lib/money";
import { LOCALES, LOCALE_NAME } from "../locales";
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

type Message = { id: string; from: "agent" | "user"; text: string };

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

export function OnboardingChat({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<StepId>("locale");
  const [messages, setMessages] = useState<Message[]>([{ id: "m0", from: "agent", text: c.say.locale }]);
  const [typing, setTyping] = useState(false);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [pickingEdit, setPickingEdit] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing, step, pickingEdit]);

  const message = (from: Message["from"], text: string): Message => ({ id: `m${nextId.current++}`, from, text });

  const agentSays = (lines: string[], then?: () => void) => {
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((prev) => [...prev, ...lines.map((line) => message("agent", line))]);
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

    agentSays([...notes, question(target, next, c)], () => setStep(target));
  };

  const nudge = (userText: string, line: string) => {
    setMessages((prev) => [...prev, message("user", userText)]);
    agentSays([line]);
  };

  const chooseLocale = (value: Locale) => {
    if (value !== locale) {
      router.push(`/${value}/onboarding`);
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

  const percent = progressPercent(draft);
  const done = step === "done";
  const card = buildAgentCard(done);
  const today = new Date().toISOString().slice(0, 10);

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
            options={[{ value: "none", label: c.historyNone }]}
            value={null}
            onChange={() => advance({ ...draft, history: c.historyNone }, c.historyNone)}
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
      default:
        return null;
    }
  };

  const preview = (
    <div className="flex flex-col gap-sp-4">
      <Card className="flex flex-col gap-sp-4">
        <CardHeader title={done ? c.doneTitle : c.previewTitle} description={c.progress(percent)} />
        <p className="text-label text-subtle">{c.previewCaption}</p>
        <SlotList draft={draft} copy={c} locale={locale} />
      </Card>
      <AgentCardView card={card} labels={c.agentCard} />
    </div>
  );

  return (
    <main lang={locale} className="mx-auto flex h-dvh max-w-screen-xl flex-col lg:grid lg:grid-cols-5 lg:grid-rows-1">
      <section className="flex min-h-0 flex-1 flex-col lg:col-span-3 lg:border-e lg:border-border-soft">
        <header className="flex items-center justify-between gap-sp-3 border-b border-border-soft px-sp-4 py-sp-2">
          <h1 className="text-title font-semi">{c.title}</h1>
          <Button variant="secondary" className="lg:hidden" onClick={() => setSheetOpen(true)}>
            <span className="tabular-nums">{c.progress(percent)}</span>
          </Button>
          <span className="hidden text-label text-muted tabular-nums lg:inline">{c.progress(percent)}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-sp-4 py-sp-4">
          <div role="log" aria-live="polite" className="mx-auto flex max-w-2xl flex-col gap-sp-3">
            {messages.map((m) => (
              <ChatBubble key={m.id} from={m.from}>
                {m.text}
              </ChatBubble>
            ))}
            {typing ? <ChatBubble from="agent">{`${c.typing}...`}</ChatBubble> : null}
            {!typing ? widget() : null}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-border-soft px-sp-4 py-sp-3">
          <div className="mx-auto max-w-2xl">
            <ChatInput
              onSend={handleText}
              label={c.inputLabel}
              sendLabel={c.send}
              placeholder={c.placeholder}
              disabled={typing || done}
            />
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto p-sp-6 lg:col-span-2 lg:block">{preview}</aside>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={c.previewTitle} closeLabel={c.close}>
        {preview}
      </Sheet>
    </main>
  );
}

// Live slot rows for the agent preview and the summary card. Empty values show a middle dot.
function SlotList({ draft, copy: c, locale }: { draft: Draft; copy: OnboardingCopy; locale: Locale }) {
  const value = (step: StepId) => {
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
  };

  const rows = STEP_ORDER.filter((step) => STEP_SLOT[step] && isStepApplicable(step, draft));

  return (
    <dl className="flex flex-col gap-sp-2">
      {rows.map((step) => (
        <div key={step} className="flex items-baseline justify-between gap-sp-3">
          <dt className="shrink-0 text-label text-muted">{c.slots[STEP_SLOT[step] ?? "nickname"]}</dt>
          <dd className="min-w-0 break-words text-end text-body">{value(step) ?? <span className="text-subtle">·</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
