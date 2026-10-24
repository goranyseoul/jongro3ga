import { exportData } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

/** "내보내기": everything the customer agent holds about this customer, as a JSON download. */
export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const data = await exportData(ctx.store, ctx.profile.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pibu-export-${ctx.profile.agentId}.json"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
