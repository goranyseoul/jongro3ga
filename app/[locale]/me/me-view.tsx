"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles, Card, CardHeader, Money, Stat, Timeline } from "@/components/ui";
import { formatDay, formatMonth, formatRange, formatSlot, moneyText } from "@/components/customer/format";
import { useSession } from "@/components/customer/session";
import { TaskSteps, type TaskStepStatus } from "@/components/customer/task-steps";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  BOOKING_ID,
  QUOTES,
  REQUEST_ID,
  YUKI_REQUEST,
  canMatch,
  consentsFor,
  referenceFor,
  upcomingDue,
  upcomingSessionNumber,
  daysBetween,
  DEMO_TODAY,
  type TreatmentRecord,
} from "@/lib/ui-data/customer";
import { LOCALE_NAME, wordBreak } from "../locales";
import { SignedOutCard } from "./signed-out-card";
import { activePlans, journeyStatus, journeySteps, nextDue, recentRecords, totalSpentKrw, type JourneyStatus } from "./summary";

const STATUS_TONE: Record<JourneyStatus, string> = {
  none: "text-muted",
  comparing: "text-text",
  requested: "text-text",
  pending_clinic: "text-text",
  confirmed: "text-success",
  completed: "text-success",
  canceled: "text-danger",
  no_show: "text-danger",
};

export function MeView() {
  const { session } = useSession();
  if (!session) return <SignedOutCard next="/me" />;
  return <Dashboard />;
}

