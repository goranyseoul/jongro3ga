import { consentsOf, latestConsents, setConsent } from "@/lib/agents/customer/consent";
import { customerContext, errorResponse, readJson } from "../_lib/context";
import { ConsentPatchSchema } from "../_lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const entries = await consentsOf(ctx.store, ctx.profile.id);
    return Response.json({ consents: [...latestConsents(entries).values()], history: entries });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Switches an optional consent; the change is appended to the ledger as a new entry. */
export async function PATCH(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = await readJson(request, ConsentPatchSchema);
    return Response.json({ consent: await setConsent(ctx.store, ctx.profile.id, body.type, body.granted) });
  } catch (error) {
    return errorResponse(error);
  }
}
