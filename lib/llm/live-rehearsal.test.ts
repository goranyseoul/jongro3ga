import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ProcedureRequestV1Schema } from "../a2a/schemas";
import { isFixtureMode } from "./client";
import { DEMO_ARA_PROPOSER_INPUT, GRACE_SITUATIONS, JISU_MEMO, YUKI_INTENT_INPUT } from "./fixtures";
import { runOnboardingTurn } from "./onboarding";
import { draftProcedureRequest, importNotepad, proposeRules, situationToFilter } from "./tasks";
import { recentLlmCalls } from "./trace";
import { appendFileSync } from "node:fs";

// vitest hides stdout of passing tests, so the rehearsal also appends its lines to LLM_REHEARSAL_LOG when set.
function note(...parts: unknown[]): void {
  const line = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
  console.log(line);
  if (process.env.LLM_REHEARSAL_LOG) appendFileSync(process.env.LLM_REHEARSAL_LOG, `${line}\n`);
}

// Rehearsal against the real API. Skipped unless .env has a key and LLM_FORCE_LIVE=true:
//   NODE_OPTIONS=--env-file=.env npx vitest run lib/llm/live-rehearsal.test.ts
// It spends real tokens and checks what the fixtures cannot: that the API accepts the strict schemas and that
// the live answers have the shape the agents rely on. Wording is reported, not asserted.
const live = process.env.LLM_FORCE_LIVE === "true" && !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!live)("live rehearsal", () => {
  it("is in live mode", () => {
    expect(isFixtureMode()).toBe(false);
  });

  it("intent: リジュラン受けたい becomes a valid pibu/procedure-request@1", async () => {
    // The real flow asks platform.recipe first and hands the typical amounts to the intent step (02 "요청 정리").
    const recipe = {
      procedures: [
        { procedureId: "rejuran_healer", typicalAmount: { min: 2, max: 3, unit: "cc" as const }, cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } }, downtimeDays: { min: 1, max: 3 }, onsetDays: { min: 14, max: 28 } },
      ],
    };
    const { mode, draft, built } = await draftProcedureRequest({ ...YUKI_INTENT_INPUT, recipe }, { requestId: "req_live_1", customerAgentId: "cag_7f3k2" });
    note("[intent]", mode, JSON.stringify(draft));
    expect(mode).toBe("live");
    expect(built?.ok, JSON.stringify(built)).toBe(true);
    if (!built?.ok) return;
    const request = ProcedureRequestV1Schema.parse(built.request);
    expect(request.procedureId).toBe("rejuran_healer");
    expect(request.languages).toEqual(["ja"]);
    expect(request.amount).toEqual({ value: 2, unit: "cc" });
  }, 90_000);

  it("onboarding: first two customer turns call tools in Japanese", async () => {
    let draft = {};
    let history: Anthropic.MessageParam[] = [];
    const seen: string[] = [];
    for (const message of ["start", "日本語で"]) {
      const result = await runOnboardingTurn({ kind: "customer", draft, history, message, locale: "ja", today: "2026-11-12" });
      note("[onboarding]", result.mode, JSON.stringify({ text: result.text, events: result.events.map((e) => e.type) }));
      expect(result.mode).toBe("live");
      draft = result.draft;
      history = result.history;
      seen.push(...result.events.map((e) => e.type));
    }
    expect(seen.length).toBeGreaterThan(0);
  }, 120_000);

  it("notepad: Jisu's memo yields records with the Rejuran line", async () => {
    const { mode, data } = await importNotepad({ text: JISU_MEMO, locale: "ko", today: "2026-11-12" });
    note("[notepad]", mode, `records=${data.records.length} passes=${data.passes.length} appointments=${data.appointments.length} questions=${data.questions.length}`);
    note("[notepad rejuran]", JSON.stringify(data.records.filter((r) => r.procedureId === "rejuran_healer").slice(0, 3)));
    expect(mode).toBe("live");
    expect(data.records.some((r) => r.procedureId === "rejuran_healer" && r.date === "2026-09-11")).toBe(true);
  }, 400_000);

  it("situation: Grace's English situation becomes filter fields", async () => {
    const { mode, data } = await situationToFilter({ text: GRACE_SITUATIONS.en, locale: "en" });
    note("[situation]", mode, JSON.stringify(data));
    expect(mode).toBe("live");
    expect(data.languages).toEqual(["en"]);
  }, 90_000);

  it("proposer: the Ara burst becomes an exclude_clinic draft", async () => {
    const result = await proposeRules(DEMO_ARA_PROPOSER_INPUT);
    note("[proposer]", result.mode, JSON.stringify(result.accepted), "rejected:", JSON.stringify(result.rejected));
    expect(result.mode).toBe("live");
    expect(result.accepted.some((r) => r.then.kind === "exclude_clinic" && r.then.clinicIds.includes("cln_ara"))).toBe(true);
  }, 120_000);

  it("reports the trace: which purposes ran live and whether strict was refused", () => {
    for (const call of recentLlmCalls()) note("[trace]", JSON.stringify(call));
    expect(recentLlmCalls().every((c) => c.mode === "live")).toBe(true);
  });
});
