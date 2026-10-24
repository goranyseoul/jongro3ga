"use client";

import { useState, type ReactNode } from "react";
import {
  AgentCardView,
  Button,
  Card,
  ChatBubble,
  ChatInput,
  Chip,
  ChipGroup,
  ConsentCard,
  Input,
  JsonViewer,
  Label,
  Money,
  Sheet,
  Stat,
  Table,
  Timeline,
  WidgetCurrency,
  WidgetDateRange,
  WidgetSlider,
  VERDICT_LABEL_COPY,
  type VerdictLabel,
} from "@/components/ui";

const VERDICTS = Object.keys(VERDICT_LABEL_COPY) as VerdictLabel[];

interface QuoteRow {
  id: string;
  clinic: string;
  total: number;
  unit: number;
  verdict: VerdictLabel;
}

const ROWS: QuoteRow[] = [
  { id: "q1", clinic: "Clinic A", total: 340000, unit: 170000, verdict: "fair" },
  { id: "q2", clinic: "Clinic B", total: 99000, unit: 99000, verdict: "underdosed" },
  { id: "q3", clinic: "Clinic C", total: 330000, unit: 165000, verdict: "fair" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`ui-${id}`} aria-labelledby={`ui-${id}-h`} className="flex flex-col gap-sp-3">
      <h2 id={`ui-${id}-h`} className="text-title font-semi text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [last, setLast] = useState("none");
  const [messages, setMessages] = useState<string[]>([]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-sp-8 px-sp-4 py-sp-8 md:px-sp-6">
      <header className="flex flex-col gap-sp-1">
        <h1 className="text-h1 font-semi text-text">UI components</h1>
        <p className="text-body text-muted">Every shared component, tokens only.</p>
      </header>

      <Section id="button" title="Button">
        <div className="flex flex-wrap gap-sp-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section id="input" title="Input">
        <Input label="Nickname" placeholder="Yuki" hint="Shown to your agent only" />
      </Section>

      <Section id="chip" title="Chip and ChipGroup">
        <div className="flex flex-wrap gap-sp-2">
          <Chip>Default</Chip>
          <Chip selected>Selected</Chip>
        </div>
        <ChipGroup
          ariaLabel="Concerns"
          multiple
          defaultValue={["elasticity"]}
          options={[
            { value: "elasticity", label: "Elasticity" },
            { value: "fine_lines", label: "Fine lines" },
            { value: "pores", label: "Pores" },
          ]}
        />
      </Section>

      <Section id="card" title="Card">
        <Card title="Card title" caption="Caption line">
          Body text on an elevated surface.
        </Card>
      </Section>

      <Section id="sheet" title="Sheet">
        <div>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
        </div>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Sheet title">
          <p className="text-body text-muted">Bottom sheet on small screens, centered panel from md.</p>
        </Sheet>
      </Section>

      <Section id="table" title="Table (cards below md)">
        <Table
          columns={[
            { key: "clinic", header: "Clinic", render: (r: QuoteRow) => r.clinic },
            { key: "total", header: "Total", numeric: true, render: (r: QuoteRow) => <Money krw={r.total} /> },
            { key: "unit", header: "Unit price", numeric: true, render: (r: QuoteRow) => <Money krw={r.unit} /> },
            { key: "verdict", header: "Verdict", render: (r: QuoteRow) => <Label label={r.verdict} locale="en" /> },
          ]}
          rows={ROWS}
          rowKey={(r) => r.id}
        />
      </Section>

      <Section id="label" title="Label (verdict, 4 languages)">
        <div className="grid gap-sp-2 sm:grid-cols-2">
          {VERDICTS.map((v) => (
            <div key={v} className="flex flex-wrap items-baseline gap-sp-3 rounded-md border border-line-soft bg-elev p-sp-3">
              <Label label={v} locale="ko" />
              <Label label={v} locale="ja" />
              <Label label={v} locale="en" />
              <Label label={v} locale="zh-CN" />
            </div>
          ))}
        </div>
      </Section>

      <Section id="stat" title="Stat">
        <div className="grid grid-cols-2 gap-sp-4 sm:grid-cols-3">
          <Stat label="Quotes today" value="12" caption="3 pending" />
          <Stat label="Sample size" value="n=42" />
          <Stat label="Median unit" value={<Money krw={160000} />} />
        </div>
      </Section>

      <Section id="timeline" title="Timeline">
        <Timeline
          items={[
            { id: "t1", time: "10:00", title: "Asked the platform for matching clinics", caption: "platform.match_clinics" },
            { id: "t2", time: "10:01", title: "Requested quotes from 3 clinics", detail: <JsonViewer value={{ skillId: "clinic.quote", clinics: 3 }} summary="Raw A2A JSON" /> },
            { id: "t3", time: "10:02", title: "Platform reviewed the prices" },
          ]}
        />
      </Section>

      <Section id="chat" title="ChatBubble and ChatInput">
        <div className="flex flex-col gap-sp-3">
          <ChatBubble role="agent" name="Pibu">
            What would you like to get done?
          </ChatBubble>
          <ChatBubble role="user">I want Rejuran</ChatBubble>
          {messages.map((m, i) => (
            <ChatBubble key={`${i}-${m}`} role="user">
              {m}
            </ChatBubble>
          ))}
          <ChatInput placeholder="Type a message" onSend={(t) => setMessages((p) => [...p, t])} />
        </div>
      </Section>

      <Section id="widgets" title="WidgetDateRange, WidgetSlider, WidgetCurrency">
        <div className="flex flex-col gap-sp-3">
          <WidgetDateRange
            fromLabel="From"
            toLabel="To"
            confirmLabel="Confirm dates"
            defaultValue={{ from: "2026-11-13", to: "2026-11-15" }}
            onConfirm={(r) => setLast(`dates ${r.from} ~ ${r.to}`)}
          />
          <WidgetSlider label="Amount" min={1} max={4} step={0.5} unit="cc" defaultValue={2} confirmLabel="Confirm amount" onConfirm={(v) => setLast(`amount ${v}`)} />
          <WidgetCurrency label="Budget" confirmLabel="Confirm budget" defaultValue={450000} onConfirm={(v) => setLast(`budget ${v}`)} />
          <p className="text-sm text-muted" data-testid="widget-last">
            Last widget value: {last}
          </p>
        </div>
      </Section>

      <Section id="consent" title="ConsentCard">
        <ConsentCard
          title="Share safety information with the clinic"
          description="Your agent sends these fields only to the clinic you book."
          recipient="Recipient: the clinic you choose"
          scope={["Pregnancy or breastfeeding", "Allergies", "Contact handle"]}
          grantLabel="Agree"
          declineLabel="Not now"
          onGrant={() => setLast("consent granted")}
          onDecline={() => setLast("consent declined")}
        />
      </Section>

      <Section id="agentcard" title="AgentCardView">
        <AgentCardView
          title="Your agent"
          subtitle="cag_demo"
          slots={[
            { key: "nationality", label: "Nationality", value: "JP" },
            { key: "ageBand", label: "Age band", value: "25-29" },
            { key: "budget", label: "Budget", value: undefined },
          ]}
          emptyText="Not set yet"
        />
      </Section>

      <Section id="json" title="JsonViewer">
        <JsonViewer open summary="pibu/quote@1" value={{ schema: "pibu/quote@1", priceKrw: 340000, amount: { value: 2, unit: "cc" } }} />
      </Section>

      <Section id="money" title="Money">
        <div className="flex flex-col gap-sp-1 text-body text-text">
          <Money krw={340000} reference={{ prefix: "約", symbol: "¥", amount: 37000 }} />
          <Money krw={99000} />
        </div>
      </Section>
    </main>
  );
}
