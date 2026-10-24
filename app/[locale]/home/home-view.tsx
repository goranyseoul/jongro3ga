"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles, Card, CardHeader, Chip, Input, Button, Stat } from "@/components/ui";
import { ApiStatus } from "@/components/customer/api-state";
import { formatRange, formatSlot } from "@/components/customer/format";
import { useHome, useLabels } from "@/components/customer/use-customer";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { LOCALE_NAME } from "../locales";

// Quick picks only fill the input: no procedure is recommended (08-compliance.md section 6).
const QUICK_PROCEDURES = ["rejuran_healer", "botox_forehead", "thermage_flx", "ulthera"] as const;

const IN_PROGRESS = new Set(["matching", "quoting", "judging", "comparing", "booking"]);

export function HomeView() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const requestsT = useTranslations("requests");
  const router = useRouter();
  const label = useLabels();
  const { data, error, loading, reload, locale, name } = useHome();
  const [intent, setIntent] = useState("");

  if (!data) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("metaTitle")}</h1>
        <ApiStatus error={error} loading={loading} onRetry={reload} />
      </>
    );
  }

  const { me, requests, bookings, due, inbox } = data;
  const profile = me.profile;
  const matchable = me.canMatch;
  const active = requests.filter((r) => IN_PROGRESS.has(r.status));
  const upcomingBookings = bookings.filter((b) => b.status !== "completed");

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const text = intent.trim();
    router.push(text ? `/chat?intent=${encodeURIComponent(text)}` : "/chat");
  };

  return (
    <>
      <h1 className="text-h2 font-semi">{t("greeting", { name })}</h1>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader title={t("agent.title")} description={`PibooK Customer Agent ${profile.agentId}`} as="h2" />
        <div className="grid grid-cols-2 gap-sp-4 sm:grid-cols-3">
          <Stat label={t("agent.status")} value={<span className="text-body font-semi text-success">{t("agent.active")}</span>} />
          <Stat
            label={t("agent.languages")}
            value={<span className="text-body font-semi">{profile.prefs.languagesNeeded.map((l) => LOCALE_NAME[l]).join(" · ")}</span>}
          />
          <Stat
            label={t("agent.stay")}
            value={
              <span className="text-body font-semi tabular-nums">
                {profile.trip ? formatRange(profile.trip.arrival, profile.trip.departure) : "·"}
              </span>
            }
          />
        </div>
        <Link href="/settings/data" className={cn("inline-flex min-h-touch items-center self-start text-label text-muted hover:text-text", focusRing)}>
          {t("agent.cardLink")}
        </Link>
      </Card>

      {matchable ? (
        <Card className="flex flex-col gap-sp-4">
          <form onSubmit={ask} className="flex flex-col gap-sp-3">
            <Input
              label={t("ask.label")}
              placeholder={t("ask.placeholder")}
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              autoComplete="off"
            />
            <Button type="submit">{t("ask.submit")}</Button>
          </form>
          <div className="flex flex-col gap-sp-2">
            <p className="text-label text-muted">{t("ask.quick")}</p>
            <div className="flex flex-wrap gap-sp-2">
              {QUICK_PROCEDURES.map((id) => (
                <Chip key={id} onClick={() => setIntent(label.procedure(id))}>
                  {label.procedure(id)}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-sp-3">
          <CardHeader title={t("locked.title")} as="h2" />
          <p className="text-body text-muted">{t("locked.body")}</p>
        </Card>
      )}

      {inbox.due.some((item) => item.status === "open") ? (
        <section aria-labelledby="home-inbox" className="flex flex-col gap-sp-3">
          <h2 id="home-inbox" className="text-title font-semi">
            {t("inbox.title")}
          </h2>
          <ul className="flex flex-col gap-sp-3">
            {inbox.due
              .filter((item) => item.status === "open")
              .map((item) => (
                <li key={item.id}>
                  <Card className="flex flex-col gap-sp-2">
                    <p className="text-body">{item.text[locale] ?? item.text.en ?? Object.values(item.text)[0]}</p>
                    <p className="text-caption text-subtle tabular-nums">{formatSlot(item.dueAt, locale)}</p>
                    {(item.kind === "checkin_due" || item.kind === "checkin_request") && item.bookingId ? (
                      <Link
                        href={`/outcomes/${item.bookingId}?checkin=${item.id}&checkpoint=${item.checkpoint ?? "D7"}`}
                        className={cn(buttonStyles({ variant: "secondary" }), "self-start")}
                      >
                        {t("inbox.answer")}
                      </Link>
                    ) : null}
                  </Card>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {matchable && active.length > 0 ? (
        <section aria-labelledby="home-requests" className="flex flex-col gap-sp-3">
          <h2 id="home-requests" className="text-title font-semi">
            {t("requests.title")}
          </h2>
          <ul className="flex flex-col gap-sp-3">
            {active.map((request) => (
              <li key={request.id}>
                <Card className="flex flex-col gap-sp-3">
                  <div className="flex flex-col gap-sp-1">
                    <p className="text-title font-semi">
                      {label.procedure(request.request.procedureId)} · {label.amount(request.request.amount)}
                    </p>
                    <p className="text-label text-muted tabular-nums">
                      {formatRange(request.request.dateWindow.from, request.request.dateWindow.to)}
                    </p>
                    <p className="text-label text-muted">
                      {request.quoteCount > 0 ? t("requests.count", { count: request.quoteCount }) : requestsT(`status.${request.status}`)}
                    </p>
                  </div>
                  <Link href={`/requests/${request.id}`} className={buttonStyles({ variant: "secondary" })}>
                    {t("requests.open")}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcomingBookings.length > 0 ? (
        <section aria-labelledby="home-booking" className="flex flex-col gap-sp-3">
          <h2 id="home-booking" className="text-title font-semi">
            {t("booking.title")}
          </h2>
          <ul className="flex flex-col gap-sp-3">
            {upcomingBookings.map((booking) => (
              <li key={booking.id}>
                <Card className="flex flex-col gap-sp-3">
                  <div className="flex flex-col gap-sp-1">
                    <p className="text-title font-semi">{label.clinic(booking.clinicId)}</p>
                    <p className="text-label text-muted tabular-nums">{formatSlot(booking.slot, locale)}</p>
                    <p className="text-label font-med">{common(`bookingStatus.${booking.status}`)}</p>
                  </div>
                  <Link href={`/bookings/${booking.id}`} className={buttonStyles({ variant: "secondary" })}>
                    {t("booking.open")}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="home-next" className="flex flex-col gap-sp-3">
        <h2 id="home-next" className="text-title font-semi">
          {t("next.title")}
        </h2>
        {due.length > 0 ? (
          <ul className="flex flex-col gap-sp-3">
            {due.map((record) => {
              const overdue = (record.nextDue as string) < me.today;
              return (
                <li key={record.id}>
                  <Card className="flex flex-col gap-sp-1">
                    <p className="text-title font-semi">{label.procedure(record.procedureId)}</p>
                    <p className="text-body tabular-nums">{common("session", { n: record.sessionNumber + 1, date: record.nextDue as string })}</p>
                    {overdue ? <p className="text-label font-med text-warning">{t("next.overdue")}</p> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body text-muted">{t("next.empty")}</p>
        )}
        <div className="flex flex-wrap gap-sp-2">
          <Link href="/records" className={buttonStyles({ variant: "secondary" })}>
            {t("next.all")}
          </Link>
          <Link href="/records/new" className={buttonStyles({ variant: matchable ? "ghost" : "primary" })}>
            {t("next.add")}
          </Link>
        </div>
      </section>
    </>
  );
}
