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
  Timeline,
  type AgentCard,
} from "@/components/ui";
import type { VerdictLabel } from "@/lib/domain/verdict";
import { Interactive } from "./interactive";
import { TableDemo } from "./table-demo";

export const metadata: Metadata = { title: "UI kit" };

const verdicts: VerdictLabel[] = ["fair", "good_deal", "high", "very_high", "underdosed", "insufficient_data"];

const agentCard: AgentCard = {
  name: "PibooK Customer Agent",
  description: "Collects a customer's conditions and asks clinics for quotes on their behalf.",
  version: "0.1.0",
  provider: { organization: "PibooK" },
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
            <Stat label="견적 요청" value={12} delta={{ value: "+3건", dir: "up", against: "어제 이 시각" }} caption="오늘" />
            <Stat label="예약 대기" value={3} delta={{ value: "-1건", dir: "down", against: "어제" }} />
            <Stat label="이번 주 예약" value={8} delta={{ value: "변화 없음", dir: "flat", against: "지난주" }} />
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
        <TableDemo />
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
