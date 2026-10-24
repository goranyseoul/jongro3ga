import { clock } from "../../clock";
import { getProcedure } from "../../domain/procedure-master";
import { summarizeQuotes, type ConciergeQuoteRow } from "../../llm";
import { clinicName } from "./clinic-names";
import { customerStore } from "./store";

// The comparison in one sentence of the customer's language (02 대화 대행 "결과를 고객 언어로 요약").
// The platform's verdict numbers and labels are passed through as data; the LLM (or the fixture template in demo
// mode) only words them and never makes a number up (09 LLM table, lib/llm/prompts/concierge.ts).

/** Builds the concierge rows from the stored quotes and verdicts, in shortlist order. Quotes without a verdict are left out. */
export async function conciergeRows(requestId: string, locale: Parameters<typeof clinicName>[1]): Promise<ConciergeQuoteRow[]> {
  const quotes = await customerStore.quotes(requestId);
  return quotes.flatMap(({ quote, verdict }) =>
    verdict
      ? [
          {
            clinicName: clinicName(quote.clinicId, locale),
            priceKrw: quote.priceKrw,
            amount: quote.amount,
            label: verdict.label,
            typicalAmount: verdict.typicalAmount,
            paidMoreThanQuoted: verdict.clinicFlags.some((f) => f.code === "paid_more_than_quoted"),
          },
        ]
      : [],
  );
}

/** Writes and stores `summary` on the request. Returns undefined when there is nothing judged to summarize. */
export async function summarizeRequest(requestId: string): Promise<{ text: string; mode: "live" | "fixture" } | undefined> {
  const request = await customerStore.request(requestId);
  if (!request) throw new Error(`no request ${requestId}`);
  const profile = await customerStore.profile(request.customerId);
  const locale = profile?.locale ?? request.request.languages[0];
  const rows = await conciergeRows(requestId, locale);
  if (rows.length === 0) return undefined;
  const procedure = getProcedure(request.request.procedureId);
  const procedureName = procedure?.name[locale] ?? procedure?.name.en ?? request.request.procedureId;
  const result = await summarizeQuotes({ locale, procedureName, rows });
  const summary = { text: result.text, mode: result.mode, at: clock.nowIso() };
  const latest = (await customerStore.request(requestId)) ?? request;
  await customerStore.putRequest({ ...latest, summary, updatedAt: clock.nowIso() });
  return { text: result.text, mode: result.mode };
}
