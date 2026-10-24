import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProcedureRequestV1Schema } from "../a2a/schemas";
import { createLlm, isFixtureMode, llm } from "./client";
import {
  DEMO_ARA_PROPOSER_INPUT,
  GRACE_SITUATIONS,
  JISU_MEMO,
  YUKI_INTENT_INPUT,
  fixtureNextUserUtterance,
} from "./fixtures";
import { runOnboardingTurn, type OnboardingEvent } from "./onboarding";
import { draftProcedureRequest, importNotepad, proposeRules, situationToFilter, translate } from "./tasks";
import { missingRequiredSlots, onboardingProgress, type CustomerOnboardingDraft, type DraftProcedureRequest } from "./tools";
import { DraftProcedureRequestSchema } from "./tools/procedure-request";
import { TRACE_LIMIT, clearLlmTrace, recentLlmCalls } from "./trace";

const ENV = { ...process.env };
const KEYS = ["ANTHROPIC_API_KEY", "DEMO_MODE", "LLM_FORCE_LIVE", "CLAUDE_MODEL_CHAT"] as const;

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
  process.env.DEMO_MODE = "true";
  clearLlmTrace();
});

afterEach(() => {
  for (const key of KEYS) {
    if (ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ENV[key];
  }
  clearLlmTrace();
});

describe("mode", () => {
  it("is fixture without a key or in demo mode, live with a key outside demo mode or when forced", () => {
    delete process.env.DEMO_MODE;
    expect(isFixtureMode()).toBe(true); // no key
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(isFixtureMode()).toBe(false);
    process.env.DEMO_MODE = "true";
    expect(isFixtureMode()).toBe(true);
    process.env.LLM_FORCE_LIVE = "true";
    expect(isFixtureMode()).toBe(false);
    delete process.env.ANTHROPIC_API_KEY;
    expect(isFixtureMode()).toBe(true); // forcing needs a key
  });
});

describe("fixture mode, no key (T07 수용 기준)", () => {
  it("turns リジュラン受けたい into pibu/procedure-request@1 with the 02 defaults (10 데모 2행)", async () => {
    const ids = { requestId: "req_yuki_1", customerAgentId: "cag_7f3k2" };
    const { mode, built } = await draftProcedureRequest(YUKI_INTENT_INPUT, ids);
    expect(mode).toBe("fixture");
    expect(built?.ok).toBe(true);
    if (!built?.ok) return;
    expect(ProcedureRequestV1Schema.parse(built.request)).toEqual({
      schema: "pibu/procedure-request@1",
      requestId: "req_yuki_1",
      customerAgentId: "cag_7f3k2",
      procedureId: "rejuran_healer",
      amount: { value: 2, unit: "cc" },
      budgetKrw: { max: 450000 },
      areas: ["sinsa", "gangnam", "apgujeong"],
      languages: ["ja"],
      dateWindow: { from: "2026-11-13", to: "2026-11-15" },
      visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
    });
  });

  it("uses the recipe minimum and asks back for an unknown procedure", async () => {
    const recipe = {
      procedures: [
        {
          procedureId: "thermage_flx",
          typicalAmount: { min: 300, max: 600, unit: "shot" as const },
          cycle: { maintenanceIntervalDays: { min: 300, max: 400 } },
          downtimeDays: { min: 0, max: 0 },
          onsetDays: { min: 30, max: 90 },
        },
      ],
    };
    const thermage = await draftProcedureRequest({ ...YUKI_INTENT_INPUT, utterance: "サーマジも気になる", recipe });
    expect(thermage.draft.amount).toEqual({ value: 300, unit: "shot" });
    const unknown = await draftProcedureRequest({ ...YUKI_INTENT_INPUT, utterance: "何かいいのある？" });
    expect(unknown.draft.procedureId).toBe("unknown");
    expect(unknown.draft.followUpQuestion).toBeTruthy();
  });

  it("runs Yuki's onboarding to finish_onboarding with every required slot filled (10 데모 1행)", async () => {
    let draft: CustomerOnboardingDraft = {};
    let history: Anthropic.MessageParam[] = [];
    const events: OnboardingEvent[] = [];
    let finished = false;
    let message = "start";
    let streamed = "";

    for (let turn = 0; turn < 25 && !finished; turn += 1) {
      const result = await runOnboardingTurn({
        kind: "customer",
        draft,
        history,
        message,
        locale: "ja",
        today: "2026-11-12",
        onText: (delta) => (streamed += delta),
      });
      expect(result.mode).toBe("fixture");
      draft = result.draft as CustomerOnboardingDraft;
      history = result.history;
      events.push(...result.events);
      finished = result.finished;
      message = fixtureNextUserUtterance({ kind: "customer", draft }) ?? "";
    }

    expect(finished).toBe(true);
    expect(missingRequiredSlots("customer", draft)).toEqual([]);
    expect(onboardingProgress("customer", draft)).toBe(1);
    expect(events.filter((event) => event.type === "tool_error")).toEqual([]);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.filter((event) => event.type === "consent")).toHaveLength(5);
    expect(draft).toMatchObject({
      locale: "ja",
      nickname: "ゆき",
      nationality: "JP",
      residency: "short_term_visitor",
      ageBand: "25-29",
      trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa", flightTimeHome: "20:00" },
      prefs: { budgetKrw: { max: 450000 }, languagesNeeded: ["ja"] },
      firstIntent: "リジュランを受けたい",
    });
    expect(streamed).toContain("何とお呼びすればいいですか");
    // tool_use and tool_result stay paired in the history the next turn sends
    const toolUses = history.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_use") : []));
    const toolResults = history.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result") : []));
    expect(toolResults).toHaveLength(toolUses.length);
  });

  it("re-asks instead of guessing when the message is not the scripted answer", async () => {
    const result = await runOnboardingTurn({ kind: "customer", draft: { locale: "ja" }, history: [], message: "うーん", today: "2026-11-12" });
    expect(result.events.some((event) => event.type === "profile_patch")).toBe(false);
    expect(result.events.filter((event) => event.type === "consent")).toHaveLength(5);
  });

  it("runs the clinic onboarding script to the end too", async () => {
    let draft = {};
    let history: Anthropic.MessageParam[] = [];
    let finished = false;
    let message = "시작";
    for (let turn = 0; turn < 20 && !finished; turn += 1) {
      const result = await runOnboardingTurn({ kind: "clinic", draft, history, message, today: "2026-11-12" });
      ({ draft, history, finished } = result);
      message = fixtureNextUserUtterance({ kind: "clinic", draft }) ?? "";
    }
    expect(finished).toBe(true);
    expect(missingRequiredSlots("clinic", draft)).toEqual([]);
  });

  it("organizes Jisu's memo like DEMO.md scenario 2 ①", async () => {
    const { mode, data } = await importNotepad({ text: JISU_MEMO, locale: "ko", today: "2026-11-12" });
    expect(mode).toBe("fixture");
    const rejuran = data.records.filter((record) => record.procedureId === "rejuran_healer").sort((a, b) => b.date.localeCompare(a.date));
    expect(rejuran[0]).toMatchObject({ date: "2026-09-11", clinicName: "유앤아이 여의도", priceKrw: 260000, yearInferred: false });
    expect(data.records.find((record) => record.procedureId === "thermage_flx")).toMatchObject({ date: "2026-03-21", amount: { value: 450, unit: "shot" } });
    expect(data.records.find((record) => record.date === "2026-02-15" && record.procedureId === "rejuran_healer")).toMatchObject({
      priceKrw: 140000,
      unitPriceKrw: 70000,
    });
    expect(data.records.find((record) => record.date === "2025-09-09")).toMatchObject({ unitPriceKrw: 50000 });
    expect(data.records.find((record) => record.date === "2024-11-02")).toMatchObject({ yearInferred: true });
    expect(data.passes).toContainEqual(expect.objectContaining({ clinicName: "유앤아이 여의도", description: "50+5권", creditKrw: 550000 }));
    expect(data.appointments).toEqual([
      expect.objectContaining({ date: "2026-11-06", startTime: "14:00", endTime: "16:40", clinicName: "디앤에이" }),
    ]);
    expect(data.observations).toContainEqual(expect.objectContaining({ text: "오른쪽 팔자 두드러져 보임", bodyPart: "nasolabial", side: "right" }));
    expect(data.questions.find((question) => question.kind === "year_inference")?.text).toContain("추정");
    expect(data.records.every((record) => record.procedureId !== "unknown")).toBe(true);
  });

  it("parses another memo line by line and asks about the guessed year", async () => {
    const { data } = await importNotepad({ text: "3/2 리쥬란 2cc 15만\n25/12/1 써마지 300샷", locale: "ko", today: "2026-11-12" });
    expect(data.records).toMatchObject([
      { procedureId: "rejuran_healer", date: "2026-03-02", yearInferred: true, amount: { value: 2, unit: "cc" }, priceKrw: 150000 },
      { procedureId: "thermage_flx", date: "2025-12-01", yearInferred: false },
    ]);
    expect(data.questions.map((question) => question.kind)).toEqual(["year_inference"]);
  });

  it.each(Object.entries(GRACE_SITUATIONS))("turns Grace's situation (%s) into filter fields", async (locale, text) => {
    const { data } = await situationToFilter({ text, locale: locale as "en" });
    expect(data).toMatchObject({ minMaintenanceDays: 300, visitGapDays: 365, maxDowntimeDays: 0, excludeMethods: ["injection", "thread"], languages: ["en"] });
    expect(new Set(data.evidence.map((entry) => entry.field))).toEqual(
      new Set(["minMaintenanceDays", "visitGapDays", "maxDowntimeDays", "excludeMethods", "languages"]),
    );
  });

  it("proposes the Ara exclusion of 10 데모 7행", async () => {
    const result = await proposeRules(DEMO_ARA_PROPOSER_INPUT);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([
      expect.objectContaining({
        when: { nationalities: ["JP"] },
        then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
        reason: "견적 대비 실결제 평균 +31% (n=20)",
        expiresInDays: 90,
      }),
    ]);
  });

  it("returns short translations unchanged and says so", async () => {
    expect(await translate("予約確定", "en")).toEqual({ mode: "fixture", text: "予約確定" });
  });

  it("records every call in the trace ring buffer, newest first, at most 50", async () => {
    await draftProcedureRequest(YUKI_INTENT_INPUT);
    await translate("hi", "ja");
    const [latest, previous] = recentLlmCalls();
    expect(latest).toMatchObject({ purpose: "translate", mode: "fixture", model: "claude-haiku-5-5", at: "2026-11-12T10:00:00+09:00" });
    expect(previous).toMatchObject({ purpose: "intent", mode: "fixture", model: "claude-sonnet-5-5" });
    expect(latest!.latencyMs).toBeGreaterThanOrEqual(0);
    for (let index = 0; index < TRACE_LIMIT + 5; index += 1) await translate(`t${index}`, "ja");
    expect(recentLlmCalls()).toHaveLength(TRACE_LIMIT);
  });
});

