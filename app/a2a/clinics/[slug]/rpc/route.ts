import { clinicCard } from "../../../../../lib/a2a/cards";
import { resolveClinic } from "../../../../../lib/a2a/directory";
import { makeRpcRoute } from "../../../../../lib/a2a/server";
import { clinicExecutor } from "../../../../../lib/agents/clinic/executor";

// Clinic agent JSON-RPC endpoint, one per clinic in the platform registry (03 "바인딩과 엔드포인트").
export const dynamic = "force-dynamic";

export const POST = makeRpcRoute<{ slug: string }>({
  role: "clinic",
  agentKey: ({ slug }) => `clinic:${slug}`,
  agentId: async ({ slug }) => (await resolveClinic(slug))?.id,
  card: async ({ slug }) => {
    const clinic = await resolveClinic(slug);
    return clinic ? clinicCard(clinic) : undefined;
  },
  executor: async ({ slug }) => {
    const clinic = await resolveClinic(slug);
    if (!clinic) throw new Error(`clinic ${slug} disappeared from the registry`);
    return clinicExecutor(clinic);
  },
});
