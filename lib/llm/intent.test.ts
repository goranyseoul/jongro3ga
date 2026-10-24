import { describe, expect, it, vi } from "vitest";
import { ProcedureRequestForPlatformSchema } from "../a2a/schemas";
import { seedTypicalAmount } from "../agents/platform/recipe";
import { findMedicalViolations } from "./guard";
import * as llm from "./index";
import { areaGroup, draftProcedureRequest, type IntentProfile } from "./intent";
import { findProcedureId } from "./procedure-names";

vi.mock("./index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./index")>();
  return { ...actual, runClaude: vi.fn(actual.runClaude) };
});

// Yuki after onboarding (DEMO.md scenario 1 dates moved +28 days, BUILD-LOG #13), staying in Sinsa.
const YUKI: IntentProfile = {
  agentId: "cag_7f3k2",
  locale: "ja",
  nationality: "JP",
  residency: "short_term_visitor",
  ageBand: "25-29",
  trip: { arrival: "2026-11-08", departure: "2026-11-10", stayArea: "sinsa" },
  skin: { concerns: ["elasticity"] },
  prefs: { budgetKrw: { max: 450000 }, languagesNeeded: ["ja"] },
  history: { none: true },
};

// The recipe module stands in for the A2A platform.recipe call (typical amount from the seed).
const typicalAmount = async (procedureId: string) => seedTypicalAmount(procedureId);

describe("intent: one utterance to a draft pibu/procedure-request@1", () => {
  it("applies every default from 02 section 1 for Yuki's 'リジュラン受けたい'", async () => {
    const result = await draftProcedureRequest({ utterance: "リジュラン受けたい", profile: YUKI, typicalAmount, requestId: "req_yuki01", today: "2026-10-24" });
    expect(result.missing).toEqual([]);
    expect(result.eligible).toBe(true);
    expect(result.request).toEqual({
      schema: "pibu/procedure-request@1",
      requestId: "req_yuki01",
      customerAgentId: "cag_7f3k2",
      procedureId: "rejuran",
      amount: { value: 2, unit: "cc" },
      budgetKrw: { max: 450000 },
      areas: ["sinsa", "gangnam", "apgujeong"],
      languages: ["ja"],
      dateWindow: { from: "2026-11-08", to: "2026-11-10" },
      visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
    });
    expect(ProcedureRequestForPlatformSchema.safeParse(result.request).success).toBe(true);
    expect(result.defaultsApplied.map((d) => d.source).sort()).toEqual(
      ["prefs.budgetKrw", "prefs.languagesNeeded", "recipe_typical_min", "stay_area_group", "trip"].sort(),
    );
    expect(result.text).toBe("リジュラン 2cc・45万ウォン以下・新沙/江南/狎鴎亭・日本語・11月8日~11月10日で探しますか？");
  });

  it("reads the Korean spelling '리주란 받고 싶어' the same way", async () => {
    const result = await draftProcedureRequest({ utterance: "리주란 받고 싶어", profile: { ...YUKI, locale: "ko" }, typicalAmount, today: "2026-10-24" });
    expect(result.draft.procedureId).toBe("rejuran");
    expect(result.draft.amount).toEqual({ value: 2, unit: "cc" });
    expect(result.request?.requestId).toMatch(/^req_[a-f0-9]{12}$/);
    expect(result.text).toContain("리쥬란 2cc");
  });

  it("keeps an amount the customer stated instead of the typical minimum", async () => {
    const result = await draftProcedureRequest({ utterance: "リジュラン3ccでお願いします", profile: YUKI, typicalAmount, today: "2026-10-24" });
    expect(result.draft.amount).toEqual({ value: 3, unit: "cc" });
    expect(result.defaultsApplied.map((d) => d.field)).not.toContain("amount");
  });

  it("returns which required slots are still missing", async () => {
    const result = await draftProcedureRequest({
      utterance: "I want something for my skin",
      profile: { agentId: "cag_abc", locale: "en", nationality: "US" },
      typicalAmount,
      today: "2026-10-24",
    });
    expect(result.request).toBeUndefined();
    expect(result.missing).toEqual(["procedureId", "dateWindow", "visitorProfile.residency", "visitorProfile.ageBand"]);
    expect(result.text).toBe("Which treatment would you like?");
  });

  it("marks KR nationals and residents as not eligible for matching (08 section 2)", async () => {
    const resident = await draftProcedureRequest({ utterance: "리쥬란", profile: { ...YUKI, residency: "resident" }, typicalAmount, locale: "ko", today: "2026-10-24" });
    expect(resident.eligible).toBe(false);
    expect(resident.text).toContain("병원 매칭과 예약을 도와드릴 수 없어요");
  });

  it("falls back to the fixture when the live tool input is invalid", async () => {
    vi.mocked(llm.runClaude).mockResolvedValueOnce({ text: "", toolCalls: [{ name: "draft_procedure_request", input: { procedureId: "rejuran_healer" } }] });
    const result = await draftProcedureRequest({ utterance: "リジュラン受けたい", profile: YUKI, typicalAmount, today: "2026-10-24" });
    expect(result.source).toBe("fixture");
    expect(result.draft.procedureId).toBe("rejuran");
  });

  it("has no medical advice wording in any summary line", async () => {
    for (const locale of ["ja", "ko", "en", "zh-CN"] as const) {
      const result = await draftProcedureRequest({ utterance: "rejuran", profile: { ...YUKI, locale }, typicalAmount, today: "2026-10-24" });
      expect(findMedicalViolations(result.text)).toEqual([]);
    }
  });

  it("expands the stay area to its area group", () => {
    expect(areaGroup("gangnam")).toEqual(["gangnam", "sinsa", "apgujeong"]);
    expect(areaGroup("hongdae")).toEqual(["hongdae"]);
    expect(areaGroup("other")).toBeUndefined();
  });

  it("recognizes procedure names in four languages, the most specific first", () => {
    expect(findProcedureId("쥬베룩 볼륨 맞고 싶어")).toBe("juvelook_volume");
    expect(findProcedureId("ジュベルック")).toBe("juvelook");
    expect(findProcedureId("我想打丽珠兰")).toBe("rejuran");
    expect(findProcedureId("Thermage once a year")).toBe("thermage");
    expect(findProcedureId("multiple questions")).toBeUndefined();
  });
});
