// AgentDefinition for the customer agent (02 section 1, 03 "고객 에이전트 카드"). OWNER: track CUSTOMER.
// The card and RPC require a bearer token; the A2A core enforces that before calling card() or a skill.
import type { AgentDefinition, SkillHandler } from "../../a2a/contract";
import type { CheckinRequestV1, InputRequestV1, NotificationV1 } from "../../a2a/schemas";
import { getStore } from "../../store";
import { profileByAgentId } from "./account";
import { storeCheckinRequest, storeNotification } from "./inbox";

export function customerCard(agentId: string, baseUrl: string): Record<string, unknown> {
  return {
    name: `PibooK Customer Agent ${agentId}`,
    description: "Personal agent acting on behalf of one PibooK customer. Receives booking updates and outcome check-ins.",
    supportedInterfaces: [{ url: `${baseUrl}/a2a/customers/${agentId}/rpc`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    provider: { organization: "PibooK (hosting on behalf of the customer)", url: baseUrl },
    version: "0.1.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [{ uri: "https://pibu.app/ext/consent/v1", description: "Personal fields carry metadata.consentRef", required: false }],
    },
    securitySchemes: { pibuBearer: { httpAuthSecurityScheme: { scheme: "bearer", bearerFormat: "JWT" } } },
    securityRequirements: [{ schemes: { pibuBearer: { list: [] } } }],
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
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

/** customer.notify: clinics and the platform leave a message in the customer's inbox (P0). */
export const notifySkill: SkillHandler = async (data, ctx) => {
  if (ctx.caller.role !== "clinic" && ctx.caller.role !== "platform") {
    return { state: "TASK_STATE_REJECTED", text: "Only clinic and platform agents can notify a customer." };
  }
  const profile = await profileByAgentId(getStore(), ctx.self.agentId);
  if (!profile) return { state: "TASK_STATE_REJECTED", text: "Unknown customer agent." };
  await storeNotification(getStore(), profile.id, data as unknown as NotificationV1, ctx.caller);
  return { state: "TASK_STATE_COMPLETED", text: "Notification received." };
};

/**
 * customer.checkin (P1): the platform asks a follow-up question. The task waits in INPUT_REQUIRED until the
 * customer answers in the app; the answer completes it with pibu/outcome@1 through the TaskCompleter.
 */
export const checkinSkill: SkillHandler = async (data, ctx) => {
  if (ctx.caller.role !== "platform") return { state: "TASK_STATE_REJECTED", text: "Only the platform agent can ask for a check-in." };
  const profile = await profileByAgentId(getStore(), ctx.self.agentId);
  if (!profile) return { state: "TASK_STATE_REJECTED", text: "Unknown customer agent." };
  const request = data as unknown as CheckinRequestV1;
  await storeCheckinRequest(getStore(), profile.id, request, ctx.caller, ctx.taskId);
  const inputRequest: InputRequestV1 = {
    schema: "pibu/input-request@1",
    fields: request.questions.map((question, i) => ({ key: `q${i + 1}`, label: { en: question }, sensitive: false })),
  };
  return { state: "TASK_STATE_INPUT_REQUIRED", text: "Waiting for the customer to answer in the app.", inputRequest };
};

export const customerAgent: AgentDefinition = {
  role: "customer",
  async card(agentId, baseUrl) {
    return customerCard(agentId, baseUrl);
  },
  async exists(agentId) {
    return Boolean(await profileByAgentId(getStore(), agentId));
  },
  skills: {
    "customer.notify": notifySkill,
    "customer.checkin": checkinSkill,
  },
};
