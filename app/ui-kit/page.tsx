import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AgentCardView,
  Button,
  Card,
  CardHeader,
  JsonViewer,
  Label,
  Money,
  Stat,
  Table,
  Timeline,
  type AgentCard,
  type TableColumn,
} from "@/components/ui";
import type { VerdictLabel } from "@/lib/domain/verdict";
import { Interactive } from "./interactive";

export const metadata: Metadata = { title: "UI kit" };

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
  { key: "clinic", header: "병원", card: "title", cell: (row) => row.clinic },
  { key: "area", header: "지역", cell: (row) => row.area },
  {
    key: "total",
    header: "총액",
    align: "end",
    cell: (row) => <Money krw={row.totalKrw} reference={{ currency: "JPY", amount: row.referenceJpy }} locale="ja" />,
  },
  {
    key: "verdict",
    header: "판정",
    cell: (row) => <Label verdict={row.verdict} locale="ko" reason={row.reason} sampleSize={row.sampleSize} />,
  },
  { key: "action", header: "행동", card: "action", cell: () => <Button variant="secondary">이 병원으로 예약</Button> },
];

const verdicts: VerdictLabel[] = ["fair", "good_deal", "high", "very_high", "underdosed", "insufficient_data"];

const agentCard: AgentCard = {
  name: "Pibuk Customer Agent",
  description: "Collects a customer's conditions and asks clinics for quotes on their behalf.",
  version: "0.1.0",
  provider: { organization: "Pibuk" },
  supportedInterfaces: [
    { url: "https://pibu.example/a2a/customer/cag_7f3k2/rpc", protocolBinding: "JSONRPC", protocolVersion: "1.0" },
  ],
  skills: [
    {
      id: "customer.request_quotes",
      name: "Request quotes",
      description: "Sends the structured procedure request to matched clinics.",
      tags: ["quote", "request"],
    },
  ],
};

const steps = [
  { id: "t1", at: "14:02", title: "병원 4곳에 견적을 요청했어요", raw: { method: "SendMessage", skillId: "platform.match_clinics" } },
  { id: "t2", at: "14:03", title: "3곳에서 답이 왔어요", detail: "아라의원은 아직 답하지 않았어요" },
  { id: "t3", at: "14:03", title: "플랫폼이 가격과 용량을 판정했어요" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-sp-3">
      <h2 className="text-title font-semi">{title}</h2>
      {children}
    </section>
  );
}

export default function UiKitPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-sp-8 px-sp-4 py-sp-8 md:py-sp-12">
      <header className="flex flex-col gap-sp-1">
        <h1 className="text-h1 font-semi">UI kit</h1>
        <p className="text-body text-muted">components/ui 공통 컴포넌트 19종</p>
      </header>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-sp-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Stat · Money · Label">
        <Card className="flex flex-col gap-sp-4">
          <CardHeader title="오늘 현황" description="병원 콘솔 대시보드" />
          <div className="grid grid-cols-2 gap-sp-4 md:grid-cols-4">
            <Stat label="견적 요청" value={12} caption="오늘" />
            <Stat label="예약 대기" value={3} />
            <Stat label="이번 주 예약" value={8} />
            <Stat label="응답률" />
          </div>
          <Money krw={340000} reference={{ currency: "JPY", amount: 37000 }} locale="ja" />
          <div className="grid grid-cols-2 gap-sp-4 md:grid-cols-3">
            {verdicts.map((verdict) => (
              <Label key={verdict} verdict={verdict} locale="ko" />
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Table (md 미만에서 카드)">
        <Table caption="병원별 견적 비교" columns={columns} rows={quotes} rowKey={(row) => row.id} />
      </Section>

      <Section title="Timeline">
        <Timeline items={steps} rawLabel="원본 JSON 보기" />
      </Section>

      <Section title="AgentCardView · JsonViewer">
        <AgentCardView
          card={agentCard}
          labels={{ version: "버전", skills: "스킬", endpoint: "엔드포인트", json: "JSON 보기" }}
        />
        <JsonViewer value={{ schema: "pibu/example@1", ok: true }} />
      </Section>

      <Section title="Interactive">
        <Interactive />
      </Section>
    </main>
  );
}
