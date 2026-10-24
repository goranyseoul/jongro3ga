"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonStyles, Card, CardHeader, ChatBubble, ChatInput, ChipGroup } from "@/components/ui";
import { api, ApiError } from "@/components/customer/api";
import { ApiStatus } from "@/components/customer/api-state";
import type { Condition } from "@/components/customer/condition";
import { ConditionCard } from "@/components/customer/condition-card";
import { useLabels, useMe } from "@/components/customer/use-customer";
import type { StoredRequest } from "@/lib/agents/customer/store";
import type { Locale } from "@/lib/domain/common";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { PROCEDURES, detectProcedure } from "@/lib/ui-data/customer";

type Message = { id: string; from: "agent" | "user"; text: string };

type IntentDraft = Partial<Condition> & { procedureId: string };

/** Finds a procedure-request-like object in the /api/intent response (LLM track), whatever its wrapper. */
function intentDraft(body: unknown): IntentDraft | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const toolInput = Array.isArray(record.toolCalls)
    ? (record.toolCalls as { name?: string; input?: unknown }[]).find((call) => call.name === "draft_procedure_request")?.input
    : undefined;
  const candidates = [record.request, record.draft, record.procedureRequest, record.condition, record.data, toolInput, record];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const c = candidate as Record<string, unknown>;
    if (typeof c.procedureId !== "string" || !c.procedureId) continue;
    const budget = c.budgetKrw as { max?: number } | number | undefined;
    return {
      procedureId: c.procedureId,
      ...(c.amount && typeof c.amount === "object" ? { amount: c.amount as Condition["amount"] } : {}),
      ...(typeof budget === "number" ? { budgetKrw: budget } : budget?.max ? { budgetKrw: budget.max } : {}),
      ...(Array.isArray(c.areas) ? { areas: c.areas as Condition["areas"] } : {}),
      ...(Array.isArray(c.languages) && c.languages.length > 0 ? { languages: c.languages as Locale[] } : {}),
      ...(c.dateWindow && typeof c.dateWindow === "object" ? { dateWindow: c.dateWindow as Condition["dateWindow"] } : {}),
    };
  }
  return null;
}

/** The LLM track's intent endpoint when it exists, otherwise the same draft from the procedure name. */
async function draftFromText(text: string, locale: Locale): Promise<IntentDraft | null> {
  try {
    const response = await fetch("/api/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, text, locale }),
    });
    if (response.ok) {
      const draft = intentDraft(await response.json());
      if (draft) return draft;
    }
  } catch {
    // intent endpoint not available: local fallback below
  }
  const procedure = detectProcedure(text);
  return procedure ? { procedureId: procedure.id } : null;
}

function toCondition(request: StoredRequest["request"]): Condition {
  return {
    procedureId: request.procedureId,
    amount: request.amount as Condition["amount"],
    budgetKrw: request.budgetKrw?.max,
    areas: request.areas ?? [],
    languages: request.languages,
    dateWindow: request.dateWindow,
  };
}

// The customer agent turns the sentence into pibu/procedure-request@1 (02 "요청 정리"): the intent comes from
// POST /api/intent (or the local fallback), the defaults and the usual amount (platform.recipe) from the BFF.
export function ChatView() {
  const t = useTranslations("chat");
  const router = useRouter();
  const label = useLabels();
  const { data: me, error: meError, loading: meLoading, reload, locale } = useMe();
  const params = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([{ id: "m0", from: "agent", text: t("agent.greeting") }]);
  const [typing, setTyping] = useState(false);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [askingProcedure, setAskingProcedure] = useState(false);
  const [finding, setFinding] = useState(false);
  const [failed, setFailed] = useState(false);

  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing, condition, askingProcedure]);

  const message = (from: Message["from"], text: string): Message => ({ id: `m${nextId.current++}`, from, text });

  const send = async (text: string) => {
    setMessages((prev) => [...prev, message("user", text)]);
    setAskingProcedure(false);
    setFailed(false);
    setTyping(true);
    try {
      const draft = await draftFromText(text, locale);
      if (!draft) {
        setMessages((prev) => [...prev, message("agent", t("agent.askProcedure"))]);
        setAskingProcedure(true);
        return;
      }
      const updating = condition !== null;
      const created = await api<{ requestId: string; request: StoredRequest }>("/api/customer/requests", {
        method: "POST",
        json: { condition: draft, rawUtterance: text, start: false },
      });
      setRequestId(created.requestId);
      setCondition(toCondition(created.request.request));
      setMessages((prev) => [...prev, message("agent", t(updating ? "agent.updated" : "agent.summary", { procedure: label.procedure(draft.procedureId) }))]);
    } catch {
      setMessages((prev) => [...prev, message("agent", t("agent.error"))]);
    } finally {
      setTyping(false);
    }
  };

  // ?intent= from the home input is sent once, as if typed here
  const intent = params.get("intent");
  // (a timeout, not a ref guard: React strict mode mounts twice and the cleanup must cancel the first run)
  useEffect(() => {
    if (!intent || !me?.canMatch) return;
    const id = window.setTimeout(() => void send(intent), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, me?.canMatch]);

  const find = async () => {
    if (!requestId || !condition) return;
    setFinding(true);
    setFailed(false);
    try {
      await api(`/api/customer/requests/${requestId}/start`, { method: "POST", json: { condition } });
      router.push(`/requests/${requestId}`);
    } catch (error) {
      setFailed(true);
      setFinding(false);
      if (error instanceof ApiError && error.status === 401) void reload();
    }
  };

  if (!me) {
    return (
      <>
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <ApiStatus error={meError} loading={meLoading} onRetry={reload} />
      </>
    );
  }

  if (!me.canMatch) {
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
            onChange={(id) => void send(label.procedure(id))}
          />
        ) : null}
        {condition && !typing ? (
          <ConditionCard locale={locale} value={condition} onChange={setCondition} onFind={() => void find()} today={me.today} busy={finding} />
        ) : null}
        {failed ? <p className="text-label text-muted">{t("agent.findError")}</p> : null}
        <div ref={endRef} />
      </div>
      <div className="cu-chat-input">
        <ChatInput onSend={(text) => void send(text)} label={t("inputLabel")} sendLabel={t("send")} placeholder={t("placeholder")} disabled={typing} />
      </div>
    </>
  );
}
