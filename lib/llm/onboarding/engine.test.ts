import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "../../store/memory";
import { mentionsSensitiveTopic } from "../guard";
import * as llm from "../index";
import { parseToolInput } from "../tools";
import {
  runOnboardingTurn,
  widgetAction,
  type OnboardingEvent,
  type OnboardingRequest,
  type TurnDeps,
} from "./engine";
import { SENSITIVE_SLOTS, checkPatchRules, emptyDraft, missingRequired, type SlotId } from "./slots";
import { updateProfileTool } from "./tools";

vi.mock("../index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../index")>();
  return { ...actual, runClaude: vi.fn(actual.runClaude) };
});

const texts = (events: OnboardingEvent[]) => events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text);
const widget = (events: OnboardingEvent[]) => (events.find((e) => e.type === "widget") as { widget: { type: string; slot: string } } | undefined)?.widget;
const done = (events: OnboardingEvent[]) => events.find((e) => e.type === "done") as Extract<OnboardingEvent, { type: "done" }>;

const ALL_CONSENTS = { terms: true, privacy: true, sensitiveHealth: true, crossBorder: true, shareAnonymizedRecords: true };

function conversation(sessionId: string, locale: "ja" | "en" | "ko" | "zh-CN" = "ja") {
  const deps: TurnDeps = { store: createMemoryStore(), today: "2026-10-24", now: "2026-10-24T10:00:00+09:00" };
  const log: OnboardingEvent[][] = [];
  const send = async (body: Omit<OnboardingRequest, "sessionId">) => {
    const { events } = await runOnboardingTurn({ sessionId, locale, ...body }, deps);
    log.push(events);
    return events;
  };
  const pick = (slot: string, value: unknown, message = "") => send({ message, widgetValue: { slot, value } });
  return { send, pick, log, deps };
}

beforeEach(() => {
  vi.mocked(llm.runClaude).mockClear();
});

describe("Yuki's onboarding in Japanese with fixtures (04 example, DEMO.md dates)", () => {
  it("runs from the landing intent to a finished CustomerProfile", async () => {
    const c = conversation("yuki-session-0001");

    let events = await c.send({ message: "リジュラン受けたい" });
    expect(texts(events)).toEqual([
      "「リジュラン受けたい」ですね。お手伝いする前に、あなた専用のエージェントを作ります。3分ほどです。",
      "はじめまして、PibooKの担当エージェントです。日本語で進めてもいいですか？",
    ]);
    expect(widget(events)).toMatchObject({ type: "chips", slot: "locale" });

    events = await c.pick("locale", "ja", "日本語");
    expect(widget(events)).toMatchObject({ type: "consent", slot: "consents" });

    events = await c.pick("consents", ALL_CONSENTS);
    expect(texts(events)).toEqual(["ありがとうございます。何とお呼びすればいいですか？"]);
    expect(widget(events)).toBeUndefined();

    events = await c.send({ message: "ゆきです。29歳、東京から11月8日から10日まで行きます" });
    const patch = events.find((e) => e.type === "profile_patch") as Extract<OnboardingEvent, { type: "profile_patch" }>;
    expect(patch.patch).toEqual({
      nickname: "ゆき",
      nationality: "JP",
      ageBand: "25-29",
      trip: { arrival: "2026-11-08", departure: "2026-11-10" },
    });
    expect(texts(events)).toEqual(["11月8日から10日ですね。韓国で外国人登録（または居所申告）をして暮らしていますか？"]);
    expect(widget(events)).toMatchObject({ type: "chips", slot: "residency" });

    events = await c.pick("residency", "short_term_visitor");
    expect(widget(events)).toMatchObject({ slot: "trip.stayArea" });
    events = await c.pick("trip.stayArea", "sinsa");
    expect(widget(events)).toMatchObject({ type: "chips_multi", slot: "skin.concerns" });
    events = await c.pick("skin.concerns", ["elasticity"]);
    expect(widget(events)).toMatchObject({ slot: "history" });
    events = await c.pick("history", "none");
    expect(widget(events)).toMatchObject({ slot: "safety.pregnantOrBreastfeeding" });
    events = await c.pick("safety.pregnantOrBreastfeeding", false);
    expect(widget(events)).toMatchObject({ type: "currency", slot: "prefs.budgetKrw" });
    events = await c.pick("prefs.budgetKrw", { currency: "JPY", amount: 49000 });
    expect(widget(events)).toMatchObject({ type: "slider", slot: "prefs.downtimeToleranceDays" });
    events = await c.pick("prefs.downtimeToleranceDays", 3);
    expect(widget(events)).toMatchObject({ slot: "prefs.languagesNeeded" });
    events = await c.pick("prefs.languagesNeeded", ["ja"]);
    expect(widget(events)).toMatchObject({ slot: "contact.channel" });
    events = await c.pick("contact.channel", "line");
    expect(texts(events)).toEqual(["LINEのIDまたはアドレスを教えてください。"]);
    events = await c.send({ message: "yuki_tokyo" });
    expect(widget(events)).toMatchObject({ type: "summary", slot: "summary" });
    expect(done(events).missing).toEqual([]);

    events = await c.pick("summary", "confirm", "作成する");
    const finished = done(events);
    expect(finished.status).toBe("completed");
    expect(texts(events)).toEqual(["ゆきさんのエージェントができました。受けたい施術を教えてください。", "「リジュラン受けたい」の条件を整理する準備ができました。"]);
    expect(finished.profile).toMatchObject({
      locale: "ja",
      nickname: "ゆき",
      nationality: "JP",
      residency: "short_term_visitor",
      ageBand: "25-29",
      trip: { arrival: "2026-11-08", departure: "2026-11-10", stayArea: "sinsa" },
      skin: { concerns: ["elasticity"] },
      safety: { pregnantOrBreastfeeding: false, allergies: [] },
      prefs: { budgetKrw: { max: 450800 }, downtimeToleranceDays: 3, languagesNeeded: ["ja"] },
      contact: { channel: "line", handle: "yuki_tokyo" },
    });
    expect(finished.profile!.agentId).toMatch(/^cag_/);
    expect(finished.consents!.map((e) => [e.type, e.granted])).toContainEqual(["sensitiveHealth", true]);
    expect(finished.progress).toBe(100);
  });

  it("never asks or shows a health question before the sensitiveHealth consent", async () => {
    const c = conversation("yuki-session-0002");
    await c.send({ message: "" });
    await c.pick("locale", "ja");
    for (const events of c.log) {
      for (const text of texts(events)) expect(mentionsSensitiveTopic(text)).toBe(false);
      expect(SENSITIVE_SLOTS).not.toContain(widget(events)?.slot as SlotId);
    }
  });
});

