"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  CardHeader,
  ChipGroup,
  Label,
  Money,
  Sheet,
  Table,
  Timeline,
  buttonStyles,
  type TableColumn,
} from "@/components/ui";
import { formatRange, formatSlot, moneyText } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { SlotPicker } from "@/components/customer/slot-picker";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LOCALE_NAME } from "../../locales";
import {
  A2A_LOG,
  BOOKING_ID,
  EVENT_COPY,
  PROGRESS_STEPS,
  QUOTES,
  REQUEST_ID,
  SHORTLIST,
  VERDICTS,
  YUKI_REQUEST,
  candidateScore,
  downtimeOverlapsDeparture,
  getClinic,
  getProcedure,
  normalizedTotal,
  referenceFor,
  type ClinicProfile,
  type FairnessVerdictV1,
  type IsoDateTime,
  type QuoteV1,
} from "@/lib/ui-data/customer";

type Row = { quote: QuoteV1; verdict: FairnessVerdictV1; clinic: ClinicProfile; score: number };
type Sort = "match" | "unit" | "total";

const ROWS: Row[] = QUOTES.flatMap((quote) => {
  const verdict = VERDICTS.find((v) => v.quoteId === quote.quoteId);
  const clinic = getClinic(quote.clinicId);
  return verdict && clinic ? [{ quote, verdict, clinic, score: candidateScore(quote.clinicId) }] : [];
});

const SORTERS: Record<Sort, (a: Row, b: Row) => number> = {
  match: (a, b) => b.score - a.score,
  unit: (a, b) => a.verdict.normalizedUnitKrw - b.verdict.normalizedUnitKrw,
  total: (a, b) => normalizedTotal(a.quote) - normalizedTotal(b.quote),
};

