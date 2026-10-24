"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Chip, ChipGroup, Input, WidgetCurrency, WidgetSlider, buttonStyles, type CurrencyAmount } from "@/components/ui";
import { api, useApi } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import { AMOUNT_STEPS } from "@/components/customer/condition";
import { granted } from "@/lib/agents/customer/consent-view";
import { useLabels, useMe } from "@/components/customer/use-customer";
import type { I18nText } from "@/lib/domain/common";
import type { TreatmentRecord } from "@/lib/domain/customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";
import { LOCALES } from "../../locales";
import { FX_RATES, PROCEDURES, getProcedure } from "@/lib/ui-data/customer";

const RATES = { KRW: 1, ...FX_RATES };
const CURRENCIES = ["KRW", "JPY", "CNY", "USD"] as const;

type ClinicOption = { id: string; name: I18nText; area: string };

export function NewRecordForm() {
  const t = useTranslations("recordsNew");
  const common = useTranslations("common");
  const label = useLabels();
  const { data: me, error, loading, reload, locale } = useMe();
  const { data: clinics } = useApi<{ clinics: ClinicOption[] }>("/api/customer/clinics");

  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [clinicText, setClinicText] = useState("");
  const [price, setPrice] = useState<CurrencyAmount>({ currency: "KRW", amount: null });
  const [date, setDate] = useState<string | null>(null);
  // "I only remember the month": the record keeps the 1st of that month with datePrecision "month".
  const [monthOnly, setMonthOnly] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<TreatmentRecord | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!me) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }

  const today = me.today;
  const day = date ?? today;
  const procedure = procedureId ? getProcedure(procedureId) : undefined;
  const shares = granted(me.consents, "shareAnonymizedRecords");

  const choose = (id: string) => {
    const next = getProcedure(id);
    setProcedureId(id);
    setAmount(next ? next.typicalAmount.min : null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!procedure || !day) return;
    // a typed name that matches a registry clinic (in any language) is stored by id
    const typed = clinicText.trim();
    const clinic = clinics?.clinics.find((c) => LOCALES.some((l) => c.name[l] === typed));
    setSending(true);
    setFailed(false);
    try {
      const { record } = await api<{ record: TreatmentRecord }>("/api/customer/records", {
        method: "POST",
        json: {
          procedureId: procedure.id,
          date: day,
          ...(monthOnly ? { datePrecision: "month" } : {}),
          ...(amount === null ? {} : { amount: { value: amount, unit: procedure.unit } }),
          ...(price.amount === null ? {} : { priceKrw: Math.round(price.amount * RATES[price.currency]) }),
          ...(clinic ? { clinicId: clinic.id } : {}),
          ...(typed ? { clinicName: typed } : {}),
          ...(rating ? { rating: Number(rating) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setSaved(record);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (saved) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("saved.title")}</h1>
        <Card className="flex flex-col gap-sp-2">
          <p className="text-title font-semi">{label.procedure(saved.procedureId)}</p>
          <p className="text-label text-muted">{t("saved.next")}</p>
          <p className="text-body tabular-nums">
            {saved.nextDue ? common("session", { n: saved.sessionNumber + 1, date: saved.nextDue }) : t("saved.noNext")}
          </p>
        </Card>
        <div className="flex flex-col gap-sp-2 sm:flex-row">
          <Link href="/records" className={buttonStyles({ size: "lg" })}>
            {t("saved.all")}
          </Link>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setSaved(null);
              setProcedureId(null);
              setAmount(null);
              setClinicText("");
              setPrice({ currency: "KRW", amount: null });
              setRating(null);
              setNote("");
            }}
          >
            {t("saved.another")}
          </Button>
        </div>
      </>
    );
  }

  const range = procedure ? `${procedure.typicalAmount.min}~${label.amount({ value: procedure.typicalAmount.max, unit: procedure.unit })}` : "";

  return (
    <>
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("lead")}</p>
      </header>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-sp-6">
        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("procedure")}</legend>
          <ChipGroup label={t("procedure")} options={PROCEDURES.map((p) => ({ value: p.id, label: label.procedure(p.id) }))} value={procedureId} onChange={choose} />
        </fieldset>

        {procedure && amount !== null ? (
          <div className="flex flex-col gap-sp-2">
            <WidgetSlider
              label={t("amount")}
              steps={AMOUNT_STEPS[procedure.unit].map((n) => ({ value: n, label: label.amount({ value: n, unit: procedure.unit }) }))}
              value={amount}
              onChange={setAmount}
            />
            <p className="text-caption text-subtle">{t("amountNote", { range, demo: common("demoValue") })}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-sp-1">
          <Input
            label={t("clinic")}
            list="clinic-suggestions"
            autoComplete="off"
            value={clinicText}
            onChange={(event) => setClinicText(event.target.value)}
            hint={t("clinicHint")}
          />
          <datalist id="clinic-suggestions">
            {(clinics?.clinics ?? []).map((clinic) => (
              <option key={clinic.id} value={clinic.name[locale] ?? clinic.name.en ?? clinic.id} />
            ))}
          </datalist>
        </div>

        <WidgetCurrency
          value={price}
          onChange={setPrice}
          currencies={[...CURRENCIES]}
          rates={RATES}
          currencyLabel={t("currency")}
          amountLabel={t("price")}
          rateNote={t("rateNote")}
        />

        <div className="flex flex-col gap-sp-2">
          {monthOnly ? (
            <Input
              type="month"
              label={t("month")}
              value={day.slice(0, 7)}
              max={today.slice(0, 7)}
              onChange={(event) => setDate(event.target.value ? `${event.target.value}-01` : "")}
            />
          ) : (
            <Input type="date" label={t("date")} value={day} max={today} onChange={(event) => setDate(event.target.value)} />
          )}
          <Chip
            selected={monthOnly}
            className="self-start"
            onClick={() => {
              setMonthOnly(!monthOnly);
              if (!monthOnly && day) setDate(`${day.slice(0, 7)}-01`);
            }}
          >
            {t("dateUnknown")}
          </Chip>
        </div>

        <section aria-label={t("optional")} className="flex flex-col gap-sp-4">
          <p className="text-label font-med text-muted">{t("optional")}</p>
          <div className="flex flex-col gap-sp-1">
            <Input label={t("receipt")} type="file" accept="image/*" disabled hint={t("receiptSoon")} />
          </div>
          <div className="flex flex-col gap-sp-4 md:flex-row">
            <div className="flex shrink-0 flex-col gap-sp-2">
              <span className="text-label font-med text-muted">{t("rating")}</span>
              <div role="group" aria-label={t("rating")} className="flex flex-wrap gap-sp-2">
                {["1", "2", "3", "4", "5"].map((value) => (
                  <Chip key={value} selected={rating === value} className="min-w-touch" onClick={() => setRating(rating === value ? null : value)}>
                    {value}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-sp-2">
              <label htmlFor="record-note" className="text-label font-med text-muted">
                {t("note")}
              </label>
              <textarea
                id="record-note"
                rows={3}
                maxLength={500}
                value={note}
                placeholder={t("notePlaceholder")}
                onChange={(event) => setNote(event.target.value)}
                className={cn(fieldBase, "border-input py-sp-2", focusRing)}
              />
              <p className="text-caption text-subtle">{t("noteHint")}</p>
            </div>
          </div>
        </section>

        <p className="text-caption text-subtle">{shares ? t("shareOn") : t("shareOff")}</p>
        {failed ? <p className="text-label text-muted">{t("error")}</p> : null}
        <Button type="submit" size="lg" fullWidth disabled={!procedure || !day || sending}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
}
