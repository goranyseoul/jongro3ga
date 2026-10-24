"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonStyles, Card, ChipGroup, Input, Timeline } from "@/components/ui";
import { formatMonth, moneyText } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { carePoint, isLate, monthGroups, procedureSummaries, type CarePoint } from "./care-plan";
import { RecordsCalendar } from "./records-calendar";
import {
  DEMO_TODAY,
  detectProcedure,
  getProcedure,
  upcomingSessionNumber,
  type RecordStatus,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";

const STATUSES: RecordStatus[] = ["active", "paused", "stopped"];
const TOP_COUNT = 3;
const ALL = "all";

/** The newest record of each procedure; its nextDue is the date the customer is waiting for. */
function latestPerProcedure(records: TreatmentRecord[]): TreatmentRecord[] {
  const latest = new Map<string, TreatmentRecord>();
  for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date))) latest.set(record.procedureId, record);
  return [...latest.values()].sort((a, b) => (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999"));
}

export function RecordsView() {
  const t = useTranslations("records");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale, records } = useCustomer();
  const [filter, setFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [showAllTop, setShowAllTop] = useState(false);

  const latest = latestPerProcedure(records);
  const summaries = procedureSummaries(records);
  const history = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber);

  // A chip picks one procedure; free text matches names in any language through detectProcedure.
  const needle = query.trim().toLowerCase();
  const matches = (id: string) =>
    filter !== ALL
      ? id === filter
      : needle === "" || label.procedure(id).toLowerCase().includes(needle) || detectProcedure(needle)?.id === id;
  const shown = history.filter((record) => matches(record.procedureId));
  const focused = filter !== ALL || needle !== "" ? summaries.filter((s) => matches(s.procedureId)) : [];

  const setStatus = (record: TreatmentRecord, status: RecordStatus) =>
    updateDemoState((state) => ({ ...state, recordStatus: { ...state.recordStatus, [record.id]: status } }));

  const openProcedure = (procedureId: string) => {
    setFilter(procedureId);
    setQuery("");
    document.getElementById("rec-history")?.scrollIntoView({ behavior: "smooth" });
  };

  const recordDate = (record: TreatmentRecord) =>
    record.datePrecision === "month" ? t("history.unknownDay", { month: formatMonth(record.date.slice(0, 7), locale) }) : record.date;

  const cycleText = (procedureId: string) => {
    const procedure = getProcedure(procedureId);
    if (!procedure) return "";
    const { initial, maintenanceIntervalDays: window } = procedure.cycle;
    const every =
      window.min === window.max ? t("cycle.every", { days: window.min }) : t("cycle.range", { min: window.min, max: window.max });
    return initial
      ? t("cycle.course", { interval: initial.intervalDays, count: initial.count, every })
      : t("cycle.maintenance", { every });
  };

  const pointText = (point: CarePoint) => {
    const { kind, ...values } = point;
    return t(`point.${kind}`, values);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-sp-3">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Link href="/records/new" className={buttonStyles()}>
          {t("add")}
        </Link>
      </div>

      <section aria-labelledby="rec-plan" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="rec-plan" className="text-title font-semi">
            {t("plan.title")}
          </h2>
          <p className="text-label text-muted">{t("plan.lead")}</p>
        </div>
        {latest.length === 0 ? (
          <p className="text-body text-muted">{t("next.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-sp-3 md:grid-cols-2">
            {latest.map((record) => {
              const point = carePoint(record, DEMO_TODAY);
              return (
                <li key={record.id}>
                  <Card className="flex h-full flex-col gap-sp-3">
                    <div className="flex flex-col gap-sp-1">
                      <p className="text-title font-semi">{label.procedure(record.procedureId)}</p>
                      {record.status === "active" && record.nextDue ? (
                        <p className="text-body tabular-nums">
                          {common("session", { n: upcomingSessionNumber(record), date: record.nextDue })}
                        </p>
                      ) : (
                        <p className="text-body text-muted">{t(`next.${record.status === "paused" ? "paused" : "stopped"}`)}</p>
                      )}
                      {point ? (
                        <p
                          className={cn(
                            "text-label font-med",
                            isLate(point) ? "text-warning" : point.kind === "window" ? "text-success" : "text-text",
                          )}
                        >
                          {pointText(point)}
                        </p>
                      ) : null}
                      <p className="text-label text-subtle">{cycleText(record.procedureId)}</p>
                    </div>
                    <div className="flex flex-col gap-sp-2">
                      <p className="text-label text-muted">{t("next.statusLabel")}</p>
                      <ChipGroup
                        label={t("next.statusLabel")}
                        options={STATUSES.map((value) => ({ value, label: t(`next.status.${value}`) }))}
                        value={record.status}
                        onChange={(status) => setStatus(record, status)}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {summaries.length > 0 ? (
        <section aria-labelledby="rec-top" className="flex flex-col gap-sp-3">
          <h2 id="rec-top" className="text-title font-semi">
            {t("top.title")}
          </h2>
          <ul className="grid grid-cols-1 gap-sp-3 sm:grid-cols-3">
            {(showAllTop ? summaries : summaries.slice(0, TOP_COUNT)).map((summary) => (
              <li key={summary.procedureId}>
                <button
                  type="button"
                  onClick={() => openProcedure(summary.procedureId)}
                  className={cn("h-full w-full rounded-card text-start", focusRing)}
                >
                  <Card className="flex h-full flex-col gap-sp-1 hover:bg-sunken">
                    <p className="text-title font-semi">{label.procedure(summary.procedureId)}</p>
                    <p className="text-body tabular-nums">{t("top.count", { n: summary.count })}</p>
                    <p className="text-label text-muted tabular-nums">{t("top.last", { date: recordDate(summary.last) })}</p>
                    {summary.totalKrw > 0 ? (
                      <p className="text-label text-muted tabular-nums">
                        {t("top.total", { amount: moneyText(summary.totalKrw, locale) })}
                      </p>
                    ) : null}
                  </Card>
                </button>
              </li>
            ))}
          </ul>
          {summaries.length > TOP_COUNT ? (
            <Button variant="ghost" className="self-start" onClick={() => setShowAllTop(!showAllTop)}>
              {showAllTop ? t("top.less") : t("top.more", { n: summaries.length - TOP_COUNT })}
            </Button>
          ) : null}
        </section>
      ) : null}

      <RecordsCalendar records={records} latest={latest} locale={locale} />

      <section aria-labelledby="rec-history" className="flex scroll-mt-sp-16 flex-col gap-sp-3">
        <h2 id="rec-history" className="text-title font-semi">
          {t("history.title")}
        </h2>
        {history.length === 0 ? (
          <p className="text-body text-muted">{t("history.empty")}</p>
        ) : (
          <>
            <Input
              type="search"
              label={t("history.search")}
              placeholder={t("history.searchPlaceholder")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFilter(ALL);
              }}
            />
            <ChipGroup
              label={t("history.search")}
              options={[
                { value: ALL, label: t("history.all") },
                ...summaries.map((s) => ({ value: s.procedureId as string, label: label.procedure(s.procedureId) })),
              ]}
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setQuery("");
              }}
            />

            {focused.map((summary) => {
              const point = carePoint(summary.last, DEMO_TODAY);
              return (
                <Card key={summary.procedureId} className="flex flex-col gap-sp-1">
                  <p className="text-title font-semi">{label.procedure(summary.procedureId)}</p>
                  <p className="text-body tabular-nums">
                    {t("history.summary", {
                      first: recordDate(summary.first),
                      count: summary.count,
                      total: moneyText(summary.totalKrw, locale),
                    })}
                  </p>
                  {point ? (
                    <p className={cn("text-label font-med", isLate(point) ? "text-warning" : "text-text")}>{pointText(point)}</p>
                  ) : null}
                  <p className="text-label text-subtle">{cycleText(summary.procedureId)}</p>
                </Card>
              );
            })}

            {shown.length === 0 ? (
              <p className="text-body text-muted">{t("history.noMatch")}</p>
            ) : (
              monthGroups(shown).map((group) => (
                <div key={group.month} className="flex flex-col gap-sp-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-sp-2 border-b border-border pb-sp-1">
                    <h3 className="text-body font-semi tabular-nums">{formatMonth(group.month, locale)}</h3>
                    <p className="text-label text-muted tabular-nums">
                      {t("history.month", { count: group.records.length, total: moneyText(group.totalKrw, locale) })}
                    </p>
                  </div>
                  <Timeline
                    rawLabel=""
                    items={group.records.map((record) => ({
                      id: record.id,
                      at: recordDate(record),
                      title: (
                        <span className="font-med">
                          {label.procedure(record.procedureId)}
                          {record.amount ? ` · ${label.amount(record.amount)}` : ""} ·{" "}
                          {t("history.session", { n: record.sessionNumber })}
                        </span>
                      ),
                      detail: (
                        <ul className="flex flex-col gap-sp-1">
                          {record.clinicId || record.clinicName ? (
                            <li>{record.clinicId ? label.clinic(record.clinicId) : record.clinicName}</li>
                          ) : null}
                          {record.priceKrw ? <li className="tabular-nums">{moneyText(record.priceKrw, locale)}</li> : null}
                          {record.rating ? <li>{t("history.rating", { n: record.rating })}</li> : null}
                          {record.source === "booking" ? <li>{t("history.fromBooking")}</li> : null}
                          <li>{record.sharedToPlatform ? t("history.shared") : t("history.notShared")}</li>
                        </ul>
                      ),
                    }))}
                  />
                </div>
              ))
            )}
          </>
        )}
      </section>
    </>
  );
}
