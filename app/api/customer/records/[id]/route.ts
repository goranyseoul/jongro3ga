import { deleteRecord, updateRecord } from "@/lib/agents/customer/records";
import { customerContext, errorResponse, notFound, readJson } from "../../_lib/context";
import { RecordPatchSchema } from "../../_lib/schemas";

export const dynamic = "force-dynamic";

/** Continue / pause / stop, rating, note and corrections of a record. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const patch = await readJson(request, RecordPatchSchema);
    const record = await updateRecord(ctx.store, ctx.profile.id, id, patch);
    return record ? Response.json({ record }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    return (await deleteRecord(ctx.store, ctx.profile.id, id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
