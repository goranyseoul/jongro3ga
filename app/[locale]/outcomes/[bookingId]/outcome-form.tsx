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
import { api, useApi } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import { AMOUNT_STEPS } from "@/components/customer/condition";
import { formatDay, moneyText } from "@/components/customer/format";
import { useLabels, useMe } from "@/components/customer/use-customer";
import type { BookingView } from "@/lib/agents/customer/bff";
import type { OutcomeResult } from "@/lib/agents/customer/orchestrator";
import type { TreatmentRecord } from "@/lib/domain/customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { FX_RATES, addDays, referenceFor, type ProductVerified, type Unit } from "@/lib/ui-data/customer";

const RATES = { KRW: 1, ...FX_RATES };
const CURRENCIES = ["KRW", "JPY", "CNY", "USD"] as const;
const VERIFIED: ProductVerified[] = ["vial_shown", "packaging_shown", "explained_verbally", "not_checked"];
const DOWNTIME_STEPS = [0, 1, 2, 3, 5, 7];

export type OutcomeFormProps = {
  bookingId: string;
  /** Inbox item of a D7/D30 check-in; without it the screen records D0. */
  checkinId?: string;
  checkpoint?: "D7" | "D30";
};

export function OutcomeForm({ bookingId, checkinId, checkpoint }: OutcomeFormProps) {
  const t = useTranslations("outcomes");
  const { data: view, error, loading, reload } = useApi<BookingView>(`/api/customer/bookings/${bookingId}`);

  if (!view) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }
  if (checkinId && checkpoint) return <CheckinForm view={view} checkinId={checkinId} checkpoint={checkpoint} />;
  return <D0Form view={view} />;
}

function D0Form({ view }: { view: BookingView }) {
  const t = useTranslations("outcomes");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale } = useMe();
  const { booking, quote } = view;
  const day = booking.slot.slice(0, 10);
  const unit = (quote?.amount.unit ?? "cc") as Unit;

  const [paid, setPaid] = useState<CurrencyAmount>({ currency: "KRW", amount: booking.priceKrw });
  const [received, setReceived] = useState<number>(quote?.amount.value ?? AMOUNT_STEPS[unit][0] ?? 1);
  const [verified, setVerified] = useState<ProductVerified>("vial_shown");
  const [satisfaction, setSatisfaction] = useState<number>(5);
  const [pain, setPain] = useState<number>(3);
  const [wouldReturn, setWouldReturn] = useState<"yes" | "no" | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<{ record: TreatmentRecord; sent: boolean } | null>(null);

  const already = view.outcome?.outcome;

  if (booking.status === "requested" || booking.status === "pending_clinic" || booking.status === "canceled") {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Card className="flex flex-col gap-sp-3">
          <CardHeader title={t("wait.title")} description={t("wait.body")} as="h2" />
          <Link href={`/bookings/${booking.id}`} className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("wait.open")}
          </Link>
        </Card>
      </>
    );
  }

  const paidKrw = paid.amount === null ? null : Math.round(paid.amount * RATES[paid.currency]);
  const difference = paidKrw === null ? null : paidKrw - booking.priceKrw;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (paidKrw === null || wouldReturn === null) return;
    setSending(true);
    setFailed(false);
    try {
      const result = await api<OutcomeResult>(`/api/customer/bookings/${booking.id}/outcome`, {
        method: "POST",
        json: {
          paidKrw,
          receivedAmount: { value: received, unit },
          productVerified: verified,
          satisfaction,
          painScore: pain,
          wouldReturn: wouldReturn === "yes",
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        },
      });
      setSaved({ record: result.record, sent: result.sent });
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
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

  if (saved || (already && booking.status === "completed")) {
    const record = saved?.record;
    return (
      <>
        <h1 className="text-h2 font-semi">{t("saved.title")}</h1>
        <Card className="flex flex-col gap-sp-2">
          <p className="text-body text-muted">{saved && !saved.sent ? t("saved.local") : t("saved.body")}</p>
          {record?.nextDue ? (
            <>
              <p className="text-label text-muted">{t("saved.next")}</p>
              <p className="text-title font-semi tabular-nums">{common("session", { n: record.sessionNumber + 1, date: record.nextDue })}</p>
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
          <Fact term={t("summary.clinic")}>{label.clinic(view.clinic.id, view.clinic.name)}</Fact>
          <Fact term={t("summary.when")}>
            <span className="tabular-nums">{formatDay(day, locale)}</span>
          </Fact>
          <Fact term={t("summary.quoted")}>
            <Money krw={booking.priceKrw} reference={referenceFor(booking.priceKrw, locale)} locale={locale} />
          </Fact>
        </dl>
      </Card>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-sp-6">
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
              {difference === 0 ? t("gap.same") : t(difference > 0 ? "gap.higher" : "gap.lower", { amount: moneyText(Math.abs(difference), locale) })}
            </p>
          ) : null}
        </div>

        <WidgetSlider
          label={t("fields.received")}
          steps={AMOUNT_STEPS[unit].map((n) => ({ value: n, label: label.amount({ value: n, unit }) }))}
          value={received}
          onChange={setReceived}
        />

        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("fields.verified")}</legend>
          <ChipGroup label={t("fields.verified")} options={VERIFIED.map((value) => ({ value, label: t(`verified.${value}`) }))} value={verified} onChange={setVerified} />
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

        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("fields.wouldReturn")}</legend>
          <ChipGroup
            label={t("fields.wouldReturn")}
            options={[
              { value: "yes" as const, label: t("wouldReturn.yes") },
              { value: "no" as const, label: t("wouldReturn.no") },
            ]}
            value={wouldReturn}
            onChange={setWouldReturn}
          />
        </fieldset>

        <Input label={t("fields.comment")} value={comment} maxLength={140} onChange={(event) => setComment(event.target.value)} />

        <p className="text-caption text-subtle">{t("share")}</p>
        {failed ? <p className="text-label text-muted">{t("error")}</p> : null}
        <Button type="submit" size="lg" fullWidth disabled={paidKrw === null || wouldReturn === null || sending}>
          {t("submit")}
        </Button>
      </form>

      <LaterCheckins day={day} />
    </>
  );
}

