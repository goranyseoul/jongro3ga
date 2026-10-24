import type { AgentCard } from "@/components/ui";

// Customer Agent Card preview and the slot label types the screen copy uses. The onboarding script that
// used to live here is now POST /api/onboarding/customer (lib/llm/onboarding); slot rules are in
// lib/llm/onboarding/slots.ts.

export type {
  Channel,
  ConsentType,
  NationalityOption,
  Residency,
} from "@/lib/llm/onboarding/slots";
export type { AgeBand, Area, Concern } from "@/lib/domain/common";

/** Label keys of the onboarding checklist rows (one per slot, plus the landing intent). */
export type SlotKey =
  | "locale"
  | "consents"
  | "nickname"
  | "nationality"
  | "residency"
  | "ageBand"
  | "trip"
  | "stayArea"
  | "concerns"
  | "history"
  | "pregnant"
  | "budget"
  | "downtime"
  | "languages"
  | "channel"
  | "handle"
  | "firstIntent";

export const MOCK_AGENT_ID = "cag_7f3k2";

// Customer Agent Card in the shape of the 03-a2a-protocol.md example. Wire text stays English.
export function buildAgentCard(active: boolean, agentId: string = MOCK_AGENT_ID): AgentCard {
  const base = "https://pibu.example";
  return {
    name: `PibooK Customer Agent ${agentId}`,
    description: "Personal agent acting on behalf of one PibooK customer. Receives booking updates and outcome check-ins.",
    version: active ? "0.1.0" : "0.0.0-draft",
    provider: { organization: "PibooK (hosting on behalf of the customer)", url: base },
    supportedInterfaces: active
      ? [{ url: `${base}/a2a/customers/${agentId}/rpc`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }]
      : [],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        { uri: "https://pibu.app/ext/consent/v1", description: "Personal fields carry metadata.consentRef", required: false },
      ],
    },
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
