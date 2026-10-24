import type { Area, ClinicRegistryEntry } from "../domain";
import type { SkillId } from "./schemas";

// Agent Cards in the wire JSON shape of docs/spec/03-a2a-protocol.md "Agent Card 예시". The three builders
// return exactly the fields of the three examples there, with URLs from PUBLIC_BASE_URL. The SDK needs its
// own internal AgentCard type: convert with `AgentCard.fromJSON(card)` from "@a2a-js/sdk" (lib/a2a/server.ts).

export const EXT = {
  clinicOperation: "https://pibu.app/ext/clinic-operation/v1",
  referral: "https://pibu.app/ext/referral/v1",
  consent: "https://pibu.app/ext/consent/v1",
  zkOfferProof: "https://pibu.app/ext/zk-offer-proof/v1",
} as const;

export interface AgentInterfaceJson {
  url: string;
  protocolBinding: "JSONRPC";
  protocolVersion: "1.0";
}

export interface AgentExtensionJson {
  uri: string;
  description: string;
  required: boolean;
  params?: Record<string, unknown>;
}

export interface AgentSkillJson {
  id: SkillId;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentCardJson {
  name: string;
  description: string;
  supportedInterfaces: AgentInterfaceJson[];
  provider: { organization: string; url: string };
  version: string;
  documentationUrl?: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    extendedAgentCard?: boolean;
    extensions?: AgentExtensionJson[];
  };
  securitySchemes: Record<string, { httpAuthSecurityScheme: { scheme: string; bearerFormat: string; description?: string } }>;
  securityRequirements: Array<{ schemes: Record<string, { list: string[] }> }>;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkillJson[];
}

export type ClinicCardInput = Pick<
  ClinicRegistryEntry,
  "id" | "slug" | "name" | "area" | "operationMode" | "dataSources" | "lastVerifiedAt" | "foreignPatientFacilityRegistered"
>;

// ---- URLs (03 "바인딩과 엔드포인트" table) ----

const DEFAULT_BASE_URL = "http://localhost:3000";

/** PUBLIC_BASE_URL without a trailing slash. */
export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export const agentUrls = {
  platform: () => ({
    card: `${publicBaseUrl()}/a2a/platform/agent-card.json`,
    rpc: `${publicBaseUrl()}/a2a/platform/rpc`,
    jwks: `${publicBaseUrl()}/a2a/platform/jwks.json`,
  }),
  clinic: (slug: string) => ({
    card: `${publicBaseUrl()}/a2a/clinics/${slug}/agent-card.json`,
    rpc: `${publicBaseUrl()}/a2a/clinics/${slug}/rpc`,
  }),
  customer: (agentId: string) => ({
    card: `${publicBaseUrl()}/a2a/customers/${agentId}/agent-card.json`,
    rpc: `${publicBaseUrl()}/a2a/customers/${agentId}/rpc`,
  }),
};

// ---- shared parts ----

const VERSION = "0.1.0";
const DOCUMENTATION_URL = "https://github.com/goranyseoul/jongro3ga/blob/main/docs/spec/03-a2a-protocol.md";
const DEFAULT_ZK_CHAIN_ID = 84532;
const DEFAULT_ZK_REGISTRY = "0xcf47152e720508bf8c757a55aa30956ca8b58857";
const MODES = ["application/json", "text/plain"];

const jsonrpc = (url: string): AgentInterfaceJson[] => [{ url, protocolBinding: "JSONRPC", protocolVersion: "1.0" }];

const bearer = (description?: string): AgentCardJson["securitySchemes"] => ({
  pibuBearer: {
    httpAuthSecurityScheme: { scheme: "bearer", bearerFormat: "JWT", ...(description === undefined ? {} : { description }) },
  },
});

const bearerRequired = (): AgentCardJson["securityRequirements"] => [{ schemes: { pibuBearer: { list: [] } } }];