// D7 / D30 check-in from the inbox: actual downtime, satisfaction and whether the customer would return.
function CheckinForm({ view, checkinId, checkpoint }: { view: BookingView; checkinId: string; checkpoint: "D7" | "D30" }) {
  const t = useTranslations("outcomes");
  const label = useLabels();
  const [satisfaction, setSatisfaction] = useState(4);
  const [downtime, setDowntime] = useState(1);
  const [wouldReturn, setWouldReturn] = useState<"yes" | "no" | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (wouldReturn === null) return;
    setState("sending");
    try {
      await api(`/api/customer/notifications/${checkinId}/answer`, {
        method: "POST",
        json: { satisfaction, downtimeDaysActual: downtime, wouldReturn: wouldReturn === "yes" },
      });
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("saved.title")}</h1>
        <Card className="flex flex-col gap-sp-2">
          <p className="text-body text-muted">{t("checkin.done")}</p>
        </Card>
        <Link href="/home" className={buttonStyles({ size: "lg" })}>
          {t("checkin.home")}
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{t(checkpoint === "D7" ? "later.d7" : "later.d30")}</h1>
        <p className="text-body text-muted">
          {label.clinic(view.clinic.id, view.clinic.name)} · {label.procedure(view.booking.procedureId)}
        </p>
      </header>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-sp-6">
        <WidgetSlider
          label={t("checkin.downtime")}
          steps={DOWNTIME_STEPS.map((n) => ({ value: n, label: t("checkin.days", { n }) }))}
          value={downtime}
          onChange={setDowntime}
        />
        <div className="flex flex-col gap-sp-2">
          <span className="text-label font-med text-muted">{t("fields.satisfaction")}</span>
          <div role="group" aria-label={t("fields.satisfaction")} className="flex flex-wrap gap-sp-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} selected={satisfaction === n} className="min-w-touch" onClick={() => setSatisfaction(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("fields.wouldReturn")}</legend>
          <ChipGroup
            label={t("fields.wouldReturn")}
            options={[
              { value: "yes" as const, label: t("wouldReturn.yes") },
              { value: "no" as const, label: t("wouldReturn.no") },
            ]}
            value={wouldReturn}
            onChange={setWouldReturn}
          />
        </fieldset>
        <p className="text-caption text-subtle">{t("share")}</p>
        {state === "error" ? <p className="text-label text-muted">{t("error")}</p> : null}
        <Button type="submit" size="lg" fullWidth disabled={wouldReturn === null || state === "sending"}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
}

// D7 and D30 check-ins arrive in the in-app inbox (no external messaging).
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
