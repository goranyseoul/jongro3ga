"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  CardHeader,
  ChipGroup,
  Sheet,
  WidgetCurrency,
  WidgetDateRange,
  WidgetSlider,
  type CurrencyAmount,
} from "@/components/ui";
import { LOCALES, LOCALE_NAME } from "@/app/[locale]/locales";
import type { Locale } from "@/lib/domain/common";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { FX_RATES, PROCEDURES, getProcedure } from "@/lib/ui-data/customer";
import { AMOUNT_STEPS, AREAS, isTypicalMinimum, type Condition } from "./condition";
import { formatRange, moneyText } from "./format";
import { useLabels } from "./use-customer";

type Field = "procedure" | "amount" | "budget" | "area" | "language" | "dates";

const FIELDS: Field[] = ["procedure", "amount", "budget", "area", "language", "dates"];
const CURRENCIES = ["KRW", "JPY", "CNY", "USD"] as const;
const RATES = { KRW: 1, ...FX_RATES };

export type ConditionCardProps = {
  locale: Locale;
  value: Condition;
  onChange: (value: Condition) => void;
  onFind: () => void;
  /** Today in the demo clock, the earliest selectable date. */
  today: string;
};

export function ConditionCard({ locale, value, onChange, onFind, today }: ConditionCardProps) {
  const t = useTranslations("chat.condition");
  const common = useTranslations("common");
  const label = useLabels();
  const [editing, setEditing] = useState<Field | null>(null);
  const [budget, setBudget] = useState<CurrencyAmount>({ currency: "KRW", amount: value.budgetKrw ?? null });

  const procedure = getProcedure(value.procedureId);

  const display = (field: Field) => {
    switch (field) {
      case "procedure":
        return label.procedure(value.procedureId);
      case "amount":
        return label.amount(value.amount);
      case "budget":
        return value.budgetKrw ? t("budgetValue", { amount: moneyText(value.budgetKrw, locale) }) : t("budgetNone");
      case "area":
        return value.areas.length > 0 ? value.areas.map(label.area).join(" · ") : "·";
      case "language":
        return value.languages.map((l) => LOCALE_NAME[l]).join(" · ");
      case "dates":
        return value.dateWindow.from && value.dateWindow.to ? formatRange(value.dateWindow.from, value.dateWindow.to) : "·";
    }
  };

  const note = (field: Field) => {
    if (field !== "amount" || !procedure || !isTypicalMinimum(value)) return null;
    const { min, max } = procedure.typicalAmount;
    const range = `${min}~${label.amount({ value: max, unit: procedure.unit })}`;
    return `${t("amountNote", { range })} ${common("demoValue")}`;
  };

  const widget = (field: Field) => {
    switch (field) {
      case "procedure":
        return (
          <ChipGroup
            label={t("rows.procedure")}
            options={PROCEDURES.map((p) => ({ value: p.id, label: label.procedure(p.id) }))}
            value={value.procedureId}
            onChange={(id) => {
              const next = getProcedure(id);
              if (next) onChange({ ...value, procedureId: id, amount: { value: next.typicalAmount.min, unit: next.unit } });
            }}
          />
        );
      case "amount":
        return (
          <WidgetSlider
            label={t("rows.amount")}
            steps={AMOUNT_STEPS[value.amount.unit].map((n) => ({ value: n, label: label.amount({ value: n, unit: value.amount.unit }) }))}
            value={value.amount.value}
            onChange={(n) => onChange({ ...value, amount: { ...value.amount, value: n } })}
          />
        );
      case "budget":
        return (
          <WidgetCurrency
            value={budget}
            onChange={(next) => {
              setBudget(next);
              onChange({ ...value, budgetKrw: next.amount === null ? undefined : Math.round(next.amount * RATES[next.currency]) });
            }}
            currencies={[...CURRENCIES]}
            rates={RATES}
            currencyLabel={t("currency")}
            amountLabel={t("amountInput")}
            rateNote={t("rateNote")}
          />
        );
      case "area":
        return (
          <ChipGroup
            multiple
            label={t("rows.area")}
            options={AREAS.map((area) => ({ value: area, label: label.area(area) }))}
            value={value.areas}
            onChange={(areas) => onChange({ ...value, areas })}
          />
        );
      case "language":
        return (
          <ChipGroup
            multiple
            label={t("rows.language")}
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAME[l] }))}
            value={value.languages}
            onChange={(languages) => onChange({ ...value, languages: languages.length > 0 ? languages : value.languages })}
          />
        );
      case "dates":
        return (
          <WidgetDateRange
            value={{ start: value.dateWindow.from, end: value.dateWindow.to }}
            onChange={(range) => onChange({ ...value, dateWindow: { from: range.start, to: range.end } })}
            startLabel={t("from")}
            endLabel={t("to")}
            min={today}
          />
        );
    }
  };

  return (
    <Card className="flex flex-col gap-sp-4">
      <CardHeader title={t("title")} description={t("hint")} as="h2" />
      <ul className="flex flex-col divide-y divide-border-soft">
        {FIELDS.map((field) => (
          <li key={field}>
            <button
              type="button"
              onClick={() => setEditing(field)}
              className={cn(
                "flex min-h-touch w-full flex-col items-start gap-sp-1 py-sp-3 text-start transition-colors duration-press ease-out hover:bg-sunken",
                focusRing,
              )}
            >
              <span className="text-label text-muted">{t(`rows.${field}`)}</span>
              <span className="text-body font-med tabular-nums">{display(field)}</span>
              {note(field) ? <span className="text-caption text-subtle">{note(field)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-caption text-subtle">{t("privacy")}</p>
      <Button size="lg" fullWidth onClick={onFind}>
        {t("find")}
      </Button>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? t(`rows.${editing}`) : ""}
        closeLabel={common("close")}
      >
        <div className="flex flex-col gap-sp-4">
          {editing ? widget(editing) : null}
          <Button fullWidth onClick={() => setEditing(null)}>
            {t("done")}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}
