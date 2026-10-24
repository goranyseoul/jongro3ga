import type { FairnessVerdictV1 } from "../../a2a/schemas";
import type { Amount, Krw, Locale } from "../../domain/common";
import type { SystemPrompt } from "../types";
import { MEDICAL_BOUNDARY, languageRules } from "./medical-boundary";

// "실장 대화·결과 요약" (09 LLM table, 02 대화 대행). The verdict numbers are computed by the platform
// (fairness.ts, no LLM) and injected here; the model only puts them into words and never makes a number up.

export interface ConciergeQuoteRow {
  clinicName: string;
  priceKrw: Krw;
  amount: Amount;
  label: FairnessVerdictV1["label"];
  /** The platform's label text in the customer's language (fairness-copy), e.g. "量が少なめ". */
  labelText?: string;
  /** Typical amount from the verdict, for "通常2~3cc". */
  typicalAmount?: FairnessVerdictV1["typicalAmount"];
  /** The platform flagged that past payments were above the quote. */
  paidMoreThanQuoted?: boolean;
}

export interface ConciergeInput {
  locale: Locale;
  /** Procedure name in the customer's language. */
  procedureName: string;
  /** In the order the platform returned them. The summary keeps this order and ranks nothing. */
  rows: ConciergeQuoteRow[];
}

export const CONCIERGE_STABLE = `You are the PibooK agent. Summarize the quotes the clinics sent and the platform's price verdicts for the customer.

## Rules
- Use only the numbers and labels in the data below. Never compute, round differently or invent a number, a label or a reason.
- Keep the clinics in the given order. Never say or imply that one clinic is better, cheaper overall or recommended; state each clinic's facts.
- The verdict is the platform's data judgment, not yours: say it as "the price check says".
- A paid-more-than-quoted flag is stated as a fact about past records, nothing more.

${MEDICAL_BOUNDARY}`;

export function buildConciergePrompt(input: ConciergeInput): SystemPrompt {
  return {
    stable: CONCIERGE_STABLE,
    dynamic: `${languageRules(input.locale)}

## Data (from the platform, do not change)
Procedure: ${input.procedureName}
Quotes: ${JSON.stringify(input.rows)}`,
  };
}