export function RequestView() {
  const t = useTranslations("requests");
  const common = useTranslations("common");
  const router = useRouter();
  const label = useLabels();
  const { locale, profile, demo } = useCustomer();

  const [sort, setSort] = useState<Sort>("match");
  const [chosen, setChosen] = useState<Record<string, IsoDateTime | undefined>>({});
  const [confirming, setConfirming] = useState<Row | null>(null);

  const request = YUKI_REQUEST.request;
  const procedure = getProcedure(request.procedureId);
  const booking = demo.booking;
  const reference = SHORTLIST.priceReference;
  const rows = [...ROWS].sort(SORTERS[sort]);
  const unitName = common(`unitName.${reference.unit}`);

  const sendBooking = () => {
    if (!confirming) return;
    const slot = chosen[confirming.quote.quoteId];
    if (!slot) return;
    updateDemoState((state) => ({
      ...state,
      requestStarted: true,
      booking: { quoteId: confirming.quote.quoteId, slot, status: "pending_clinic" },
    }));
    router.push(`/bookings/${BOOKING_ID}`);
  };

  const warnings = (row: Row) => {
    const items: string[] = [];
    const gap = row.verdict.clinicFlags.find((flag) => flag.code === "paid_more_than_quoted");
    if (gap) items.push(t("warn.paidMore", { pct: gap.avgGapPct ?? 0 }));
    const slot = chosen[row.quote.quoteId];
    if (slot && procedure && downtimeOverlapsDeparture(procedure, slot, request.dateWindow.to)) items.push(t("warn.downtime"));
    return items;
  };

  const columns: TableColumn<Row>[] = [
    {
      key: "clinic",
      header: t("columns.clinic"),
      card: "title",
      cell: ({ clinic, quote }) => (
        <div className="flex flex-col gap-sp-1">
          <span className="font-semi">{label.clinic(clinic.id)}</span>
          <span className="text-label font-reg text-muted">{label.area(clinic.area)}</span>
          <span className="text-label font-reg text-muted">{quote.languages.map((l) => LOCALE_NAME[l]).join(" · ")}</span>
          <span className="text-caption font-reg text-subtle">{t(`mode.${quote.operationMode}`)}</span>
        </div>
      ),
    },
    {
      key: "total",
      header: t("columns.total"),
      card: "row",
      cell: ({ quote }) => {
        const copy = quote.event ? EVENT_COPY[quote.event.title] : undefined;
        return (
          <div className="flex flex-col items-end gap-sp-1 md:items-start">
            <Money krw={quote.priceKrw} reference={referenceFor(quote.priceKrw, locale)} locale={locale} />
            <span className="text-caption text-subtle">
              {quote.vatIncluded ? t("vat.included") : t("vat.excluded", { total: moneyText(normalizedTotal(quote), locale) })}
            </span>
            {quote.event ? (
              <div className="flex flex-col gap-sp-1 text-caption text-muted md:items-start">
                <span className="font-med text-text">{copy?.title[locale] ?? quote.event.title}</span>
                <span className="tabular-nums">{t("event.regular", { price: moneyText(quote.event.regularPriceKrw, locale) })}</span>
                <span className="tabular-nums">
                  {quote.event.validFrom}~{quote.event.validUntil}
                </span>
                <span>{t("event.conditions", { text: copy?.conditions[locale] ?? quote.event.conditions })}</span>
              </div>
            ) : null}
            <span className="text-caption text-subtle tabular-nums">{t("validUntil", { date: quote.validUntil })}</span>
          </div>
        );
      },
    },
    {
      key: "unit",
      header: t("columns.unit"),
      card: "row",
      cell: ({ verdict }) => (
        <span className="tabular-nums">{t("perUnit", { price: moneyText(verdict.normalizedUnitKrw, locale), unit: unitName })}</span>
      ),
    },
    {
      key: "amount",
      header: t("columns.amount"),
      card: "row",
      cell: ({ quote, verdict }) => {
        const { min, max, unit } = verdict.typicalAmount;
        return (
          <div className="flex flex-col gap-sp-1 md:items-start">
            <span className="font-med">{label.amount(quote.amount)}</span>
            <span className="text-caption text-subtle">
              {t("typical", { range: `${min}~${label.amount({ value: max, unit })}` })} · {common("demoValue")}
            </span>
          </div>
        );
      },
    },
    {
      key: "verdict",
      header: t("columns.verdict"),
      // full-width block in card mode: the evidence sentence is too long for a label/value row
      card: "action",
      cell: (row) => (
        <div className="flex flex-col gap-sp-2 md:items-start">
          <span className="text-label text-muted md:sr-only">{t("columns.verdict")}</span>
          <Label
            verdict={row.verdict.label}
            locale={locale}
            sampleSize={row.verdict.sampleSize}
            reason={row.verdict.explanation[locale] ?? row.verdict.explanation.en}
          />
          {warnings(row).map((text) => (
            <p key={text} className="text-caption text-muted">
              <span className="font-semi text-warning">{t("warn.label")}</span> {text}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: "includes",
      header: t("columns.includes"),
      card: "row",
      cell: ({ quote }) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span>{quote.includes.length > 0 ? quote.includes.map((k) => t(`includes.${k}`)).join(" · ") : t("includes.none")}</span>
          {quote.excludes.length > 0 ? (
            <span className="text-caption text-subtle">
              {t("includes.excluded", { items: quote.excludes.map((k) => t(`includes.${k}`)).join(" · ") })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "booking",
      header: t("columns.action"),
      card: "action",
      cell: (row) => {
        const { quote } = row;
        const slot = chosen[quote.quoteId];
        if (booking?.quoteId === quote.quoteId) {
          return (
            <div className="flex flex-col gap-sp-2">
              <span className="text-label font-med">{common(`bookingStatus.${booking.status}`)}</span>
              <Link href={`/bookings/${BOOKING_ID}`} className={buttonStyles({ variant: "secondary" })}>
                {t("openBooking")}
              </Link>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-sp-3">
            <div className="flex flex-col gap-sp-2">
              <span className="text-label text-muted md:sr-only">{t("columns.slots")}</span>
              <SlotPicker
                slots={quote.slots}
                value={slot}
                locale={locale}
                disabled={Boolean(booking)}
                onChange={(next) => setChosen((prev) => ({ ...prev, [quote.quoteId]: next }))}
              />
            </div>
            <div className="flex flex-col gap-sp-1">
              <Button disabled={!slot || Boolean(booking)} onClick={() => setConfirming(row)}>
                {t("book")}
              </Button>
              {!slot && !booking ? <span className="text-caption text-subtle">{t("pickSlot")}</span> : null}
            </div>
          </div>
        );
      },
    },
  ];

  const status = demo.booking ? (demo.booking.status === "confirmed" ? "booked" : "booking") : YUKI_REQUEST.status;
  const confirmSlot = confirming ? chosen[confirming.quote.quoteId] : undefined;

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("summary.title")} description={`${REQUEST_ID}`} as="h2" />
        <dl className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem term={t("summary.procedure")}>
            {label.procedure(request.procedureId)} · {label.amount(request.amount)}
          </SummaryItem>
          <SummaryItem term={t("summary.dates")}>
            <span className="tabular-nums">{formatRange(request.dateWindow.from, request.dateWindow.to)}</span>
          </SummaryItem>
          <SummaryItem term={t("summary.languages")}>{request.languages.map((l) => LOCALE_NAME[l]).join(" · ")}</SummaryItem>
          <SummaryItem term={t("summary.status")}>{t(`status.${status}`)}</SummaryItem>
        </dl>
      </Card>

      <section aria-labelledby="req-progress" className="flex flex-col gap-sp-3">
        <h2 id="req-progress" className="text-title font-semi">
          {t("progress.title")}
        </h2>
        <Timeline
          rawLabel={t("progress.raw")}
          items={PROGRESS_STEPS.map((step) => ({
            id: step.id,
            at: step.at.slice(11, 19),
            title: step.humanSummary[locale] ?? step.humanSummary.en,
            detail: step.detail[locale] ?? step.detail.en,
            raw: step.entries.length === 1 ? rawOf(step.entries[0]) : step.entries.map(rawOf),
          }))}
        />
      </section>

      <Card className="flex flex-col gap-sp-1">
        <CardHeader title={t("reference.title")} as="h2" />
        <p className="text-body text-muted tabular-nums">
          {t("reference.body", {
            days: reference.windowDays,
            count: reference.sampleSize,
            unit: unitName,
            p25: moneyText(reference.p25UnitKrw, locale),
            p75: moneyText(reference.p75UnitKrw, locale),
            p50: moneyText(reference.p50UnitKrw, locale),
          })}
        </p>
      </Card>

      <section aria-labelledby="req-compare" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="req-compare" className="text-title font-semi">
            {t("compare.title")}
          </h2>
          <p className="text-label text-muted">{t("compare.hint")}</p>
        </div>
        <div className="flex flex-col gap-sp-1">
          <span className="text-label text-muted">{t("sort.label")}</span>
          <ChipGroup
            label={t("sort.label")}
            options={(["match", "unit", "total"] as const).map((value) => ({ value, label: t(`sort.${value}`) }))}
            value={sort}
            onChange={setSort}
          />
        </div>
        <div className="cu-quotes">
          <Table caption={t("compare.caption")} columns={columns} rows={rows} rowKey={(row) => row.quote.quoteId} />
        </div>
      </section>

      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title={t("sheet.title")} closeLabel={common("close")}>
        {confirming && confirmSlot ? (
          <div className="flex flex-col gap-sp-4">
            <dl className="flex flex-col gap-sp-2">
              <Fact term={t("sheet.clinic")}>{label.clinic(confirming.clinic.id)}</Fact>
              <Fact term={t("sheet.when")}>
                <span className="tabular-nums">{formatSlot(confirmSlot, locale)}</span>
              </Fact>
              <Fact term={t("sheet.procedure")}>
                {label.procedure(confirming.quote.procedureId)} · {label.amount(confirming.quote.amount)}
              </Fact>
              <Fact term={t("sheet.total")}>
                <Money krw={confirming.quote.priceKrw} reference={referenceFor(confirming.quote.priceKrw, locale)} locale={locale} />
              </Fact>
            </dl>
            <section className="flex flex-col gap-sp-2">
              <h3 className="text-label font-med text-muted">{t("sheet.sharedTitle")}</h3>
              <dl className="flex flex-col gap-sp-2">
                <Fact term={t("sheet.name")}>{profile.nickname}</Fact>
                <Fact term={t("sheet.safety")}>
                  {t("sheet.safetyValue", {
                    pregnant: profile.safety.pregnantOrBreastfeeding ? t("sheet.yes") : t("sheet.no"),
                    allergies: profile.safety.allergies.length > 0 ? profile.safety.allergies.join(", ") : t("sheet.none"),
                  })}
                </Fact>
                <Fact term={t("sheet.contact")}>
                  {profile.contact.channel} · {profile.contact.handle}
                </Fact>
              </dl>
            </section>
            <p className="text-caption text-subtle">{t("sheet.doctor")}</p>
            <div className="flex flex-col gap-sp-2 sm:flex-row-reverse">
              <Button fullWidth onClick={sendBooking}>
                {t("sheet.send")}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setConfirming(null)}>
                {t("sheet.back")}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function rawOf(entry: (typeof A2A_LOG)[number]) {
  return { skillId: entry.skillId, to: entry.to.url, latencyMs: entry.latencyMs, request: entry.request, response: entry.response };
}

function SummaryItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1">
      <dt className="text-label text-muted">{term}</dt>
      <dd className="text-body font-med">{children}</dd>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-sp-3")}>
      <dt className="shrink-0 text-label text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-end text-body">{children}</dd>
    </div>
  );
}
