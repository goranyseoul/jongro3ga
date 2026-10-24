import { describe, expect, it } from "vitest";
import { clinicCode, clinicIdByCode, procedureCode, procedureIdByCode } from "./codes";

describe("zk codes", () => {
  it("maps ids from zk/codes.json to circuit codes and back", () => {
    expect(procedureCode("rejuran_healer")).toBe(1);
    expect(procedureCode("skin_booster_juvelook")).toBe(6);
    expect(clinicCode("cln_seoul_glow")).toBe(1);
    expect(clinicCode("cln_hanbit")).toBe(3);
    expect(procedureIdByCode(3)).toBe("ulthera");
    expect(clinicIdByCode(2)).toBe("cln_mint");
  });

  it("round trips every code and never uses 0", () => {
    for (const id of ["rejuran_healer", "thermage_flx", "ulthera", "botox_forehead", "shrink_universe", "skin_booster_juvelook"]) {
      expect(procedureCode(id)).toBeGreaterThan(0);
      expect(procedureIdByCode(procedureCode(id))).toBe(id);
    }
    for (const id of ["cln_seoul_glow", "cln_mint", "cln_hanbit", "cln_ara", "cln_dahye"]) {
      expect(clinicIdByCode(clinicCode(id))).toBe(id);
    }
  });

  it("throws on unknown ids and codes, including prototype keys", () => {
    expect(() => procedureCode("nope")).toThrow(/unknown procedure/);
    expect(() => clinicCode("cln_nope")).toThrow(/unknown clinic/);
    expect(() => procedureCode("constructor")).toThrow();
    expect(() => procedureIdByCode(0)).toThrow();
    expect(() => clinicIdByCode(99)).toThrow();
  });
});
