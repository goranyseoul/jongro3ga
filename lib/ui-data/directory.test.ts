import { describe, expect, it } from "vitest";
import { procedureMaster } from "../domain/procedure-master";
import { DIRECTORY, clinicsForTopic, findProcedure } from "./directory";
import { DIRECTORY_PROFILES, clinicBySlug } from "./directory-profile";
import { COURSE_PROCEDURES, FEATURED_PROCEDURES } from "../../app/[locale]/landing-home-copy";

describe("mock clinic directory", () => {
  it("lists only procedures from the procedure master", () => {
    const ids = new Set(procedureMaster.map((p) => p.id));
    for (const clinic of DIRECTORY) for (const id of clinic.procedures) expect(ids.has(id), `${clinic.id}: ${id}`).toBe(true);
  });

  it("uses only master procedure ids on the landing rails", () => {
    const ids = new Set(procedureMaster.map((p) => p.id));
    for (const id of [...FEATURED_PROCEDURES, ...Object.values(COURSE_PROCEDURES).flat()]) expect(ids.has(id), id).toBe(true);
  });

  it("gives every clinic one profile with a unique slug that resolves back", () => {
    expect(DIRECTORY_PROFILES).toHaveLength(DIRECTORY.length);
    const slugs = DIRECTORY_PROFILES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const profile of DIRECTORY_PROFILES) expect(clinicBySlug(profile.slug)?.clinic.id).toBe(profile.id);
  });

  it("prices every offered procedure and verifies only the standards a clinic passes", () => {
    for (const clinic of DIRECTORY) {
      const profile = DIRECTORY_PROFILES.find((p) => p.id === clinic.id)!;
      expect(Object.keys(profile.priceFromKrw).sort()).toEqual([...clinic.procedures].sort());
      for (const price of Object.values(profile.priceFromKrw)) expect(price % 10000).toBe(0);
      expect(profile.verifications.map((v) => v.key).sort()).toEqual([...clinic.passes].sort());
      expect(clinic.procedures).toContain(profile.signature);
    }
  });

  it("ranks by standards passed, never by anything else", () => {
    const ranked = clinicsForTopic({ kind: "all" });
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]!.passes.length).toBeGreaterThanOrEqual(ranked[i]!.passes.length);
  });

  it("finds procedures typed in any language", () => {
    expect(findProcedure("リジュラン受けたい")?.id).toBe("rejuran_healer");
    expect(findProcedure("I want Ulthera")?.id).toBe("ulthera");
    expect(findProcedure("써마지 맞고 싶어")?.id).toBe("thermage_flx");
  });
});

describe("generated doctors", () => {
  it("never gives two doctors of one clinic the same name", () => {
    for (const profile of DIRECTORY_PROFILES) {
      const names = profile.doctors.map((d) => d.name.en);
      expect(new Set(names).size, profile.id).toBe(names.length);
    }
  });
});
