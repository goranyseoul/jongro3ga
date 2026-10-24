import { describe, expect, it } from "vitest";
import raw from "../../data/seed/procedures.json";
import { ProcedureSchema, type ProcedureArea } from "./procedure";
import { getProcedure, procedureMaster } from "./procedure-master";

const parse = (value: unknown) => ProcedureSchema.safeParse(value);
const sample = () => structuredClone(raw[0]) as Record<string, any>;

describe("procedure master seed", () => {
  it("has the 27 procedures of the table, unique ids, none medically verified yet", () => {
    expect(procedureMaster).toHaveLength(27);
    expect(new Set(procedureMaster.map((p) => p.id)).size).toBe(27);
    expect(procedureMaster.every((p) => p.verified === false)).toBe(true);
    expect(procedureMaster.every((p) => typeof p.name.ko === "string" && p.name.ko.length > 0)).toBe(true);
  });

  it("looks procedures up by id", () => {
    expect(getProcedure("rejuran_healer")?.name.ko).toBe("리쥬란");
    expect(getProcedure("nope")).toBeUndefined();
  });

  it("keeps the scenario facts: Rejuran series, once a year lifting, Juvelook Volume avoids the under eye", () => {
    const rejuran = getProcedure("rejuran_healer")!;
    expect(rejuran.cycle).toEqual({ initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } });
    expect(rejuran.name).toMatchObject({ ja: "リジュラン", "zh-CN": "丽珠兰" });
    for (const id of ["ulthera", "thermage_flx"]) {
      expect(getProcedure(id)!.cycle.maintenanceIntervalDays).toEqual({ min: 300, max: 400 });
    }
    const volume = getProcedure("juvelook_volume")!;
    expect(volume.avoidParts).toEqual([{ part: "under_eye", reason: "결절 위험" }]);
    expect(volume.recommendedParts).toEqual(["nasolabial"]);
    expect(getProcedure("lituo")).toMatchObject({ unit: null, downtimeDays: null, priceKrw: null, pain: "high" });
  });

  describe("every normalized value agrees with the original cell it came from", () => {
    // Independent readers of the verbatim `source` cells, not the generator's maps.
    const AREA_WORDS: Record<string, ProcedureArea> = {
      리프팅: "lifting", 피부결: "texture_renewal", 재생: "texture_renewal", 볼륨: "volume", 주름: "wrinkles",
      윤곽: "contouring", 색소: "pigment_tone", 모공: "pores_oil", 흉터: "acne_scars", 여드름: "acne_scars",
      홍조: "redness", 혈관: "redness", 수분: "hydration_glow", 광채: "hydration_glow",
    };

    it("areas", () => {
      for (const p of procedureMaster) {
        const expected = new Set(Object.entries(AREA_WORDS).filter(([word]) => p.source.area.includes(word)).map(([, area]) => area));
        expect(new Set(p.areas), p.id).toEqual(expected);
      }
    });

    it("price range", () => {
      for (const p of procedureMaster) {
        if (p.source.price === "[확인]") {
          expect(p.priceKrw, p.id).toBeNull();
          continue;
        }
        const ranges = [...p.source.price.matchAll(/(\d+)~(\d+)만/g)].map((m) => [Number(m[1]) * 10000, Number(m[2]) * 10000]);
        const used = p.id === "laser_toning" ? ranges.slice(0, 1) : ranges;
        expect(p.priceKrw?.min, p.id).toBe(Math.min(...used.map((r) => r[0]!)));
        expect(p.priceKrw?.max, p.id).toBe(Math.max(...used.map((r) => r[1]!)));
      }
    });

    it("downtime days where the cell has numbers", () => {
      for (const p of procedureMaster) {
        const cell = p.source.downtime;
        if (cell === "[확인]") expect(p.downtimeDays, p.id).toBeNull();
        else if (cell === "거의 없음" || cell === "없음") expect(p.downtimeDays, p.id).toEqual({ min: 0, max: 0 });
        else if (/수일/.test(cell)) {
          // "수일" has no number: read as 2~5 days, and "0~수일" as 0~5
          expect(p.downtimeDays?.max, p.id).toBe(5);
          expect(p.downtimeDays?.min, p.id).toBe(cell.startsWith("0~") ? 0 : 2);
        } else {
          const range = cell.match(/(\d+)~(\d+)일/);
          const single = cell.match(/(?:약\s*)?(\d+)일/);
          const week = /약 1주/.test(cell);
          const [min, max] = range ? [Number(range[1]), Number(range[2])] : week ? [7, 7] : [Number(single![1]), Number(single![1])];
          expect(p.downtimeDays, p.id).toEqual({ min, max });
        }
      }
    });

    it("cycle source follows the star, unit follows the cell, pain never falls below the stated range", () => {
      const units: Record<string, string | null> = {
        샷: "shot", 회: "session", 줄: "line", cc: "cc", 바이알: "vial", "[확인]": null, 유닛: "unit", "유닛·cc": "unit",
      };
      const rank = { low: 0, mid: 1, high: 2 } as const;
      for (const p of procedureMaster) {
        expect(p.cycleSource, p.id).toBe(p.source.cycle.startsWith("★") ? "founder" : "general");
        expect(p.unit, p.id).toBe(units[p.source.unit]);
        const stated = p.source.pain.includes("높음") ? 2 : p.source.pain.includes("중") ? 1 : 0;
        expect(p.pain === null ? -1 : rank[p.pain], p.id).toBe(stated);
      }
    });

    it("series counts and intervals follow the cell, counts at the top of a range and intervals at the bottom", () => {
      for (const p of procedureMaster) {
        const cell = p.source.cycle;
        const series = cell.match(/(\d+)(?:~(\d+))?주 간격(?: (\d+)(?:~(\d+))?회| 여러 회| 10회 내외)?/);
        if (!p.cycle.initial || !series) continue;
        expect(p.cycle.initial.intervalDays, p.id).toBe(Number(series[1]) * 7);
      }
      expect(getProcedure("laser_toning")!.cycle.initial).toEqual({ count: 10, intervalDays: 7 });
      expect(getProcedure("ipl")!.cycle.initial).toEqual({ count: 5, intervalDays: 21 });
      expect(getProcedure("sculptra")!.cycle.initial).toEqual({ count: 3, intervalDays: 28 });
    });
  });
});

describe("ProcedureSchema", () => {
  it("accepts a seed entry as is", () => {
    expect(parse(sample()).success).toBe(true);
  });

  it("rejects broken entries", () => {
    const withPatch = (patch: Record<string, unknown>) => parse({ ...sample(), ...patch }).success;
    expect(withPatch({ id: "Bad Id" })).toBe(false);
    expect(withPatch({ areas: [] })).toBe(false);
    expect(withPatch({ areas: ["face"] })).toBe(false);
    expect(withPatch({ downtimeDays: { min: 5, max: 2 } })).toBe(false);
    expect(withPatch({ priceKrw: { min: 9, max: 1, basis: null } })).toBe(false);
    expect(withPatch({ pain: "extreme" })).toBe(false);
    expect(withPatch({ unknown: 1 })).toBe(false);
    expect(withPatch({ bodyParts: ["nasolabial"], recommendedParts: ["eyes"] })).toBe(false);
    expect(withPatch({ bodyParts: ["eyes"], avoidParts: [{ part: "eyes", reason: "x" }] })).toBe(false);
    const { source: _source, ...withoutSource } = sample();
    expect(parse(withoutSource).success).toBe(false);
  });
});
