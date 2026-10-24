// AgentDefinition for the platform agent. OWNER: track A2A core (+ OPS proposer, LLM recipe register their skills here). Stub so app/a2a routes compile before the track lands.
import type { AgentDefinition } from "@/lib/a2a/contract";

export const platformAgent: AgentDefinition = {
  role: "platform",
  async card() {
    throw new Error("platform agent card not implemented yet");
  },
  async exists() {
    return false;
  },
  skills: {},
};