describe("onboarding state machine", () => {
  it("skips skin, history and safety when sensitiveHealth is declined, and still finishes", async () => {
    const c = conversation("declined-0001", "en");
    await c.send({ message: "" });
    await c.pick("locale", "en");
    let events = await c.pick("consents", { ...ALL_CONSENTS, sensitiveHealth: false, shareAnonymizedRecords: false });
    expect(texts(events)[0]).toContain("won't ask about your skin");
    await c.send({ message: "I'm Grace, 48, from New York, Nov 17 to Nov 24" });
    await c.pick("residency", "short_term_visitor");
    const asked: string[] = [];
    for (const [slot, value] of [
      ["trip.stayArea", "gangnam"],
      ["prefs.budgetKrw", { currency: "USD", amount: 2000 }],
      ["prefs.downtimeToleranceDays", 0],
      ["prefs.languagesNeeded", ["en"]],
      ["contact.channel", "email"],
    ] as const) {
      events = await c.pick(slot, value);
      asked.push(widget(events)?.slot ?? "free_text");
    }
    expect(asked.some((slot) => SENSITIVE_SLOTS.includes(slot as SlotId))).toBe(false);
    events = await c.send({ message: "grace@example.com" });
    expect(widget(events)?.slot).toBe("summary");
    events = await c.pick("summary", "confirm");
    expect(done(events).status).toBe("completed");
    expect(done(events).profile!.safety).toBeUndefined();
    expect(done(events).profile!.skin.concerns).toEqual([]);
  });

  it("keeps asking for consent while a blocking consent is declined", async () => {
    const c = conversation("blocked-0001", "ko");
    await c.send({ message: "" });
    await c.pick("locale", "ko");
    const events = await c.pick("consents", { ...ALL_CONSENTS, crossBorder: false });
    expect(texts(events)[0]).toContain("국외 처리 동의");
    expect(widget(events)).toMatchObject({ type: "consent" });
  });

  it("residency=resident: says matching is unavailable and skips trip, area, budget and downtime", async () => {
    const c = conversation("resident-0001", "zh-CN");
    await c.send({ message: "" });
    await c.pick("locale", "zh-CN");
    await c.pick("consents", ALL_CONSENTS);
    await c.send({ message: "我叫小林" });
    await c.pick("nationality", "CN");
    let events = await c.pick("residency", "resident");
    expect(texts(events)[0]).toContain("无法为你匹配和预约诊所");
    expect(widget(events)).toMatchObject({ slot: "ageBand" });
    events = await c.pick("ageBand", "35-39");
    expect(widget(events)).toMatchObject({ slot: "skin.concerns" });
    const missing = done(events).missing;
    expect(missing).not.toContain("trip");
    events = await c.pick("skin.concerns", ["pores"]);
    events = await c.pick("history", "none");
    events = await c.pick("safety.pregnantOrBreastfeeding", "no");
    expect(widget(events)).toMatchObject({ slot: "prefs.languagesNeeded" });
  });

  it("does not ask KR nationals about residency", async () => {
    const c = conversation("korean-0001", "ko");
    await c.send({ message: "" });
    await c.pick("locale", "ko");
    await c.pick("consents", ALL_CONSENTS);
    await c.send({ message: "지수예요" });
    const events = await c.pick("nationality", "KR");
    expect(widget(events)).toMatchObject({ slot: "ageBand" });
    expect(done(events).missing).not.toContain("residency");
  });

  it("finish_onboarding is refused while required slots are missing; the model is told and asks again", async () => {
    const c = conversation("finish-early-1", "en");
    await c.send({ message: "" });
    await c.pick("locale", "en");
    await c.pick("consents", ALL_CONSENTS);
    vi.mocked(llm.runClaude).mockResolvedValueOnce({ text: "All set!", toolCalls: [{ name: "finish_onboarding", input: {} }] });
    const events = await c.send({ message: "just finish it" });
    expect(done(events).status).toBe("active");
    const retry = vi.mocked(llm.runClaude).mock.calls.at(-1)![0];
    expect(retry.system).toContain("required slots missing: nickname");
    expect(retry.messages.at(-1)!.content).toContain("[tool_error] finish_onboarding");
    expect(texts(events)).not.toContain("All set!");
  });

  it("rejects health data written before the consent and keeps the valid part of the patch", async () => {
    const c = conversation("early-health-1", "en");
    await c.send({ message: "" });
    await c.pick("locale", "en");
    vi.mocked(llm.runClaude).mockResolvedValueOnce({
      text: "Noted.",
      toolCalls: [
        { name: "update_profile", input: { patch: { nickname: "Emily" } } },
        { name: "update_profile", input: { patch: { safety: { pregnantOrBreastfeeding: false } } } },
      ],
    });
    const events = await c.send({ message: "I'm Emily and I'm not pregnant" });
    const draft = done(events).draft;
    expect(draft.nickname).toBe("Emily");
    expect(draft.safety.pregnantOrBreastfeeding).toBeUndefined();
    const retry = vi.mocked(llm.runClaude).mock.calls.at(-1)![0];
    expect(retry.system).toContain("sensitiveHealth consent first");
  });

  it("returns a tool error for an invalid update_profile input instead of storing it", async () => {
    const c = conversation("bad-input-0001", "en");
    await c.send({ message: "" });
    vi.mocked(llm.runClaude).mockResolvedValueOnce({
      text: "",
      toolCalls: [{ name: "update_profile", input: { patch: { ageBand: "29", nationality: "Japan" } } }],
    });
    const events = await c.send({ message: "29, Japan" });
    expect(done(events).draft.ageBand).toBeUndefined();
    const retry = vi.mocked(llm.runClaude).mock.calls.at(-1)![0];
    expect(retry.messages.at(-1)!.content).toMatch(/patch\.ageBand/);
    expect(retry.messages.at(-1)!.content).toMatch(/patch\.nationality/);
  });

  it("rejects an invalid widget value without calling the model", async () => {
    const c = conversation("bad-widget-001", "ja");
    await c.send({ message: "" });
    vi.mocked(llm.runClaude).mockClear();
    const events = await c.pick("ageBand", "29");
    expect(events.find((e) => e.type === "error")).toBeDefined();
    expect(vi.mocked(llm.runClaude)).not.toHaveBeenCalled();
  });
});