function Dashboard() {
  const t = useTranslations("me");
  const common = useTranslations("common");
  const label = useLabels();
  const { locale, profile, demo, records, name } = useCustomer();

  const matchable = canMatch(profile);
  const agentActive = Boolean(profile.completedAt) && !demo.deleted;
  const due = nextDue(records);
  const upcoming = upcomingDue(records).slice(0, 4);
  const spent = totalSpentKrw(records);
  const recent = recentRecords(records);
  const status = journeyStatus(demo);
  const plans = activePlans(records);

  const consents = consentsFor(profile).map((c) => ({ ...c, granted: demo.consents[c.type] ?? c.granted }));
  const grantedCount = consents.filter((c) => c.granted).length;

  const dday = (days: number) =>
    days > 0 ? t("kpi.dueIn", { days }) : days === 0 ? t("kpi.dueToday") : t("kpi.overdue", { days: -days });

  const statusText = (s: JourneyStatus) =>
    s === "none" || s === "comparing" ? t(`status.${s}`) : common(`bookingStatus.${s}`);

  const recordDate = (r: TreatmentRecord) =>
    r.datePrecision === "month" ? formatMonth(r.date.slice(0, 7), locale) : formatDay(r.date, locale);

  return (
    <div className={cn("flex flex-col gap-sp-6", wordBreak(locale))}>
      {/* Page header: greeting, agent status, one primary action */}
      <header className="flex flex-col gap-sp-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-sp-1">
          <h1 className="text-h2 font-semi">{t("header.greeting", { name })}</h1>
          <p className="text-label text-muted">
            <span className={cn("font-med", agentActive ? "text-success" : "text-muted")}>
              {agentActive ? t("header.agentActive") : t("header.agentInactive")}
            </span>{" "}
            · <span className="tabular-nums">{t("header.agentId", { id: profile.agentId })}</span>
          </p>
        </div>
        <Link
          href={matchable ? "/chat" : "/records/new"}
          className={cn(buttonStyles({ variant: "primary" }), "shrink-0 self-start sm:self-auto")}
        >
          {matchable ? t("header.startRequest") : t("header.addRecord")}
        </Link>
      </header>

      {/* KPI row: 1 column on phones, 2 on tablets, 4 on desktop */}
      <section aria-label={t("kpi.label")} className="grid grid-cols-1 gap-sp-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label={t("kpi.treatments")}
            value={records.length > 0 ? records.length : undefined}
            caption={records.length > 0 ? t("kpi.treatmentsCaption", { count: plans }) : t("kpi.treatmentsEmpty")}
          />
        </Card>
        <Card>
          <Stat
            label={t("kpi.nextDue")}
            value={due ? dday(due.days) : undefined}
            caption={
              due ? (
                <span className={cn("tabular-nums", due.days < 0 && "text-warning")}>
                  {label.procedure(due.record.procedureId)} · {formatDay(due.date, locale)}
                </span>
              ) : (
                t("kpi.nextDueEmpty")
              )
            }
          />
        </Card>
        <Card>
          {matchable ? (
            <Stat
              label={t("kpi.status")}
              value={status === "none" ? undefined : <span className={cn("text-title", STATUS_TONE[status])}>{statusText(status)}</span>}
              caption={status === "none" ? t("status.none") : label.procedure(YUKI_REQUEST.request.procedureId)}
            />
          ) : (
            <Stat
              label={t("kpi.plans")}
              value={plans > 0 ? plans : undefined}
              caption={plans > 0 ? t("kpi.plansCaption") : t("kpi.plansEmpty")}
            />
          )}
        </Card>
        <Card>
          <Stat
            label={t("kpi.spent")}
            value={
              spent !== undefined ? (
                <Money krw={spent} reference={referenceFor(spent, locale)} locale={locale} className="flex flex-col" />
              ) : undefined
            }
            caption={spent !== undefined ? t("kpi.spentCaption", { count: records.filter((r) => r.priceKrw).length }) : t("kpi.spentEmpty")}
          />
        </Card>
      </section>

      {/* Row: upcoming sessions and the request / booking progress */}
      <div className="grid grid-cols-1 gap-sp-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col gap-sp-4">
          <CardHeader title={t("upcoming.title")} description={t("upcoming.description")} as="h2" />
          {upcoming.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border-soft">
              {upcoming.map((record) => {
                const days = daysBetween(DEMO_TODAY, record.nextDue as string);
                return (
                  <li key={record.id} className="flex items-baseline justify-between gap-sp-3 py-sp-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-col gap-sp-1">
                      <span className="text-body font-med">{label.procedure(record.procedureId)}</span>
                      <span className="text-label text-muted tabular-nums">
                        {t("upcoming.session", { n: upcomingSessionNumber(record) })} · {formatDay(record.nextDue as string, locale)}
                      </span>
                    </div>
                    <span className={cn("shrink-0 text-label font-med tabular-nums", days < 0 ? "text-warning" : "text-text")}>
                      {dday(days)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body text-muted">{t("upcoming.empty")}</p>
          )}
          <PanelLink href="/records">{t("upcoming.all")}</PanelLink>
        </Card>

        <JourneyPanel matchable={matchable} />
      </div>

      {/* Row: recent records, then agent and consent summaries */}
      <div className="grid grid-cols-1 gap-sp-4 lg:grid-cols-3">
        <Card className="flex h-full flex-col gap-sp-4 lg:col-span-2 lg:row-span-2">
          <CardHeader title={t("recent.title")} description={t("recent.description")} as="h2" />
          {recent.length > 0 ? (
            <Timeline
              rawLabel=""
              items={recent.map((record) => ({
                id: record.id,
                at: recordDate(record),
                title: (
                  <span className="font-med">
                    {label.procedure(record.procedureId)}
                    {record.amount ? ` · ${label.amount(record.amount)}` : ""} · {t("recent.session", { n: record.sessionNumber })}
                  </span>
                ),
                detail: [
                  record.clinicId ? label.clinic(record.clinicId) : record.clinicName,
                  record.priceKrw ? moneyText(record.priceKrw, locale) : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined,
              }))}
            />
          ) : (
            <p className="text-body text-muted">{t("recent.empty")}</p>
          )}
          <div className="mt-auto flex flex-wrap gap-sp-2">
            <Link href="/records" className={buttonStyles({ variant: "secondary" })}>
              {t("recent.all")}
            </Link>
            <Link href="/records/new" className={buttonStyles({ variant: "ghost" })}>
              {t("recent.add")}
            </Link>
          </div>
        </Card>

        <Card className="flex h-full flex-col gap-sp-4">
          <CardHeader title={t("agent.title")} description={`PibooK Customer Agent ${profile.agentId}`} as="h2" />
          <dl className="grid grid-cols-1 gap-sp-3 sm:grid-cols-2 lg:grid-cols-1">
            <Fact term={t("agent.status")}>
              <span className={cn("font-med", agentActive ? "text-success" : "text-muted")}>
                {agentActive ? t("header.agentActive") : t("header.agentInactive")}
              </span>
            </Fact>
            <Fact term={t("agent.languages")}>{profile.prefs.languagesNeeded.map((l) => LOCALE_NAME[l]).join(" · ") || "·"}</Fact>
            {matchable ? (
              <Fact term={t("agent.stay")}>
                <span className="tabular-nums">
                  {profile.trip ? formatRange(profile.trip.arrival, profile.trip.departure) : "·"}
                  {profile.trip?.stayArea ? ` · ${label.area(profile.trip.stayArea)}` : ""}
                </span>
              </Fact>
            ) : null}
            <Fact term={t("agent.contact")}>
              {t(`channel.${profile.contact.channel}`)} · <span className="break-all">{profile.contact.handle}</span>
            </Fact>
          </dl>
          <div className="mt-auto flex flex-wrap gap-sp-2">
            <Link href="/me/profile" className={buttonStyles({ variant: "secondary" })}>
              {t("agent.edit")}
            </Link>
            <Link href="/settings/data" className={buttonStyles({ variant: "ghost" })}>
              {t("agent.card")}
            </Link>
          </div>
        </Card>

        <Card className="flex h-full flex-col gap-sp-4">
          <CardHeader
            title={t("consents.title")}
            description={<span className="tabular-nums">{t("consents.description", { granted: grantedCount, total: consents.length })}</span>}
            as="h2"
          />
          <ul className="flex flex-col gap-sp-2">
            {consents.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-sp-3 text-label">
                <span className="min-w-0 text-text">{t(`consents.types.${c.type}`)}</span>
                <span className={cn("shrink-0 font-med", c.granted ? "text-success" : "text-muted")}>
                  {c.granted ? t("consents.on") : t("consents.off")}
                </span>
              </li>
            ))}
          </ul>
          <PanelLink href="/settings/data">{t("consents.manage")}</PanelLink>
        </Card>
      </div>

      {/* Quick links */}
      <nav aria-labelledby="me-links" className="flex flex-col gap-sp-3">
        <h2 id="me-links" className="text-title font-semi">
          {t("links.title")}
        </h2>
        <ul className="grid grid-cols-1 gap-sp-2 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["/records", t("links.records")],
              ["/records/new", t("links.newRecord")],
              ["/chat", t("links.chat")],
              ["/settings/data", t("links.data")],
              ["/me/profile", t("links.profile")],
            ] as const
          ).map(([href, text]) => (
            <li key={href}>
              <Link href={href} className={buttonStyles({ variant: "secondary", fullWidth: true })}>
                {text}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function JourneyPanel({ matchable }: { matchable: boolean }) {
  const t = useTranslations("me.journey");
  const label = useLabels();
  const { locale, demo } = useCustomer();

  if (!matchable) {
    return (
      <Card className="flex h-full flex-col gap-sp-4">
        <CardHeader title={t("lockedTitle")} as="h2" />
        <p className="text-body text-muted">{t("lockedBody")}</p>
        <PanelLink href="/records/new">{t("lockedAction")}</PanelLink>
      </Card>
    );
  }

  const steps = journeySteps(demo);
  const done = steps.filter((s) => s.status === "done").length;
  const request = YUKI_REQUEST.request;
  const booking = demo.booking;
  const quote = booking ? QUOTES.find((q) => q.quoteId === booking.quoteId) : undefined;
  const started = journeyStatus(demo) !== "none";

  const values: Record<string, ReactNode> = {
    request: started ? `${label.procedure(request.procedureId)} · ${label.amount(request.amount)}` : undefined,
    quotes: started ? t("quotesCount", { count: QUOTES.length }) : undefined,
    booking: quote ? label.clinic(quote.clinicId) : undefined,
    visit: booking ? formatSlot(booking.slot, locale) : undefined,
  };

  const statusLabels: Record<TaskStepStatus, string> = {
    pending: t("stepStatus.pending"),
    active: t("stepStatus.active"),
    done: t("stepStatus.done"),
    error: t("stepStatus.error"),
  };

  return (
    <Card className="flex h-full flex-col gap-sp-4">
      <CardHeader
        title={t("title")}
        description={<span className="tabular-nums">{t("description", { done, total: steps.length })}</span>}
        as="h2"
      />
      <div
        role="progressbar"
        aria-label={t("title")}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        className="h-sp-1 w-full overflow-hidden rounded-pill bg-sunken"
      >
        <div className="h-full rounded-pill bg-brand transition-all duration-modal ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <TaskSteps
        label={t("title")}
        statusLabels={statusLabels}
        steps={steps.map((s) => ({ id: s.id, status: s.status, label: t(`steps.${s.id}`), value: values[s.id] }))}
      />
      {!started ? <p className="text-label text-muted">{t("empty")}</p> : null}
      <div className="mt-auto flex flex-wrap gap-sp-2">
        {booking ? (
          <Link href={`/bookings/${BOOKING_ID}`} className={buttonStyles({ variant: "secondary" })}>
            {t("openBooking")}
          </Link>
        ) : null}
        {started ? (
          <Link href={`/requests/${REQUEST_ID}`} className={buttonStyles({ variant: booking ? "ghost" : "secondary" })}>
            {t("openRequest")}
          </Link>
        ) : (
          <Link href="/chat" className={buttonStyles({ variant: "secondary" })}>
            {t("start")}
          </Link>
        )}
      </div>
    </Card>
  );
}

function Fact({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-1">
      <dt className="text-label text-muted">{term}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("mt-auto inline-flex min-h-touch items-center self-start text-label text-muted hover:text-text", focusRing)}
    >
      {children}
    </Link>
  );
}
