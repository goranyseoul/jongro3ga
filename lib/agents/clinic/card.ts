// Agent Card per clinic (03-a2a-protocol.md "병원 에이전트 카드"). Proxy and clinic operation keep the same
// URL, skill ids and schemas; only provider, version and the clinic-operation params change on takeover.
import type { ClinicProfile } from "../../domain/clinic";
import type { ClinicOperation, StoredSlotPolicy } from "./store";

export const CLINIC_OPERATION_EXT = "https://pibu.app/ext/clinic-operation/v1";
export const REFERRAL_EXT = "https://pibu.app/ext/referral/v1";

const AREA_EN: Record<ClinicProfile["area"], string> = {
  gangnam: "Gangnam",
  sinsa: "Sinsa",
  apgujeong: "Apgujeong",
  myeongdong: "Myeongdong",
  hongdae: "Hongdae",
  other: "Seoul",
};

export function clinicDisplayNameEn(profile: ClinicProfile): string {
  return profile.name.en ?? profile.name.ko ?? profile.id;
}

export function buildClinicCard(input: {
  profile: ClinicProfile;
  operation: ClinicOperation;
  slotPolicy?: StoredSlotPolicy;
  /** Path segment the card was requested with (clinic id or slug), so the rpc URL is the reachable one. */
  pathSegment: string;
  baseUrl: string;
}): Record<string, unknown> {
  const { profile, operation, slotPolicy, pathSegment, baseUrl } = input;
  const name = clinicDisplayNameEn(profile);
  const proxy = operation.mode === "proxy";
  const bookDescription = proxy
    ? "Requests a booking. Proxy-operated clinics confirm after a human check, so the task stays working until confirmed."
    : slotPolicy?.autoConfirm
      ? "Requests a booking. Open slots are confirmed automatically."
      : "Requests a booking. The clinic confirms from its inbox, so the task stays working until confirmed.";

  return {
    name: `${name} Agent`,
    description: `Answers prices, doses, monthly offers and available times for ${name} (${AREA_EN[profile.area]}), and accepts booking requests referred by PibooK.`,
    supportedInterfaces: [
      { url: `${baseUrl}/a2a/clinics/${pathSegment}/rpc`, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
    ],
    provider: { organization: proxy ? `PibooK (operating on behalf of ${name})` : name, url: baseUrl },
    // Takeover bumps the minor version (03 "대행 운영 → 인수").
    version: proxy ? "0.1.0" : "0.2.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        {
          uri: CLINIC_OPERATION_EXT,
          description: "Operation mode and data provenance of this clinic agent",
          required: false,
          params: {
            mode: operation.mode,
            dataSources: operation.dataSources,
            lastVerifiedAt: operation.lastVerifiedAt,
            foreignPatientFacilityRegistered: operation.foreignPatientFacilityRegistered,
          },
        },
        {
          uri: REFERRAL_EXT,
          description: "quote and book requests must carry a PibooK referral token in metadata.referralToken",
          // false: offers, availability and cancel are called without a token (03 확장 표).
          required: false,
        },
      ],
    },
    securitySchemes: { pibuBearer: { httpAuthSecurityScheme: { scheme: "bearer", bearerFormat: "JWT" } } },
    securityRequirements: [{ schemes: { pibuBearer: { list: [] } } }],
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [
      { id: "clinic.offers", name: "Monthly offers", description: "Lists this month's offers and regular menu prices.", tags: ["price", "event"] },
      {
        id: "clinic.quote",
        name: "Quote",
        description: "Quotes total price, unit price, dose, product, inclusions and slots for a procedure request.",
        tags: ["price", "quote"],
      },
      { id: "clinic.availability", name: "Availability", description: "Returns open slots for a procedure in a date range.", tags: ["schedule"] },
      { id: "clinic.book", name: "Book", description: bookDescription, tags: ["booking"] },
      { id: "clinic.cancel", name: "Cancel booking", description: "Cancels a booking made through PibooK.", tags: ["booking"] },
    ],
  };
}
