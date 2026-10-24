"use client";

import { useState } from "react";
import { Button, Card, CardHeader, Money, Table, type TableColumn } from "@/components/ui";
import { clinicApi, type MenuData, type MenuItem, type Offer } from "@/lib/ui-data/clinic";
import { formatCurrency } from "@/lib/money";
import { ConfirmSheet } from "./confirm-sheet";
import { EventSheet, type EventTarget } from "./event-sheet";
import { formatAmount, formatDate } from "./format";
import { PriceSheet } from "./price-sheet";
import { Switch } from "./switch";

function offerStatus(offer: Offer, today: string): { text: string; tone: string } {
  if (!offer.active) return { text: "노출 중지", tone: "text-muted" };
  if (offer.validUntil < today) return { text: "종료", tone: "text-muted" };
  if (offer.validFrom > today) return { text: "시작 전", tone: "text-muted" };
  return { text: "진행 중", tone: "text-success" };
}

const discountPercent = (offer: Offer) => Math.round((1 - offer.priceKrw / offer.regularPriceKrw) * 100);

// Every save goes to the clinic agent's store (app/api/clinic/menu, offers): the next clinic.quote and
// clinic.offers answer with it.
export function MenuEditor({ initial }: { initial: MenuData }) {
  const [items, setItems] = useState<MenuItem[]>(initial.items);
  const [offers, setOffers] = useState<Offer[]>(initial.offers);
  const today = initial.today;
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [eventTarget, setEventTarget] = useState<EventTarget | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [notice, setNotice] = useState("");

  const run = async (request: Promise<MenuData>, message: string): Promise<boolean> => {
    try {
      const next = await request;
      setItems(next.items);
      setOffers(next.offers);
      setNotice(message);
      return true;
    } catch (error) {
      setNotice(`저장하지 못했어요: ${(error as Error).message}`);
      return false;
    }
  };

  const saveItem = async (next: MenuItem) => {
    setEditingItem(null);
    await run(
      clinicApi.saveMenuItem(next),
      `${next.nameKo} ${formatAmount(next.amount)} 가격 저장: ${formatCurrency(next.priceKrw, "KRW")}`,
    );
  };

  const saveOffer = async (next: Offer) => {
    const exists = offers.some((offer) => offer.id === next.id);
    setEventTarget(null);
    await run(clinicApi.saveOffer(next), `이벤트 "${next.title}" ${exists ? "수정" : "추가"}했어요`);
  };

  const removeOffer = async (offer: Offer) => {
    setDeleting(null);
    await run(clinicApi.deleteOffer(offer.id), `이벤트 "${offer.title}" 삭제했어요`);
  };

  const toggleOffer = (offer: Offer, active: boolean) =>
    run(
      clinicApi.saveOffer({ ...offer, active }),
      active
        ? `이벤트 "${offer.title}" 노출을 다시 켰어요`
        : `이벤트 "${offer.title}" 노출을 껐어요. 고객 에이전트에게 전달되지 않아요`,
    );

  const nameOf = (procedureId: string) => items.find((item) => item.procedureId === procedureId)?.nameKo ?? procedureId;

  const priceColumns: TableColumn<MenuItem>[] = [
    {
      key: "procedure",
      header: "시술",
      card: "title",
      sort: (item) => `${item.nameKo} ${String(item.amount.value).padStart(4, "0")}`,
      cell: (item) => (
        <div className="flex flex-col gap-sp-1">
          <span className="text-body font-med">
            {item.nameKo} {formatAmount(item.amount)}
          </span>
          <span className="text-caption font-reg text-subtle">{item.product}</span>
        </div>
      ),
    },
    { key: "price", header: "가격", align: "end", sort: (item) => item.priceKrw, cell: (item) => <Money krw={item.priceKrw} /> },
    { key: "vat", header: "부가세", cell: (item) => (item.vatIncluded ? "포함" : "별도") },
    { key: "includes", header: "포함 항목", cell: (item) => (item.includes.length > 0 ? item.includes.join(", ") : "·") },
    {
      key: "foreigner",
      header: "외국인 가격",
      cell: (item) => (item.foreignerSamePrice ? "내국인과 동일" : "별도"),
    },
    {
      key: "edit",
      header: "수정",
      card: "action",
      cell: (item) => (
        <Button variant="secondary" onClick={() => setEditingItem(item)}>
          가격 수정
        </Button>
      ),
    },
  ];

  const offerColumns: TableColumn<Offer>[] = [
    {
      key: "title",
      header: "이벤트",
      card: "title",
      cell: (offer) => (
        <div className="flex flex-col gap-sp-1">
          <span className="text-body font-med">{offer.title}</span>
          <span className="text-caption font-reg text-subtle">{nameOf(offer.procedureId)} {formatAmount(offer.amount)}</span>
        </div>
      ),
    },
    {
      key: "price",
      header: "이벤트가",
      align: "end",
      sort: (offer) => offer.priceKrw,
      cell: (offer) => (
        <div className="flex flex-col gap-sp-1 md:items-end">
          <Money krw={offer.priceKrw} />
          <span className="text-caption text-subtle tabular-nums">
            정상가 {formatCurrency(offer.regularPriceKrw, "KRW")} · {discountPercent(offer)}% 낮음
          </span>
        </div>
      ),
    },
    {
      key: "period",
      header: "기간",
      sort: (offer) => offer.validFrom,
      cell: (offer) => (
        <span className="tabular-nums">
          {formatDate(offer.validFrom)} ~ {formatDate(offer.validUntil)}
        </span>
      ),
    },
    { key: "conditions", header: "조건", cell: (offer) => offer.conditions },
    {
      key: "active",
      header: "노출",
      cell: (offer) => <Switch checked={offer.active} onChange={(next) => toggleOffer(offer, next)} label={`${offer.title} 노출`} />,
    },
    {
      key: "status",
      header: "상태",
      cell: (offer) => {
        const status = offerStatus(offer, today);
        return <span className={`text-body font-semi ${status.tone}`}>{status.text}</span>;
      },
    },
    {
      key: "actions",
      header: "관리",
      card: "action",
      cell: (offer) => (
        <div className="flex flex-wrap gap-sp-2">
          <Button variant="secondary" onClick={() => setEventTarget({ offer })}>
            수정
          </Button>
          <Button variant="secondary" onClick={() => setEventTarget({ offer: null, preset: offer })}>
            복제
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(offer)}>
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-sp-6">
      <p role="status" aria-live="polite" className="min-h-sp-5 text-label text-muted">
        {notice}
      </p>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader as="h2" title="시술 가격표" description="견적 요청에는 이 가격표로 자동 응답해요" />
        <Table caption="시술별 정가" columns={priceColumns} rows={items} rowKey={(item) => item.id} />
      </Card>

      <Card className="flex flex-col gap-sp-4">
        <CardHeader
          as="h2"
          title="이벤트"
          description="이벤트에는 정상가, 기간, 조건이 꼭 필요해요"
          action={
            <Button variant="primary" onClick={() => setEventTarget({ offer: null })}>
              이벤트 추가
            </Button>
          }
        />
        <Table
          caption="진행 중이거나 예정된 이벤트"
          columns={offerColumns}
          rows={offers}
          rowKey={(offer) => offer.id}
          empty="등록된 이벤트가 없어요"
        />
      </Card>

      <p className="text-caption text-subtle">저장하면 바로 병원 에이전트에 반영돼요. 다음 견적부터 새 가격과 이벤트로 답해요</p>

      <PriceSheet item={editingItem} onClose={() => setEditingItem(null)} onSave={saveItem} />
      <ConfirmSheet
        open={deleting !== null}
        title="이벤트 삭제"
        message={
          deleting
            ? `"${deleting.title}" 이벤트를 삭제하면 되돌릴 수 없어요. 잠시 숨기려면 노출을 꺼 두세요`
            : ""
        }
        confirmLabel="삭제"
        onConfirm={() => deleting && removeOffer(deleting)}
        onClose={() => setDeleting(null)}
      />
      <EventSheet target={eventTarget} items={items} onClose={() => setEventTarget(null)} onSave={saveOffer} />
    </div>
  );
}
