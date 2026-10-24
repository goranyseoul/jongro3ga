import { describe, expect, it } from "vitest";
import type { Locale } from "../domain/common";
import { consultReply, detectScenario } from "./consult";
import { SCENARIO_OPENERS } from "./fixtures/consult";
import { ONBOARDING_LINES } from "./fixtures/onboarding-lines";
import { findMedicalViolations, hasStyleViolation, mentionsSensitiveTopic, sanitizeText } from "./guard";
import { MEDICAL_BOUNDARY_BLOCK } from "./prompts/medical-boundary";
import { buildOnboardingSystemPrompt } from "./prompts/onboarding-customer";
import { buildIntentSystemPrompt } from "./prompts/intent";
import { buildConsultSystemPrompt } from "./consult";
import { emptyDraft } from "./onboarding/slots";

// 08-compliance.md section 6: fixed model output samples are checked for forbidden patterns. Every fixture a
// customer can see is a sample here.

const LOCALES: Locale[] = ["ja", "ko", "en", "zh-CN"];

function onboardingSamples(locale: Locale): string[] {
  const L = ONBOARDING_LINES[locale];
  return Object.values(L).flatMap((value) => {
    if (typeof value === "string") return [value];
    if (typeof value === "function") return [String((value as (a: string, b: string) => string)("2026-11-08", "2026-11-10"))];
    return Object.values(value as Record<string, string>);
  });
}

const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe("medical boundary on fixture outputs", () => {
  it.each(LOCALES)("onboarding lines in %s have no diagnosis, recommendation, contraindication or guarantee", (locale) => {
    for (const text of onboardingSamples(locale)) {
      expect(findMedicalViolations(text), text).toEqual([]);
      expect(hasStyleViolation(text), text).toBe(false);
    }
  });

  it.each(LOCALES)("scenario openers in %s cite data and leave the decision to the doctor", (locale) => {
    for (const [scenario, byLocale] of Object.entries(SCENARIO_OPENERS)) {
      const text = byLocale[locale];
      expect(findMedicalViolations(text), `${scenario}.${locale}`).toEqual([]);
      expect(hasStyleViolation(text), `${scenario}.${locale}`).toBe(false);
    }
  });

  it("only the safety question and the declined-consent notice talk about health topics", () => {
    for (const locale of LOCALES) {
      const L = ONBOARDING_LINES[locale];
      const early = [L.greeting, L.consent, L.nickname, L.nationality("x"), L.residency, L.ageBand, L.trip, L.stayArea];
      for (const text of early) expect(mentionsSensitiveTopic(text), text).toBe(false);
    }
  });

  it("every customer facing prompt includes the shared medical boundary block", () => {
    const state = {
      locale: "ja" as const,
      today: "2026-10-24",
      draft: emptyDraft(),
      skipped: [],
      summaryShown: false,
      summaryConfirmed: false,
      finished: false,
      nextSlot: "locale" as const,
      missing: [],
      input: { kind: "start" as const },
    };
    for (const prompt of [buildOnboardingSystemPrompt(state), buildIntentSystemPrompt("2026-10-24"), buildConsultSystemPrompt("en")]) {
      expect(prompt).toContain(MEDICAL_BOUNDARY_BLOCK);
      expect(DASH.test(prompt)).toBe(false);
    }
  });
});

describe("the guard itself", () => {
  it.each([
    ["recommendation", "리쥬란 받으세요."],
    ["recommendation", "팔자에 특히 잘 맞아요."],
    ["recommendation", "リジュランを受けてください。"],
    ["recommendation", "You should get Rejuran."],
    ["recommendation", "我建议你做丽珠兰。".replace("我建议你做", "建议你做")],
    ["diagnosis", "これは肝斑です。"],
    ["diagnosis", "You have melasma."],
    ["contraindication", "임신 중이니 안 돼요."],
    ["contraindication", "If you are pregnant you can't get it."],
    ["guarantee", "주름이 없어져요."],
    ["guarantee", "Your wrinkles will disappear."],
    ["guarantee", "保证效果。"],
  ])("catches %s: %s", (kind, text) => {
    expect(findMedicalViolations(text).map((v) => v.kind)).toContain(kind);
  });

  it("allows data citations and doctor-decides wording", () => {
    for (const text of [
      "같은 고민의 한국 20대 후반 여성 기록에서 가장 많이 받은 조합이에요.",
      "시술 가능 여부는 의사가 판단해요.",
      "Among Korean women in their late 20s, Rejuran was chosen most often.",
    ]) {
      expect(findMedicalViolations(text)).toEqual([]);
    }
  });

  it("strips emoji and em or en dashes", () => {
    const dashed = `Hello ${String.fromCharCode(0x2014)} world ${String.fromCodePoint(0x1f60a)}`;
    expect(sanitizeText(dashed)).toBe("Hello, world");
    expect(hasStyleViolation(dashed)).toBe(true);
  });
});

describe("DEMO.md scenario openers", () => {
  it.each([
    ["yuki", "저 일본에 사는 유키, 29살이에요. 피부과는 한 번도 안 가봤는데 요즘 늙어 보여요. 한국 언니들은 뭐 해요?"],
    ["yuki", "日本に住むゆき、29歳です。最近老けて見えます。韓国のお姉さんたちは何をしていますか？"],
    ["grace", "I'm 48 and my jawline and skin are getting saggy. I can only visit Seoul once a year."],
    ["lin", "皮肤粗糙，弹性下降。朋友说丽珠兰好。我3月、7月、11月去韩国。"],
    ["lin", "피부결이 거칠고 탄력이 떨어져요. 한국은 3월, 7월, 11월에 가요."],
    ["jisu", "피부 리포트\n\n쥬베룩 볼륨\n11/2 2cc 플래져"],
  ])("detects %s", (scenario, utterance) => {
    expect(detectScenario(utterance)).toBe(scenario);
  });

  it("answers with the opener fixture in the customer's language without a key", async () => {
    const reply = await consultReply({ utterance: "日本に住むゆき、29歳です。最近老けて見えます。韓国のお姉さんたちは何をしていますか？", locale: "ja" });
    expect(reply).toEqual({ text: SCENARIO_OPENERS.yuki.ja, scenario: "yuki", source: "fixture" });
    const generic = await consultReply({ utterance: "hello", locale: "ko" });
    expect(generic.text).toBe(SCENARIO_OPENERS.generic.ko);
  });
});
