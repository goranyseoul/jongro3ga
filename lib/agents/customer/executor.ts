import type { AgentExecutor } from "@a2a-js/sdk/server";
import { notImplementedExecutor } from "../../a2a/stub-executor";

// Customer agent executor, one per customer agent, served at /a2a/customers/{agentId}/rpc
// (app/a2a/customers/[agentId]/rpc/route.ts).
// T04 stub: every skill answers TASK_STATE_FAILED. WP6 (T08) replaces this file with the real skills.
export const customerExecutor = (agentId: string): AgentExecutor => {
  void agentId;
  return notImplementedExecutor();
};
