import { addRecord, listRecords, upcomingDue } from "@/lib/agents/customer/records";
import { clock } from "@/lib/clock";
import { customerContext, errorResponse, readJson } from "../_lib/context";
import { RecordInputSchema } from "../_lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const records = await listRecords(ctx.store, ctx.profile.id);
    return Response.json({ records, due: upcomingDue(records), today: clock.today() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** 3 second record. Session number and next due date are computed by the agent (06 schedule rules). */
export async function POST(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const input = await readJson(request, RecordInputSchema);
    return Response.json({ record: await addRecord(ctx.store, ctx.profile.id, input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