function zkParams(): { chainId: number; registry: string } {
  const chainId = Number(process.env.ZK_CHAIN_ID);
  return {
    chainId: Number.isInteger(chainId) && chainId > 0 ? chainId : DEFAULT_ZK_CHAIN_ID,
    registry: process.env.ZK_REGISTRY_ADDRESS || DEFAULT_ZK_REGISTRY,
  };
}

const AREA_EN: Record<Area, string> = {
  gangnam: "Gangnam",
  sinsa: "Sinsa",
  apgujeong: "Apgujeong",
  myeongdong: "Myeongdong",
  hongdae: "Hongdae",
  other: "Seoul",
};

// ---- platform ----

export function platformCard(): AgentCardJson {
  const base = publicBaseUrl();
  return {
    name: "Pibu Platform Agent",
    description:
      "Matches K-beauty clinic requests with clinics using real paid-price records, judges whether a quoted price and dose are fair, and collects post-procedure outcomes.",
    supportedInterfaces: jsonrpc(agentUrls.platform().rpc),
    provider: { organization: "Pibu", url: base },
    version: VERSION,
    documentationUrl: DOCUMENTATION_URL,
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: bearer("Agent token issued by Pibu"),
    securityRequirements: bearerRequired(),
    defaultInputModes: [...MODES],
    defaultOutputModes: [...MODES],
    skills: [
      {
        id: "platform.recipe",
        name: "Korean women procedure recipe",
        description:
          "Returns which procedures Korean women with the same concern and age band actually chose, typical dose, cycle, downtime and onset, from recorded data.",
        tags: ["recipe", "procedure", "data"],
        examples: ['{"schema":"pibu/recipe-query@1","concerns":["elasticity"],"ageBand":"25-29"}'],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "platform.match_clinics",
        name: "Match clinics",
        description: "Ranks up to three clinics for a procedure request and issues a signed referral token per clinic.",
        tags: ["matching", "clinic", "referral"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "platform.judge_quote",
        name: "Judge quote fairness",
        description: "Judges each quote's unit price and dose against recent verified paid records in the same region.",
        tags: ["price", "fairness", "dose"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "platform.report_booking",
        name: "Report booking",
        description: "Clinic agents report confirmed bookings with the referral token for attribution.",
        tags: ["booking", "attribution"],
        inputModes: ["application/json"],
        outputModes: ["text/plain"],
      },
      {
        id: "platform.report_signal",
        name: "Report signal",
        description: "Customer agents report clinic response timeouts and rejections observed while requesting quotes.",
        tags: ["signal", "reliability"],
        inputModes: ["application/json"],
        outputModes: ["text/plain"],
      },
      {
        id: "platform.submit_outcome",
        name: "Submit outcome",
        description: "Customer agents submit paid price, received dose and satisfaction after a procedure.",
        tags: ["review", "outcome"],
        inputModes: ["application/json"],
        outputModes: ["text/plain"],
      },
      {
        id: "platform.anchor_record",
        name: "Anchor record",
        description:
          "Verifies that a completed booking belongs to the calling customer agent, then submits the customer wallet's append proof to the record registry as relayer and issues one visit ticket.",
        tags: ["zk", "record", "anchor"],
        inputModes: ["application/json"],
        outputModes: ["text/plain"],
      },
      {
        id: "platform.submit_review",
        name: "Submit verified review",
        description:
          "Accepts one anonymous review per verified visit using a Semaphore proof and adds it to the clinic and procedure aggregate. No public feed.",
        tags: ["zk", "review", "aggregate"],
        inputModes: ["application/json"],
        outputModes: ["text/plain"],
      },
    ],
  };
}

// ---- clinic ----

/** Display name in English, falling back to Korean, then the id. */
export function clinicDisplayName(input: Pick<ClinicCardInput, "id" | "name">): string {
  return input.name.en || input.name.ko || input.id;
}

export function clinicCard(input: ClinicCardInput): AgentCardJson {
  const name = clinicDisplayName(input);
  return {
    name: `${name} Agent`,
    description: `Answers prices, doses, monthly offers and available times for ${name} (${AREA_EN[input.area]}), and accepts booking requests referred by Pibu.`,
    supportedInterfaces: jsonrpc(agentUrls.clinic(input.slug).rpc),
    provider: {
      // 03 "대행 운영 → 인수": the organization switches to the clinic itself once the clinic takes over.
      organization: input.operationMode === "proxy" ? `Pibu (operating on behalf of ${name})` : name,
      url: publicBaseUrl(),
    },
    version: VERSION,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        {
          uri: EXT.clinicOperation,
          description: "Operation mode and data provenance of this clinic agent",
          required: false,
          params: {
            mode: input.operationMode,
            dataSources: [...input.dataSources],
            lastVerifiedAt: input.lastVerifiedAt,
            foreignPatientFacilityRegistered: input.foreignPatientFacilityRegistered,
          },
        },
        {
          uri: EXT.referral,
          description: "quote and book requests must carry a Pibu referral token in metadata.referralToken",
          required: false,
        },
        {
          uri: EXT.zkOfferProof,
          description:
            "Offer proofs travel in metadata.offerProof of clinic.quote; the clinic verifies them against the on-chain chart hash",
          required: false,
          params: zkParams(),
        },
      ],
    },
    securitySchemes: bearer(),
    securityRequirements: bearerRequired(),
    defaultInputModes: [...MODES],
    defaultOutputModes: [...MODES],
    skills: [
      { id: "clinic.offers", name: "Monthly offers", description: "Lists this month's offers and regular menu prices.", tags: ["price", "event"] },
      {
        id: "clinic.quote",
        name: "Quote",
        description: "Quotes total price, unit price, dose, product, inclusions and slots for a procedure request.",
        tags: ["price", "quote"],
      },
      { id: "clinic.availability", name: "Availability", description: "Returns open slots for a procedure in a date range.", tags: ["schedule"] },
      {
        id: "clinic.book",
        name: "Book",
        description:
          "Requests a booking. Proxy-operated clinics confirm after a human check, so the task stays working until confirmed.",
        tags: ["booking"],
      },
      { id: "clinic.cancel", name: "Cancel booking", description: "Cancels a booking made through Pibu.", tags: ["booking"] },
    ],
  };
}

