"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardHeader, Input, Money, Timeline, buttonStyles } from "@/components/ui";
import { api, useApi } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import { formatSlot } from "@/components/customer/format";
import { useLabels, useMe } from "@/components/customer/use-customer";
import type { BookingView as BookingViewData } from "@/lib/agents/customer/bff";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { referenceFor } from "@/lib/ui-data/customer";

/** The booking screen polls every 2s while the clinic has not answered; each poll is one GetTask. */
const OPEN = new Set(["requested", "pending_clinic"]);

export function BookingView({ id }: { id: string }) {
  const t = useTranslations("bookings");
  const common = useTranslations("common");
  const requests = useTranslations("requests");
  const label = useLabels();
  const { data: me, locale } = useMe();
  const { data: view, error, loading, reload } = useApi<BookingViewData>(`/api/customer/bookings/${id}`, {
    pollMs: 2000,
    keepPolling: (v) => OPEN.has(v.booking.status) && !v.booking.inputRequest,
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [simulating, setSimulating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!view) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }

  const { booking, clinic, quote } = view;
  const status = booking.status;
  const confirmed = status === "confirmed" || status === "completed";
  const operationMode = view.operationMode ?? "clinic";
  const instructions = booking.booking?.instructions;
  const confirmedBy = booking.booking?.confirmedBy;

  const note =
    status === "requested" || status === "pending_clinic"
      ? t(operationMode === "clinic" ? "statusNote.pending_clinic_clinic" : "statusNote.pending_clinic_proxy")
      : status === "canceled"
        ? t("statusNote.canceled")
        : t(`statusNote.${status === "completed" ? "completed" : "confirmed"}`);

  const mapUrl = clinic.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}` : undefined;

  // Demo only: asks the demo control (OPS track) to confirm as the clinic or operator would.
  const simulate = async () => {
    setSimulating(true);
    setNotice(null);
    try {
      await api("/api/demo/confirm-booking", {
        method: "POST",
        json: { clinicId: booking.clinicId, taskId: booking.clinicTaskId, bookingId: booking.booking?.bookingId },
      });
    } catch {
      setNotice(t("actions.simulateUnavailable"));
    } finally {
      setSimulating(false);
      await reload();
    }
  };

  const answer = async () => {
    try {
      await api(`/api/customer/bookings/${id}/input`, { method: "POST", json: { values } });
      await reload();
    } catch {
      setNotice(t("input.error"));
    }
  };

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      <Card className="flex flex-col gap-sp-2">
        <p className="text-title font-semi" aria-live="polite">
          {common(`bookingStatus.${status}`)}
        </p>
        <p className="text-body text-muted">{note}</p>
        {view.downtimeWarning ? (
          <p className="text-label text-muted">
            <span className="font-semi text-warning">{requests("warn.label")}</span> {t("downtime")}
          </p>
        ) : null}
      </Card>

      {booking.inputRequest ? (
        <Card className="flex flex-col gap-sp-3">
          <CardHeader title={t("input.title")} description={t("input.body")} as="h2" />
          {booking.inputRequest.fields.map((field) => (
            <Input
              key={field.key}
              label={field.label[locale] ?? field.label.en ?? field.key}
              value={values[field.key] ?? ""}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              autoComplete="off"
            />
          ))}
          <Button className="self-start" onClick={() => void answer()} disabled={booking.inputRequest.fields.some((f) => !values[f.key]?.trim())}>
            {t("input.submit")}
          </Button>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title={t("info.title")} description={`${t("info.id")} ${booking.booking?.bookingId ?? booking.id}`} as="h2" />
        <dl className="flex flex-col gap-sp-3">
          <Row term={t("info.clinic")}>{label.clinic(clinic.id, clinic.name)}</Row>
          <Row term={t("info.when")}>
            <span className="tabular-nums">{formatSlot(booking.slot, locale)}</span>
          </Row>
          {clinic.address ? (
            <Row term={t("info.address")}>
              <span className="cu-wrap">{clinic.address}</span>
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("mt-sp-1 flex min-h-touch items-center justify-end text-label text-muted hover:text-text", focusRing)}
                >
                  {t("info.map")}
                </a>
              ) : null}
            </Row>
          ) : null}
          <Row term={t("info.procedure")}>
            {label.procedure(booking.procedureId)}
            {quote ? ` · ${label.amount(quote.amount)}` : ""}
          </Row>
          <Row term={t("info.price")}>
            <Money krw={booking.priceKrw} reference={referenceFor(booking.priceKrw, locale)} locale={locale} />
          </Row>
          {confirmedBy ? <Row term={t("info.confirmedBy")}>{t(`info.by.${confirmedBy}`)}</Row> : null}
        </dl>
        <p className="text-caption text-subtle">{t("info.priceNote")}</p>
      </Card>

      <section aria-labelledby="booking-steps" className="flex flex-col gap-sp-3">
        <h2 id="booking-steps" className="text-title font-semi">
          {t("steps.title")}
        </h2>
        <Timeline
          rawLabel={requests("progress.raw")}
          items={[
            { id: "requested", title: t("steps.requested"), at: formatSlot(booking.createdAt, locale) },
            ...(confirmed || status === "canceled" ? [] : [{ id: "pending", title: t("steps.pending") }]),
            ...(confirmed ? [{ id: "confirmed", title: t("steps.confirmed") }] : []),
            ...(status === "canceled" ? [{ id: "canceled", title: common("bookingStatus.canceled") }] : []),
            ...view.timeline.map((item) => ({
              id: item.id,
              at: item.at.slice(11, 19),
              title: item.summary[locale] ?? item.summary.en ?? "",
              raw: item.raw,
            })),
          ]}
        />
      </section>

      <Card className="flex flex-col gap-sp-2">
        <CardHeader title={t("notes.title")} as="h2" />
        <p className="text-body text-muted">{confirmed && instructions ? (instructions[locale] ?? instructions.en) : t("notes.empty")}</p>
      </Card>

      <Card className="flex flex-col gap-sp-3">
        <CardHeader title={t("explain.title")} as="h2" />
        <ul className="flex flex-col gap-sp-2 text-body text-muted">
          {(["diagnosis", "contract", "cost", "dispute"] as const).map((key) => (
            <li key={key}>{t(`explain.${key}`)}</li>
          ))}
        </ul>
        <p className="text-caption text-subtle">{t("explain.doctor")}</p>
      </Card>

      <section className="flex flex-col gap-sp-3">
        {OPEN.has(status) && me?.demo ? (
          <div className="flex flex-col gap-sp-1">
            <Button variant="secondary" onClick={() => void simulate()} disabled={simulating}>
              {t("actions.simulate")}
            </Button>
            <p className="text-caption text-subtle">{t("actions.simulateNote")}</p>
          </div>
        ) : null}
        {notice ? <p className="text-label text-muted">{notice}</p> : null}
        {status === "confirmed" ? (
          <div className="flex flex-col gap-sp-1">
            <Link href={`/outcomes/${booking.id}`} className={buttonStyles({ size: "lg" })}>
              {t("actions.record")}
            </Link>
            <p className="text-caption text-subtle">{t("actions.recordNote")}</p>
          </div>
        ) : null}
        {status === "completed" ? (
          <Link href="/records" className={buttonStyles({ size: "lg" })}>
            {t("actions.viewRecords")}
          </Link>
        ) : null}
        <Link href={`/requests/${booking.requestId}`} className={buttonStyles({ variant: "ghost" })}>
          {t("actions.requests")}
        </Link>
      </section>
    </>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-sp-3">
      <dt className="shrink-0 text-label text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-end text-body">{children}</dd>
    </div>
  );
}
