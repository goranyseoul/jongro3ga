import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, Money, Stat, buttonStyles } from "@/components/ui";
import { formatCurrency } from "@/lib/money";
import { PageHeader } from "@/components/clinic/page-header";
import { StateText } from "@/components/clinic/task-state";
import { daysBetween, formatAmount, formatDate, formatDay, formatSlot, seoulDate } from "@/components/clinic/format";
import {
  CLINIC,
  INBOX_TASKS,
  NOW,
  OFFERS,
  OPERATION_MODE_TEXT,
  RESPONSE_STATS,
  TODAY,
  responseRatePercent,
} from "@/lib/ui-data/clinic";

export const metadata: Metadata = { title: "대시보드" };

const WEEK_MS = 7 * 86_400_000;

export default function ClinicDashboardPage() {
  const now = Date.parse(NOW);
  const bookings = INBOX_TASKS.filter((task) => task.kind === "booking");

  const quotesToday = INBOX_TASKS.filter((task) => task.kind === "quote" && seoulDate(task.receivedAt) === TODAY);
  const waiting = bookings.filter((task) => task.state === "TASK_STATE_WORKING");
  const waitingGuest = bookings.filter((task) => task.state === "TASK_STATE_INPUT_REQUIRED");
  const thisWeek = bookings
    .filter((task) => {
      if (task.state !== "TASK_STATE_COMPLETED" || !task.slot) return false;
      const at = Date.parse(task.slot);
      return at >= now && at < now + WEEK_MS;
    })
    .sort((a, b) => Date.parse(a.slot ?? "") - Date.parse(b.slot ?? ""));
  const needsAction = bookings.filter(
    (task) => task.state === "TASK_STATE_WORKING" || task.state === "TASK_STATE_INPUT_REQUIRED",
  );
  const offersNow = OFFERS.filter((offer) => offer.validUntil >= TODAY);

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader title="대시보드" description={`${CLINIC.name} · ${formatDay(NOW)} 기준`} />

      <section aria-label="오늘 현황" className="grid grid-cols-1 gap-sp-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="오늘 견적 요청" value={`${quotesToday.length}건`} caption="에이전트가 자동으로 답했어요" />
        </Card>
        <Card>
          <Stat
            label="예약 대기"
            value={`${waiting.length}건`}
            caption={waitingGuest.length > 0 ? `고객 응답 대기 ${waitingGuest.length}건 별도` : "확정이나 거절이 필요해요"}
          />
        </Card>
        <Card>
          <Stat label="이번 주 예약" value={`${thisWeek.length}건`} caption="오늘부터 7일 안에 확정된 예약" />
        </Card>
        <Card>
          <Stat
            label="응답률"
            value={`${responseRatePercent()}%`}
            caption={`최근 ${RESPONSE_STATS.windowDays}일 · ${RESPONSE_STATS.quoteRequests}건 중 ${RESPONSE_STATS.answeredWithin20s}건을 20초 안에 응답`}
          />
        </Card>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-sp-4 lg:grid-cols-3">
        <Card className="flex h-full flex-col gap-sp-4 lg:col-span-2">
          <CardHeader
            as="h2"
            title="처리가 필요한 예약"
            description="확정, 시간 제안, 거절은 요청함에서 해요"
            action={
              <Link href="/clinic/inbox" className={buttonStyles({ variant: "secondary" })}>
                요청함 열기
              </Link>
            }
          />
          {needsAction.length === 0 ? (
            <p className="text-body text-muted">처리할 예약이 없어요</p>
          ) : (
            <ul className="flex flex-col">
              {needsAction.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-sp-1 border-b border-border-soft py-sp-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-sp-4"
                >
                  <div className="flex min-w-0 flex-col gap-sp-1">
                    <span className="text-body font-med">
                      {task.from} · {task.product} {formatAmount(task.amount)}
                    </span>
                    <span className="text-label text-muted tabular-nums">
                      희망 {task.slot ? formatSlot(task.slot) : "·"} · <Money krw={task.priceKrw} />
                    </span>
                  </div>
                  <StateText task={task} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex h-full flex-col gap-sp-4">
          <CardHeader as="h2" title="이번 주 예약 일정" description="확정된 예약만 보여요" />
          {thisWeek.length === 0 ? (
            <p className="text-body text-muted">이번 주 확정된 예약이 없어요</p>
          ) : (
            <ul className="flex flex-col">
              {thisWeek.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-sp-1 border-b border-border-soft py-sp-3 last:border-b-0"
                >
                  <span className="text-body font-med tabular-nums">{task.slot ? formatSlot(task.slot) : "·"}</span>
                  <span className="text-label text-muted">
                    {task.from} · {task.product} {formatAmount(task.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-sp-4 lg:grid-cols-3">
        <Card className="flex h-full flex-col gap-sp-4 lg:col-span-2">
          <CardHeader
            as="h2"
            title="이벤트"
            description="정상가, 기간, 조건이 함께 고객 에이전트에게 전달돼요"
            action={
              <Link href="/clinic/menu" className={buttonStyles({ variant: "secondary" })}>
                메뉴·가격
              </Link>
            }
          />
          {offersNow.length === 0 ? (
            <p className="text-body text-muted">진행 중이거나 예정된 이벤트가 없어요</p>
          ) : (
            <ul className="flex flex-col">
              {offersNow.map((offer) => {
                const started = offer.validFrom <= TODAY;
                const daysLeft = daysBetween(TODAY, offer.validUntil);
                return (
                  <li
                    key={offer.id}
                    className="flex flex-col gap-sp-1 border-b border-border-soft py-sp-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-sp-4"
                  >
                    <div className="flex min-w-0 flex-col gap-sp-1">
                      <span className="text-body font-med">{offer.title}</span>
                      <span className="text-label text-muted tabular-nums">
                        {formatDate(offer.validFrom)} ~ {formatDate(offer.validUntil)} · {offer.conditions}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col gap-sp-1 sm:items-end">
                      <Money krw={offer.priceKrw} />
                      <span className="text-caption text-subtle tabular-nums">
                        정상가 {formatCurrency(offer.regularPriceKrw, "KRW")} ·{" "}
                        {started ? (daysLeft <= 7 ? `${daysLeft}일 남음` : "진행 중") : "시작 전"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex h-full flex-col gap-sp-4">
          <CardHeader
            as="h2"
            title="내 에이전트"
            description="견적과 예약 요청을 받는 병원 에이전트예요"
            action={
              <Link href="/clinic/agent" className={buttonStyles({ variant: "secondary" })}>
                보기
              </Link>
            }
          />
          <dl className="flex flex-col gap-sp-2">
            <div className="flex items-baseline justify-between gap-sp-3">
              <dt className="text-label text-muted">운영 모드</dt>
              <dd className="text-body font-med">{OPERATION_MODE_TEXT[CLINIC.operationMode]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-sp-3">
              <dt className="text-label text-muted">견적 응답</dt>
              <dd className="text-body font-med">메뉴 데이터로 자동</dd>
            </div>
            <div className="flex items-baseline justify-between gap-sp-3">
              <dt className="text-label text-muted">예약 확정</dt>
              <dd className="text-body font-med">요청함에서 직접</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
