export interface MoneyReference {
  /** Display prefix for the approximate amount, for example "約" in ja. */
  prefix?: string;
  symbol: string;
  amount: number;
}

export interface MoneyProps {
  krw: number;
  reference?: MoneyReference;
  className?: string;
}

/** KRW amount with an optional approximate amount in the customer's currency: ₩340,000 (約 ¥37,000). */
export function Money({ krw, reference, className }: MoneyProps) {
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {`₩${Math.round(krw).toLocaleString("en-US")}`}
      {reference ? (
        <span className="text-muted">{` (${reference.prefix ?? ""}${reference.symbol}${Math.round(reference.amount).toLocaleString("en-US")})`}</span>
      ) : null}
    </span>
  );
}
