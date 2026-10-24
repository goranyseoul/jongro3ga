import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, Money, Stat, buttonStyles } from "@/components/ui";
import { formatCurrency } from "@/lib/money";
import { PageHeader } from "@/components/clinic/page-header";
import { SignedOut } from "@/components/clinic/signed-out";
import { StateText } from "@/components/clinic/task-state";
import { changeOf, daysBetween, formatAmount, formatDate, formatDay, formatSlot } from "@/components/clinic/format";
import { getDashboard } from "@/lib/agents/clinic/console";
import { OPERATION_MODE_TEXT } from "@/lib/ui-data/clinic";
import { currentClinicId } from "../console-session";

export const metadata: Metadata = { title: "대시보드" };

export default async function ClinicDashboardPage() {
  const clinicId = await currentClinicId();
  if (!clinicId) return <SignedOut />;

  const data = await getDashboard(clinicId);
  const { clinic, needsAction, thisWeek, offersNow, response } = data;
  const today = data.today;
  const responseValue = response.percent === null ? "·" : `${response.percent}%`;
  const responseCaption =
    response.quoteRequests === 0
      ? `최근 ${response.windowDays}일 동안 받은 견적 요청이 없어요`
      : `최근 ${response.windowDays}일 · ${response.quoteRequests}건 중 ${response.answeredWithin20s}건을 20초 안에 응답`;

  return (
    <div className="flex flex-col gap-sp-6">
      <PageHeader title="대시보드" description={`${clinic.name} · ${formatDay(data.now)} 기준`} />

      <section aria-label="오늘 현황" className="grid grid-cols-1 gap-sp-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="오늘 견적 요청"
            value={`${data.quotesToday}건`}
            caption="에이전트가 자동으로 답했어요"
            delta={changeOf(data.quotesToday - data.quotesYesterdayByNow, "건", "어제 이 시각 대비")}
          />
        </Card>
        <Card>
          <Stat
            label="예약 대기"
            value={`${data.waiting}건`}
            caption={data.waitingGuest > 0 ? `고객 응답 대기 ${data.waitingGuest}건 별도` : "확정이나 거절이 필요해요"}
          />
        </Card>
        <Card>
          <Stat
            label="이번 주 예약"
            value={`${thisWeek.length}건`}
            caption="오늘부터 7일 안에 확정된 예약"
            delta={changeOf(thisWeek.length - data.bookingsLastWeek, "건", "지난주 대비")}
          />
        </Card>
        <Card>
          {response.percent !== null && response.previousPercent !== null ? (
            <Stat
              label="응답률"
              value={responseValue}
              caption={responseCaption}
              delta={changeOf(response.percent - response.previousPercent, "%p", "지난주 대비")}
            />
          ) : (
            <Stat label="응답률" value={responseValue} caption={responseCaption} />
          )}
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
                      희망 {task.slot ? formatSlot(task.slot) : "·"} · {task.priceKrw !== undefined ? <Money krw={task.priceKrw} /> : "·"}
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
                const started = offer.validFrom <= today;
                const daysLeft = daysBetween(today, offer.validUntil);
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
              <dd className="text-body font-med">{OPERATION_MODE_TEXT[clinic.operationMode]}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-sp-3">
              <dt className="text-label text-muted">견적 응답</dt>
              <dd className="text-body font-med">메뉴 데이터로 자동</dd>
            </div>
            <div className="flex items-baseline justify-between gap-sp-3">
              <dt className="text-label text-muted">예약 확정</dt>
              <dd className="text-body font-med">
                {clinic.operationMode === "proxy" ? "PibooK이 병원 확인 후" : clinic.autoConfirm ? "빈 시간이면 자동" : "요청함에서 직접"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