describe("tool input validation", () => {
  it("validates update_profile patches with the zod schema", () => {
    expect(parseToolInput(updateProfileTool, { patch: { nickname: "ゆき", ageBand: "25-29" } }).ok).toBe(true);
    const bad = parseToolInput(updateProfileTool, { patch: { consents: { terms: true } } });
    expect(bad.ok).toBe(false);
    const wrongDate = parseToolInput(updateProfileTool, { patch: { trip: { arrival: "11/8" } } });
    expect(wrongDate).toMatchObject({ ok: false });
    expect((wrongDate as { error: string }).error).toContain("patch.trip.arrival");
  });

  it("applies the business rules: past dates, reversed dates, residency for KR", () => {
    const draft = { ...emptyDraft(), nationality: "KR" };
    expect(checkPatchRules(draft, { residency: "resident" }, "2026-10-24")).toHaveLength(1);
    const jp = { ...emptyDraft(), nationality: "JP", residency: "short_term_visitor" as const };
    expect(checkPatchRules(jp, { trip: { arrival: "2026-10-01", departure: "2026-10-03" } }, "2026-10-24")[0]).toContain("in the past");
    expect(checkPatchRules(jp, { trip: { arrival: "2026-11-10", departure: "2026-11-08" } }, "2026-10-24")[0]).toContain("before");
  });

  it("maps widget values and refuses to skip a required slot", () => {
    expect(widgetAction({ slot: "nationality", value: "other" })).toMatchObject({ kind: "patch", patch: { nationality: "ZZ" } });
    expect(widgetAction({ slot: "nickname", skip: true })).toMatchObject({ kind: "invalid" });
    expect(widgetAction({ slot: "trip.stayArea", skip: true })).toEqual({ kind: "skip", slot: "trip.stayArea" });
    expect(missingRequired(emptyDraft())).toContain("consents");
  });
});
