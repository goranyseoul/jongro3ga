import type { ClinicRegistryEntry } from "../../domain";
import { agentUrls } from "../cards";

// The five demo clinics of docs/spec/01-users-journeys.md, with the values lib/ui-data/ops.ts OPS_CLINICS uses.
// Built on call so `agentCardUrl` follows the PUBLIC_BASE_URL of the running test.
export function clinicFixtures(): ClinicRegistryEntry[] {
  const entry = (e: Omit<ClinicRegistryEntry, "agentCardUrl" | "verificationStatus" | "foreignPatientFacilityRegistered">) => ({
    ...e,
    agentCardUrl: agentUrls.clinic(e.slug).card,
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified" as const,
  });

  return [
    entry({
      id: "cln_seoul_glow",
      slug: "seoul-glow",
      name: { ko: "서울글로우의원", en: "Seoul Glow Clinic", ja: "ソウルグロウ医院", "zh-CN": "首尔Glow诊所" },
      area: "sinsa",
      operationMode: "clinic",
      dataSources: ["clinic_input"],
      lastVerifiedAt: "2026-11-05",
      languages: [
        { locale: "ja", mode: "staff" },
        { locale: "ko", mode: "staff" },
      ],
    }),
    entry({
      id: "cln_mint",
      slug: "mint",
      name: { ko: "민트피부과의원", en: "Mint Dermatology Clinic", ja: "ミント皮膚科", "zh-CN": "薄荷皮肤科" },
      area: "gangnam",
      operationMode: "proxy",
      dataSources: ["sms", "public_web"],
      lastVerifiedAt: "2026-10-20",
      languages: [
        { locale: "ja", mode: "interpreter" },
        { locale: "ko", mode: "staff" },
      ],
    }),
    entry({
      id: "cln_ara",
      slug: "ara",
      name: { ko: "아라의원", en: "Ara Clinic", ja: "アラ医院", "zh-CN": "阿拉诊所" },
      area: "apgujeong",
      operationMode: "proxy",
      dataSources: ["sms", "public_web"],
      lastVerifiedAt: "2026-10-09",
      languages: [
        { locale: "ja", mode: "interpreter" },
        { locale: "ko", mode: "staff" },
      ],
    }),
    entry({
      id: "cln_hanbit",
      slug: "hanbit",
      name: { ko: "한빛의원", en: "Hanbit Clinic", ja: "ハンビット医院", "zh-CN": "韩比特医院" },
      area: "myeongdong",
      operationMode: "proxy",
      dataSources: ["sms"],
      lastVerifiedAt: "2026-09-28",
      languages: [
        { locale: "zh-CN", mode: "staff" },
        { locale: "ko", mode: "staff" },
      ],
    }),
    entry({
      id: "cln_dahye",
      slug: "dahye",
      name: { ko: "다혜피부과의원", en: "Dahye Dermatology Clinic", ja: "ダヘ皮膚科", "zh-CN": "多惠皮肤科" },
      area: "hongdae",
      operationMode: "clinic",
      dataSources: ["clinic_input"],
      lastVerifiedAt: "2026-11-09",
      languages: [
        { locale: "en", mode: "staff" },
        { locale: "ko", mode: "staff" },
      ],
    }),
  ];
}
