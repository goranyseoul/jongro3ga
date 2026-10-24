import { describe, expect, it } from "vitest";
import { SKILL_IDS } from "./schemas";
import { SUMMARY_OUTCOMES, humanSummary } from "./summary";

const LOCALES = ["ja", "zh-CN", "en", "ko"] as const;
// Ranking words between clinics (same list as the T06 fairness copy test, 10-build-plan.md).
const BANNED = ["より良い", "better than", "보다 낫", "比较好", "更好"];

describe("humanSummary", () => {
  it("has a line in all four languages for every skill and outcome", () => {
    expect(SKILL_IDS).toHaveLength(15);
    for (const skillId of SKILL_IDS) {
      for (const outcome of [...SUMMARY_OUTCOMES, undefined]) {
        const line = humanSummary(skillId, outcome);
        for (const locale of LOCALES) {
          expect(line[locale], `${skillId} ${String(outcome)} ${locale}`).toEqual(expect.any(String));
          expect(line[locale]!.trim().length, `${skillId} ${String(outcome)} ${locale}`).toBeGreaterThan(1);
          for (const piece of line[locale]!.split(" · ")) expect(piece.trim(), `${skillId} ${String(outcome)} ${locale}`).not.toBe("");
        }
      }
    }
  });

  it("never ranks clinics", () => {
    for (const skillId of [...SKILL_IDS, undefined, "unknown.skill"]) {
      for (const outcome of SUMMARY_OUTCOMES) {
        const line = humanSummary(skillId, outcome);
        for (const locale of LOCALES) for (const word of BANNED) expect(line[locale]).not.toContain(word);
      }
    }
  });

  it("says what finished, per skill", () => {
    expect(humanSummary("platform.match_clinics", "TASK_STATE_COMPLETED").ko).toBe("조건에 맞는 병원을 찾았어요");
    expect(humanSummary("clinic.quote", "TASK_STATE_COMPLETED").ja).toBe("見積もりを受け取りました");
    const done = new Set(SKILL_IDS.map((id) => humanSummary(id, "TASK_STATE_COMPLETED").en));
    expect(done.size).toBe(15);
  });

  it("uses the 03 state copy where it applies", () => {
    expect(humanSummary("clinic.book", "TASK_STATE_WORKING").ko).toBe("예약 · 병원에서 확인하고 있어요");
    expect(humanSummary("clinic.quote", "TASK_STATE_REJECTED").ko).toBe("견적 · 이 병원은 요청을 받을 수 없어요");
    expect(humanSummary("platform.match_clinics", "TASK_STATE_REJECTED").ko).toBe("병원 찾기 · 요청을 받을 수 없다는 답이 왔어요");
    expect(humanSummary("clinic.quote", "no_response").ko).toBe("견적 · 응답이 없었어요");
  });

  it("names the counterpart first and falls back for unknown skills", () => {
    expect(humanSummary("clinic.quote", "TASK_STATE_COMPLETED", { counterpart: { ko: "민트피부과의원", en: "Mint Dermatology Clinic" } })).toMatchObject({
      ko: "민트피부과의원 · 견적을 받았어요",
      en: "Mint Dermatology Clinic · Received a quote",
      ja: "Mint Dermatology Clinic · 見積もりを受け取りました",
    });
    expect(humanSummary(undefined, "rpc_error").en).toBe("Request · the request could not be processed");
    expect(humanSummary("nope", "TASK_STATE_COMPLETED").ko).toBe("요청 · 완료됐어요");
  });
});
