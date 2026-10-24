import { markRead } from "@/lib/agents/customer/inbox";
import { customerContext, errorResponse, notFound } from "../../_lib/context";

export const dynamic = "force-dynamic";

/** Marks an inbox item as read (check-ins stay open until answered). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const item = await markRead(ctx.store, ctx.profile.id, id);
    return item ? Response.json({ item }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
