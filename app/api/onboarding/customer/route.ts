import { getSessionUser } from "@/lib/auth/session";
import { OnboardingRequestSchema, runOnboardingTurn, type OnboardingEvent } from "@/lib/llm/onboarding/engine";
import { saveProfileToAccount, type ProfileSaveResult } from "@/lib/llm/onboarding/save-profile";
import { encodeSse, textChunks } from "@/lib/llm/sse";
import { formatZodError } from "@/lib/llm/tools";

// POST /api/onboarding/customer (04-onboarding-chat.md "대화 엔진").
// Request { sessionId, message, widgetValue?, locale? }. Response: SSE with `text` tokens ({ id, delta }),
// `profile_patch`, `widget`, `error` and a final `done` (with `profile` and `saved` once onboarding finished).

const TOKEN_DELAY_MS = 12;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = OnboardingRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: formatZodError(parsed.error) }, { status: 400 });

  // The landing opens this conversation for signed-out visitors, so an auth layer that cannot answer (for
  // example a production build started without BETTER_AUTH_SECRET, as the e2e run does) means "signed out",
  // not a failed turn.
  const user = await getSessionUser(request.headers).catch((error: unknown) => {
    console.warn("[onboarding] session lookup failed, continuing signed out:", error instanceof Error ? error.message : error);
    return null;
  });
  const identity = user ? { id: user.id, agentId: user.customerAgentId } : undefined;

  let events: OnboardingEvent[];
  try {
    ({ events } = await runOnboardingTurn(parsed.data, identity ? { identity } : {}));
  } catch (error) {
    console.error("[onboarding] turn failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "onboarding turn failed" }, { status: 500 });
  }

  let saved: ProfileSaveResult | undefined;
  const done = events.find((e): e is Extract<OnboardingEvent, { type: "done" }> => e.type === "done");
  if (done?.profile) saved = await saveProfileToAccount(done.profile, request);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(encodeSse(event, data)));
      for (const event of events) {
        if (event.type === "text") {
          for (const delta of textChunks(event.text)) {
            send("text", { id: event.id, delta });
            await sleep(TOKEN_DELAY_MS);
          }
        } else if (event.type === "done") {
          const { type, ...data } = event;
          send(type, saved ? { ...data, saved } : data);
        } else {
          const { type, ...data } = event;
          send(type, data);
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
