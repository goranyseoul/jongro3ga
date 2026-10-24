import { z } from "zod";
import { detectProcedure } from "@/lib/ui-data/customer";
import { customerContext, errorResponse, readJson } from "../_lib/context";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ message: z.string().min(1).max(2000), locale: z.string().optional() });

interface IntentDraft {
  procedureId: string;
  amount?: { value: number; unit: string };
  budgetKrw?: number;
  areas?: string[];
  languages?: string[];
  dateWindow?: { from: string; to: string };
}

/** Finds a procedure-request-like object in the LLM track's /api/intent response, whatever its wrapper. */
function intentDraft(body: unknown): IntentDraft | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const toolInput = Array.isArray(record.toolCalls)
    ? (record.toolCalls as { name?: string; input?: unknown }[]).find((call) => call.name === "draft_procedure_request")?.input
    : undefined;
  for (const candidate of [record.request, record.draft, record.procedureRequest, record.condition, record.data, toolInput, record]) {
    if (!candidate || typeof candidate !== "object") continue;
    const c = candidate as Record<string, unknown>;
    if (typeof c.procedureId !== "string" || !c.procedureId) continue;
    const budget = c.budgetKrw as { max?: number } | number | undefined;
    return {
      procedureId: c.procedureId,
      ...(c.amount && typeof c.amount === "object" ? { amount: c.amount as IntentDraft["amount"] } : {}),
      ...(typeof budget === "number" ? { budgetKrw: budget } : budget?.max ? { budgetKrw: budget.max } : {}),
      ...(Array.isArray(c.areas) ? { areas: c.areas as string[] } : {}),
      ...(Array.isArray(c.languages) && c.languages.length > 0 ? { languages: c.languages as string[] } : {}),
      ...(c.dateWindow && typeof c.dateWindow === "object" ? { dateWindow: c.dateWindow as IntentDraft["dateWindow"] } : {}),
    };
  }
  return null;
}

/**
 * The customer's sentence as a condition draft. Asks the LLM track's POST /api/intent (Claude, fixtures without a
 * key) on the same origin; when it is missing or answers without a procedure, the procedure name is matched
 * locally so the demo keeps running. The defaults and the usual amount are filled later by the agent.
 */
export async function POST(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = await readJson(request, BodySchema);
    try {
      const response = await fetch(`${ctx.baseUrl}/api/intent`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
        body: JSON.stringify({ message: body.message, text: body.message, locale: body.locale ?? ctx.profile.locale }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const draft = intentDraft(await response.json());
        if (draft) return Response.json({ draft, source: "intent" });
      }
    } catch {
      // intent endpoint not available: local match below
    }
    const procedure = detectProcedure(body.message);
    return Response.json({ draft: procedure ? { procedureId: procedure.id } : null, source: "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
