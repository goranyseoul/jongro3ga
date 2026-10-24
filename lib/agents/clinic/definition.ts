// AgentDefinition for the clinic agent. OWNER: track CLINIC. Stub so app/a2a routes compile before the track lands.
import type { AgentDefinition } from "@/lib/a2a/contract";

export const clinicAgent: AgentDefinition = {
  role: "clinic",
  async card() {
    throw new Error("clinic agent card not implemented yet");
  },
  async exists() {
    return false;
  },
  skills: {},
};
