"use client";

import { Button, Label, Money, Table, type TableColumn } from "@/components/ui";
import type { VerdictLabel } from "@/lib/domain/verdict";

// The table takes cell functions, so its demos live in a client file: a server page cannot pass them down.

type QuoteRow = {
  id: string;
  clinic: string;
  area: string;
  totalKrw: number;
  referenceJpy: number;
  verdict: VerdictLabel;
  reason: string;
  sampleSize: number;
};

const quotes: QuoteRow[] = [
  { id: "q1", clinic: "민트의원", area: "강남", totalKrw: 340000, referenceJpy: 37000, verdict: "fair", reason: "강남 리쥬란 2cc 중앙값 범위", sampleSize: 42 },
  { id: "q2", clinic: "서울글로우", area: "신사", totalKrw: 198000, referenceJpy: 21500, verdict: "underdosed", reason: "1cc는 통상 2~3cc보다 적어요", sampleSize: 42 },
  { id: "q3", clinic: "아라의원", area: "압구정", totalKrw: 520000, referenceJpy: 56500, verdict: "very_high", reason: "최근 실결제가 견적보다 높았어요", sampleSize: 18 },
];

const columns: TableColumn<QuoteRow>[] = [
  { key: "clinic", header: "병원", card: "title", cell: (row) => row.clinic, sort: (row) => row.clinic },
  { key: "area", header: "지역", cell: (row) => row.area },
  {
    key: "total",
    header: "총액",
    align: "end",
    sort: (row) => row.totalKrw,
    cell: (row) => <Money krw={row.totalKrw} reference={{ currency: "JPY", amount: row.referenceJpy }} locale="ja" />,
  },
  {
    key: "verdict",
    header: "판정",
    cell: (row) => <Label verdict={row.verdict} locale="ko" reason={row.reason} sampleSize={row.sampleSize} />,
  },
  { key: "action", header: "행동", card: "action", cell: () => <Button variant="secondary">이 병원으로 예약</Button> },
];

// enough rows for two pages, to show the footer
const many: QuoteRow[] = Array.from({ length: 7 }, (_, i) => ({
  ...quotes[i % quotes.length],
  id: `m${i}`,
  clinic: `${quotes[i % quotes.length].clinic} ${i + 1}`,
  totalKrw: quotes[i % quotes.length].totalKrw + i * 10000,
}));

export function TableDemo() {
  return (
    <div className="flex flex-col gap-sp-6">
      <Table caption="병원별 견적 비교" columns={columns} rows={quotes} rowKey={(row) => row.id} />
      <Table
        caption="정렬과 페이지 이동"
        columns={columns}
        rows={many}
        rowKey={(row) => row.id}
        defaultSort={{ key: "total", dir: "asc" }}
        pagination={{
          pageSize: 4,
          labels: { previous: "이전", next: "다음", summary: (page, pages, total) => `${page} / ${pages} 페이지 · ${total}행` },
        }}
      />
      <Table caption="비어 있는 표" columns={columns} rows={[]} rowKey={(row: QuoteRow) => row.id} empty="견적이 아직 없어요" />
    </div>
  );
}
