"use client";

import { useState } from "react";
import { Button, Card, CardHeader, Money, Table, type TableColumn } from "@/components/ui";
import { MENU_ITEMS, OFFERS, TODAY, type MenuItem, type Offer } from "@/lib/ui-data/clinic";
import { formatCurrency } from "@/lib/money";
import { EventSheet, type EventTarget } from "./event-sheet";
import { formatAmount, formatDate } from "./format";
import { PriceSheet } from "./price-sheet";

function offerStatus(offer: Offer): { text: string; tone: string } {
  if (offer.validUntil < TODAY) return { text: "종료", tone: "text-muted" };
  if (offer.validFrom > TODAY) return { text: "시작 전", tone: "text-muted" };
  return { text: "진행 중", tone: "text-success" };
}

const discountPercent = (offer: Offer) => Math.round((1 - offer.priceKrw / offer.regularPriceKrw) * 100);

export function MenuEditor() {
  const [items, setItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [offers, setOffers] = useState<Offer[]>(OFFERS);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [eventTarget, setEventTarget] = useState<EventTarget | null>(null);
  const [notice, setNotice] = useState("");

  const saveItem = (next: MenuItem) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
    setEditingItem(null);
    setNotice(`${next.nameKo} ${formatAmount(next.amount)} 가격을 ${formatCurrency(next.priceKrw, "KRW")}으로 저장했어요`);
  };

  const saveOffer = (next: Offer) => {
    const exists = offers.some((offer) => offer.id === next.id);
    setOffers((current) => (exists ? current.map((offer) => (offer.id === next.id ? next : offer)) : [...current, next]));
    setEventTarget(null);
    setNotice(`이벤트 "${next.title}"을 ${exists ? "수정" : "추가"}했어요`);
  };

  const removeOffer = (offer: Offer) => {
    setOffers((current) => current.filter((candidate) => candidate.id !== offer.id));
    setNotice(`이벤트 "${offer.title}"을 삭제했어요`);
  };

  const nameOf = (procedureId: string) => items.find((item) => item.procedureId === procedureId)?.nameKo ?? procedureId;

  const priceColumns: TableColumn<MenuItem>[] = [
    {
      key: "procedure",
      header: "시술",
      card: "title",
      cell: (item) => (
        <div className="flex flex-col gap-sp-1">
          <span className="text-body font-med">
            {item.nameKo} {formatAmount(item.amount)}
          </span>
          <span className="text-caption font-reg text-subtle">{item.product}</span>
        </div>
      ),
    },
    { key: "price", header: "가격", align: "end", cell: (item) => <Money krw={item.priceKrw} /> },
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
      cell: (offer) => (
        <span className="tabular-nums">
          {formatDate(offer.validFrom)} ~ {formatDate(offer.validUntil)}
        </span>
      ),
    },
    { key: "conditions", header: "조건", cell: (offer) => offer.conditions },
    {
      key: "status",
      header: "상태",
      cell: (offer) => {
        const status = offerStatus(offer);
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
          <Button variant="ghost" onClick={() => removeOffer(offer)}>
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

      <p className="text-caption text-subtle">데모 데이터예요. 변경은 이 화면을 닫을 때까지만 유지돼요</p>

      <PriceSheet item={editingItem} onClose={() => setEditingItem(null)} onSave={saveItem} />
      <EventSheet target={eventTarget} items={items} onClose={() => setEventTarget(null)} onSave={saveOffer} />
    </div>
  );
}
