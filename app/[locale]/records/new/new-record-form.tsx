"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Chip, ChipGroup, Input, WidgetCurrency, WidgetSlider, buttonStyles, type CurrencyAmount } from "@/components/ui";
import { AMOUNT_STEPS } from "@/components/customer/condition";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";
import { LOCALES } from "../../locales";
import {
  CLINICS,
  DEMO_TODAY,
  FX_RATES,
  PROCEDURES,
  clinicName,
  computeNextDue,
  consentsFor,
  getProcedure,
  nextSessionNumber,
  upcomingSessionNumber,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";

const RATES = { KRW: 1, ...FX_RATES };
const CURRENCIES = ["KRW", "JPY", "CNY", "USD"] as const;

export function NewRecordForm() {
  const t = useTranslations("recordsNew");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale, profile, records } = useCustomer();

  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [clinicText, setClinicText] = useState("");
  const [price, setPrice] = useState<CurrencyAmount>({ currency: "KRW", amount: null });
  const [date, setDate] = useState(DEMO_TODAY);
  // "I only remember the month": the record keeps the 1st of that month with datePrecision "month".
  const [monthOnly, setMonthOnly] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<TreatmentRecord | null>(null);

  const procedure = procedureId ? getProcedure(procedureId) : undefined;
  const shares = consentsFor(profile).some((c) => c.type === "shareAnonymizedRecords" && c.granted);

  const choose = (id: string) => {
    const next = getProcedure(id);
    setProcedureId(id);
    setAmount(next ? next.typicalAmount.min : null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!procedure || !date) return;
    const previous = records
      .filter((r) => r.procedureId === procedure.id && r.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const sessionNumber = nextSessionNumber(previous, procedure, date);
    // a typed name that matches a registry clinic (in any language) is stored by id
    const typed = clinicText.trim();
    const clinic = CLINICS.find((c) => LOCALES.some((l) => c.name[l] === typed));
    const record: TreatmentRecord = {
      id: `rec_${profile.id}_new_${records.length + 1}`,
      customerId: profile.id,
      procedureId: procedure.id,
      date,
      datePrecision: monthOnly ? "month" : undefined,
      amount: amount === null ? undefined : { value: amount, unit: procedure.unit },
      priceKrw: price.amount === null ? undefined : Math.round(price.amount * RATES[price.currency]),
      clinicId: clinic?.id,
      clinicName: typed || undefined,
      source: "manual",
      rating: rating ? (Number(rating) as TreatmentRecord["rating"]) : undefined,
      note: note.trim() || undefined,
      sessionNumber,
      nextDue: computeNextDue(procedure, date, sessionNumber),
      status: "active",
      sharedToPlatform: shares,
    };
    updateDemoState((state) => ({ ...state, addedRecords: [...state.addedRecords, record] }));
    setSaved(record);
  };

  if (saved) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("saved.title")}</h1>
        <Card className="flex flex-col gap-sp-2">
          <p className="text-title font-semi">{label.procedure(saved.procedureId)}</p>
          <p className="text-label text-muted">{t("saved.next")}</p>
          <p className="text-body tabular-nums">
            {common("session", { n: upcomingSessionNumber(saved), date: saved.nextDue ?? "" })}
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

  const range = procedure
    ? `${procedure.typicalAmount.min}~${label.amount({ value: procedure.typicalAmount.max, unit: procedure.unit })}`
    : "";

  return (
    <>
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("lead")}</p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-sp-6">
        <fieldset className="flex flex-col gap-sp-2">
          <legend className="mb-sp-2 text-label font-med text-muted">{t("procedure")}</legend>
          <ChipGroup
            label={t("procedure")}
            options={PROCEDURES.map((p) => ({ value: p.id, label: label.procedure(p.id) }))}
            value={procedureId}
            onChange={choose}
          />
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
            {CLINICS.map((clinic) => (
              <option key={clinic.id} value={clinicName(clinic.id, locale)} />
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
              value={date.slice(0, 7)}
              max={DEMO_TODAY.slice(0, 7)}
              onChange={(event) => setDate(event.target.value ? `${event.target.value}-01` : "")}
            />
          ) : (
            <Input type="date" label={t("date")} value={date} max={DEMO_TODAY} onChange={(event) => setDate(event.target.value)} />
          )}
          <Chip
            selected={monthOnly}
            className="self-start"
            onClick={() => {
              setMonthOnly(!monthOnly);
              if (!monthOnly && date) setDate(`${date.slice(0, 7)}-01`);
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
        <Button type="submit" size="lg" fullWidth disabled={!procedure || !date}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
}
