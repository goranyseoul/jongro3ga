"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FiAlertCircle, FiMinus, FiPlus, FiSearch } from "react-icons/fi";
import { Button, buttonStyles, Card, Input, Timeline } from "@/components/ui";
import { formatMonth, formatRange, moneyText } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  carePoint,
  isLate,
  monthGroups,
  procedureSummaries,
  recordArea,
  recordClinic,
  topValues,
  type CarePoint,
} from "./care-plan";
import { RecordsCalendar } from "./records-calendar";
import {
  DEMO_TODAY,
  addDays,
  detectProcedure,
  getProcedure,
  shortHex,
  txUrl,
  upcomingSessionNumber,
  type RecordStatus,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";

const STATUSES: RecordStatus[] = ["active", "paused", "stopped"];
const PLAN_COUNT = 4;
const ALERT_COUNT = 2;
const PAGE_SIZE = 10;
const FIND_DAYS = 30;

type PresetKind = "procedure" | "area" | "clinic";
const PRESET_KINDS: PresetKind[] = ["procedure", "area", "clinic"];
const presetValue: Record<PresetKind, (r: TreatmentRecord) => string | undefined> = {
  procedure: (r) => r.procedureId,
  area: recordArea,
  clinic: recordClinic,
};

// Compact chips for the care plan cards and history presets: two thirds of the regular chip height.
const smallChip =
  "inline-flex h-sp-8 items-center justify-center gap-sp-1 rounded-md border px-sp-3 text-label font-med transition-colors duration-press ease-out";
const chipState = (selected: boolean) =>
  selected ? "border-brand bg-brand text-on-brand" : "border-input bg-elev text-text hover:bg-sunken";

/** The newest record of each procedure, active ones first, then by the date the customer is waiting for. */
function latestPerProcedure(records: TreatmentRecord[]): TreatmentRecord[] {
  const latest = new Map<string, TreatmentRecord>();
  for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date))) latest.set(record.procedureId, record);
  return [...latest.values()].sort(
    (a, b) =>
      STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999"),
  );
}

