"use client";

import { useTranslations } from "next-intl";
import { buttonStyles, Card, ChipGroup, Timeline } from "@/components/ui";
import { moneyText } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { RecordsCalendar } from "./records-calendar";
import {
  DEMO_TODAY,
  shortHex,
  txUrl,
  upcomingSessionNumber,
  type RecordStatus,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";

const STATUSES: RecordStatus[] = ["active", "paused", "stopped"];

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

  const latest = latestPerProcedure(records);
  const history = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber);

  const setStatus = (record: TreatmentRecord, status: RecordStatus) =>
    updateDemoState((state) => ({ ...state, recordStatus: { ...state.recordStatus, [record.id]: status } }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-sp-3">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Link href="/records/new" className={buttonStyles()}>
          {t("add")}
        </Link>
      </div>

      <section aria-labelledby="rec-next" className="flex flex-col gap-sp-3">
        <h2 id="rec-next" className="text-title font-semi">
          {t("next.title")}
        </h2>
        {latest.length === 0 ? (
          <p className="text-body text-muted">{t("next.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-sp-3 md:grid-cols-2">
            {latest.map((record) => {
              const overdue = record.status === "active" && record.nextDue !== undefined && record.nextDue < DEMO_TODAY;
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
                      {overdue ? <p className="text-label font-med text-warning">{t("next.overdue")}</p> : null}
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

      <RecordsCalendar records={records} latest={latest} locale={locale} />

      <section aria-labelledby="rec-history" className="flex flex-col gap-sp-3">
        <h2 id="rec-history" className="text-title font-semi">
          {t("history.title")}
        </h2>
        {history.length === 0 ? (
          <p className="text-body text-muted">{t("history.empty")}</p>
        ) : (
          <Timeline
            rawLabel=""
            items={history.map((record) => ({
              id: record.id,
              at: record.date,
              title: (
                <span className="font-med">
                  {label.procedure(record.procedureId)}
                  {record.amount ? ` · ${label.amount(record.amount)}` : ""} · {t("history.session", { n: record.sessionNumber })}
                </span>
              ),
              detail: (
                <ul className="flex flex-col gap-sp-1">
                  {record.clinicId || record.clinicName ? <li>{record.clinicId ? label.clinic(record.clinicId) : record.clinicName}</li> : null}
                  {record.priceKrw ? <li className="tabular-nums">{moneyText(record.priceKrw, locale)}</li> : null}
                  {record.rating ? <li>{t("history.rating", { n: record.rating })}</li> : null}
                  <Provenance record={record} />
                  <li>{record.sharedToPlatform ? t("history.shared") : t("history.notShared")}</li>
                </ul>
              ),
            }))}
          />
        )}
      </section>
    </>
  );
}

/**
 * Where a record comes from, as plain text: a clinic-confirmed record (with its chain version once anchored)
 * can back an offer proof, a self-reported one cannot.
 */
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
