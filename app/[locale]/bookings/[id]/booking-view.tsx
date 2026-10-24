"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardHeader, Money, Timeline, buttonStyles } from "@/components/ui";
import { formatSlot } from "@/components/customer/format";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  DEFAULT_BOOKING_CHOICE,
  QUOTES,
  REQUEST_ID,
  buildBooking,
  downtimeOverlapsDeparture,
  getClinic,
  getProcedure,
  referenceFor,
  YUKI_REQUEST,
} from "@/lib/ui-data/customer";

export function BookingView() {
  const t = useTranslations("bookings");
  const common = useTranslations("common");
  const requests = useTranslations("requests");
  const label = useLabels();
  const { locale, demo } = useCustomer();

  // Opened directly (no booking made in this browser), the demo shows its reference booking
  const choice = demo.booking ?? { ...DEFAULT_BOOKING_CHOICE, status: "pending_clinic" as const };
  const status = demo.outcome ? "completed" : choice.status;
  const booking = buildBooking({ quoteId: choice.quoteId, slot: choice.slot, status });
  const quote = QUOTES.find((q) => q.quoteId === booking.quoteId) ?? QUOTES[0]!;
  const clinic = getClinic(booking.clinicId);
  const procedure = getProcedure(quote.procedureId);
  const confirmed = status === "confirmed" || status === "completed";
  const downtimeWarning = procedure ? downtimeOverlapsDeparture(procedure, booking.slot, YUKI_REQUEST.request.dateWindow.to) : false;

  const note =
    status === "pending_clinic"
      ? t(quote.operationMode === "clinic" ? "statusNote.pending_clinic_clinic" : "statusNote.pending_clinic_proxy")
      : t(`statusNote.${status === "completed" ? "completed" : "confirmed"}`);

  const mapUrl = clinic ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}` : undefined;

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>

      <Card className="flex flex-col gap-sp-2">
        <p className="text-title font-semi">{common(`bookingStatus.${status}`)}</p>
        <p className="text-body text-muted">{note}</p>
        {downtimeWarning ? (
          <p className="text-label text-muted">
            <span className="font-semi text-warning">{requests("warn.label")}</span> {t("downtime")}
          </p>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title={t("info.title")} description={`${t("info.id")} ${booking.bookingId}`} as="h2" />
        <dl className="flex flex-col gap-sp-3">
          <Row term={t("info.clinic")}>{label.clinic(booking.clinicId)}</Row>
          <Row term={t("info.when")}>
            <span className="tabular-nums">{formatSlot(booking.slot, locale)}</span>
          </Row>
          {clinic ? (
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
            {label.procedure(quote.procedureId)} · {label.amount(quote.amount)}
          </Row>
          <Row term={t("info.price")}>
            <Money krw={booking.priceKrw} reference={referenceFor(booking.priceKrw, locale)} locale={locale} />
          </Row>
          {booking.confirmedBy ? <Row term={t("info.confirmedBy")}>{t(`info.by.${booking.confirmedBy}`)}</Row> : null}
        </dl>
        <p className="text-caption text-subtle">{t("info.priceNote")}</p>
      </Card>

      <section aria-labelledby="booking-steps" className="flex flex-col gap-sp-3">
        <h2 id="booking-steps" className="text-title font-semi">
          {t("steps.title")}
        </h2>
        <Timeline
          rawLabel=""
          items={[
            { id: "requested", title: t("steps.requested") },
            ...(confirmed ? [] : [{ id: "pending", title: t("steps.pending") }]),
            ...(confirmed ? [{ id: "confirmed", title: t("steps.confirmed") }] : []),
          ]}
        />
      </section>

      <Card className="flex flex-col gap-sp-2">
        <CardHeader title={t("notes.title")} as="h2" />
        <p className="text-body text-muted">{confirmed ? (booking.instructions[locale] ?? booking.instructions.en) : t("notes.empty")}</p>
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
        {status === "pending_clinic" ? (
          <div className="flex flex-col gap-sp-1">
            <Button
              variant="secondary"
              onClick={() =>
                updateDemoState((state) => ({
                  ...state,
                  booking: { ...choice, status: "confirmed" },
                }))
              }
            >
              {t("actions.simulate")}
            </Button>
            <p className="text-caption text-subtle">{t("actions.simulateNote")}</p>
          </div>
        ) : null}
        {status === "confirmed" ? (
          <div className="flex flex-col gap-sp-1">
            <Link href={`/outcomes/${booking.bookingId}`} className={buttonStyles({ size: "lg" })}>
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
        <Link href={`/requests/${REQUEST_ID}`} className={buttonStyles({ variant: "ghost" })}>
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
