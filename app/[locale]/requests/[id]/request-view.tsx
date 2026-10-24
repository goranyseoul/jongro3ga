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
import { api, ApiError, useApi } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import { formatRange, formatSlot, moneyText } from "@/components/customer/format";
import { SlotPicker } from "@/components/customer/slot-picker";
import { useLabels, useMe } from "@/components/customer/use-customer";
import type { OptionView, RequestView as RequestViewData } from "@/lib/agents/customer/bff";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LOCALE_NAME } from "../../locales";
import { EVENT_COPY, referenceFor, type IsoDateTime } from "@/lib/ui-data/customer";

type Sort = "match" | "unit" | "total";

/** Total with VAT, the base of the unit price (07 "입력 정규화"). */
const normalizedTotal = (quote: OptionView["quote"]) => (quote.vatIncluded ? quote.priceKrw : Math.round(quote.priceKrw * 1.1));
const unitPrice = (row: OptionView) => row.verdict?.normalizedUnitKrw ?? Math.round(normalizedTotal(row.quote) / row.quote.amount.value);

const SORTERS: Record<Sort, (a: OptionView, b: OptionView) => number> = {
  match: (a, b) => b.score - a.score,
  unit: (a, b) => unitPrice(a) - unitPrice(b),
  total: (a, b) => normalizedTotal(a.quote) - normalizedTotal(b.quote),
};

/** Request progress polls every 2s while the agents are still working (09). */
const WORKING = new Set(["matching", "quoting", "judging", "booking"]);

