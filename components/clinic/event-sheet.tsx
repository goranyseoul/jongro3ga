"use client";

import { useState } from "react";
import { Button, ChipGroup, Input, Sheet } from "@/components/ui";
import { formatCurrency } from "@/lib/money";
import type { MenuItem, Offer } from "@/lib/ui-data/clinic";
import { formatAmount } from "./format";
import { parseWon } from "./price-sheet";

export type EventTarget = { offer: Offer | null };

export type EventSheetProps = {
  /** null closes the sheet, `{ offer: null }` starts a new event. */
  target: EventTarget | null;
  items: MenuItem[];
  onClose: () => void;
  onSave: (offer: Offer) => void;
};

export function EventSheet({ target, items, onClose, onSave }: EventSheetProps) {
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target?.offer ? "이벤트 수정" : "이벤트 추가"}
      closeLabel="닫기"
    >
      {target ? <EventForm key={target.offer?.id ?? "new"} offer={target.offer} items={items} onSave={onSave} /> : null}
    </Sheet>
  );
}

type Errors = Partial<Record<"item" | "title" | "price" | "regular" | "from" | "until" | "conditions", string>>;

function EventForm({ offer, items, onSave }: { offer: Offer | null; items: MenuItem[]; onSave: EventSheetProps["onSave"] }) {
  const initialItem = offer
    ? items.find((item) => item.procedureId === offer.procedureId && item.amount.value === offer.amount.value)
    : undefined;

  const [itemId, setItemId] = useState<string | null>(initialItem?.id ?? null);
  const [title, setTitle] = useState(offer?.title ?? "");
  const [price, setPrice] = useState(offer ? String(offer.priceKrw) : "");
  const [regular, setRegular] = useState(offer ? String(offer.regularPriceKrw) : "");
  const [from, setFrom] = useState(offer?.validFrom ?? "");
  const [until, setUntil] = useState(offer?.validUntil ?? "");
  const [conditions, setConditions] = useState(offer?.conditions ?? "");
  const [submitted, setSubmitted] = useState(false);

  const item = items.find((candidate) => candidate.id === itemId);
  const priceKrw = parseWon(price);
  const regularKrw = parseWon(regular);

  // The regular price starts from the menu price; a value the clinic typed itself is kept.
  const pickItem = (nextId: string) => {
    const next = items.find((candidate) => candidate.id === nextId);
    if (next && (regular === "" || regularKrw === item?.priceKrw)) setRegular(String(next.priceKrw));
    setItemId(nextId);
  };

  // Regular price, period and conditions are all required for an event (05-screens.md, 병원 콘솔 메뉴·가격).
  const errors: Errors = {};
  if (!item) errors.item = "시술을 골라 주세요";
  if (title.trim() === "") errors.title = "이벤트 이름을 입력해 주세요";
  if (regularKrw <= 0) errors.regular = "정상가를 입력해 주세요";
  if (priceKrw <= 0) errors.price = "이벤트가를 입력해 주세요";
  else if (regularKrw > 0 && priceKrw >= regularKrw) errors.price = "이벤트가는 정상가보다 낮아야 해요";
  if (from === "") errors.from = "시작일을 골라 주세요";
  if (until === "") errors.until = "종료일을 골라 주세요";
  else if (from !== "" && until < from) errors.until = "종료일은 시작일 이후여야 해요";
  if (conditions.trim() === "") errors.conditions = "적용 조건을 입력해 주세요 (예: 첫 방문 고객만)";

  const shown = (key: keyof Errors) => (submitted ? errors[key] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || !item) return;
    onSave({
      id: offer?.id ?? `of_${Date.now().toString(36)}`,
      procedureId: item.procedureId,
      title: title.trim(),
      amount: item.amount,
      priceKrw,
      regularPriceKrw: regularKrw,
      validFrom: from,
      validUntil: until,
      conditions: conditions.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex flex-col gap-sp-2">
        <span className="text-label font-med text-muted">시술</span>
        <ChipGroup
          label="이벤트 시술"
          value={itemId}
          onChange={pickItem}
          options={items.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.nameKo} ${formatAmount(candidate.amount)}`,
          }))}
        />
        {shown("item") ? <p className="text-caption text-danger">{shown("item")}</p> : null}
      </div>

      <Input label="이벤트 이름" value={title} onChange={(event) => setTitle(event.target.value)} error={shown("title")} />

      <div className="grid grid-cols-1 gap-sp-4 sm:grid-cols-2">
        <Input
          label="정상가 (원)"
          inputMode="numeric"
          value={regular}
          onChange={(event) => setRegular(event.target.value)}
          error={shown("regular")}
          hint={regularKrw > 0 ? formatCurrency(regularKrw, "KRW") : "고객에게 함께 보여줘요"}
        />
        <Input
          label="이벤트가 (원)"
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          error={shown("price")}
          hint={priceKrw > 0 ? formatCurrency(priceKrw, "KRW") : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-sp-4 sm:grid-cols-2">
        <Input label="시작일" type="date" value={from} onChange={(event) => setFrom(event.target.value)} error={shown("from")} />
        <Input label="종료일" type="date" value={until} onChange={(event) => setUntil(event.target.value)} error={shown("until")} />
      </div>

      <Input
        label="적용 조건"
        value={conditions}
        onChange={(event) => setConditions(event.target.value)}
        error={shown("conditions")}
        hint="예: 첫 방문 고객만, 평일 오전 예약 한정"
      />

      <Button variant="primary" fullWidth onClick={save}>
        저장
      </Button>
    </div>
  );
}
