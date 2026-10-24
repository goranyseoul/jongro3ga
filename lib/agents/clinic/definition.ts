// AgentDefinition for the clinic agent. OWNER: track CLINIC.
// One agent per clinic; the A2A core routes /a2a/clinics/{id or slug}/... here.
import type { AgentDefinition } from "../../a2a/contract";
import { buildClinicCard } from "./card";
import { ensureClinicData } from "./seed";
import { clinicSkills } from "./skills";
import { clinicStore, operationOf, resolveClinic } from "./store";

export const clinicAgent: AgentDefinition = {
  role: "clinic",
  async card(agentId, baseUrl) {
    const db = clinicStore();
    await ensureClinicData(db.store);
    const profile = await resolveClinic(agentId, db);
    if (!profile) throw new Error(`unknown clinic: ${agentId}`);
    return buildClinicCard({
      profile,
      operation: await operationOf(profile, db),
      slotPolicy: await db.slotPolicy(profile.id),
      pathSegment: agentId,
      baseUrl: baseUrl.replace(/\/$/, ""),
    });
  },
  async exists(agentId) {
    const db = clinicStore();
    await ensureClinicData(db.store);
    return (await resolveClinic(agentId, db)) !== undefined;
  },
  skills: clinicSkills,
};
