"use client";

import { formatCurrency, type CurrencyCode } from "@/lib/money";
import { ChipGroup } from "./chip-group";
import { Input } from "./input";

export type CurrencyAmount = { currency: CurrencyCode; amount: number | null };

export type WidgetCurrencyProps = {
  value: CurrencyAmount;
  onChange: (value: CurrencyAmount) => void;
  currencies: CurrencyCode[];
  /** Won per 1 unit of each currency, fixed reference values (data/seed/fx.json). */
  rates: Record<CurrencyCode, number>;
  currencyLabel: string;
  amountLabel: string;
  /** Caption before the converted won amount, e.g. "참고 환율". */
  rateNote: string;
};

export function WidgetCurrency({
  value,
  onChange,
  currencies,
  rates,
  currencyLabel,
  amountLabel,
  rateNote,
}: WidgetCurrencyProps) {
  const converted =
    value.amount !== null && value.currency !== "KRW" ? Math.round(value.amount * rates[value.currency]) : null;

  return (
    <div className="flex flex-col gap-sp-3">
      <ChipGroup
        label={currencyLabel}
        options={currencies.map((currency) => ({ value: currency, label: currency }))}
        value={value.currency}
        onChange={(currency) => onChange({ currency, amount: value.amount })}
      />
      <Input
        label={amountLabel}
        inputMode="numeric"
        autoComplete="off"
        value={value.amount === null ? "" : value.amount.toLocaleString("en-US")}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange({ currency: value.currency, amount: digits ? Number(digits) : null });
        }}
        hint={converted !== null ? `${rateNote}: ${formatCurrency(converted, "KRW")}` : undefined}
      />
    </div>
  );
}