// ---- live path with a stubbed network: no real call is made ----

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

function message(content: unknown[], stopReason = "end_turn"): Record<string, unknown> {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

function stubFetch(replies: Array<{ status?: number; body: unknown }>): { fetch: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const stub = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json", "x-should-retry": "false", "request-id": "req_test" },
    });
  };
  return { fetch: stub as typeof fetch, calls };
}

const YUKI_LIVE_DRAFT: DraftProcedureRequest = {
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP" },
};

describe("live path (fetch stubbed)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.DEMO_MODE;
  });

  it("extracts with structured output, no forced tool_choice, no temperature, a cached system prompt", async () => {
    const { fetch, calls } = stubFetch([{ body: message([{ type: "text", text: JSON.stringify(YUKI_LIVE_DRAFT) }]) }]);
    const result = await draftProcedureRequest(YUKI_INTENT_INPUT, undefined, createLlm({ fetch }));
    expect(result).toMatchObject({ mode: "live", draft: YUKI_LIVE_DRAFT });
    expect(calls).toHaveLength(1);
    const body = calls[0]!.body;
    expect(calls[0]!.url).toContain("/v1/messages");
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("thinking");
    expect((body.output_config as { format: { type: string; schema: { properties: { procedureId: { enum: string[] } } } } }).format).toMatchObject({
      type: "json_schema",
    });
    expect((body.output_config as { format: { schema: { properties: { procedureId: { enum: string[] } } } } }).format.schema.properties.procedureId.enum).toContain(
      "rejuran_healer",
    );
    expect((body.system as Array<{ cache_control?: unknown }>)[0]!.cache_control).toEqual({ type: "ephemeral" });
    const messages = body.messages as Array<{ role: string }>;
    expect(messages.at(-1)!.role).toBe("user"); // no assistant prefill
    expect(recentLlmCalls()[0]).toMatchObject({ purpose: "intent", mode: "live", inputTokens: 120, outputTokens: 40 });
  });

  it("sends onboarding tools strict with tool_choice auto and returns the tool calls", async () => {
    const reply = message(
      [
        { type: "text", text: "何とお呼びすればいいですか？" },
        { type: "tool_use", id: "toolu_1", name: "update_profile", input: { patch: { locale: "ja" } } },
      ],
      "tool_use",
    );
    const { fetch, calls } = stubFetch([{ body: reply }]);
    const client = createLlm({ fetch });
    const result = await client.complete({
      purpose: "onboarding_customer",
      system: "onboarding",
      messages: [{ role: "user", content: "日本語で" }],
      tools: ["update_profile", "show_widget", "request_consent", "finish_onboarding"],
    });
    expect(result).toMatchObject({ mode: "live", stopReason: "tool_use", toolCalls: [{ id: "toolu_1", name: "update_profile" }] });
    const body = calls[0]!.body;
    const choice = body.tool_choice as { type: string } | undefined;
    expect(choice === undefined || choice.type === "auto").toBe(true);
    expect(["any", "tool"]).not.toContain(choice?.type);
    expect(body).not.toHaveProperty("temperature");
    const tools = body.tools as Array<{ name: string; strict: boolean; input_schema: { additionalProperties: boolean } }>;
    expect(tools.map((tool) => tool.name)).toEqual(["update_profile", "show_widget", "request_consent", "finish_onboarding"]);
    expect(tools.every((tool) => tool.input_schema.additionalProperties === false)).toBe(true);
    // update_profile exceeds the API's 24 optional parameter cap for strict grammars (rehearsal 2026-10-24).
    expect(tools.map((tool) => tool.strict)).toEqual([false, true, true, true]);
  });

  it("falls back to the fixture on a 429 and records why", async () => {
    const { fetch } = stubFetch([{ status: 429, body: { type: "error", error: { type: "rate_limit_error", message: "slow down" } } }]);
    const result = await draftProcedureRequest(YUKI_INTENT_INPUT, undefined, createLlm({ fetch }));
    expect(result.mode).toBe("fixture");
    expect(result.draft.procedureId).toBe("rejuran_healer");
    expect(recentLlmCalls()[0]).toMatchObject({ mode: "fixture", fallbackReason: "api_error:429" });
  });

  it("falls back to the fixture on a refusal", async () => {
    const { fetch } = stubFetch([{ body: message([], "refusal") }]);
    const result = await createLlm({ fetch }).complete({ purpose: "concierge", system: "s", messages: [{ role: "user", content: "summary" }] });
    expect(result.mode).toBe("fixture");
    expect(recentLlmCalls()[0]).toMatchObject({ fallbackReason: "refusal" });
  });

  it("retries an output that fails the schema once, then falls back", async () => {
    const bad = message([{ type: "text", text: JSON.stringify({ ...YUKI_LIVE_DRAFT, procedureId: "rejuran_hb_super" }) }]);
    const { fetch, calls } = stubFetch([{ body: bad }, { body: bad }]);
    const result = await createLlm({ fetch }).extract({
      purpose: "intent",
      schema: DraftProcedureRequestSchema,
      system: "s",
      messages: [{ role: "user", content: "リジュラン受けたい" }],
    });
    expect(calls).toHaveLength(2);
    expect(result.mode).toBe("fixture");
    expect(recentLlmCalls()[0]).toMatchObject({ fallbackReason: "invalid_output" });
  });

  it("retries without strict schemas when the API refuses them (400), and validates locally", async () => {
    const { fetch, calls } = stubFetch([
      { status: 400, body: { type: "error", error: { type: "invalid_request_error", message: "schema too complex" } } },
      { body: message([{ type: "text", text: `Here it is: ${JSON.stringify(YUKI_LIVE_DRAFT)}` }]) },
    ]);
    const result = await createLlm({ fetch }).extract({
      purpose: "intent",
      schema: DraftProcedureRequestSchema,
      system: "s",
      messages: [{ role: "user", content: "リジュラン受けたい" }],
    });
    expect(result).toMatchObject({ mode: "live", data: YUKI_LIVE_DRAFT });
    expect(calls[0]!.body).toHaveProperty("output_config");
    expect(calls[1]!.body).not.toHaveProperty("output_config");
  });

  it("the process wide client takes the fixture path in demo mode even with a key", async () => {
    process.env.DEMO_MODE = "true";
    const result = await llm.complete({ purpose: "translate", system: "s", messages: [{ role: "user", content: "x" }] });
    expect(result.mode).toBe("fixture");
  });
});
