import { describe, expect, it } from "vitest";
import { scanText } from "../scripts/check-tokens.mjs";

// Positive controls: the violation fixtures are assembled from code points so this test file
// itself stays free of the characters the scanner forbids.
const EM = String.fromCodePoint(0x2014);
const EN = String.fromCodePoint(0x2013);
const EMOJI = String.fromCodePoint(0x1f600);
const STAR = String.fromCodePoint(0x2b50);

const cases: { rule: string; text: string }[] = [
  { rule: "hex-color", text: 'const c = "#ff00aa";' },
  { rule: "hex-color", text: "color: #fff;" },
  { rule: "arbitrary-px", text: '<div className="w-[37px]" />' },
  { rule: "default-palette", text: '<div className="bg-pink-500" />' },
  { rule: "default-palette", text: '<p className="text-slate-700" />' },
  { rule: "default-palette", text: '<p className="border-emerald-400" />' },
  { rule: "default-black-white", text: '<p className="bg-white" />' },
  { rule: "emoji", text: `label ${EMOJI}` },
  { rule: "emoji", text: `rating ${STAR}` },
  { rule: "em-dash", text: `a ${EM} b` },
  { rule: "en-dash", text: `11/13 ${EN} 11/15` },
];

describe("check-tokens scanner", () => {
  for (const c of cases) {
    it(`catches ${c.rule}: ${JSON.stringify(c.text)}`, () => {
      const v = scanText(c.text);
      expect(v.map((x) => x.rule)).toContain(c.rule);
    });
  }

  it("allows hex in the token definition file only", () => {
    expect(scanText("--bg: #fafafa;", { isTokenFile: true })).toEqual([]);
    expect(scanText("--bg: #fafafa;").length).toBe(1);
  });

  it("still catches em dash and emoji inside the token file", () => {
    expect(scanText(`/* a ${EM} b */`, { isTokenFile: true }).map((x) => x.rule)).toEqual(["em-dash"]);
  });

  it("passes clean token-based markup", () => {
    const clean = '<div className="bg-elev text-muted p-sp-4 rounded-card min-h-touch md:p-sp-6">KRW 340,000 ~ 400,000</div>';
    expect(scanText(clean)).toEqual([]);
  });
});
