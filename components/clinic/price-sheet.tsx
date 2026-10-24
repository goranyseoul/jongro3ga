"use client";

import { useState } from "react";
import { Button, ChipGroup, Input, Sheet } from "@/components/ui";
import type { MenuItem } from "@/lib/ui-data/clinic";
import { formatCurrency } from "@/lib/money";
import { formatAmount } from "./format";

const INCLUDE_OPTIONS = ["마취크림", "진정팩", "재생크림"];

type Vat = "included" | "excluded";

/** Keeps digits only, so "99,000원" and "99000" both read as 99000. */
export function parseWon(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}

export type PriceSheetProps = {
  item: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
};

export function PriceSheet({ item, onClose, onSave }: PriceSheetProps) {
  return (
    <Sheet open={item !== null} onClose={onClose} title="가격 수정" closeLabel="닫기">
      {item ? <PriceForm key={item.id} item={item} onSave={onSave} /> : null}
    </Sheet>
  );
}

function PriceForm({ item, onSave }: { item: MenuItem; onSave: PriceSheetProps["onSave"] }) {
  const [price, setPrice] = useState(String(item.priceKrw));
  const [vat, setVat] = useState<Vat>(item.vatIncluded ? "included" : "excluded");
  const [includes, setIncludes] = useState<string[]>(item.includes);
  const [submitted, setSubmitted] = useState(false);

  const priceKrw = parseWon(price);
  const priceError = submitted && priceKrw <= 0 ? "가격을 숫자로 입력해 주세요" : undefined;
  const includeOptions = Array.from(new Set([...INCLUDE_OPTIONS, ...item.includes]));

  const save = () => {
    setSubmitted(true);
    if (priceKrw <= 0) return;
    onSave({ ...item, priceKrw, vatIncluded: vat === "included", includes });
  };

  return (
    <div className="flex flex-col gap-sp-4">
      <p className="text-body font-med">
        {item.nameKo} {formatAmount(item.amount)}
      </p>

      <Input
        label="가격 (원)"
        inputMode="numeric"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        error={priceError}
        hint={priceKrw > 0 ? formatCurrency(priceKrw, "KRW") : undefined}
      />

      <div className="flex flex-col gap-sp-2">
        <span className="text-label font-med text-muted">부가세</span>
        <ChipGroup
          label="부가세"
          value={vat}
          onChange={setVat}
          options={[
            { value: "included", label: "포함" },
            { value: "excluded", label: "별도" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-sp-2">
        <span className="text-label font-med text-muted">포함 항목</span>
        <ChipGroup
          multiple
          label="포함 항목"
          value={includes}
          onChange={setIncludes}
          options={includeOptions.map((value) => ({ value, label: value }))}
        />
      </div>

      <Button variant="primary" fullWidth onClick={save}>
        저장
      </Button>
    </div>
  );
}