export function RequestView({ id }: { id: string }) {
  const t = useTranslations("requests");
  const common = useTranslations("common");
  const router = useRouter();
  const label = useLabels();
  const { data: me, locale } = useMe();
  const { data: view, error, loading, reload } = useApi<RequestViewData>(`/api/customer/requests/${id}`, {
    pollMs: 2000,
    keepPolling: (v) => WORKING.has(v.request.status),
  });

  const [sort, setSort] = useState<Sort>("match");
  const [chosen, setChosen] = useState<Record<string, IsoDateTime | undefined>>({});
  const [confirming, setConfirming] = useState<OptionView | null>(null);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!view) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }

  const request = view.request.request;
  const status = view.request.status;
  const booking = view.booking && view.booking.status !== "canceled" ? view.booking : undefined;
  const reference = view.priceReference;
  const rows = [...view.options].sort(SORTERS[sort]);
  const unitName = common(`unitName.${reference?.unit ?? request.amount.unit}`);
  const working = WORKING.has(status) && status !== "booking";

  const sendBooking = async () => {
    if (!confirming) return;
    const slot = chosen[confirming.quote.quoteId];
    if (!slot) return;
    setSending(true);
    setActionError(null);
    try {
      const created = await api<{ bookingId: string }>(`/api/customer/requests/${id}/book`, {
        method: "POST",
        json: { quoteId: confirming.quote.quoteId, slot },
      });
      router.push(`/bookings/${created.bookingId}`);
    } catch (err) {
      setActionError(err instanceof ApiError && err.code === "consent_required" ? t("errors.consent") : t("errors.book"));
      setSending(false);
    }
  };

  const retry = async () => {
    setActionError(null);
    try {
      await api(`/api/customer/requests/${id}/start`, { method: "POST", json: {} });
      await reload();
    } catch {
      setActionError(t("errors.retry"));
    }
  };

  const warnings = (row: OptionView) => {
    const items: string[] = [];
    if (row.warnings.includes("underdosed")) {
      const { min, max, unit } = row.verdict?.typicalAmount ?? { min: 0, max: 0, unit: row.quote.amount.unit };
      items.push(t("warn.underdosed", { range: `${min}~${label.amount({ value: max, unit })}` }));
    }
    const gap = row.verdict?.clinicFlags.find((flag) => flag.code === "paid_more_than_quoted");
    if (gap) items.push(t("warn.paidMore", { pct: gap.avgGapPct ?? 0 }));
    const slot = chosen[row.quote.quoteId];
    if (slot && row.downtimeSlots.includes(slot)) items.push(t("warn.downtime"));
    return items;
  };

  const columns: TableColumn<OptionView>[] = [
    {
      key: "clinic",
      header: t("columns.clinic"),
      card: "title",
      cell: ({ clinic, quote }) => (
        <div className="flex flex-col gap-sp-1">
          <span className="font-semi">{label.clinic(clinic.id, clinic.name)}</span>
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
            {quote.indicative ? <span className="text-caption text-subtle">{t("indicativeNote")}</span> : null}
            <span className="text-caption text-subtle tabular-nums">{t("validUntil", { date: quote.validUntil })}</span>
          </div>
        );
      },
    },
    {
      key: "unit",
      header: t("columns.unit"),
      card: "row",
      cell: (row) => <span className="tabular-nums">{t("perUnit", { price: moneyText(unitPrice(row), locale), unit: common(`unitName.${row.quote.amount.unit}`) })}</span>,
    },
    {
      key: "amount",
      header: t("columns.amount"),
      card: "row",
      cell: ({ quote, verdict }) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span className="font-med">{label.amount(quote.amount)}</span>
          {verdict ? (
            <span className="text-caption text-subtle">
              {t("typical", { range: `${verdict.typicalAmount.min}~${label.amount({ value: verdict.typicalAmount.max, unit: verdict.typicalAmount.unit })}` })} · {common("demoValue")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "verdict",
      header: t("columns.verdict"),
      // full-width block in card mode: the evidence sentence is too long for a label/value row
      card: "action",
      cell: (row) => (
        <div className="flex flex-col gap-sp-2 md:items-start">
          <span className="text-label text-muted md:sr-only">{t("columns.verdict")}</span>
          {row.verdict ? (
            <Label
              verdict={row.verdict.label}
              locale={locale}
              sampleSize={row.verdict.sampleSize}
              reason={row.verdict.explanation[locale] ?? row.verdict.explanation.en}
            />
          ) : (
            <span className="text-label text-muted">{t("noVerdict")}</span>
          )}
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
          <span>{quote.includes.length > 0 ? quote.includes.map((k) => includeLabel(k)).join(" · ") : t("includes.none")}</span>
          {quote.excludes.length > 0 ? (
            <span className="text-caption text-subtle">{t("includes.excluded", { items: quote.excludes.map((k) => includeLabel(k)).join(" · ") })}</span>
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
              <Link href={`/bookings/${booking.id}`} className={buttonStyles({ variant: "secondary" })}>
                {t("openBooking")}
              </Link>
            </div>
          );
        }
        const locked = Boolean(booking) || status !== "comparing";
        return (
          <div className="flex flex-col gap-sp-3">
            <div className="flex flex-col gap-sp-2">
              <span className="text-label text-muted md:sr-only">{t("columns.slots")}</span>
              <SlotPicker
                slots={quote.slots}
                value={slot}
                locale={locale}
                disabled={locked}
                onChange={(next) => setChosen((prev) => ({ ...prev, [quote.quoteId]: next }))}
              />
            </div>
            <div className="flex flex-col gap-sp-1">
              <Button disabled={!slot || locked} onClick={() => setConfirming(row)}>
                {t("book")}
              </Button>
              {!slot && !locked ? <span className="text-caption text-subtle">{t("pickSlot")}</span> : null}
            </div>
          </div>
        );
      },
    },
  ];

  function includeLabel(key: string): string {
    return t.has(`includes.${key}`) ? t(`includes.${key}`) : key;
  }

  const confirmSlot = confirming ? chosen[confirming.quote.quoteId] : undefined;
  const profile = me?.profile;

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("summary.title")} description={view.request.id} as="h2" />
        <dl className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem term={t("summary.procedure")}>
            {label.procedure(request.procedureId)} · {label.amount(request.amount)}
          </SummaryItem>
          <SummaryItem term={t("summary.dates")}>
            <span className="tabular-nums">{formatRange(request.dateWindow.from, request.dateWindow.to)}</span>
          </SummaryItem>
          <SummaryItem term={t("summary.languages")}>{request.languages.map((l) => LOCALE_NAME[l]).join(" · ")}</SummaryItem>
          <SummaryItem term={t("summary.status")}>
            <span aria-live="polite">{t(`status.${status}`)}</span>
          </SummaryItem>
        </dl>
        {working ? (
          <p role="status" className="text-label text-muted">
            {view.statusCopy[locale] ?? view.statusCopy.en}
          </p>
        ) : null}
        {status === "failed" ? (
          <div className="flex flex-col gap-sp-2">
            <p className="text-body text-muted">{t(`failure.${view.request.failure ?? "platform_unavailable"}`)}</p>
            {view.request.failure !== "not_eligible_foreign_patient" ? (
              <Button variant="secondary" className="self-start" onClick={() => void retry()}>
                {t("retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {status === "draft" ? (
          <Link href="/chat" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("draftNote")}
          </Link>
        ) : null}
        {actionError ? <p className="text-label text-muted">{actionError}</p> : null}
      </Card>

      <section aria-labelledby="req-progress" className="flex flex-col gap-sp-3">
        <h2 id="req-progress" className="text-title font-semi">
          {t("progress.title")}
        </h2>
        {view.timeline.length > 0 ? (
          <Timeline
            rawLabel={t("progress.raw")}
            items={view.timeline.map((item) => ({
              id: item.id,
              at: item.at.slice(11, 19),
              title: item.summary[locale] ?? item.summary.en ?? item.skillId ?? "",
              detail: [item.skillId, item.state ? common(`taskState.${item.state}`) : undefined].filter(Boolean).join(" · "),
              raw: { skillId: item.skillId, target: item.target, latencyMs: item.latencyMs, ...item.raw },
            }))}
          />
        ) : (
          <p className="text-body text-muted">{working ? (view.statusCopy[locale] ?? view.statusCopy.en) : t("progress.empty")}</p>
        )}
        {view.failures.length > 0 ? (
          <ul className="flex flex-col gap-sp-1">
            {view.failures.map((failure) => (
              <li key={failure.clinicId} className="text-label text-muted">
                {t(`noAnswer.${failure.kind}`, { clinic: label.clinic(failure.clinicId, failure.clinic.name) })}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {reference ? (
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
      ) : null}

      {rows.length > 0 ? (
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
      ) : null}

      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title={t("sheet.title")} closeLabel={common("close")}>
        {confirming && confirmSlot ? (
          <div className="flex flex-col gap-sp-4">
            <dl className="flex flex-col gap-sp-2">
              <Fact term={t("sheet.clinic")}>{label.clinic(confirming.clinic.id, confirming.clinic.name)}</Fact>
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
            {profile ? (
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
            ) : null}
            <p className="text-caption text-subtle">{t("sheet.doctor")}</p>
            {actionError ? <p className="text-label text-muted">{actionError}</p> : null}
            <div className="flex flex-col gap-sp-2 sm:flex-row-reverse">
              <Button fullWidth onClick={() => void sendBooking()} disabled={sending}>
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
