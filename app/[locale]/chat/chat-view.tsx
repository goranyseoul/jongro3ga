"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonStyles, Card, CardHeader, ChatBubble, ChatInput, ChipGroup } from "@/components/ui";
import { buildCondition, type Condition } from "@/components/customer/condition";
import { ConditionCard } from "@/components/customer/condition-card";
import { updateDemoState } from "@/components/customer/demo-state";
import { useCustomer, useLabels } from "@/components/customer/use-customer";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { DEMO_TODAY, PROCEDURES, REQUEST_ID, canMatch, detectProcedure } from "@/lib/ui-data/customer";

type Message = { id: string; from: "agent" | "user"; text: string };

/** Mock agent typing delay. */
const REPLY_DELAY_MS = 400;

// The real agent turns the sentence into pibu/procedure-request@1 (02-agents.md "요청 정리");
// this mock only recognizes the procedure name and fills the defaults of that rule.
export function ChatView() {
  const t = useTranslations("chat");
  const router = useRouter();
  const label = useLabels();
  const { locale, profile } = useCustomer();
  const params = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([{ id: "m0", from: "agent", text: t("agent.greeting") }]);
  const [typing, setTyping] = useState(false);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [askingProcedure, setAskingProcedure] = useState(false);

  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing, condition, askingProcedure]);

  const message = (from: Message["from"], text: string): Message => ({ id: `m${nextId.current++}`, from, text });

  const agentSays = (text: string, then?: () => void) => {
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((prev) => [...prev, message("agent", text)]);
        setTyping(false);
        then?.();
      }, REPLY_DELAY_MS),
    );
  };

  const send = (text: string) => {
    setMessages((prev) => [...prev, message("user", text)]);
    setAskingProcedure(false);
    const procedure = detectProcedure(text);
    if (!procedure) {
      agentSays(t("agent.askProcedure"), () => setAskingProcedure(true));
      return;
    }
    const name = label.procedure(procedure.id);
    const updating = condition !== null;
    agentSays(t(updating ? "agent.updated" : "agent.summary", { procedure: name }), () =>
      setCondition(buildCondition(profile, procedure)),
    );
  };

  // ?intent= from the home input is sent once, as if typed here
  const intent = params.get("intent");
  // (a timeout, not a ref guard: React strict mode mounts twice and the cleanup must cancel the first run)
  useEffect(() => {
    if (!intent || !canMatch(profile)) return;
    const id = window.setTimeout(() => send(intent), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const find = () => {
    updateDemoState((state) => ({ ...state, requestStarted: true }));
    router.push(`/requests/${REQUEST_ID}`);
  };

  if (!canMatch(profile)) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <Card className="flex flex-col gap-sp-3">
          <CardHeader title={t("locked.title")} as="h2" />
          <p className="text-body text-muted">{t("locked.body")}</p>
          <Link href="/records" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
            {t("locked.records")}
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="text-h2 font-semi">{t("title")}</h1>
      <div role="log" aria-live="polite" className="flex flex-1 flex-col gap-sp-3">
        {messages.map((m) => (
          <ChatBubble key={m.id} from={m.from}>
            {m.text}
          </ChatBubble>
        ))}
        {typing ? <ChatBubble from="agent">{`${t("typing")}...`}</ChatBubble> : null}
        {askingProcedure && !typing ? (
          <ChipGroup
            label={t("condition.rows.procedure")}
            options={PROCEDURES.map((p) => ({ value: p.id, label: label.procedure(p.id) }))}
            value={null}
            onChange={(id) => send(label.procedure(id))}
          />
        ) : null}
        {condition && !typing ? (
          <ConditionCard locale={locale} value={condition} onChange={setCondition} onFind={find} today={DEMO_TODAY} />
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="cu-chat-input">
        <ChatInput onSend={send} label={t("inputLabel")} sendLabel={t("send")} placeholder={t("placeholder")} disabled={typing} />
      </div>
    </>
  );
}
