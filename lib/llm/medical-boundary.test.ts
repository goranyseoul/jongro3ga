import { describe, expect, it } from "vitest";
import type { Locale } from "../domain/common";
import {
  DEMO_ARA_PROPOSER_INPUT,
  INTENT_FOLLOW_UPS,
  JISU_NOTEPAD_IMPORT,
  allOnboardingFixtureTexts,
  conciergeFixture,
  demoConciergeInput,
  templateRuleDrafts,
} from "./fixtures";
import type { ProposerInput, TriggerKind } from "./prompts/proposer";

// 08-compliance.md 6절 회귀 테스트: no fixture output (the answers the demo shows without a key) diagnoses,
// judges contraindications, recommends a procedure, promises an effect or ranks clinics. The patterns are
// written out by hand on purpose, so a change to the fixtures cannot quietly change what is checked.

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  // ko
  { pattern: /받으세요/, why: "ko recommendation" },
  { pattern: /진단/, why: "ko diagnosis" },
  { pattern: /없어져요/, why: "ko effect promise" },
  { pattern: /안 돼요/, why: "ko contraindication judgment" },
  { pattern: /보다 낫/, why: "ko clinic ranking" },
  // ja
  { pattern: /受けてください/, why: "ja recommendation" },
  { pattern: /診断/, why: "ja diagnosis" },
  { pattern: /なくなります/, why: "ja effect promise" },
  { pattern: /より良い/, why: "ja clinic ranking" },
  // zh-CN
  { pattern: /建议您做/, why: "zh-CN recommendation" },
  { pattern: /诊断/, why: "zh-CN diagnosis" },
  { pattern: /消失/, why: "zh-CN effect promise" },
  // en
  { pattern: /you should get/i, why: "en recommendation" },
  { pattern: /diagnos/i, why: "en diagnosis" },
  { pattern: /will disappear/i, why: "en effect promise" },
  { pattern: /better than/i, why: "en clinic ranking" },
];

function violations(texts: readonly string[]): string[] {
  return texts.flatMap((text) => FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ why }) => `${why}: ${text}`));
}

const LOCALES: Locale[] = ["ja", "en", "zh-CN", "ko"];
const TRIGGERS: TriggerKind[] = ["quote_gap", "low_satisfaction", "response_timeout", "area_preference", "side_effect"];

/** Every customer or operator facing string the fixture router can produce. */
function fixtureOutputs(): string[] {
  const proposer: ProposerInput = {
    ...DEMO_ARA_PROPOSER_INPUT,
    candidates: TRIGGERS.map((trigger) => ({ ...DEMO_ARA_PROPOSER_INPUT.candidates[0]!, trigger })),
  };
  return [
    ...allOnboardingFixtureTexts(),
    ...LOCALES.map((locale) => conciergeFixture(demoConciergeInput(locale))),
    ...INTENT_FOLLOW_UPS,
    ...JISU_NOTEPAD_IMPORT.questions.map((question) => question.text),
    ...JISU_NOTEPAD_IMPORT.records.flatMap((record) => (record.note ? [record.note] : [])),
    ...templateRuleDrafts(proposer).flatMap((draft) => [draft.reason, draft.evidence.summary]),
  ];
}

describe("medical boundary of the fixture outputs (08 6절)", () => {
  const outputs = fixtureOutputs();

  it("covers all four customer languages", () => {
    expect(outputs.filter((text) => /[぀-ヿ]/.test(text)).length).toBeGreaterThan(15); // ja kana
    expect(outputs.filter((text) => /[가-힣]/.test(text)).length).toBeGreaterThan(15); // ko
    expect(outputs.filter((text) => /[一-鿿]/.test(text) && !/[぀-ヿ가-힣]/.test(text)).length).toBeGreaterThan(15); // zh-CN
    expect(outputs.filter((text) => /^[\x20-\x7e]+$/.test(text)).length).toBeGreaterThan(15); // en
  });

  it("contains no forbidden pattern", () => {
    expect(violations(outputs)).toEqual([]);
  });

  it("states that the doctor decides, never the agent (08 6절 적응증 행)", () => {
    expect(outputs.some((text) => text.includes("医師が判断します"))).toBe(true);
    expect(outputs.some((text) => text.includes("의사가 판단해요"))).toBe(true);
  });

  it("keeps the platform's order in the quote summary and ranks nothing", () => {
    const ja = conciergeFixture(demoConciergeInput("ja"));
    expect(ja.indexOf("ソウルグロウ")).toBeLessThan(ja.indexOf("ミント"));
    expect(ja.indexOf("ミント")).toBeLessThan(ja.indexOf("アラ"));
    expect(ja).toContain("量が少なめ");
    expect(ja).toContain("見積もりより支払額が高かった記録があります");
  });

  it("catches each forbidden pattern in a fake fixture (positive control)", () => {
    const fakes = [
      "그 증상이면 리쥬란 받으세요.",
      "사진으로 진단해 보면 기미예요.",
      "주름이 없어져요.",
      "임신 중이니 안 돼요.",
      "A의원이 B의원보다 낫습니다.",
      "リジュランを受けてください。",
      "肌を診断します。",
      "しわがなくなります。",
      "ミントよりアラの方がより良いです。",
      "建议您做丽珠兰。",
      "我来诊断一下。",
      "皱纹会消失。",
      "You should get Rejuran.",
      "Let me diagnose your skin.",
      "Your wrinkles will disappear.",
      "Mint is better than Ara.",
    ];
    expect(fakes).toHaveLength(FORBIDDEN.length);
    fakes.forEach((fake, index) => {
      expect(violations([fake]), fake).toEqual([`${FORBIDDEN[index]!.why}: ${fake}`]);
    });
    expect(violations([...outputs, fakes[0]!])).toHaveLength(1);
  });
});
