import { z } from "zod";
import { platformTypicalAmount } from "@/lib/agents/platform/recipe";
import { draftProcedureRequest, IntentProfileSchema, type IntentProfile } from "@/lib/llm/intent";
import { getSessionUser } from "@/lib/auth/session";
import { loadOnboardingSession, placeholderIdentity } from "@/lib/llm/onboarding/engine";
import { formatZodError } from "@/lib/llm/tools";

// POST /api/intent (02-agents.md section 1 "요청 정리").
// Body { utterance, profile?, sessionId?, locale? }: `profile` is a CustomerProfile (06) or the onboarding
// draft; without it the finished onboarding session `sessionId` is used. Returns the draft
// pibu/procedure-request@1, the required fields still missing, the defaults applied and a summary line.

const BodySchema = z.strictObject({
  utterance: z.string().trim().min(1).max(500),
  profile: IntentProfileSchema.optional(),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  locale: z.enum(["ja", "zh-CN", "en", "ko"]).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: formatZodError(parsed.error) }, { status: 400 });

  let profile: IntentProfile | undefined = parsed.data.profile;
  if (!profile && parsed.data.sessionId) {
    const session = await loadOnboardingSession(parsed.data.sessionId);
    if (session) {
      const user = await getSessionUser(request.headers);
      const agentId = user?.customerAgentId ?? placeholderIdentity(session.id).agentId;
      profile = IntentProfileSchema.parse({ ...session.draft, agentId });
    }
  }

  try {
    const result = await draftProcedureRequest({
      utterance: parsed.data.utterance,
      profile: profile ?? {},
      locale: parsed.data.locale,
      // the BFF may call the platform module directly; agents go through A2A platform.recipe
      typicalAmount: (procedureId) => platformTypicalAmount(procedureId),
    });
    return Response.json(result);
  } catch (error) {
    console.error("[intent] draft failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "intent draft failed" }, { status: 500 });
  }
}
