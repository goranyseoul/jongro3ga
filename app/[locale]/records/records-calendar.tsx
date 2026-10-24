"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import { useLabels } from "@/components/customer/use-customer";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import type { TreatmentRecord } from "@/lib/domain/customer";

const upcomingSessionNumber = (record: TreatmentRecord) => record.sessionNumber + 1;

type CalendarEvent = { id: string; kind: "done" | "planned"; record: TreatmentRecord; session: number };

/** Month grid cells (Sunday first) for a "YYYY-MM" month; null pads the first week. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Past sessions from every record, plus the next due date of each procedure still active. */
function calendarEvents(records: TreatmentRecord[], latest: TreatmentRecord[]): Map<string, CalendarEvent[]> {
  const byDate = new Map<string, CalendarEvent[]>();
  const add = (date: string, event: CalendarEvent) => byDate.set(date, [...(byDate.get(date) ?? []), event]);
  for (const record of records) add(record.date, { id: `${record.id}-done`, kind: "done", record, session: record.sessionNumber });
  for (const record of latest) {
    if (record.status === "active" && record.nextDue) {
      add(record.nextDue, { id: `${record.id}-planned`, kind: "planned", record, session: upcomingSessionNumber(record) });
    }
  }
  return byDate;
}

export function RecordsCalendar({
  records,
  latest,
  locale,
  today,
}: {
  records: TreatmentRecord[];
  latest: TreatmentRecord[];
  locale: string;
  /** Today on the demo clock, from the BFF. */
  today: string;
}) {
  const t = useTranslations("records.calendar");
  const label = useLabels();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const events = calendarEvents(records, latest);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const monthTitle = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  // 2026-11-01 is a Sunday, so the next seven days give the weekday names in order.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + i))),
  );
  const selectedEvents = events.get(selected) ?? [];

  return (
    <section aria-labelledby="rec-calendar" className="flex flex-col gap-sp-3">
      <h2 id="rec-calendar" className="text-title font-semi">
        {t("title")}
      </h2>
      <Card className="flex flex-col gap-sp-3">
        <div className="flex items-center justify-between gap-sp-2">
          <Button variant="ghost" aria-label={t("prev")} onClick={() => setMonth(shiftMonth(month, -1))}>
            {"<"}
          </Button>
          <p className="text-title font-semi tabular-nums" aria-live="polite">
            {monthTitle}
          </p>
          <Button variant="ghost" aria-label={t("next")} onClick={() => setMonth(shiftMonth(month, 1))}>
            {">"}
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-sp-1 text-center">
          {weekdays.map((day) => (
            <p key={day} className="text-label text-subtle">
              {day}
            </p>
          ))}
          {monthCells(month).map((date, i) => {
            if (!date) return <span key={`pad-${i}`} />;
            const dayEvents = events.get(date) ?? [];
            const isSelected = date === selected;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={isSelected}
                aria-label={dayEvents.length > 0 ? `${date} · ${t("hasEvents", { n: dayEvents.length })}` : date}
                onClick={() => setSelected(date)}
                className={cn(
                  "flex min-h-touch flex-col items-center justify-center gap-sp-1 rounded-md text-body tabular-nums transition duration-press ease-out",
                  isSelected ? "bg-brand text-on-brand" : "hover:bg-sunken",
                  isToday && !isSelected && "border border-brand",
                  focusRing,
                )}
              >
                {Number(date.slice(8))}
                <span className="flex h-sp-1 gap-sp-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn(
                        "size-sp-1 rounded-pill",
                        event.kind === "planned"
                          ? date < today
                            ? "bg-warning"
                            : "bg-success"
                          : isSelected
                            ? "bg-on-brand"
                            : "bg-muted",
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-sp-4 text-label text-muted">
          <span className="flex items-center gap-sp-2">
            <span className="size-sp-2 rounded-pill bg-muted" />
            {t("done")}
          </span>
          <span className="flex items-center gap-sp-2">
            <span className="size-sp-2 rounded-pill bg-success" />
            {t("planned")}
          </span>
          <span className="flex items-center gap-sp-2">
            <span className="size-sp-2 rounded-pill bg-warning" />
            {t("overdue")}
          </span>
        </div>

        <div className="flex flex-col gap-sp-2 border-t border-border pt-sp-3">
          <p className="text-label text-muted tabular-nums">{selected}</p>
          {selectedEvents.length === 0 ? (
            <p className="text-body text-muted">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-sp-1">
              {selectedEvents.map((event) => (
                <li key={event.id} className="text-body">
                  <span className="font-med">{label.procedure(event.record.procedureId)}</span>
                  {" · "}
                  {t(event.kind === "planned" ? "plannedSession" : "doneSession", { n: event.session })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