export function RecordsView() {
  const t = useTranslations("records");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale, records } = useCustomer();
  const [filter, setFilter] = useState<{ kind: PresetKind; value: string } | null>(null);
  const [query, setQuery] = useState("");
  const topRail = useRef<HTMLUListElement>(null);
  const [topEdges, setTopEdges] = useState({ start: true, end: true });
  const [showAllPlan, setShowAllPlan] = useState(false);
  const [page, setPage] = useState(0);

  const latest = latestPerProcedure(records);
  // Urgent alerts by the page title: active procedures past their recommended interval, most overdue first.
  const alerts = latest
    .map((record) => ({ record, point: carePoint(record, DEMO_TODAY) }))
    .flatMap(({ record, point }) =>
      point && (point.kind === "late" || point.kind === "courseLate") ? [{ record, kind: point.kind, late: point.late }] : [],
    )
    .sort((a, b) => b.late - a.late);
  const summaries = procedureSummaries(records);
  const history = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber);

  // A preset chip picks one procedure, area or clinic; free text matches procedure names in any language.
  const needle = query.trim().toLowerCase();
  const matchesText = (id: string) =>
    needle === "" || label.procedure(id).toLowerCase().includes(needle) || detectProcedure(needle)?.id === id;
  const matchesRecord = (record: TreatmentRecord) =>
    filter ? presetValue[filter.kind](record) === filter.value : matchesText(record.procedureId);
  const shown = history.filter(matchesRecord);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRecords = shown.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const focused =
    filter?.kind === "procedure"
      ? summaries.filter((s) => s.procedureId === filter.value)
      : !filter && needle !== ""
        ? summaries.filter((s) => matchesText(s.procedureId))
        : [];

  const presetLabel = (kind: PresetKind, value: string) => {
    if (kind === "procedure") return label.procedure(value);
    if (kind === "area") return t(`history.area.${value}`);
    return value.startsWith("name:") ? value.slice(5) : label.clinic(value);
  };
  const choosePreset = (next: { kind: PresetKind; value: string } | null) => {
    setFilter(next);
    setQuery("");
    setPage(0);
  };

  // "Find clinics" opens the agent chat with the procedure and the next month. Shown to every customer
  // (records owner decision 2026-10-24); the chat itself still refuses matching for Korean nationals and
  // residents (08-compliance.md section 2) and shows its notice instead.
  const findTo = addDays(DEMO_TODAY, FIND_DAYS);
  const findHref = (procedureId: string) =>
    `/chat?intent=${encodeURIComponent(
      t("plan.findIntent", { procedure: label.procedure(procedureId), range: formatRange(DEMO_TODAY, findTo) }),
    )}`;

  const setStatus = (record: TreatmentRecord, status: RecordStatus) =>
    updateDemoState((state) => ({ ...state, recordStatus: { ...state.recordStatus, [record.id]: status } }));

  // The top procedures rail scrolls sideways (swipe on phones, arrows next to the heading).
  const updateTopEdges = () => {
    const rail = topRail.current;
    if (!rail) return;
    setTopEdges({ start: rail.scrollLeft <= 1, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1 });
  };
  const scrollTop = (direction: 1 | -1) => topRail.current?.scrollBy({ left: direction * topRail.current.clientWidth, behavior: "smooth" });
  useEffect(() => {
    updateTopEdges();
    window.addEventListener("resize", updateTopEdges);
    return () => window.removeEventListener("resize", updateTopEdges);
  }, [summaries.length]);

  const openProcedure = (procedureId: string) => {
    choosePreset({ kind: "procedure", value: procedureId });
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

  // Month headers count the whole month even when a page shows only part of it.
  const monthText = (month: string) => {
    const inMonth = shown.filter((r) => r.date.startsWith(month));
    const total = inMonth.reduce((sum, r) => sum + (r.priceKrw ?? 0), 0);
    return t("history.month", { count: inMonth.length, total: moneyText(total, locale) });
  };

  const pointText = (point: CarePoint) => {
    const { kind, ...values } = point;
    return t(`point.${kind}`, values);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-sp-3">
        <div className="flex flex-wrap items-center gap-sp-3">
          <h1 className="text-h2 font-semi">{t("title")}</h1>
          {alerts.length > 0 ? (
            <ul aria-label={t("alerts.label")} className="flex flex-wrap items-center gap-sp-2">
              {alerts.slice(0, ALERT_COUNT).map(({ record, kind, late }) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => document.getElementById("rec-plan")?.scrollIntoView({ behavior: "smooth" })}
                    className={cn(smallChip, "border-warning bg-elev text-warning hover:bg-sunken", focusRing)}
                  >
                    <FiAlertCircle aria-hidden />
                    {t(`alerts.${kind}`, { procedure: label.procedure(record.procedureId), late })}
                  </button>
                </li>
              ))}
              {alerts.length > ALERT_COUNT ? (
                <li className="text-label font-med text-warning">{t("alerts.more", { n: alerts.length - ALERT_COUNT })}</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <Link href="/records/new" className={buttonStyles()}>
          {t("add")}
        </Link>
      </div>

      {summaries.length > 0 ? (
        <section aria-labelledby="rec-top" className="flex flex-col gap-sp-3">
          <div className="flex items-center justify-between gap-sp-2">
            <h2 id="rec-top" className="text-title font-semi">
              {t("top.title")}
            </h2>
            {topEdges.start && topEdges.end ? null : (
              <div className="flex items-center">
                <Button variant="ghost" aria-label={t("top.prev")} disabled={topEdges.start} onClick={() => scrollTop(-1)}>
                  {"<"}
                </Button>
                <Button variant="ghost" aria-label={t("top.next")} disabled={topEdges.end} onClick={() => scrollTop(1)}>
                  {">"}
                </Button>
              </div>
            )}
          </div>
          <ul
            ref={topRail}
            onScroll={updateTopEdges}
            className="-me-sp-3 flex snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {summaries.map((summary) => (
              <li key={summary.procedureId} className="shrink-0 basis-4/5 snap-start pe-sp-3 sm:basis-1/3">
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
        </section>
      ) : null}

      <section aria-labelledby="rec-plan" className="flex flex-col gap-sp-3">
        <div className="flex items-start justify-between gap-sp-2">
          <div className="flex flex-col gap-sp-1">
            <h2 id="rec-plan" className="text-title font-semi">
              {t("plan.title")}
            </h2>
            <p className="text-label text-muted">{t("plan.lead")}</p>
          </div>
          {latest.length > PLAN_COUNT ? (
            <Button
              variant="ghost"
              className="shrink-0 text-title"
              aria-label={showAllPlan ? t("plan.showLess") : t("plan.showAll", { n: latest.length })}
              title={showAllPlan ? t("plan.showLess") : t("plan.showAll", { n: latest.length })}
              aria-expanded={showAllPlan}
              onClick={() => setShowAllPlan(!showAllPlan)}
            >
              {showAllPlan ? <FiMinus aria-hidden /> : <FiPlus aria-hidden />}
            </Button>
          ) : null}
        </div>
        {latest.length === 0 ? (
          <p className="text-body text-muted">{t("next.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-sp-3 md:grid-cols-2">
            {(showAllPlan ? latest : latest.slice(0, PLAN_COUNT)).map((record) => {
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
                    <div className="mt-auto flex flex-col gap-sp-1">
                      <p className="text-label text-muted">{t("next.statusLabel")}</p>
                      <div className="flex flex-wrap items-center gap-sp-2">
                        <div role="group" aria-label={t("next.statusLabel")} className="flex gap-sp-1">
                          {STATUSES.map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={record.status === value}
                              onClick={() => setStatus(record, value)}
                              className={cn(smallChip, chipState(record.status === value), focusRing)}
                            >
                              {t(`next.status.${value}`)}
                            </button>
                          ))}
                        </div>
                        {record.status === "active" ? (
                          <Link
                            href={findHref(record.procedureId)}
                            className={cn(smallChip, "ms-auto border-danger bg-elev text-danger hover:bg-sunken", focusRing)}
                          >
                            <FiSearch aria-hidden />
                            {t("plan.findClinic")}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RecordsCalendar records={records} latest={latest} locale={locale} />

      <section aria-labelledby="rec-history" className="flex scroll-mt-sp-16 flex-col gap-sp-3">
        <div className="flex items-center justify-between gap-sp-2">
          <h2 id="rec-history" className="text-title font-semi">
            {t("history.title")}
          </h2>
          {history.length > 0 ? (
            <button
              type="button"
              aria-pressed={!filter && needle === ""}
              onClick={() => choosePreset(null)}
              className={cn(smallChip, chipState(!filter && needle === ""), focusRing)}
            >
              {t("history.all")}
            </button>
          ) : null}
        </div>
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
                setFilter(null);
                setPage(0);
              }}
            />
            <div className="flex flex-col gap-sp-2">
              {PRESET_KINDS.map((kind) => {
                const values = topValues(records, presetValue[kind]);
                if (values.length === 0) return null;
                return (
                  <div key={kind} className="flex items-start gap-sp-2">
                    <span className="flex h-sp-8 w-sp-12 shrink-0 items-center text-label text-muted">{t(`history.preset.${kind}`)}</span>
                    <div role="group" aria-label={t(`history.preset.${kind}`)} className="flex flex-wrap gap-sp-1">
                      {values.map((value) => {
                        const selected = filter?.kind === kind && filter.value === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => choosePreset(selected ? null : { kind, value })}
                            className={cn(smallChip, chipState(selected), focusRing)}
                          >
                            {presetLabel(kind, value)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {focused.map((summary) => {
              const point = carePoint(summary.last, DEMO_TODAY);
              return (
                <Card key={summary.procedureId} className="flex flex-col gap-sp-1">
                  <div className="flex flex-wrap items-center justify-between gap-sp-2">
                    <p className="text-title font-semi">{label.procedure(summary.procedureId)}</p>
                    <Link
                      href={findHref(summary.procedureId)}
                      className={cn(smallChip, "border-danger bg-elev text-danger hover:bg-sunken", focusRing)}
                    >
                      <FiSearch aria-hidden />
                      {t("plan.findClinic")}
                    </Link>
                  </div>
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
              monthGroups(pageRecords).map((group) => (
                <div key={group.month} className="flex flex-col gap-sp-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-sp-2 border-b border-border pb-sp-1">
                    <h3 className="text-body font-semi tabular-nums">{formatMonth(group.month, locale)}</h3>
                    <p className="text-label text-muted tabular-nums">
                      {monthText(group.month)}
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
                          {record.note ? <li className="whitespace-pre-line text-text">{record.note}</li> : null}
                          <Provenance record={record} />
                          <li>{record.sharedToPlatform ? t("history.shared") : t("history.notShared")}</li>
                        </ul>
                      ),
                    }))}
                  />
                </div>
              ))
            )}

            {pageCount > 1 ? (
              <nav aria-label={t("history.pages")} className="flex flex-wrap items-center justify-center gap-sp-1">
                <Button
                  variant="ghost"
                  aria-label={t("history.prevPage")}
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {"<"}
                </Button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <Button
                    key={i}
                    variant={i === currentPage ? "secondary" : "ghost"}
                    aria-current={i === currentPage ? "page" : undefined}
                    className="tabular-nums"
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  aria-label={t("history.nextPage")}
                  disabled={currentPage === pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {">"}
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

/** Where a record came from: clinic confirmed and anchored on chain, clinic confirmed, or typed in by the customer. */
function Provenance({ record }: { record: TreatmentRecord }) {
  const t = useTranslations("records.history");
  if (record.source === "booking" && record.anchor) {
    const tx = shortHex(record.anchor.tx);
    return (
      <li>
        {t("anchored", { version: record.anchor.version })} ·{" "}
        <a
          href={txUrl(record.anchor.tx)}
          target="_blank"
          rel="noreferrer"
          aria-label={`tx ${tx}, ${t("txLabel")}`}
          className={cn("tabular-nums underline hover:text-text", focusRing)}
        >
          tx {tx}
        </a>
      </li>
    );
  }
  return <li>{record.source === "booking" ? t("clinicConfirmed") : t("selfReported")}</li>;
}
