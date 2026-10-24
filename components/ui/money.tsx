import { cn } from "@/lib/cn";
import type { Krw, Locale } from "@/lib/domain/common";
import { APPROX_PREFIX, formatCurrency, type ReferenceCurrency } from "@/lib/money";

export type MoneyProps = {
  krw: Krw;
  /** Customer-currency reference value shown after the won amount. */
  reference?: { currency: ReferenceCurrency; amount: number };
  /** Picks the "approximately" prefix of the reference value. */
  locale?: Locale;
  className?: string;
};

// "₩340,000 (約 ¥37,000)" as in 05-screens.md rule 6.
export function Money({ krw, reference, locale = "ko", className }: MoneyProps) {
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="font-semi">{formatCurrency(krw, "KRW")}</span>
      {reference ? (
        <span className="text-muted">
          {" "}
          ({APPROX_PREFIX[locale]} {formatCurrency(reference.amount, reference.currency)})
        </span>
      ) : null}
    </span>
  );
}
