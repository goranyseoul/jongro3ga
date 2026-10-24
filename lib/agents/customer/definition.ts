// AgentDefinition for the customer agent. OWNER: track CUSTOMER. Stub so app/a2a routes compile before the track lands.
import type { AgentDefinition } from "@/lib/a2a/contract";

export const customerAgent: AgentDefinition = {
  role: "customer",
  async card() {
    throw new Error("customer agent card not implemented yet");
  },
  async exists() {
    return false;
  },
  skills: {},
};
