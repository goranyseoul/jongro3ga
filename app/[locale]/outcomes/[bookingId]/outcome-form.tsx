"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  ChipGroup,
  Input,
  Money,
  WidgetCurrency,
  WidgetSlider,
  buttonStyles,
  type CurrencyAmount,
} from "@/components/ui";
import { AMOUNT_STEPS } from "@/components/customer/condition";
import { formatDay, moneyText } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  BOOKING_ID,
  DEFAULT_BOOKING_CHOICE,
  FX_RATES,
  OUTCOME_DEFAULTS,
  QUOTES,
  addDays,
  buildBooking,
  computeNextDue,
  consentsFor,
  getProcedure,
  nextSessionNumber,
  referenceFor,
  upcomingSessionNumber,
  type ProductVerified,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";

const RATES = { KRW: 1, ...FX_RATES };
const CURRENCIES = ["KRW", "JPY", "CNY", "USD"] as const;
const VERIFIED: ProductVerified[] = ["vial_shown", "packaging_shown", "explained_verbally", "not_checked"];

export function OutcomeForm() {
  const t = useTranslations("outcomes");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale, profile, demo, records } = useCustomer();

  const choice = demo.booking ?? { ...DEFAULT_BOOKING_CHOICE, status: "pending_clinic" as const };
  const booking = buildBooking({ quoteId: choice.quoteId, slot: choice.slot, status: choice.status });
  const quote = QUOTES.find((q) => q.quoteId === booking.quoteId) ?? QUOTES[0]!;
  const procedure = getProcedure(quote.procedureId);
  const day = booking.slot.slice(0, 10);

  const [paid, setPaid] = useState<CurrencyAmount>({ currency: "KRW", amount: OUTCOME_DEFAULTS.paidKrw });
  const [received, setReceived] = useState<number>(OUTCOME_DEFAULTS.receivedAmount.value);
  const [verified, setVerified] = useState<ProductVerified>(OUTCOME_DEFAULTS.productVerified);
  const [satisfaction, setSatisfaction] = useState<number>(OUTCOME_DEFAULTS.satisfaction);
  const [pain, setPain] = useState<number>(OUTCOME_DEFAULTS.painScore);
  const [comment, setComment] = useState("");
  const [savedRecord, setSavedRecord] = useState<TreatmentRecord | null>(null);

  if (choice.status === "pending_clinic" && !demo.outcome) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Card className="flex flex-col gap-sp-3">
          <CardHeader title={t("wait.title")} description={t("wait.body")} as="h2" />
          <Link href={`/bookings/${BOOKING_ID}`} className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("wait.open")}
          </Link>
        </Card>
      </>
    );
  }

  const paidKrw = paid.amount === null ? null : Math.round(paid.amount * RATES[paid.currency]);
  const difference = paidKrw === null ? null : paidKrw - quote.priceKrw;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (paidKrw === null || !procedure) return;
    const previous = records
      .filter((r) => r.procedureId === procedure.id && r.date <= day)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const sessionNumber = nextSessionNumber(previous, procedure, day);
    const shares = consentsFor(profile).some((c) => c.type === "shareAnonymizedRecords" && c.granted);
    const record: TreatmentRecord = {
      id: `rec_${profile.id}_${booking.bookingId}`,
      customerId: profile.id,
      procedureId: procedure.id,
      date: day,
      amount: { value: received, unit: procedure.unit },
      priceKrw: paidKrw,
      clinicId: booking.clinicId,
      source: "booking",
      rating: satisfaction as TreatmentRecord["rating"],
      note: comment.trim() || undefined,
      sessionNumber,
      nextDue: computeNextDue(procedure, day, sessionNumber),
      status: "active",
      sharedToPlatform: shares,
    };
    updateDemoState((state) => ({
      ...state,
      addedRecords: [...state.addedRecords.filter((r) => r.id !== record.id), record],
      outcome: {
        paidKrw,
        receivedValue: received,
        productVerified: verified,
        satisfaction,
        painScore: pain,
        comment: comment.trim(),
        submittedAt: "2026-11-14T13:10:00+09:00",
      },
    }));
    setSavedRecord(record);
  };

  const scale = (value: number, onChange: (n: number) => void, name: string) => (
    <div role="group" aria-label={name} className="flex flex-wrap gap-sp-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <Chip key={n} selected={value === n} className="min-w-touch" onClick={() => onChange(n)}>
          {n}
        </Chip>
      ))}
    </div>
  );

  if (savedRecord || demo.outcome) {
    const record = savedRecord ?? records.find((r) => r.id === `rec_${profile.id}_${booking.bookingId}`);
    return (
      <>
        <h1 className="text-h2 font-semi">{t("saved.title")}</h1>
        <Card className="flex flex-col gap-sp-2">
          <p className="text-body text-muted">{t("saved.body")}</p>
          {record?.nextDue ? (
            <>
              <p className="text-label text-muted">{t("saved.next")}</p>
              <p className="text-title font-semi tabular-nums">
                {common("session", { n: upcomingSessionNumber(record), date: record.nextDue })}
              </p>
            </>
          ) : null}
        </Card>
        <Link href="/records" className={buttonStyles({ size: "lg" })}>
          {t("saved.records")}
        </Link>
        <LaterCheckins day={day} />
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("lead")}</p>
      </header>

      <Card className="flex flex-col gap-sp-2">
        <dl className="flex flex-col gap-sp-2">
          <Fact term={t("summary.clinic")}>{label.clinic(booking.clinicId)}</Fact>
          <Fact term={t("summary.when")}>
            <span className="tabular-nums">{formatDay(day, locale)}</span>
          </Fact>
          <Fact term={t("summary.quoted")}>
            <Money krw={quote.priceKrw} reference={referenceFor(quote.priceKrw, locale)} locale={locale} />
          </Fact>
        </dl>
      </Card>

      <form onSubmit={submit} className="flex flex-col gap-sp-6">
        <div className="flex flex-col gap-sp-2">
          <WidgetCurrency
            value={paid}
            onChange={setPaid}
            currencies={[...CURRENCIES]}
            rates={RATES}
            currencyLabel={t("fields.currency")}
            amountLabel={t("fields.paid")}
            rateNote={t("fields.rateNote")}
          />
          {difference !== null ? (
            <p className="text-caption text-subtle tabular-nums">
              {difference === 0
                ? t("gap.same")
                : t(difference > 0 ? "gap.higher" : "gap.lower", { amount: moneyText(Math.abs(difference), locale) })}
            </p>
          ) : null}
        </div>

        {procedure ? (
          <WidgetSlider
            label={t("fields.received")}
            steps={AMOUNT_STEPS[procedure.unit].map((n) => ({ value: n, label: label.amount({ value: n, unit: procedure.unit }) }))}
            value={received}
            onChange={setReceived}
          />
        ) : null}

        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("fields.verified")}</legend>
          <ChipGroup
            label={t("fields.verified")}
            options={VERIFIED.map((value) => ({ value, label: t(`verified.${value}`) }))}
            value={verified}
            onChange={setVerified}
          />
        </fieldset>

        <div className="flex flex-col gap-sp-2">
          <span className="text-label font-med text-muted">{t("fields.satisfaction")}</span>
          {scale(satisfaction, setSatisfaction, t("fields.satisfaction"))}
          <span className="flex justify-between text-caption text-subtle">
            <span>{t("scale.satisfactionLow")}</span>
            <span>{t("scale.satisfactionHigh")}</span>
          </span>
        </div>

        <div className="flex flex-col gap-sp-2">
          <span className="text-label font-med text-muted">{t("fields.pain")}</span>
          {scale(pain, setPain, t("fields.pain"))}
          <span className="flex justify-between text-caption text-subtle">
            <span>{t("scale.low")}</span>
            <span>{t("scale.high")}</span>
          </span>
        </div>

        <Input label={t("fields.comment")} value={comment} maxLength={140} onChange={(event) => setComment(event.target.value)} />

        <p className="text-caption text-subtle">{t("share")}</p>
        <Button type="submit" size="lg" fullWidth disabled={paidKrw === null}>
          {t("submit")}
        </Button>
      </form>

      <LaterCheckins day={day} />
    </>
  );
}

// D7 and D30 check-ins are P1 (05-screens.md): the screen only tells the customer what will be asked and when.
function LaterCheckins({ day }: { day: string }) {
  const t = useTranslations("outcomes");
  return (
    <Card className="flex flex-col gap-sp-3">
      <CardHeader title={t("later.title")} description={t("later.note")} as="h2" />
      <ul className="flex flex-col gap-sp-2">
        {([["d7", 7], ["d30", 30]] as const).map(([key, days]) => (
          <li key={key} className="flex flex-col gap-sp-1">
            <p className="text-body font-med tabular-nums">
              {t(`later.${key}`)} · {addDays(day, days)}
            </p>
            <p className="text-label text-muted">{t("later.questions")}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-sp-3">
      <dt className="shrink-0 text-label text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-end text-body">{children}</dd>
    </div>
  );
}