// ---- customer ----

export function customerCard(agentId: string): AgentCardJson {
  return {
    name: `Pibu Customer Agent ${agentId}`,
    description:
      "Personal agent acting on behalf of one Pibu customer. Receives booking updates and outcome check-ins.",
    supportedInterfaces: jsonrpc(agentUrls.customer(agentId).rpc),
    provider: { organization: "Pibu (hosting on behalf of the customer)", url: publicBaseUrl() },
    version: VERSION,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        { uri: EXT.consent, description: "Personal fields carry metadata.consentRef", required: false },
        {
          uri: EXT.zkOfferProof,
          description: "The wallet attaches offer proofs to clinic.quote messages",
          required: false,
          params: zkParams(),
        },
      ],
    },
    securitySchemes: bearer(),
    securityRequirements: bearerRequired(),
    defaultInputModes: [...MODES],
    defaultOutputModes: [...MODES],
    skills: [
      {
        id: "customer.notify",
        name: "Receive notification",
        description: "Receives booking confirmations, changes, reminders and notices from clinics and the platform.",
        tags: ["notification"],
      },
      {
        id: "customer.checkin",
        name: "Outcome check-in",
        description: "Answers platform follow-up questions about a past procedure, asking the customer when needed.",
        tags: ["outcome", "review"],
      },
    ],
  };
}

/** The JSON-RPC URL a client should call: the JSONRPC 1.0 interface of the card (09 "A2A 클라이언트"). */
export function jsonRpcUrlOf(card: Pick<AgentCardJson, "supportedInterfaces">): string | undefined {
  return card.supportedInterfaces.find((i) => i.protocolBinding === "JSONRPC" && i.protocolVersion === "1.0")?.url;
}

export function cardSkillIds(card: Pick<AgentCardJson, "skills">): SkillId[] {
  return card.skills.map((skill) => skill.id);
}
